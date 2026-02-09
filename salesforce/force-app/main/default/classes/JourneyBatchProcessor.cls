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
                // Create multi-step journey approval records
                List<Journey_Approval__c> journeySteps = processEventMultiStep(event);

                if (!journeySteps.isEmpty()) {
                    // Assign all steps to the same portfolio
                    for (Journey_Approval__c step : journeySteps) {
                        step.Assigned_Portfolio__c = assignedPortfolioId;
                    }

                    approvalsToInsert.addAll(journeySteps);

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

            // Save email content to MC Content Workspace
            saveEmailContentToWorkspace(approvalsToInsert);
        }

        // Update events
        if (!eventsToUpdate.isEmpty()) {
            update eventsToUpdate;
        }

        System.debug('JourneyBatchProcessor: Created ' + approvalsToInsert.size() + ' journey steps from ' + eventsToUpdate.size() + ' events');
    }

    global void finish(Database.BatchableContext bc) {
        // Send notification to marketing team
        sendNotificationEmail();
    }

    // ─── Content Workspace Integration ─────────────────────────────────

    /**
     * Save email content to the MC Content Workspace for each email step.
     * Updates Journey_Approval__c records with the ContentVersion ID.
     *
     * @param approvals List of newly inserted Journey_Approval__c records
     */
    private void saveEmailContentToWorkspace(List<Journey_Approval__c> approvals) {
        List<Journey_Approval__c> approvalsToUpdate = new List<Journey_Approval__c>();

        for (Journey_Approval__c approval : approvals) {
            // Only process email channels with content
            if (approval.Channel__c != 'Email' || String.isBlank(approval.Suggested_Body__c)) {
                continue;
            }

            try {
                // Build a title for the content
                String title = buildContentTitle(approval);

                // Save to Content Workspace
                ContentWorkspaceService.SaveContentResult result =
                    ContentWorkspaceService.saveEmailContent(
                        title,
                        approval.Suggested_Body__c,
                        approval.Contact__c,
                        approval.Event_Type__c
                    );

                if (result.success && result.contentVersionId != null) {
                    // Update approval with ContentVersion ID
                    Journey_Approval__c updateApproval = new Journey_Approval__c(
                        Id = approval.Id,
                        Email_Content_Version_Id__c = result.contentVersionId
                    );
                    approvalsToUpdate.add(updateApproval);

                    System.debug(LoggingLevel.INFO, 'Saved email content to workspace: ' + result.contentVersionId);
                } else {
                    System.debug(LoggingLevel.WARN, 'Failed to save email content: ' + result.errorMessage);
                }

            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR, 'Error saving email content for approval ' + approval.Id + ': ' + e.getMessage());
            }
        }

        // Update approvals with ContentVersion IDs
        if (!approvalsToUpdate.isEmpty()) {
            update approvalsToUpdate;
            System.debug('Updated ' + approvalsToUpdate.size() + ' approvals with Content Version IDs');
        }
    }

    /**
     * Build a descriptive title for the email content.
     */
    private String buildContentTitle(Journey_Approval__c approval) {
        String title = '';

        // Add event type
        if (String.isNotBlank(approval.Event_Type__c)) {
            title += approval.Event_Type__c.replaceAll('-', ' ').capitalize();
        } else {
            title += 'Journey';
        }

        title += ' Email';

        // Add step info for multi-step journeys
        if (approval.Total_Steps__c != null && approval.Total_Steps__c > 1) {
            title += ' - Step ' + Integer.valueOf(approval.Step_Number__c);
        }

        // Add timestamp
        title += ' - ' + DateTime.now().format('yyyy-MM-dd');

        return title;
    }

    // ─── Event Processing ─────────────────────────────────────────────

    /**
     * Process a meaningful event and create multi-step Journey Approval records.
     * Uses MultiStepJourneyBuilder to determine the optimal journey pattern
     * based on days until event and contact channel preferences.
     *
     * @param event The meaningful event to process
     * @return List of Journey_Approval__c records (one per journey step)
     */
    private List<Journey_Approval__c> processEventMultiStep(Meaningful_Event__c event) {
        List<Journey_Approval__c> approvals = new List<Journey_Approval__c>();

        // Resolve contact ID
        Id contactId = event.Contact__c;
        if (contactId == null && String.isNotBlank(event.Customer_Id__c)) {
            try {
                contactId = Id.valueOf(event.Customer_Id__c);
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Could not parse Customer_Id__c as Contact Id: ' + event.Customer_Id__c);
            }
        }

        // Get contact name for personalization
        String contactName = null;
        if (contactId != null) {
            try {
                Contact c = [SELECT FirstName, LastName FROM Contact WHERE Id = :contactId LIMIT 1];
                contactName = c.FirstName;
            } catch (Exception e) {
                // Continue without name
            }
        }

        // Build journey configuration
        MultiStepJourneyBuilder.JourneyConfig config = new MultiStepJourneyBuilder.JourneyConfig();
        config.contactId = contactId;
        config.meaningfulEventId = event.Id;
        config.eventType = event.Event_Type__c;
        config.eventDescription = event.Description__c;
        config.eventDate = event.Event_Date__c;
        config.urgency = event.Urgency__c;
        config.suggestedProducts = event.Suggested_Products__c;
        config.agentNote = event.Agent_Note__c;
        config.contactName = contactName;

        // Build the multi-step journey
        MultiStepJourneyBuilder.JourneyResult journeyResult = MultiStepJourneyBuilder.buildJourney(config);

        if (!journeyResult.success || journeyResult.steps.isEmpty()) {
            System.debug(LoggingLevel.WARN, 'Journey builder failed: ' + journeyResult.error + '. Falling back to single step.');
            // Fallback to single-step journey
            Journey_Approval__c fallback = createFallbackApproval(event, contactId, contactName);
            approvals.add(fallback);
            return approvals;
        }

        // Build common event summary
        String eventSummary = buildEventSummary(event);

        // Get AI-generated content for the first email step (primary touchpoint)
        CampaignAgentService.BriefGenerationResult agentResult = null;
        try {
            CampaignAgentService.BriefGenerationRequest agentReq = new CampaignAgentService.BriefGenerationRequest();
            agentReq.eventType = event.Event_Type__c;
            agentReq.eventDescription = event.Description__c;
            agentReq.eventDate = event.Event_Date__c;
            agentReq.suggestedProducts = event.Suggested_Products__c;
            agentReq.additionalContext = event.Agent_Note__c;
            agentReq.contactName = contactName;

            List<CampaignAgentService.BriefGenerationResult> agentResults =
                CampaignAgentService.generateBriefs(new List<CampaignAgentService.BriefGenerationRequest>{agentReq});

            if (!agentResults.isEmpty() && agentResults[0].success) {
                agentResult = agentResults[0];
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Campaign Agent failed: ' + e.getMessage());
        }

        // Create Journey_Approval__c records for each step
        for (MultiStepJourneyBuilder.JourneyStep step : journeyResult.steps) {
            Journey_Approval__c approval = new Journey_Approval__c();

            // Link to source records
            approval.Meaningful_Event__c = event.Id;
            approval.Contact__c = contactId;

            // Copy event details
            approval.Event_Type__c = event.Event_Type__c;
            approval.Event_Date__c = event.Event_Date__c;
            approval.Urgency__c = event.Urgency__c;
            approval.Status__c = 'Pending';
            approval.Event_Summary__c = eventSummary;

            // Multi-step journey fields
            approval.Journey_Id__c = journeyResult.journeyId;
            approval.Step_Number__c = step.stepNumber;
            approval.Total_Steps__c = step.totalSteps;
            approval.Channel__c = step.channel;
            approval.Send_Delay_Days__c = step.sendDelayDays;
            approval.Journey_Guardrails__c = step.guardrailsJson;

            // Content: Use AI-generated for first email step, builder templates for others
            if (step.stepNumber == 1 && step.channel == 'Email' && agentResult != null) {
                // First email uses AI-generated content
                approval.Suggested_Subject__c = agentResult.suggestedSubject;
                approval.Suggested_Body__c = agentResult.suggestedBody;

                if (String.isNotBlank(agentResult.fireflyPromptSuggestion)) {
                    approval.Firefly_Prompt__c = agentResult.fireflyPromptSuggestion;
                } else if (String.isNotBlank(event.Suggested_Firefly_Prompt__c)) {
                    approval.Firefly_Prompt__c = event.Suggested_Firefly_Prompt__c;
                } else {
                    approval.Firefly_Prompt__c = step.fireflyPrompt;
                }
            } else {
                // Subsequent steps use builder-generated templates
                approval.Suggested_Subject__c = step.subject;
                approval.Suggested_Body__c = step.body;
                approval.SMS_Body__c = step.smsBody;
                approval.Firefly_Prompt__c = step.fireflyPrompt;
            }

            // Products JSON (if available)
            if (String.isNotBlank(step.productsJson)) {
                approval.Recommended_Products__c = step.productsJson;
            }

            approvals.add(approval);
        }

        System.debug('Created ' + approvals.size() + '-step journey for event: ' + event.Description__c);
        return approvals;
    }

    /**
     * Create a fallback single-step approval when journey builder fails.
     */
    private Journey_Approval__c createFallbackApproval(Meaningful_Event__c event, Id contactId, String contactName) {
        Journey_Approval__c approval = new Journey_Approval__c();

        approval.Meaningful_Event__c = event.Id;
        approval.Contact__c = contactId;
        approval.Event_Type__c = event.Event_Type__c;
        approval.Event_Date__c = event.Event_Date__c;
        approval.Urgency__c = event.Urgency__c;
        approval.Status__c = 'Pending';
        approval.Event_Summary__c = buildEventSummary(event);

        // Single step fields
        approval.Journey_Id__c = JourneyStepService.generateJourneyId(contactId, event.Event_Type__c);
        approval.Step_Number__c = 1;
        approval.Total_Steps__c = 1;
        approval.Channel__c = 'Email';
        approval.Send_Delay_Days__c = 0;

        // Use fallback content
        approval.Suggested_Subject__c = buildFallbackSubject(event);
        approval.Suggested_Body__c = buildFallbackBody(event);
        approval.Firefly_Prompt__c = buildDefaultFireflyPrompt(event);

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
        html += '<p style="margin-top: 30px;">Warm regards,<br/>The BEAUTÉ Team</p>';
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
