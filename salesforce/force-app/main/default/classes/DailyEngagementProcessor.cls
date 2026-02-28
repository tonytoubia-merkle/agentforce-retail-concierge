/**
 * DailyEngagementProcessor - Nightly batch that creates personalized journey
 * campaigns for ALL identified customers who interacted yesterday, regardless
 * of whether a meaningful event was detected.
 *
 * Complements JourneyBatchProcessor (which only processes life-event
 * meaningful events). This catches the other 80-90% of daily visitors:
 * ad-referred browsers, organic shoppers, chatters without life events, etc.
 *
 * Data sources per customer:
 *   - Browse_Session__c (categories, products, duration, UTM params)
 *   - Campaign_Decode__c (rich campaign context from UTM lookup)
 *   - Chat_Summary__c (if agent conversation happened)
 *   - Agent_Captured_Profile__c (enriched profile fields)
 *   - Contact (loyalty, opt-in channels)
 *
 * Runs at 3 AM UTC — one hour after JourneyBatchProcessor (2 AM).
 * Batch size: 50 Browse_Session__c records per execution.
 */
global class DailyEngagementProcessor
    implements Database.Batchable<SObject>, Database.AllowsCallouts, Schedulable {

    // ─── Constants ──────────────────────────────────────────────────────

    private static final Integer BATCH_SIZE = 50;
    private static final Integer COOLDOWN_DAYS = 7;
    private static final Integer DEFAULT_JOURNEY_DAYS = 7;
    private static final String EVENT_TYPE = 'daily-engagement';
    private static final String DEFAULT_URGENCY = 'Future';

    private static final String GUARDRAILS_JSON = JSON.serialize(new Map<String, Object>{
        'maxEmailsPerWeek' => 2,
        'maxSMSPerWeek' => 1,
        'exitOnPurchase' => true,
        'quietHoursStart' => '22:00',
        'quietHoursEnd' => '08:00',
        'journeyType' => 'engagement',
        'cooldownDays' => COOLDOWN_DAYS
    });

    // Stats for finish()
    private Integer totalSessionsProcessed = 0;
    private Integer uniqueCustomers = 0;
    private Integer journeysCreated = 0;
    private Integer skippedAlreadyTargeted = 0;
    private Integer skippedNoChannels = 0;
    private Integer skippedNoContact = 0;

    // ─── Scheduling ─────────────────────────────────────────────────────

    public static void scheduleNightly() {
        System.schedule('Daily Engagement Processor', '0 0 3 * * ?',
            new DailyEngagementProcessor());
    }

    global void execute(SchedulableContext sc) {
        Database.executeBatch(new DailyEngagementProcessor(), BATCH_SIZE);
    }

    // ─── Batchable Implementation ───────────────────────────────────────

    global Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([
            SELECT Customer_Id__c, Session_Date__c,
                   Categories_Browsed__c, Products_Viewed__c,
                   Duration_Minutes__c, Device__c,
                   UTM_Campaign__c, UTM_Source__c, UTM_Medium__c
            FROM Browse_Session__c
            WHERE Session_Date__c = YESTERDAY
              AND Customer_Id__c != null
            ORDER BY Customer_Id__c, Session_Date__c DESC
        ]);
    }

    global void execute(Database.BatchableContext bc, List<Browse_Session__c> sessions) {
        totalSessionsProcessed += sessions.size();

        // 1. Group sessions by Customer_Id__c
        Map<String, List<Browse_Session__c>> byCustomer = new Map<String, List<Browse_Session__c>>();
        for (Browse_Session__c s : sessions) {
            if (!byCustomer.containsKey(s.Customer_Id__c)) {
                byCustomer.put(s.Customer_Id__c, new List<Browse_Session__c>());
            }
            byCustomer.get(s.Customer_Id__c).add(s);
        }

        Set<String> customerIds = byCustomer.keySet();
        uniqueCustomers += customerIds.size();

        // 2. Resolve Contact IDs
        Map<String, Id> contactMap = resolveContacts(customerIds);

        // 3. Exclude already-targeted contacts (cooldown period)
        Set<Id> contactIdSet = new Set<Id>();
        for (Id cId : contactMap.values()) {
            if (cId != null) contactIdSet.add(cId);
        }
        Set<Id> recentlyTargeted = getRecentlyTargetedContacts(contactIdSet);

        // 4. Get opted-in channels per contact
        Map<Id, List<String>> channelMap = new Map<Id, List<String>>();
        for (Id cId : contactMap.values()) {
            if (cId != null && !recentlyTargeted.contains(cId)) {
                channelMap.put(cId, JourneyStepService.getContactChannels(cId));
            }
        }

        // 5. Process each customer
        List<Journey_Approval__c> approvalsToInsert = new List<Journey_Approval__c>();
        Integer counter = 0;

        for (String custId : byCustomer.keySet()) {
            Id contactId = contactMap.get(custId);

            if (contactId == null) {
                skippedNoContact++;
                continue;
            }
            if (recentlyTargeted.contains(contactId)) {
                skippedAlreadyTargeted++;
                continue;
            }

            List<String> channels = channelMap.get(contactId);
            if (channels == null || channels.isEmpty()) {
                skippedNoChannels++;
                continue;
            }

            try {
                List<Journey_Approval__c> customerApprovals = processCustomer(
                    custId, contactId, byCustomer.get(custId), channels, counter
                );
                approvalsToInsert.addAll(customerApprovals);
                if (!customerApprovals.isEmpty()) {
                    journeysCreated++;
                    counter++;
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR,
                    'DailyEngagement: Error processing customer ' + custId + ': ' + e.getMessage());
            }
        }

        // 6. Insert Journey_Approval__c records
        if (!approvalsToInsert.isEmpty()) {
            Database.insert(approvalsToInsert, false); // AllowPartial
        }

        // 7. Assign portfolios
        List<Id> approvalIds = new List<Id>();
        for (Journey_Approval__c ja : approvalsToInsert) {
            if (ja.Id != null) approvalIds.add(ja.Id);
        }
        if (!approvalIds.isEmpty()) {
            try {
                PortfolioAssignmentService.assignBulk(approvalIds);
            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR,
                    'DailyEngagement: Portfolio assignment error: ' + e.getMessage());
            }
        }
    }

    global void finish(Database.BatchableContext bc) {
        System.debug('══════════════════════════════════════════════════');
        System.debug('DailyEngagementProcessor Complete');
        System.debug('Sessions processed: ' + totalSessionsProcessed);
        System.debug('Unique customers: ' + uniqueCustomers);
        System.debug('Journeys created: ' + journeysCreated);
        System.debug('Skipped (already targeted): ' + skippedAlreadyTargeted);
        System.debug('Skipped (no channels): ' + skippedNoChannels);
        System.debug('Skipped (no contact): ' + skippedNoContact);
        System.debug('══════════════════════════════════════════════════');

        // Send notification if any journeys were created
        if (journeysCreated > 0) {
            sendNotification();
        }
    }

    // ─── Per-Customer Processing ────────────────────────────────────────

    private List<Journey_Approval__c> processCustomer(
        String customerId,
        Id contactId,
        List<Browse_Session__c> sessions,
        List<String> channels,
        Integer counter
    ) {
        // Get contact name
        String contactName = 'there';
        try {
            Contact c = [SELECT FirstName FROM Contact WHERE Id = :contactId LIMIT 1];
            if (String.isNotBlank(c.FirstName)) contactName = c.FirstName;
        } catch (Exception e) { /* use default */ }

        // ── Aggregate browse context ──
        Set<String> allCategories = new Set<String>();
        Set<String> allProducts = new Set<String>();
        Integer totalDuration = 0;
        String device = 'desktop';
        String utmCampaign = null;
        String utmSource = null;
        String utmMedium = null;

        for (Browse_Session__c s : sessions) {
            if (String.isNotBlank(s.Categories_Browsed__c)) {
                allCategories.addAll(s.Categories_Browsed__c.split(';'));
            }
            if (String.isNotBlank(s.Products_Viewed__c)) {
                allProducts.addAll(s.Products_Viewed__c.split(';'));
            }
            totalDuration += (s.Duration_Minutes__c != null) ? s.Duration_Minutes__c.intValue() : 0;
            if (s.Device__c != null) device = s.Device__c;
            // Take the first non-null UTM (most recent session due to ORDER BY)
            if (utmCampaign == null && String.isNotBlank(s.UTM_Campaign__c)) {
                utmCampaign = s.UTM_Campaign__c;
                utmSource = s.UTM_Source__c;
                utmMedium = s.UTM_Medium__c;
            }
        }

        String browseContext = 'Categories: ' + String.join(new List<String>(allCategories), ', ')
            + '\nProducts viewed: ' + String.join(new List<String>(allProducts), ', ')
            + '\nTotal browse time: ' + totalDuration + ' minutes'
            + '\nDevice: ' + device;

        // ── Campaign decode ──
        String campaignContext = null;
        if (String.isNotBlank(utmCampaign)) {
            try {
                // Use the invocable method for a clean DecodeResult
                CampaignDecodeService.DecodeRequest decReq = new CampaignDecodeService.DecodeRequest();
                decReq.utmCampaign = utmCampaign;
                List<CampaignDecodeService.DecodeResult> decResults =
                    CampaignDecodeService.decodeCampaign(new List<CampaignDecodeService.DecodeRequest>{ decReq });
                if (!decResults.isEmpty() && decResults[0].found) {
                    CampaignDecodeService.DecodeResult dec = decResults[0];
                    campaignContext = dec.agentContextSummary;
                    if (String.isBlank(campaignContext)) {
                        campaignContext = 'Campaign: ' + dec.campaignName
                            + ' | Theme: ' + dec.campaignTheme
                            + ' | Interests: ' + dec.inferredInterests
                            + ' | Intent: ' + dec.inferredIntentSignals;
                    }
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Campaign decode lookup failed for ' + utmCampaign + ': ' + e.getMessage());
            }
        }

        // ── Chat context ──
        String chatContext = null;
        List<Chat_Summary__c> chats = [
            SELECT Summary_Text__c, Sentiment__c, Topics_Discussed__c
            FROM Chat_Summary__c
            WHERE Customer_Id__c = :customerId
              AND Session_Date__c = YESTERDAY
            ORDER BY CreatedDate DESC
            LIMIT 3
        ];
        if (!chats.isEmpty()) {
            List<String> chatParts = new List<String>();
            for (Chat_Summary__c ch : chats) {
                String part = '';
                if (String.isNotBlank(ch.Summary_Text__c)) part += ch.Summary_Text__c;
                if (String.isNotBlank(ch.Sentiment__c)) part += ' (Sentiment: ' + ch.Sentiment__c + ')';
                if (String.isNotBlank(ch.Topics_Discussed__c)) part += ' Topics: ' + ch.Topics_Discussed__c;
                chatParts.add(part.trim());
            }
            chatContext = String.join(chatParts, '\n');
        }

        // ── Profile context ──
        String profileContext = null;
        List<Agent_Captured_Profile__c> profileFields = [
            SELECT Field_Name__c, Field_Value__c
            FROM Agent_Captured_Profile__c
            WHERE Customer_Id__c = :customerId
            ORDER BY Captured_At__c DESC
            LIMIT 10
        ];
        if (!profileFields.isEmpty()) {
            List<String> profileParts = new List<String>();
            for (Agent_Captured_Profile__c pf : profileFields) {
                profileParts.add(pf.Field_Name__c + ': ' + pf.Field_Value__c);
            }
            profileContext = String.join(profileParts, '\n');
        }

        // ── Loyalty context ──
        String loyaltyContext = null;
        try {
            List<LoyaltyProgramMember> members = [
                SELECT MembershipNumber, MemberStatus
                FROM LoyaltyProgramMember
                WHERE Contact.Id = :contactId
                LIMIT 1
            ];
            if (!members.isEmpty()) {
                Id memberId = members[0].Id;
                // Tier
                String tierName = 'Unknown';
                try {
                    List<SObject> tiers = Database.query(
                        'SELECT LoyaltyTier.Name FROM LoyaltyMemberTier ' +
                        'WHERE LoyaltyProgramMemberId = \'' + memberId + '\' ' +
                        'ORDER BY CreatedDate DESC LIMIT 1'
                    );
                    if (!tiers.isEmpty()) {
                        SObject tier = ((SObject) tiers[0]).getSObject('LoyaltyTier');
                        if (tier != null) tierName = (String) tier.get('Name');
                    }
                } catch (Exception e) { /* tier query failed */ }
                // Points
                Decimal points = 0;
                try {
                    List<SObject> currencies = Database.query(
                        'SELECT PointsBalance FROM LoyaltyMemberCurrency ' +
                        'WHERE LoyaltyProgramMemberId = \'' + memberId + '\' LIMIT 1'
                    );
                    if (!currencies.isEmpty()) {
                        points = (Decimal) currencies[0].get('PointsBalance');
                    }
                } catch (Exception e) { /* points query failed */ }
                loyaltyContext = 'Tier: ' + tierName + ' | Points: ' + points.intValue();
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Loyalty lookup failed: ' + e.getMessage());
        }

        // ── Build engagement summary ──
        String engagementSummary = 'ENGAGEMENT TYPE: Daily Browse Engagement\n'
            + 'CUSTOMER NAME: ' + contactName + '\n'
            + 'INTERACTION DATE: ' + Date.today().addDays(-1).format() + '\n\n'
            + 'BROWSE ACTIVITY:\n' + browseContext + '\n\n'
            + 'CAMPAIGN ATTRIBUTION:\n' + (campaignContext != null ? campaignContext : 'Organic visit') + '\n\n'
            + 'CHAT CONTEXT:\n' + (chatContext != null ? chatContext : 'No agent interaction') + '\n\n'
            + 'PROFILE CONTEXT:\n' + (profileContext != null ? profileContext : 'No enriched profile data') + '\n\n'
            + 'LOYALTY:\n' + (loyaltyContext != null ? loyaltyContext : 'Not a loyalty member');

        // ── Call Campaign Agent ──
        CampaignAgentService.EngagementBriefRequest briefReq = new CampaignAgentService.EngagementBriefRequest();
        briefReq.contactName = contactName;
        briefReq.browseContext = browseContext;
        briefReq.campaignContext = campaignContext;
        briefReq.chatContext = chatContext;
        briefReq.profileContext = profileContext;
        briefReq.loyaltyContext = loyaltyContext;

        // Get product recommendations
        String productsJson = null;
        try {
            JourneyPromptBuilder.PromptResult promptResult =
                JourneyPromptBuilder.buildEnrichedPrompt(contactId, engagementSummary, EVENT_TYPE);
            if (promptResult != null && String.isNotBlank(promptResult.recommendedProductsJson)) {
                productsJson = promptResult.recommendedProductsJson;
                briefReq.suggestedProducts = promptResult.prompt; // product names in prompt form
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Product recommendation failed: ' + e.getMessage());
        }

        // Generate content
        CampaignAgentService.BriefGenerationResult briefResult;
        Map<String, String> fallbackContent = null;
        Boolean aiGenerated = false;

        try {
            List<CampaignAgentService.BriefGenerationResult> results =
                CampaignAgentService.generateEngagementBriefs(
                    new List<CampaignAgentService.EngagementBriefRequest>{ briefReq }
                );
            briefResult = results[0];
            aiGenerated = briefResult.success;
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Engagement agent failed, using fallback: ' + e.getMessage());
            briefResult = new CampaignAgentService.BriefGenerationResult();
            briefResult.success = false;
        }

        if (!briefResult.success) {
            fallbackContent = CampaignAgentService.generateEngagementFallback(browseContext, contactName);
        }

        // ── Determine journey steps ──
        List<JourneyStep> steps = buildJourneySteps(channels);

        // ── Compute confidence score ──
        Integer confidence = computeConfidence(
            campaignContext != null,
            allProducts.size(),
            chatContext != null,
            profileContext != null,
            loyaltyContext != null,
            totalDuration,
            allCategories.size(),
            aiGenerated
        );

        // ── Generate Journey ID ──
        String contactPrefix = String.valueOf(contactId).substring(0, Math.min(6, String.valueOf(contactId).length()));
        String dateStr = Date.today().format().replaceAll('[^0-9]', '');
        String journeyId = 'ENG-' + contactPrefix + '-' + dateStr + '-' + counter;

        // ── Create Journey_Approval__c records ──
        List<Journey_Approval__c> approvals = new List<Journey_Approval__c>();

        for (JourneyStep step : steps) {
            Journey_Approval__c ja = new Journey_Approval__c();
            ja.Contact__c = contactId;
            ja.Event_Type__c = EVENT_TYPE;
            ja.Event_Summary__c = engagementSummary.left(32768);
            ja.Urgency__c = DEFAULT_URGENCY;
            ja.Journey_Id__c = journeyId;
            ja.Step_Number__c = step.stepNumber;
            ja.Total_Steps__c = steps.size();
            ja.Channel__c = step.channel;
            ja.Send_Delay_Days__c = step.delayDays;
            ja.Status__c = 'Pending';
            ja.Confidence_Score__c = confidence;
            ja.Journey_Guardrails__c = GUARDRAILS_JSON;

            // Content
            if (briefResult.success) {
                ja.Suggested_Subject__c = briefResult.suggestedSubject;
                ja.Suggested_Body__c = briefResult.suggestedBody;
                ja.Firefly_Prompt__c = briefResult.fireflyPromptSuggestion;
                // Extract SMS from briefContent if present
                if (step.channel == 'SMS' && briefResult.briefContent != null
                    && briefResult.briefContent.contains('SMS: ')) {
                    Integer smsIdx = briefResult.briefContent.lastIndexOf('SMS: ');
                    ja.SMS_Body__c = briefResult.briefContent.substring(smsIdx + 5).trim();
                }
            } else if (fallbackContent != null) {
                ja.Suggested_Subject__c = fallbackContent.get('subject');
                ja.Suggested_Body__c = fallbackContent.get('body');
                ja.Firefly_Prompt__c = fallbackContent.get('imagePrompt');
                if (step.channel == 'SMS') {
                    ja.SMS_Body__c = fallbackContent.get('sms');
                }
            }

            if (String.isNotBlank(productsJson)) {
                ja.Recommended_Products__c = productsJson;
            }

            approvals.add(ja);
        }

        return approvals;
    }

    // ─── Journey Step Builder ───────────────────────────────────────────

    private class JourneyStep {
        Integer stepNumber;
        String channel;
        Integer delayDays;

        JourneyStep(Integer num, String ch, Integer delay) {
            this.stepNumber = num;
            this.channel = ch;
            this.delayDays = delay;
        }
    }

    private List<JourneyStep> buildJourneySteps(List<String> channels) {
        List<JourneyStep> steps = new List<JourneyStep>();
        Boolean hasEmail = channels.contains('Email');
        Boolean hasSMS = channels.contains('SMS');
        Boolean hasPush = channels.contains('Push');

        if (hasEmail && hasSMS && hasPush) {
            steps.add(new JourneyStep(1, 'Email', 1));
            steps.add(new JourneyStep(2, 'SMS', 3));
            steps.add(new JourneyStep(3, 'Push', 6));
        } else if (hasEmail && hasSMS) {
            steps.add(new JourneyStep(1, 'Email', 1));
            steps.add(new JourneyStep(2, 'SMS', 3));
            steps.add(new JourneyStep(3, 'Email', 6));
        } else if (hasEmail) {
            steps.add(new JourneyStep(1, 'Email', 1));
            steps.add(new JourneyStep(2, 'Email', 5));
        } else if (hasSMS) {
            steps.add(new JourneyStep(1, 'SMS', 1));
            steps.add(new JourneyStep(2, 'SMS', 5));
        } else if (hasPush) {
            steps.add(new JourneyStep(1, 'Push', 1));
            steps.add(new JourneyStep(2, 'Push', 5));
        }

        return steps;
    }

    // ─── Confidence Scoring ─────────────────────────────────────────────

    private Integer computeConfidence(
        Boolean hasCampaign,
        Integer productCount,
        Boolean hasChat,
        Boolean hasProfile,
        Boolean hasLoyalty,
        Integer browseDuration,
        Integer categoryCount,
        Boolean aiGenerated
    ) {
        Integer score = 5; // floor

        if (hasCampaign)            score += 20;
        if (productCount >= 3)      score += 15;
        if (hasChat)                score += 15;
        if (hasProfile)             score += 10;
        if (hasLoyalty)             score += 10;
        if (browseDuration > 5)     score += 10;
        if (categoryCount >= 2)     score += 10;
        if (aiGenerated)            score += 10;

        return Math.min(100, score);
    }

    // ─── Contact Resolution ─────────────────────────────────────────────

    private Map<String, Id> resolveContacts(Set<String> customerIds) {
        Map<String, Id> result = new Map<String, Id>();

        // Separate direct Contact IDs (003 prefix) from other identifiers
        Set<String> directIds = new Set<String>();
        Set<String> emailOrExternalIds = new Set<String>();

        for (String cid : customerIds) {
            if (cid.startsWith('003')) {
                directIds.add(cid);
                result.put(cid, Id.valueOf(cid));
            } else {
                emailOrExternalIds.add(cid);
            }
        }

        // Resolve non-direct IDs via Email lookup
        if (!emailOrExternalIds.isEmpty()) {
            for (Contact c : [
                SELECT Id, Email
                FROM Contact
                WHERE Email IN :emailOrExternalIds
            ]) {
                result.put(c.Email, c.Id);
            }
        }

        return result;
    }

    // ─── Exclusion Query ────────────────────────────────────────────────

    private Set<Id> getRecentlyTargetedContacts(Set<Id> contactIds) {
        Set<Id> targeted = new Set<Id>();
        if (contactIds == null || contactIds.isEmpty()) return targeted;

        for (AggregateResult ar : [
            SELECT Contact__c
            FROM Journey_Approval__c
            WHERE CreatedDate >= LAST_N_DAYS:7
              AND Status__c IN ('Pending', 'Approved', 'Sent')
              AND Contact__c IN :contactIds
            GROUP BY Contact__c
        ]) {
            targeted.add((Id) ar.get('Contact__c'));
        }

        return targeted;
    }

    // ─── Notification ───────────────────────────────────────────────────

    private void sendNotification() {
        try {
            // Count total pending engagement approvals
            Integer pendingCount = [
                SELECT COUNT()
                FROM Journey_Approval__c
                WHERE Status__c = 'Pending'
                  AND Event_Type__c = :EVENT_TYPE
            ];

            Marketing_Agent_Settings__c settings = Marketing_Agent_Settings__c.getOrgDefaults();
            String notifyEmails = (settings != null) ? settings.Notification_Emails__c : null;

            if (String.isBlank(notifyEmails)) {
                System.debug('No notification emails configured for engagement processor');
                return;
            }

            List<String> recipients = notifyEmails.split('[,;\\s]+');
            String subject = 'Daily Engagement: ' + journeysCreated + ' new journey'
                + (journeysCreated != 1 ? 's' : '') + ' created';
            String body = 'The Daily Engagement Processor has completed.\n\n'
                + 'New engagement journeys created: ' + journeysCreated + '\n'
                + 'Total pending engagement approvals: ' + pendingCount + '\n\n'
                + 'Sessions processed: ' + totalSessionsProcessed + '\n'
                + 'Unique customers: ' + uniqueCustomers + '\n'
                + 'Skipped (already targeted): ' + skippedAlreadyTargeted + '\n'
                + 'Skipped (no channels): ' + skippedNoChannels + '\n'
                + 'Skipped (no contact): ' + skippedNoContact + '\n\n'
                + 'Review pending approvals in the Journey Approval Dashboard.';

            Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
            email.setToAddresses(recipients);
            email.setSubject(subject);
            email.setPlainTextBody(body);
            email.setSaveAsActivity(false);
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR,
                'DailyEngagement notification error: ' + e.getMessage());
        }
    }
}
