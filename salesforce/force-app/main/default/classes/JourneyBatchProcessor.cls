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
              AND Event_Type__c NOT IN ('intent', 'concern', 'preference', 'milestone')
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
                System.debug(LoggingLevel.ERROR, 'Stack trace: ' + e.getStackTraceString());
                // Mark as error so it doesn't get stuck in an infinite retry loop
                event.Approval_Status__c = 'Processing Error';
                event.Agent_Note__c = (String.isNotBlank(event.Agent_Note__c) ? event.Agent_Note__c + '\n' : '')
                    + '[Batch Error] ' + e.getMessage() + ' | Stack: ' + e.getStackTraceString();
                eventsToUpdate.add(event);
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
                // Customer_Id__c is likely an email — look up the Contact
                List<Contact> contacts = [SELECT Id FROM Contact WHERE Email = :event.Customer_Id__c LIMIT 1];
                if (!contacts.isEmpty()) {
                    contactId = contacts[0].Id;
                } else {
                    System.debug(LoggingLevel.WARN, 'No Contact found for Customer_Id__c: ' + event.Customer_Id__c);
                }
            }
        }

        // Get contact name and opt-in for personalization and scoring
        String contactName = null;
        if (contactId != null) {
            try {
                Contact c = [SELECT FirstName, LastName FROM Contact WHERE Id = :contactId LIMIT 1];
                contactName = c.FirstName;
            } catch (Exception e) {
                // Continue without name
            }
        }

        // Query browse context and profile data for enrichment
        String browseContext = '';
        String profileContext = '';
        Boolean hasBrowseData = false;

        String customerIdStr = contactId != null ? String.valueOf(contactId) : event.Customer_Id__c;
        if (String.isNotBlank(customerIdStr)) {
            try {
                List<Browse_Session__c> browseSessions = [
                    SELECT Session_Date__c, Categories_Browsed__c, Products_Viewed__c
                    FROM Browse_Session__c
                    WHERE Customer_Id__c = :customerIdStr
                    ORDER BY Session_Date__c DESC
                    LIMIT 3
                ];

                if (!browseSessions.isEmpty()) {
                    hasBrowseData = true;
                    List<String> browseLines = new List<String>();
                    for (Browse_Session__c bs : browseSessions) {
                        String line = '';
                        if (bs.Session_Date__c != null) line += bs.Session_Date__c.format() + ': ';
                        if (String.isNotBlank(bs.Categories_Browsed__c)) line += 'Categories: ' + bs.Categories_Browsed__c;
                        if (String.isNotBlank(bs.Products_Viewed__c)) line += ' | Products: ' + bs.Products_Viewed__c;
                        browseLines.add(line);
                    }
                    browseContext = String.join(browseLines, '\n');
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Failed to query browse sessions: ' + e.getMessage());
            }

            try {
                List<Agent_Captured_Profile__c> profileRecords = [
                    SELECT Field_Name__c, Field_Value__c
                    FROM Agent_Captured_Profile__c
                    WHERE Customer_Id__c = :customerIdStr
                    LIMIT 10
                ];

                if (!profileRecords.isEmpty()) {
                    List<String> profileLines = new List<String>();
                    for (Agent_Captured_Profile__c pr : profileRecords) {
                        if (String.isNotBlank(pr.Field_Name__c) && String.isNotBlank(pr.Field_Value__c)) {
                            profileLines.add(pr.Field_Name__c + ': ' + pr.Field_Value__c);
                        }
                    }
                    profileContext = String.join(profileLines, '\n');
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Failed to query profile data: ' + e.getMessage());
            }
        }

        // Track date signal presence for confidence scoring.
        // Both explicit dates (Event_Date__c set by flow) and strong relative
        // time expressions ("in three weeks", "next month") count as date signals.
        Boolean hadOriginalDate = (event.Event_Date__c != null);
        Boolean hadRelativeTimeText = String.isNotBlank(event.Relative_Time_Text__c);

        // Derive event date if missing — enables multi-step journeys
        if (event.Event_Date__c == null) {
            Date derivedDate = null;

            // Try parsing from relative time text (e.g., "in two weeks", "next month")
            if (hadRelativeTimeText) {
                derivedDate = deriveEventDateFromText(event.Relative_Time_Text__c);
                // Successfully derived date from relative text counts as a date signal
                if (derivedDate != null) {
                    hadOriginalDate = true;
                }
            }

            // Fallback: scan the Description for relative time patterns.
            // The agent often embeds temporal info in the description (e.g.,
            // "Traveling to Dubai in three weeks") without populating
            // Relative_Time_Text__c separately.
            if (derivedDate == null && String.isNotBlank(event.Description__c)) {
                derivedDate = deriveEventDateFromText(event.Description__c);
                if (derivedDate != null) {
                    hadOriginalDate = true;
                    System.debug('Derived date from description text: ' + derivedDate);
                }
            }

            // Fallback: scan the Agent_Note__c for temporal patterns.
            if (derivedDate == null && String.isNotBlank(event.Agent_Note__c)) {
                derivedDate = deriveEventDateFromText(event.Agent_Note__c);
                if (derivedDate != null) {
                    hadOriginalDate = true;
                    System.debug('Derived date from agent note: ' + derivedDate);
                }
            }

            // Default to 14 days out for life-events
            if (derivedDate == null) {
                derivedDate = Date.today().addDays(14);
            }

            event.Event_Date__c = derivedDate;
            System.debug('Derived event date ' + derivedDate + ' for event: ' + event.Description__c);
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

        // Skincare-video events use the video journey pipeline
        if (event.Event_Type__c == 'skincare-video') {
            config.isVideoJourney = true;
            config.videoPrompt = buildSkincareVideoPrompt(event, contactName, contactId);
            config.videoRoutineHtml = buildSkincareRoutineHtml(event, contactName, contactId);
        }

        // Compute customer value score for media activation eligibility
        config.customerValueScore = computeCustomerValueScore(contactId);

        // Build the multi-step journey
        MultiStepJourneyBuilder.JourneyResult journeyResult = MultiStepJourneyBuilder.buildJourney(config);

        if (!journeyResult.success || journeyResult.steps.isEmpty()) {
            System.debug(LoggingLevel.WARN, 'Journey builder failed: ' + journeyResult.error + '. Falling back to single step.');
            // Fallback to single-step journey
            Journey_Approval__c fallback = createFallbackApproval(event, contactId, contactName);
            approvals.add(fallback);
            return approvals;
        }

        // Build common event summary enriched with browse and profile context
        String eventSummary = buildEventSummary(event);
        if (String.isNotBlank(browseContext)) {
            eventSummary += '\nBROWSE CONTEXT:\n' + browseContext + '\n';
        }
        if (String.isNotBlank(profileContext)) {
            eventSummary += '\nPROFILE CONTEXT:\n' + profileContext + '\n';
        }

        // Get AI-generated content for the first email step (primary touchpoint)
        CampaignAgentService.BriefGenerationResult agentResult = null;
        try {
            CampaignAgentService.BriefGenerationRequest agentReq = new CampaignAgentService.BriefGenerationRequest();
            agentReq.eventType = event.Event_Type__c;
            agentReq.eventDescription = event.Description__c;
            agentReq.eventDate = event.Event_Date__c;
            agentReq.suggestedProducts = event.Suggested_Products__c;
            String additionalCtx = event.Agent_Note__c != null ? event.Agent_Note__c : '';
            if (String.isNotBlank(browseContext)) {
                additionalCtx += '\nRecent Browse Activity:\n' + browseContext;
            }
            if (String.isNotBlank(profileContext)) {
                additionalCtx += '\nCustomer Profile:\n' + profileContext;
            }
            agentReq.additionalContext = additionalCtx;
            agentReq.contactName = contactName;

            List<CampaignAgentService.BriefGenerationResult> agentResults =
                CampaignAgentService.generateBriefs(new List<CampaignAgentService.BriefGenerationRequest>{agentReq});

            if (!agentResults.isEmpty() && agentResults[0].success) {
                agentResult = agentResults[0];
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Campaign Agent failed: ' + e.getMessage());
        }

        // Pre-attach product recommendations to all steps (enables product composite path)
        JourneyPromptBuilder.PromptResult promptResult = JourneyPromptBuilder.buildEnrichedPrompt(
            contactId, event.Description__c, event.Event_Type__c
        );
        String productsJson = promptResult.recommendedProductsJson;

        // If no personalized products, try event-suggested products
        if (String.isBlank(productsJson) && String.isNotBlank(event.Suggested_Products__c)) {
            productsJson = event.Suggested_Products__c;
        }

        // Extract product names for prompt templates
        List<String> productNames = new List<String>();
        if (String.isNotBlank(productsJson)) {
            try {
                List<Object> parsed = (List<Object>) JSON.deserializeUntyped(productsJson);
                for (Object obj : parsed) {
                    Map<String, Object> prodMap = (Map<String, Object>) obj;
                    String name = (String) prodMap.get('name');
                    if (String.isNotBlank(name)) productNames.add(name);
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Failed to parse products: ' + e.getMessage());
            }
        }

        Integer totalSteps = journeyResult.steps.size();

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

            // Video channel: populate video-specific fields
            if (step.channel == 'Video') {
                approval.Video_Prompt__c = step.videoPrompt;
                approval.Suggested_Subject__c = step.subject;
                approval.Suggested_Body__c = step.body;
                // Attach products if available
                if (String.isNotBlank(productsJson)) {
                    approval.Recommended_Products__c = productsJson;
                }
            }
            // Media channel: populate media activation fields
            else if (step.channel == 'Media') {
                approval.Suggested_Subject__c = step.subject;
                approval.Suggested_Body__c = step.body;
                approval.Media_Platform__c = step.mediaPlatform;
                approval.Media_Ad_Format__c = step.mediaAdFormat;
                approval.Media_Creative_Brief__c = step.mediaCreativeBrief;
                approval.Media_Audience_Signals__c = step.mediaAudienceSignals;
                approval.Media_Estimated_Reach__c = step.mediaEstimatedReach;
                approval.Merkury_Activation_Status__c = 'Staged';
                if (String.isNotBlank(productsJson)) {
                    approval.Recommended_Products__c = productsJson;
                }
            }
            // Content: Use AI-generated for first email step, builder templates for others
            else if (step.stepNumber == 1 && step.channel == 'Email' && agentResult != null) {
                // First email uses AI-generated content
                approval.Suggested_Subject__c = agentResult.suggestedSubject;
                approval.Suggested_Body__c = agentResult.suggestedBody;

                if (String.isNotBlank(agentResult.fireflyPromptSuggestion)) {
                    approval.Firefly_Prompt__c = agentResult.fireflyPromptSuggestion;
                } else if (String.isNotBlank(event.Suggested_Firefly_Prompt__c)) {
                    approval.Firefly_Prompt__c = event.Suggested_Firefly_Prompt__c;
                } else {
                    // Use step-aware prompt template with product names
                    approval.Firefly_Prompt__c = JourneyPromptBuilder.getStepPrompt(
                        event.Event_Type__c, event.Description__c,
                        step.stepNumber, totalSteps, productNames
                    );
                }
            } else {
                // Subsequent steps use builder-generated templates
                approval.Suggested_Subject__c = step.subject;
                approval.Suggested_Body__c = step.body;
                approval.SMS_Body__c = step.smsBody;

                // Use step-aware prompt template for richer, context-specific prompts
                if (step.channel == 'Email') {
                    approval.Firefly_Prompt__c = JourneyPromptBuilder.getStepPrompt(
                        event.Event_Type__c, event.Description__c,
                        step.stepNumber, totalSteps, productNames
                    );
                } else {
                    approval.Firefly_Prompt__c = step.fireflyPrompt;
                }
            }

            // Attach products to ALL email steps (enables product composite image path)
            if (step.channel == 'Email' && String.isNotBlank(productsJson)) {
                approval.Recommended_Products__c = productsJson;
            } else if (String.isNotBlank(step.productsJson)) {
                approval.Recommended_Products__c = step.productsJson;
            }

            // Compute confidence score based on real data signals
            approval.Confidence_Score__c = computeConfidenceScore(
                event, hadOriginalDate,
                String.isNotBlank(promptResult.recommendedProductsJson),
                agentResult != null,
                hasBrowseData
            );

            // Attach customer value score to every approval for media eligibility tracking
            if (config.customerValueScore != null) {
                approval.Customer_Value_Score__c = config.customerValueScore;
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

        if (event.Captured_At__c != null) {
            summary += '\nCAPTURED: ' + event.Captured_At__c.format() + '\n';
        } else {
            summary += '\nCAPTURED: ' + Datetime.now().format() + '\n';
        }

        return summary;
    }

    /**
     * Compute AI confidence score (0-100) based on available data signals.
     */
    private Integer computeConfidenceScore(
        Meaningful_Event__c event,
        Boolean hadOriginalDate,
        Boolean hasAffinityProducts,
        Boolean agentGenerated,
        Boolean hasBrowseContext
    ) {
        // Confidence = how sure we are that the detected event and recommended
        // journey are genuinely relevant to this customer.
        // Explicit details → high confidence; vague inferences → low confidence.
        Integer score = 0;

        // Explicit date mentioned (e.g. "leaves Feb 28") — strong signal the
        // event is real and timing is accurate
        if (hadOriginalDate) score += 25;

        // Detailed event description — longer, more specific descriptions
        // suggest a concrete event vs. a vague hint
        String eventDesc = event.Description__c != null ? event.Description__c : '';
        if (eventDesc.length() > 120) {
            score += 20;  // Rich detail — high specificity
        } else if (eventDesc.length() > 60) {
            score += 10;  // Moderate detail
        }

        // AI Agent generated content — means the campaign agent successfully
        // understood the context and produced a tailored journey
        if (agentGenerated) score += 15;

        // Product affinity data available — the journey includes products
        // matched to the customer's actual preferences
        if (hasAffinityProducts) score += 15;

        // Agent provided a note with additional context from the conversation
        if (String.isNotBlank(event.Agent_Note__c)) score += 10;

        // Browse/profile data corroborates the event — multi-signal validation
        if (hasBrowseContext) score += 10;

        // Agent note present suggests a rep explicitly flagged/detailed this event
        // (already scored above — cumulative with description length)

        return Math.min(Math.max(score, 5), 100);
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
     * Event-type specific content for a more engaging, personalized experience.
     */
    private String buildFallbackBody(Meaningful_Event__c event) {
        String eventDesc = event.Description__c != null ? event.Description__c.toLowerCase() : 'special occasion';
        String html = '<div style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto;">';

        // Event-specific opening
        if (eventDesc.contains('wedding')) {
            html += '<p style="font-size: 18px; line-height: 1.7; color: #444;">Every love story deserves its own glow. ✨</p>';
            html += '<p style="font-size: 16px; line-height: 1.7; color: #444;">We heard there\'s a beautiful celebration on the horizon — how exciting! Whether you\'re walking down the aisle or celebrating someone you love, we\'ve thoughtfully selected pieces designed to make you radiant from the rehearsal dinner to the last dance.</p>';
        } else if (eventDesc.contains('travel') || eventDesc.contains('trip') || eventDesc.contains('vacation')) {
            html += '<p style="font-size: 18px; line-height: 1.7; color: #444;">Adventure awaits! 🌟</p>';
            html += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Before you embark on your journey, we\'ve assembled the perfect travel companions for your beauty ritual. From protective SPF to hydrating essentials that survive any climate — arrive at every destination looking refreshed and radiant.</p>';
        } else if (eventDesc.contains('birthday')) {
            html += '<p style="font-size: 18px; line-height: 1.7; color: #444;">A birthday means celebrating the most important person — you! 🎂</p>';
            html += '<p style="font-size: 16px; line-height: 1.7; color: #444;">This year, gift yourself the glow you deserve. We\'ve selected pieces that will make you feel as radiant as the day itself. Because every year more beautiful deserves to be seen.</p>';
        } else if (eventDesc.contains('anniversary')) {
            html += '<p style="font-size: 18px; line-height: 1.7; color: #444;">Another year of beautiful moments deserves to be celebrated. 💕</p>';
            html += '<p style="font-size: 16px; line-height: 1.7; color: #444;">We\'ve curated something special for this milestone. From luxurious fragrances to skin that tells a story of happiness — here\'s to looking and feeling your most radiant.</p>';
        } else {
            html += '<p style="font-size: 18px; line-height: 1.7; color: #444;">Something wonderful is on the horizon! ✨</p>';
            html += '<p style="font-size: 16px; line-height: 1.7; color: #444;">We noticed ' + event.Description__c + ' — and we couldn\'t help but want to help you prepare in the most beautiful way possible. We\'ve selected a collection designed to make you feel confident, radiant, and ready for your special moment.</p>';
        }

        // Elegant CTA
        html += '<p style="margin: 30px 0; text-align: center;">';
        html += '<a href="#" style="display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500; font-size: 14px; letter-spacing: 0.5px;">Discover Your Selection</a>';
        html += '</p>';

        html += '</div>';
        return html;
    }

    // ─── Skincare Video Prompt Builder ──────────────────────────────

    /**
     * Build a personalized video prompt and routine for skincare-video events.
     *
     * Strategy: The Firefly Video API generates 5-second clips, so the video
     * serves as a cinematic hero visual — a beautiful, concern-specific product
     * beauty shot. The detailed step-by-step routine goes into the email body
     * (set on the Journey_Approval__c record body field via MultiStepJourneyBuilder).
     *
     * The video prompt describes a short, visually stunning vignette showing
     * the key recommended products for the customer's specific concern.
     */
    private String buildSkincareVideoPrompt(Meaningful_Event__c event, String contactName, Id contactId) {
        String skinType = '';
        String skinConcerns = '';

        // Query Contact profile for skin data
        if (contactId != null) {
            try {
                Contact c = [SELECT Skin_Type__c, Skin_Concerns__c FROM Contact WHERE Id = :contactId LIMIT 1];
                if (String.isNotBlank(c.Skin_Type__c)) {
                    skinType = c.Skin_Type__c;
                }
                if (String.isNotBlank(c.Skin_Concerns__c)) {
                    skinConcerns = c.Skin_Concerns__c;
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Failed to query Contact for video prompt: ' + e.getMessage());
            }
        }

        // Determine the primary concern from the event description or profile
        String concern = '';
        if (String.isNotBlank(event.Description__c)) {
            concern = event.Description__c.toLowerCase();
        } else if (String.isNotBlank(skinConcerns)) {
            concern = skinConcerns.toLowerCase();
        } else {
            concern = 'general skincare';
        }

        // Build a concern-specific 5-second video vignette prompt
        return buildConcernVideoVignette(concern, skinType);
    }

    /**
     * Build a concern-specific skincare routine for the email body.
     * Called by MultiStepJourneyBuilder to populate the journey step body
     * with a personalized, step-by-step routine and product recommendations.
     */
    public String buildSkincareRoutineHtml(Meaningful_Event__c event, String contactName, Id contactId) {
        String skinType = '';
        String skinConcerns = '';

        if (contactId != null) {
            try {
                Contact c = [SELECT Skin_Type__c, Skin_Concerns__c FROM Contact WHERE Id = :contactId LIMIT 1];
                if (String.isNotBlank(c.Skin_Type__c)) skinType = c.Skin_Type__c;
                if (String.isNotBlank(c.Skin_Concerns__c)) skinConcerns = c.Skin_Concerns__c;
            } catch (Exception e) { /* continue with defaults */ }
        }

        String concern = '';
        if (String.isNotBlank(event.Description__c)) {
            concern = event.Description__c.toLowerCase();
        } else if (String.isNotBlank(skinConcerns)) {
            concern = skinConcerns.toLowerCase();
        } else {
            concern = 'general skincare';
        }

        String name = String.isNotBlank(contactName) ? contactName : 'there';
        return buildRoutineEmailBody(concern, skinType, name);
    }

    /**
     * Build a 5-second video vignette prompt for Firefly Video API.
     * Each concern maps to a visually distinct, product-focused beauty shot.
     */
    private String buildConcernVideoVignette(String concern, String skinType) {

        if (concern.contains('oily') || concern.contains('oil') || concern.contains('shine') || concern.contains('greasy')) {
            return 'Cinematic close-up of mattifying skincare products on a cool slate surface with morning dew. '
                + 'A lightweight gel moisturizer is squeezed from a frosted glass bottle, spreading translucent and shine-free across a marble slab. '
                + 'Oil-blotting serum droplets fall in slow motion into a petri dish, refracting light. '
                + 'Fresh green tea leaves and kaolin clay powder scattered artfully. Cool blue-green and white color palette. '
                + 'Camera slowly dollies forward. Premium editorial beauty aesthetic, no human faces.';
        }

        if (concern.contains('dry') || concern.contains('dryness') || concern.contains('flak') || concern.contains('dehydrat')) {
            return 'Cinematic close-up of rich hydrating skincare on warm marble vanity bathed in golden hour light. '
                + 'A thick, luxurious cream is scooped from an open jar, stretching between fingertips showing its creamy texture. '
                + 'Hyaluronic acid serum drops fall in slow motion onto a dewy rose petal, glistening. '
                + 'Honey, chamomile flowers, and shea butter pieces arranged as props. Warm gold, cream, and soft pink tones. '
                + 'Camera slowly pulls back revealing the full vanity scene. Soft, enveloping mood.';
        }

        if (concern.contains('redness') || concern.contains('rosacea') || concern.contains('irritat') || concern.contains('sensitive') || concern.contains('inflam')) {
            return 'Cinematic close-up of calming skincare products on a cool white surface with soft diffused light. '
                + 'A soothing green-tinted serum is dispensed from a dropper, the liquid catching gentle light. '
                + 'Centella asiatica leaves, aloe vera gel, and oat extract float in a glass dish of water. '
                + 'Mist gently drifts across the frame. Soft sage green, lavender, and white color palette. '
                + 'Camera pans slowly left to right. Calming, meditative beauty editorial, no faces shown.';
        }

        if (concern.contains('acne') || concern.contains('breakout') || concern.contains('blemish') || concern.contains('pimple')) {
            return 'Cinematic close-up of clarifying skincare products on a clean white surface with crisp lighting. '
                + 'A clear purifying gel cleanser is pumped out and spreads across a smooth surface, bubbling slightly. '
                + 'Salicylic acid crystals and tea tree oil droplets are shown in extreme macro, sparkling. '
                + 'Clean lines, minimal styling with eucalyptus sprigs and white towels. Bright white and mint green palette. '
                + 'Camera slowly zooms into the serum texture. Fresh, clinical yet luxurious aesthetic.';
        }

        if (concern.contains('aging') || concern.contains('wrinkle') || concern.contains('fine line') || concern.contains('firm') || concern.contains('sagging') || concern.contains('mature')) {
            return 'Cinematic close-up of anti-aging skincare products on a rose gold tray with warm candlelit ambiance. '
                + 'A golden retinol serum is dispensed from an elegant dark glass dropper, the amber liquid catching warm light. '
                + 'A rich night cream is swirled with a gold spatula, revealing its silky, peptide-rich texture. '
                + 'Rose petals, gold leaf flakes, and a small hourglass as props. Deep rose, gold, and burgundy palette. '
                + 'Camera tilts up slowly in soft focus. Opulent, timeless beauty editorial, no faces shown.';
        }

        if (concern.contains('dark spot') || concern.contains('hyperpigment') || concern.contains('uneven') || concern.contains('discolor') || concern.contains('melasma') || concern.contains('bright')) {
            return 'Cinematic close-up of brightening skincare products arranged on a luminous white surface with radiant backlighting. '
                + 'A vitamin C serum in a dark amber bottle is dispensed — the bright orange liquid glows as light passes through it. '
                + 'Citrus slices, turmeric root, and pearl powder are artfully placed around the products. '
                + 'Prismatic light refractions dance across the surface. Bright white, amber, and soft coral palette. '
                + 'Camera slowly dollies forward into the serum droplet. Radiant, luminous beauty editorial.';
        }

        if (concern.contains('pore') || concern.contains('texture') || concern.contains('rough') || concern.contains('bumpy')) {
            return 'Cinematic extreme close-up of pore-refining skincare on a cool slate surface with sharp, directional lighting. '
                + 'A BHA exfoliating toner is poured onto a cotton pad in slow motion, the liquid saturating the fibers. '
                + 'A clay mask is smoothed across a ceramic palette, showing its fine, grain-free texture. '
                + 'Charcoal pieces, white kaolin powder, and green clay arranged minimally. Cool grey, white, and sage palette. '
                + 'Camera slowly racks focus from background to foreground. Clean, precise beauty editorial.';
        }

        // Default: general luxury skincare beauty shot
        String skinTypeContext = String.isNotBlank(skinType) ? ' for ' + skinType.toLowerCase() + ' skin' : '';
        return 'Cinematic close-up of a curated skincare routine' + skinTypeContext + ' on a warm marble vanity in soft morning light. '
            + 'Products are arranged in a perfect line — cleanser, toner, serum, moisturizer, sunscreen. '
            + 'A hand reaches in and picks up a serum bottle, dispensing a golden drop that catches the light. '
            + 'Fresh botanical elements — lavender, rosemary, and white flowers — frame the scene. '
            + 'Warm neutrals, soft rose gold accents, and cream tones. Camera slowly dollies forward. '
            + 'Premium luxury beauty editorial aesthetic, no faces shown.';
    }

    /**
     * Build the personalized HTML email body with step-by-step routine.
     * This is where the detailed routine and product recommendations live,
     * since the 5-second video is a visual hero element, not a tutorial.
     */
    private String buildRoutineEmailBody(String concern, String skinType, String name) {
        String concernTitle = getConcernTitle(concern);
        String routineSteps = getRoutineSteps(concern, skinType);

        return '<div style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto;">'
            + '<p style="font-size: 18px; line-height: 1.7; color: #444;">Dear ' + name + ',</p>'
            + '<p style="font-size: 16px; line-height: 1.7; color: #444;">We heard you — and we want to help. '
            + 'Our skincare experts have put together a personalized routine to address your <strong>' + concernTitle + '</strong> concern, '
            + 'using products specifically chosen for your skin.</p>'
            + '<h2 style="font-size: 20px; color: #B76E79; margin: 30px 0 15px; text-align: center; letter-spacing: 1px;">Your Personalized Routine</h2>'
            + routineSteps
            + '<p style="font-size: 14px; line-height: 1.7; color: #666; margin-top: 25px; border-top: 1px solid #eee; padding-top: 20px;">'
            + 'Questions about your routine? Reply to this email or book a one-on-one consultation with our beauty advisors.</p>'
            + '<p style="margin: 20px 0; text-align: center;">'
            + '<a href="#" style="display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500; font-size: 14px; letter-spacing: 0.5px;">Shop Your Routine</a>'
            + '</p></div>';
    }

    private String getConcernTitle(String concern) {
        if (concern.contains('oily') || concern.contains('oil')) return 'oily skin';
        if (concern.contains('dry') || concern.contains('dehydrat')) return 'dryness & dehydration';
        if (concern.contains('redness') || concern.contains('rosacea')) return 'redness & sensitivity';
        if (concern.contains('acne') || concern.contains('breakout') || concern.contains('blemish')) return 'acne & breakouts';
        if (concern.contains('aging') || concern.contains('wrinkle') || concern.contains('fine line')) return 'anti-aging';
        if (concern.contains('dark spot') || concern.contains('hyperpigment') || concern.contains('uneven')) return 'dark spots & uneven tone';
        if (concern.contains('pore') || concern.contains('texture')) return 'pores & texture';
        return 'skin health';
    }

    private String getRoutineSteps(String concern, String skinType) {
        String stepStyle = 'style="margin: 12px 0; padding: 12px 16px; background: #faf8f7; border-left: 3px solid #B76E79; border-radius: 4px;"';
        String numStyle = 'style="color: #B76E79; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;"';
        String prodStyle = 'style="font-weight: 600; color: #333;"';
        String descStyle = 'style="font-size: 14px; color: #555; line-height: 1.6; margin-top: 4px;"';

        if (concern.contains('oily') || concern.contains('oil') || concern.contains('shine') || concern.contains('greasy')) {
            return '<div ' + stepStyle + '><span ' + numStyle + '>Step 1 — Cleanse</span><br/>'
                + '<span ' + prodStyle + '>Oil Control Purifying Cleanser</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Massage onto damp skin to dissolve excess sebum without stripping. Rinse with lukewarm water.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 2 — Tone</span><br/>'
                + '<span ' + prodStyle + '>Pore Refining Toner</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Pat onto T-zone with a cotton pad to tighten pores and remove residual oil.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 3 — Treat</span><br/>'
                + '<span ' + prodStyle + '>Pore Minimizing Serum</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Press 2-3 drops into the T-zone — niacinamide controls oil production throughout the day.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 4 — Moisturize</span><br/>'
                + '<span ' + prodStyle + '>Oil-Free Hydra-Balance Moisturizer</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Smooth on a thin layer — lightweight, non-greasy, mattifying finish.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 5 — Protect</span><br/>'
                + '<span ' + prodStyle + '>Invisible Shield SPF 50</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Apply generously — sheer, no white cast, no added shine.</span></div>';
        }

        if (concern.contains('dry') || concern.contains('dryness') || concern.contains('flak') || concern.contains('dehydrat')) {
            return '<div ' + stepStyle + '><span ' + numStyle + '>Step 1 — Cleanse</span><br/>'
                + '<span ' + prodStyle + '>Velvet Cream Cleanser</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Gently massage in circular motions. Leaves skin soft without stripping moisture.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 2 — Tone</span><br/>'
                + '<span ' + prodStyle + '>Hydrating Essence Toner</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Press into damp skin with palms — multi-weight hyaluronic acid drenches skin in hydration.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 3 — Treat</span><br/>'
                + '<span ' + prodStyle + '>Hyaluronic Plumping Serum</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Apply 3 drops and press in — draws moisture deep into the skin barrier.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 4 — Moisturize</span><br/>'
                + '<span ' + prodStyle + '>Rich Repair Cream</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Warm between fingertips and press in — ceramides and shea butter seal in all that hydration.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 5 — Protect</span><br/>'
                + '<span ' + prodStyle + '>Invisible Shield SPF 50</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Adds a dewy glow while protecting against UV damage.</span></div>';
        }

        if (concern.contains('redness') || concern.contains('rosacea') || concern.contains('irritat') || concern.contains('sensitive') || concern.contains('inflam')) {
            return '<div ' + stepStyle + '><span ' + numStyle + '>Step 1 — Cleanse</span><br/>'
                + '<span ' + prodStyle + '>Hydra-Calm Sensitive Cleanser</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Use with cool water — gentle, soothing strokes only. Never rub.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 2 — Tone</span><br/>'
                + '<span ' + prodStyle + '>Calming Botanical Toner</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Mist onto skin — centella asiatica immediately reduces visible redness.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 3 — Treat</span><br/>'
                + '<span ' + prodStyle + '>Rosacea Relief Serum</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Dab onto affected areas — azelaic acid calms inflammation without irritation.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 4 — Moisturize</span><br/>'
                + '<span ' + prodStyle + '>Hydra-Calm Sensitive Moisturizer</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Apply in gentle upward strokes — ceramides strengthen the barrier and soothe reactive skin.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 5 — Protect</span><br/>'
                + '<span ' + prodStyle + '>Mineral Sunscreen SPF 50</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Zinc oxide formula shields skin without chemical irritants.</span></div>';
        }

        if (concern.contains('acne') || concern.contains('breakout') || concern.contains('blemish') || concern.contains('pimple')) {
            return '<div ' + stepStyle + '><span ' + numStyle + '>Step 1 — Cleanse</span><br/>'
                + '<span ' + prodStyle + '>Oil Control Purifying Cleanser</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Work into a gentle lather with salicylic acid — clears pore buildup without over-drying.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 2 — Exfoliate</span><br/>'
                + '<span ' + prodStyle + '>BHA Clarifying Toner</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Swipe across face with cotton pad — dissolves dead skin cells clogging pores.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 3 — Spot Treat</span><br/>'
                + '<span ' + prodStyle + '>Blemish Control Spot Treatment</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Precisely dot onto active breakouts — reduces inflammation overnight.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 4 — Moisturize</span><br/>'
                + '<span ' + prodStyle + '>Acne-Safe Hydrating Gel</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Apply lightly — oil-free, non-comedogenic, niacinamide reduces redness.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 5 — Protect</span><br/>'
                + '<span ' + prodStyle + '>Clear Skin SPF 50</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Matte, lightweight finish — zero pore-clogging ingredients.</span></div>';
        }

        if (concern.contains('aging') || concern.contains('wrinkle') || concern.contains('fine line') || concern.contains('firm') || concern.contains('sagging') || concern.contains('mature')) {
            return '<div ' + stepStyle + '><span ' + numStyle + '>Step 1 — Cleanse</span><br/>'
                + '<span ' + prodStyle + '>Velvet Cream Cleanser</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Gently remove impurities without disrupting the precious skin barrier.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 2 — Tone</span><br/>'
                + '<span ' + prodStyle + '>Hydrating Essence Toner</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Plumps skin with multi-weight hyaluronic acid — preps for active ingredients.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 3 — Treat</span><br/>'
                + '<span ' + prodStyle + '>Retinol Renewal Serum</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Press into fine lines around eyes and forehead — stimulates collagen production.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 4 — Eye Care</span><br/>'
                + '<span ' + prodStyle + '>Firming Eye Contour Cream</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Gently tap around the orbital bone — targets crow\\\'s feet and hollows.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 5 — Moisturize</span><br/>'
                + '<span ' + prodStyle + '>Overnight Repair Cream</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Locks in actives with peptides and ceramides for nighttime regeneration.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 6 — Protect (AM)</span><br/>'
                + '<span ' + prodStyle + '>Invisible Shield SPF 50</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>The most important anti-aging step — prevents further UV damage.</span></div>';
        }

        if (concern.contains('dark spot') || concern.contains('hyperpigment') || concern.contains('uneven') || concern.contains('discolor') || concern.contains('melasma') || concern.contains('bright')) {
            return '<div ' + stepStyle + '><span ' + numStyle + '>Step 1 — Cleanse</span><br/>'
                + '<span ' + prodStyle + '>Brightening Gel Cleanser</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Vitamin C derivatives start the brightening process from step one.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 2 — Tone</span><br/>'
                + '<span ' + prodStyle + '>Glow Refining Toner</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Glycolic acid gently exfoliates — accelerates cell turnover for a more even tone.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 3 — Treat</span><br/>'
                + '<span ' + prodStyle + '>Vitamin C Brightening Serum</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Apply to dark spots and across cheeks — inhibits melanin production.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 4 — Target</span><br/>'
                + '<span ' + prodStyle + '>Dark Spot Corrector</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Precisely apply to stubborn areas of discoloration.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 5 — Moisturize</span><br/>'
                + '<span ' + prodStyle + '>Radiance Day Cream</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Niacinamide evens skin tone while providing all-day hydration.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 6 — Protect</span><br/>'
                + '<span ' + prodStyle + '>Invisible Shield SPF 50</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Essential — prevents dark spots from returning after treatment.</span></div>';
        }

        if (concern.contains('pore') || concern.contains('texture') || concern.contains('rough') || concern.contains('bumpy')) {
            return '<div ' + stepStyle + '><span ' + numStyle + '>Step 1 — Cleanse</span><br/>'
                + '<span ' + prodStyle + '>Oil Control Purifying Cleanser</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Deeply cleans pores without over-stripping natural oils.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 2 — Exfoliate</span><br/>'
                + '<span ' + prodStyle + '>BHA Resurfacing Toner</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Salicylic acid dissolves pore congestion from within — pat on, don\\\'t rub.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 3 — Treat</span><br/>'
                + '<span ' + prodStyle + '>Pore Minimizing Serum</span> <span style="color: #999;">DERMACLEAR</span><br/>'
                + '<span ' + descStyle + '>Niacinamide visibly tightens enlarged pores and smooths skin texture.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 4 — Moisturize</span><br/>'
                + '<span ' + prodStyle + '>Oil-Free Hydra-Balance Moisturizer</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Hydrates without adding congestion — lightweight, breathable formula.</span></div>'
                + '<div ' + stepStyle + '><span ' + numStyle + '>Step 5 — Protect</span><br/>'
                + '<span ' + prodStyle + '>Invisible Shield SPF 50</span> <span style="color: #999;">SERENE</span><br/>'
                + '<span ' + descStyle + '>Lightweight, non-comedogenic protection.</span></div>';
        }

        // Default routine
        String skinTypeContext = String.isNotBlank(skinType) ? skinType.toLowerCase() + ' skin' : 'your skin';
        return '<div ' + stepStyle + '><span ' + numStyle + '>Step 1 — Cleanse</span><br/>'
            + '<span ' + prodStyle + '>Velvet Cream Cleanser</span> <span style="color: #999;">SERENE</span><br/>'
            + '<span ' + descStyle + '>Gentle lather removes impurities while maintaining ' + skinTypeContext + '\\\'s natural barrier.</span></div>'
            + '<div ' + stepStyle + '><span ' + numStyle + '>Step 2 — Tone</span><br/>'
            + '<span ' + prodStyle + '>Hydrating Essence Toner</span> <span style="color: #999;">SERENE</span><br/>'
            + '<span ' + descStyle + '>Press into damp skin — hyaluronic acid delivers deep hydration.</span></div>'
            + '<div ' + stepStyle + '><span ' + numStyle + '>Step 3 — Treat</span><br/>'
            + '<span ' + prodStyle + '>Vitamin C Brightening Serum</span> <span style="color: #999;">SERENE</span><br/>'
            + '<span ' + descStyle + '>3 drops — antioxidant protection against environmental stressors.</span></div>'
            + '<div ' + stepStyle + '><span ' + numStyle + '>Step 4 — Moisturize</span><br/>'
            + '<span ' + prodStyle + '>Hydra-Calm Sensitive Moisturizer</span> <span style="color: #999;">SERENE</span><br/>'
            + '<span ' + descStyle + '>Seals everything in with ceramides and peptides.</span></div>'
            + '<div ' + stepStyle + '><span ' + numStyle + '>Step 5 — Protect</span><br/>'
            + '<span ' + prodStyle + '>Invisible Shield SPF 50</span> <span style="color: #999;">SERENE</span><br/>'
            + '<span ' + descStyle + '>Sheer, weightless sun protection to finish your routine.</span></div>';
    }

    // ─── Date Derivation ─────────────────────────────────────────────

    /**
     * Parse relative time text into an actual date.
     * Handles patterns like "in two weeks", "next month", "in 3 days", "tomorrow".
     */
    private Date deriveEventDateFromText(String text) {
        if (String.isBlank(text)) return null;

        String lower = text.toLowerCase().trim();

        // "tomorrow"
        if (lower.contains('tomorrow')) {
            return Date.today().addDays(1);
        }

        // "next week"
        if (lower.contains('next week')) {
            return Date.today().addDays(7);
        }

        // "next month"
        if (lower.contains('next month')) {
            return Date.today().addMonths(1);
        }

        // "next year"
        if (lower.contains('next year')) {
            return Date.today().addMonths(12);
        }

        // Word-based: "in two weeks", "in three days", etc.
        Map<String, Integer> wordNumbers = new Map<String, Integer>{
            'one' => 1, 'two' => 2, 'three' => 3, 'four' => 4, 'five' => 5,
            'six' => 6, 'seven' => 7, 'eight' => 8, 'nine' => 9, 'ten' => 10,
            'a couple' => 2, 'a few' => 3, 'several' => 5, 'a' => 1
        };

        // Pattern: "in X day(s)/week(s)/month(s)"
        Pattern p = Pattern.compile('in\\s+(\\w+(?:\\s+\\w+)?)\\s+(day|week|month)s?');
        Matcher m = p.matcher(lower);
        if (m.find()) {
            String numText = m.group(1);
            String unit = m.group(2);

            Integer num = wordNumbers.get(numText);
            if (num == null) {
                try { num = Integer.valueOf(numText); } catch (Exception e) { return null; }
            }

            if (unit == 'day') return Date.today().addDays(num);
            if (unit == 'week') return Date.today().addDays(num * 7);
            if (unit == 'month') return Date.today().addMonths(num);
        }

        // Pattern: just a number + unit without "in" prefix, e.g. "2 weeks"
        Pattern p2 = Pattern.compile('(\\d+)\\s+(day|week|month)s?');
        Matcher m2 = p2.matcher(lower);
        if (m2.find()) {
            Integer num = Integer.valueOf(m2.group(1));
            String unit = m2.group(2);

            if (unit == 'day') return Date.today().addDays(num);
            if (unit == 'week') return Date.today().addDays(num * 7);
            if (unit == 'month') return Date.today().addMonths(num);
        }

        return null;
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

    // ─── Customer Value Scoring ──────────────────────────────────────

    /**
     * Compute a Customer Value Score (0-100) based on loyalty status, tier, and engagement.
     * Used to gate paid media activation eligibility (CVS >= 80 qualifies).
     *
     * Scoring breakdown:
     * - Baseline: 50 points
     * - Active loyalty member: +15
     * - Gold/Platinum tier: +20, Silver: +10
     * - 5+ browse sessions (last 30 days): +10, 2+: +5
     * - Capped at 100
     */
    private Decimal computeCustomerValueScore(Id contactId) {
        if (contactId == null) return 50;

        Decimal score = 50;

        // Check loyalty membership and tier
        try {
            List<LoyaltyProgramMember> members = [
                SELECT Id, MemberStatus
                FROM LoyaltyProgramMember
                WHERE ContactId = :contactId
                  AND MemberStatus = 'Active'
                LIMIT 1
            ];

            if (!members.isEmpty()) {
                // Active loyalty member bonus
                score += 15;

                // Check tier level — query all tiers and pick the highest
                // (CreatedDate may be identical across tiers, so we rank explicitly)
                Id memberId = members[0].Id;
                List<LoyaltyMemberTier> tiers = [
                    SELECT LoyaltyTier.Name
                    FROM LoyaltyMemberTier
                    WHERE LoyaltyMemberId = :memberId
                ];

                if (!tiers.isEmpty()) {
                    // Find the highest tier across all records
                    Map<String, Integer> tierRank = new Map<String, Integer>{
                        'Bronze' => 1, 'Silver' => 2, 'Gold' => 3, 'Platinum' => 4
                    };
                    String bestTier = tiers[0].LoyaltyTier.Name;
                    Integer bestRank = tierRank.containsKey(bestTier) ? tierRank.get(bestTier) : 0;
                    for (LoyaltyMemberTier t : tiers) {
                        String tn = t.LoyaltyTier.Name;
                        Integer r = tierRank.containsKey(tn) ? tierRank.get(tn) : 0;
                        if (r > bestRank) { bestTier = tn; bestRank = r; }
                    }
                    if (bestTier == 'Gold' || bestTier == 'Platinum') {
                        score += 20;
                    } else if (bestTier == 'Silver') {
                        score += 10;
                    }
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'CVS: Loyalty query failed: ' + e.getMessage());
        }

        // Check recent browse engagement
        try {
            String customerIdStr = String.valueOf(contactId);
            Integer browseCount = [
                SELECT COUNT()
                FROM Browse_Session__c
                WHERE Customer_Id__c = :customerIdStr
                  AND Session_Date__c >= :Date.today().addDays(-30)
            ];

            if (browseCount >= 5) {
                score += 10;
            } else if (browseCount >= 2) {
                score += 5;
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'CVS: Browse query failed: ' + e.getMessage());
        }

        return Math.min(score, 100);
    }
}
