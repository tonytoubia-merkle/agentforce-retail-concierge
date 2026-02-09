/**
 * JourneyBatchProcessor - Scheduled batch job that processes meaningful events
 * and creates Journey Approval records with AI-generated content.
 *
 * Runs nightly to:
 * 1. Query Meaningful_Event__c records pending review
 * 2. Invoke Campaign Creation Agent to generate brief + email content
 * 3. Call Firefly to generate personalized images
 * 4. Create Journey_Approval__c records for marketer review
 *
 * Schedule with: System.schedule('Nightly Journey Processor', '0 0 2 * * ?', new JourneyBatchProcessor());
 */
global class JourneyBatchProcessor implements Database.Batchable<SObject>, Database.AllowsCallouts, Schedulable {

    // ─── Schedulable Interface ────────────────────────────────────────

    global void execute(SchedulableContext sc) {
        // Start the batch job
        Database.executeBatch(new JourneyBatchProcessor(), 10);
    }

    // ─── Batchable Interface ──────────────────────────────────────────

    global Database.QueryLocator start(Database.BatchableContext bc) {
        // Query meaningful events that:
        // 1. Are pending review (not yet processed)
        // 2. Have a life-event type (most journey-worthy)
        // 3. Have an event date within the next 60 days (relevant for journey timing)
        return Database.getQueryLocator([
            SELECT Id, Customer_Id__c, Session_Id__c, Contact__c,
                   Event_Type__c, Description__c, Agent_Note__c,
                   Event_Date__c, Relative_Time_Text__c, Urgency__c,
                   Journey_Brief__c, Suggested_Firefly_Prompt__c, Suggested_Products__c,
                   Approval_Status__c, Captured_At__c
            FROM Meaningful_Event__c
            WHERE Approval_Status__c = 'Pending Review'
              AND Event_Type__c = 'life-event'
              AND (Event_Date__c = NULL OR Event_Date__c >= TODAY)
              AND (Event_Date__c = NULL OR Event_Date__c <= NEXT_N_DAYS:60)
            ORDER BY Event_Date__c ASC NULLS LAST, Captured_At__c DESC
            LIMIT 100
        ]);
    }

    global void execute(Database.BatchableContext bc, List<Meaningful_Event__c> events) {
        List<Journey_Approval__c> approvalsToInsert = new List<Journey_Approval__c>();
        List<Meaningful_Event__c> eventsToUpdate = new List<Meaningful_Event__c>();

        // Get an active portfolio to assign new approvals to
        // Uses round-robin by selecting portfolio with fewest pending approvals
        Id assignedPortfolioId = getPortfolioForAssignment();

        for (Meaningful_Event__c event : events) {
            try {
                // Create the journey approval record
                Journey_Approval__c approval = processEvent(event);

                if (approval != null) {
                    // Assign to a portfolio so it appears in marketer inbox
                    approval.Assigned_Portfolio__c = assignedPortfolioId;

                    approvalsToInsert.add(approval);

                    // Mark the event as processed
                    event.Approval_Status__c = 'Approval Created';
                    eventsToUpdate.add(event);
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR, 'Failed to process event ' + event.Id + ': ' + e.getMessage());
                // Continue processing other events
            }
        }

        // Insert approvals
        if (!approvalsToInsert.isEmpty()) {
            insert approvalsToInsert;
        }

        // Update events
        if (!eventsToUpdate.isEmpty()) {
            update eventsToUpdate;
        }

        System.debug('JourneyBatchProcessor: Created ' + approvalsToInsert.size() + ' approvals');
    }

    global void finish(Database.BatchableContext bc) {
        // Send notification to marketing team
        sendNotificationEmail();
    }

    // ─── Event Processing ─────────────────────────────────────────────

    /**
     * Process a single meaningful event and create a Journey Approval record.
     */
    private Journey_Approval__c processEvent(Meaningful_Event__c event) {
        Journey_Approval__c approval = new Journey_Approval__c();

        // Link to source records
        approval.Meaningful_Event__c = event.Id;

        // Use Contact__c lookup if set, otherwise try Customer_Id__c (text field)
        if (event.Contact__c != null) {
            approval.Contact__c = event.Contact__c;
        } else if (String.isNotBlank(event.Customer_Id__c)) {
            try {
                approval.Contact__c = Id.valueOf(event.Customer_Id__c);
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Could not parse Customer_Id__c as Contact Id: ' + event.Customer_Id__c);
            }
        }

        // Copy event details
        approval.Event_Type__c = event.Event_Type__c;
        approval.Event_Date__c = event.Event_Date__c;
        approval.Urgency__c = event.Urgency__c;
        approval.Status__c = 'Pending';

        // Build event summary (sanitized for marketer view)
        approval.Event_Summary__c = buildEventSummary(event);

        // Generate content using Campaign Creation Agent
        try {
            CampaignAgentService.BriefGenerationRequest agentReq = new CampaignAgentService.BriefGenerationRequest();
            agentReq.eventType = event.Event_Type__c;
            agentReq.eventDescription = event.Description__c;
            agentReq.eventDate = event.Event_Date__c;
            agentReq.suggestedProducts = event.Suggested_Products__c;
            agentReq.additionalContext = event.Agent_Note__c;

            // Get contact name if available
            if (event.Contact__c != null) {
                try {
                    Contact c = [SELECT FirstName, LastName FROM Contact WHERE Id = :event.Contact__c LIMIT 1];
                    agentReq.contactName = c.FirstName;
                } catch (Exception e) {
                    // Contact query failed, continue without name
                }
            }

            List<CampaignAgentService.BriefGenerationResult> agentResults =
                CampaignAgentService.generateBriefs(new List<CampaignAgentService.BriefGenerationRequest>{agentReq});

            if (!agentResults.isEmpty() && agentResults[0].success) {
                CampaignAgentService.BriefGenerationResult agentResult = agentResults[0];
                approval.Suggested_Subject__c = agentResult.suggestedSubject;
                approval.Suggested_Body__c = agentResult.suggestedBody;

                // Store the Firefly prompt suggestion (marketer will click button to generate image)
                if (String.isNotBlank(agentResult.fireflyPromptSuggestion)) {
                    approval.Firefly_Prompt__c = agentResult.fireflyPromptSuggestion;
                } else if (String.isNotBlank(event.Suggested_Firefly_Prompt__c)) {
                    approval.Firefly_Prompt__c = event.Suggested_Firefly_Prompt__c;
                } else {
                    approval.Firefly_Prompt__c = buildDefaultFireflyPrompt(event);
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Campaign Agent failed, using fallback: ' + e.getMessage());
            // Use fallback content generation
            approval.Suggested_Subject__c = buildFallbackSubject(event);
            approval.Suggested_Body__c = buildFallbackBody(event);
            approval.Firefly_Prompt__c = buildDefaultFireflyPrompt(event);
        }

        // NOTE: Image generation is NOT automatic - marketer clicks "Generate Image" button
        // The Firefly_Prompt__c is pre-populated so they can review/edit before generating

        return approval;
    }

    /**
     * Get a portfolio to assign new approvals to.
     * Uses simple load balancing: selects the active portfolio with fewest pending approvals.
     * Falls back to first active portfolio if aggregation fails.
     */
    private Id getPortfolioForAssignment() {
        try {
            // Get active portfolios with their pending approval counts
            List<AggregateResult> portfolioCounts = [
                SELECT Assigned_Portfolio__c portfolioId, COUNT(Id) pendingCount
                FROM Journey_Approval__c
                WHERE Status__c = 'Pending'
                  AND Assigned_Portfolio__c != null
                GROUP BY Assigned_Portfolio__c
            ];

            // Build a map of portfolio -> pending count
            Map<Id, Integer> countByPortfolio = new Map<Id, Integer>();
            for (AggregateResult ar : portfolioCounts) {
                countByPortfolio.put((Id)ar.get('portfolioId'), (Integer)ar.get('pendingCount'));
            }

            // Get all active portfolios
            List<Marketer_Portfolio__c> activePortfolios = [
                SELECT Id, Name
                FROM Marketer_Portfolio__c
                WHERE Is_Active__c = true
                ORDER BY Name
            ];

            if (activePortfolios.isEmpty()) {
                System.debug(LoggingLevel.WARN, 'No active portfolios found for assignment');
                return null;
            }

            // Find portfolio with lowest workload (or zero if no pending approvals)
            Id bestPortfolio = activePortfolios[0].Id;
            Integer lowestCount = countByPortfolio.get(bestPortfolio);
            if (lowestCount == null) lowestCount = 0;

            for (Marketer_Portfolio__c portfolio : activePortfolios) {
                Integer count = countByPortfolio.get(portfolio.Id);
                if (count == null) {
                    // This portfolio has zero pending - best choice
                    bestPortfolio = portfolio.Id;
                    break;
                } else if (count < lowestCount) {
                    lowestCount = count;
                    bestPortfolio = portfolio.Id;
                }
            }

            System.debug('Assigning new approvals to portfolio: ' + bestPortfolio);
            return bestPortfolio;

        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Portfolio assignment failed: ' + e.getMessage());
            // Fallback: just get the first active portfolio
            List<Marketer_Portfolio__c> fallback = [
                SELECT Id FROM Marketer_Portfolio__c WHERE Is_Active__c = true LIMIT 1
            ];
            return fallback.isEmpty() ? null : fallback[0].Id;
        }
    }

    // ─── Content Building Helpers ─────────────────────────────────────

    /**
     * Build a sanitized event summary for marketer review.
     * Excludes raw transcript and sensitive PII.
     */
    private String buildEventSummary(Meaningful_Event__c event) {
        String summary = '';

        summary += 'EVENT TYPE: ' + event.Event_Type__c + '\n';
        summary += 'DESCRIPTION: ' + event.Description__c + '\n';

        if (event.Event_Date__c != null) {
            summary += 'EVENT DATE: ' + event.Event_Date__c.format() + '\n';
            Integer daysUntil = Date.today().daysBetween(event.Event_Date__c);
            summary += 'DAYS UNTIL: ' + daysUntil + '\n';
        }

        if (String.isNotBlank(event.Relative_Time_Text__c)) {
            summary += 'MENTIONED AS: "' + event.Relative_Time_Text__c + '"\n';
        }

        if (String.isNotBlank(event.Urgency__c)) {
            summary += 'URGENCY: ' + event.Urgency__c + '\n';
        }

        if (String.isNotBlank(event.Agent_Note__c)) {
            summary += '\nAGENT INSIGHT: ' + event.Agent_Note__c + '\n';
        }

        if (String.isNotBlank(event.Suggested_Products__c)) {
            summary += '\nSUGGESTED PRODUCTS: ' + event.Suggested_Products__c + '\n';
        }

        summary += '\nCAPTURED: ' + event.Captured_At__c.format() + '\n';

        return summary;
    }

    /**
     * Build a default Firefly prompt based on event type and description.
     */
    private String buildDefaultFireflyPrompt(Meaningful_Event__c event) {
        String prompt = 'Elegant ';

        // Add event-specific context
        String descText = event.Description__c != null ? event.Description__c.toLowerCase() : '';

        if (descText.contains('wedding')) {
            prompt += 'bridal beauty celebration, wedding day glamour, romantic floral accents, ';
        } else if (descText.contains('birthday')) {
            prompt += 'birthday celebration, gift-giving moment, festive elegance, ';
        } else if (descText.contains('anniversary')) {
            prompt += 'romantic anniversary celebration, timeless love, elegant couple, ';
        } else if (descText.contains('baby') || descText.contains('pregnant')) {
            prompt += 'gentle motherhood moment, soft nursery tones, nurturing atmosphere, ';
        } else if (descText.contains('travel') || descText.contains('trip') || descText.contains('vacation')) {
            prompt += 'jet-set travel lifestyle, luxury getaway, wanderlust aesthetic, ';
        } else {
            prompt += 'special life moment celebration, personal milestone, ';
        }

        prompt += 'luxury beauty products subtly featured, soft rose gold accents, ';
        prompt += 'warm natural lighting, sophisticated editorial photography, ';
        prompt += 'email hero banner composition with space for text overlay';

        return prompt;
    }

    /**
     * Build fallback subject line if Campaign Agent is unavailable.
     */
    private String buildFallbackSubject(Meaningful_Event__c event) {
        String descText = event.Description__c != null ? event.Description__c.toLowerCase() : '';

        if (descText.contains('wedding')) {
            return 'Something beautiful for your special day';
        } else if (descText.contains('birthday')) {
            return 'A little something to celebrate you';
        } else if (descText.contains('anniversary')) {
            return 'Celebrating your special milestone';
        } else if (descText.contains('baby') || descText.contains('pregnant')) {
            return 'Gentle care for this precious time';
        } else if (descText.contains('travel') || descText.contains('trip')) {
            return 'Travel-ready beauty for your adventure';
        }

        return 'Something special just for you';
    }

    /**
     * Build fallback email body if Campaign Agent is unavailable.
     */
    private String buildFallbackBody(Meaningful_Event__c event) {
        String html = '<div style="font-family: Georgia, serif; color: #333;">';
        html += '<p>We couldn\'t help but notice you have something exciting coming up.</p>';
        html += '<p>' + event.Description__c + '</p>';
        html += '<p>We\'d love to help you prepare with our curated selection of products perfect for this special occasion.</p>';
        html += '<p><a href="#" style="color: #B76E79;">Shop the Collection</a></p>';
        html += '<p style="margin-top: 30px;">Warm regards,<br/>The LUMIÈRE Team</p>';
        html += '</div>';
        return html;
    }

    // ─── Notification ─────────────────────────────────────────────────

    /**
     * Send email notification to marketing team about pending approvals.
     */
    private void sendNotificationEmail() {
        try {
            // Count pending approvals
            Integer pendingCount = [SELECT COUNT() FROM Journey_Approval__c WHERE Status__c = 'Pending'];

            if (pendingCount == 0) {
                return;
            }

            // Get notification recipients from Custom Settings
            Marketing_Agent_Settings__c settings = Marketing_Agent_Settings__c.getOrgDefaults();
            String recipients = settings != null ? settings.Notification_Emails__c : null;

            if (String.isBlank(recipients)) {
                System.debug('No notification recipients configured');
                return;
            }

            // Build and send email
            Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
            email.setToAddresses(recipients.split(','));
            email.setSubject('Journey Approvals Pending Review: ' + pendingCount + ' items');
            email.setHtmlBody(
                '<p>You have <strong>' + pendingCount + '</strong> personalized journey approvals pending review.</p>' +
                '<p><a href="' + URL.getOrgDomainUrl().toExternalForm() + '/lightning/n/Journey_Approvals">Review Now</a></p>' +
                '<p>These journeys were generated from meaningful events captured during customer conversations.</p>'
            );

            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to send notification: ' + e.getMessage());
        }
    }
}
