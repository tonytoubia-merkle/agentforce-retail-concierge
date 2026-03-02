/**
 * JourneyStepService
 *
 * Service class for managing multi-step journey approvals.
 * Handles step navigation, bulk approval, scheduling, and guardrail validation.
 */
public with sharing class JourneyStepService {

    /**
     * Get all steps for a journey by Journey_Id__c
     *
     * @param journeyId The unique journey identifier
     * @return List of Journey_Approval__c records ordered by step number
     */
    @AuraEnabled(cacheable=true)
    public static List<Journey_Approval__c> getJourneySteps(String journeyId) {
        if (String.isBlank(journeyId)) {
            return new List<Journey_Approval__c>();
        }

        return [
            SELECT Id, Name, Contact__c, Contact__r.Name, Contact__r.Email,
                   Event_Type__c, Event_Date__c, Event_Summary__c,
                   Suggested_Subject__c, Suggested_Body__c, SMS_Body__c,
                   Recommended_Products__c, Firefly_Prompt__c, Generated_Image_URL__c,
                   Status__c, Urgency__c, Days_Until_Event__c,
                   Journey_Id__c, Step_Number__c, Total_Steps__c,
                   Channel__c, Send_Delay_Days__c, Scheduled_Send_Date__c,
                   Journey_Guardrails__c,
                   // Media activation fields
                   Media_Platform__c, Media_Ad_Format__c, Media_Creative_Brief__c,
                   Media_Audience_Signals__c, Media_Estimated_Reach__c,
                   Merkury_Activation_Status__c,
                   CreatedDate, LastModifiedDate
            FROM Journey_Approval__c
            WHERE Journey_Id__c = :journeyId
            ORDER BY Step_Number__c ASC
        ];
    }

    /**
     * Get a specific step by journey ID and step number
     *
     * @param journeyId The unique journey identifier
     * @param stepNumber The step number (1-based)
     * @return Journey_Approval__c record or null
     */
    @AuraEnabled(cacheable=true)
    public static Journey_Approval__c getJourneyStep(String journeyId, Integer stepNumber) {
        if (String.isBlank(journeyId) || stepNumber == null) {
            return null;
        }

        List<Journey_Approval__c> steps = [
            SELECT Id, Name, Contact__c, Contact__r.Name, Contact__r.Email,
                   Event_Type__c, Event_Date__c, Event_Summary__c,
                   Suggested_Subject__c, Suggested_Body__c, SMS_Body__c,
                   Recommended_Products__c, Firefly_Prompt__c, Generated_Image_URL__c,
                   Status__c, Urgency__c, Days_Until_Event__c,
                   Journey_Id__c, Step_Number__c, Total_Steps__c,
                   Channel__c, Send_Delay_Days__c, Scheduled_Send_Date__c,
                   Journey_Guardrails__c,
                   // Media activation fields
                   Media_Platform__c, Media_Ad_Format__c, Media_Creative_Brief__c,
                   Media_Audience_Signals__c, Media_Estimated_Reach__c,
                   Merkury_Activation_Status__c,
                   CreatedDate, LastModifiedDate
            FROM Journey_Approval__c
            WHERE Journey_Id__c = :journeyId
            AND Step_Number__c = :stepNumber
            LIMIT 1
        ];

        return steps.isEmpty() ? null : steps[0];
    }

    /**
     * Approve all steps in a journey at once
     *
     * @param journeyId The unique journey identifier
     * @return Map with success status and any error messages
     */
    @AuraEnabled
    public static Map<String, Object> approveAllSteps(String journeyId) {
        Map<String, Object> result = new Map<String, Object>();

        if (String.isBlank(journeyId)) {
            result.put('success', false);
            result.put('error', 'Journey ID is required');
            return result;
        }

        try {
            List<Journey_Approval__c> steps = [
                SELECT Id, Status__c, Step_Number__c, Send_Delay_Days__c,
                       Scheduled_Send_Date__c
                FROM Journey_Approval__c
                WHERE Journey_Id__c = :journeyId
                AND Status__c = 'Pending'
                FOR UPDATE
            ];

            // Sort by step number (ORDER BY not allowed with FOR UPDATE)
            Map<Decimal, Journey_Approval__c> stepsByNumber = new Map<Decimal, Journey_Approval__c>();
            for (Journey_Approval__c step : steps) {
                stepsByNumber.put(step.Step_Number__c, step);
            }
            List<Decimal> sortedStepNumbers = new List<Decimal>(stepsByNumber.keySet());
            sortedStepNumbers.sort();

            if (steps.isEmpty()) {
                result.put('success', false);
                result.put('error', 'No pending steps found for this journey');
                return result;
            }

            // Calculate scheduled send dates based on delays (process in sorted order)
            DateTime baseTime = DateTime.now();
            for (Decimal stepNum : sortedStepNumbers) {
                Journey_Approval__c step = stepsByNumber.get(stepNum);
                step.Status__c = 'Approved';

                // Calculate scheduled send date
                Integer delayDays = step.Send_Delay_Days__c != null ?
                    (Integer)step.Send_Delay_Days__c : 0;

                if (step.Step_Number__c == 1) {
                    // First step sends immediately
                    step.Scheduled_Send_Date__c = baseTime;
                } else {
                    // Subsequent steps add delay from previous step's scheduled time
                    baseTime = baseTime.addDays(delayDays);
                    step.Scheduled_Send_Date__c = baseTime;
                }
            }

            update steps;

            result.put('success', true);
            result.put('approvedCount', steps.size());
            result.put('message', 'All ' + steps.size() + ' steps approved successfully');
        } catch (Exception e) {
            result.put('success', false);
            result.put('error', e.getMessage());
        }

        return result;
    }

    /**
     * Decline all steps in a journey
     *
     * @param journeyId The unique journey identifier
     * @param reason The decline reason
     * @return Map with success status
     */
    @AuraEnabled
    public static Map<String, Object> declineAllSteps(String journeyId, String reason) {
        Map<String, Object> result = new Map<String, Object>();

        if (String.isBlank(journeyId)) {
            result.put('success', false);
            result.put('error', 'Journey ID is required');
            return result;
        }

        try {
            List<Journey_Approval__c> steps = [
                SELECT Id, Status__c
                FROM Journey_Approval__c
                WHERE Journey_Id__c = :journeyId
                AND Status__c = 'Pending'
                FOR UPDATE
            ];

            for (Journey_Approval__c step : steps) {
                step.Status__c = 'Declined';
            }

            update steps;

            result.put('success', true);
            result.put('declinedCount', steps.size());
        } catch (Exception e) {
            result.put('success', false);
            result.put('error', e.getMessage());
        }

        return result;
    }

    /**
     * Update content for a specific step
     *
     * @param approvalId The Journey_Approval__c record ID
     * @param subject Updated subject line
     * @param body Updated body content (email or SMS)
     * @param channel The channel type (Email, SMS, Push)
     * @return Map with success status
     */
    @AuraEnabled
    public static Map<String, Object> updateStepContent(
        Id approvalId,
        String subject,
        String body,
        String channel
    ) {
        Map<String, Object> result = new Map<String, Object>();

        try {
            Journey_Approval__c step = [
                SELECT Id, Channel__c
                FROM Journey_Approval__c
                WHERE Id = :approvalId
                LIMIT 1
            ];

            step.Suggested_Subject__c = subject;

            if (channel == 'Email') {
                step.Suggested_Body__c = body;
            } else {
                step.SMS_Body__c = body;
            }

            update step;

            result.put('success', true);
        } catch (Exception e) {
            result.put('success', false);
            result.put('error', e.getMessage());
        }

        return result;
    }

    /**
     * Calculate scheduled send dates for all steps in a journey
     *
     * @param journeyId The unique journey identifier
     * @param startDate The date/time to start the journey
     * @return Map with calculated dates for each step
     */
    @AuraEnabled
    public static Map<String, Object> calculateScheduledDates(String journeyId, DateTime startDate) {
        Map<String, Object> result = new Map<String, Object>();

        if (String.isBlank(journeyId)) {
            result.put('success', false);
            result.put('error', 'Journey ID is required');
            return result;
        }

        try {
            List<Journey_Approval__c> steps = [
                SELECT Id, Step_Number__c, Send_Delay_Days__c, Channel__c
                FROM Journey_Approval__c
                WHERE Journey_Id__c = :journeyId
                ORDER BY Step_Number__c ASC
            ];

            DateTime currentDate = startDate != null ? startDate : DateTime.now();
            List<Map<String, Object>> schedule = new List<Map<String, Object>>();

            for (Journey_Approval__c step : steps) {
                Integer delayDays = step.Send_Delay_Days__c != null ?
                    (Integer)step.Send_Delay_Days__c : 0;

                if (step.Step_Number__c > 1) {
                    currentDate = currentDate.addDays(delayDays);
                }

                Map<String, Object> stepInfo = new Map<String, Object>();
                stepInfo.put('stepNumber', step.Step_Number__c);
                stepInfo.put('channel', step.Channel__c);
                stepInfo.put('scheduledDate', currentDate);
                stepInfo.put('delayDays', delayDays);
                schedule.add(stepInfo);
            }

            result.put('success', true);
            result.put('schedule', schedule);
        } catch (Exception e) {
            result.put('success', false);
            result.put('error', e.getMessage());
        }

        return result;
    }

    /**
     * Parse and validate journey guardrails JSON
     *
     * @param guardrailsJson JSON string containing guardrails
     * @return Map with parsed guardrails or error
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> parseGuardrails(String guardrailsJson) {
        Map<String, Object> result = new Map<String, Object>();

        if (String.isBlank(guardrailsJson)) {
            result.put('success', true);
            result.put('guardrails', new Map<String, Object>());
            return result;
        }

        try {
            Map<String, Object> guardrails = (Map<String, Object>)JSON.deserializeUntyped(guardrailsJson);
            result.put('success', true);
            result.put('guardrails', guardrails);
        } catch (Exception e) {
            result.put('success', false);
            result.put('error', 'Invalid guardrails JSON: ' + e.getMessage());
        }

        return result;
    }

    /**
     * Get journey summary with all step details
     *
     * @param journeyId The unique journey identifier
     * @return Map with journey summary
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getJourneySummary(String journeyId) {
        Map<String, Object> result = new Map<String, Object>();

        if (String.isBlank(journeyId)) {
            result.put('success', false);
            result.put('error', 'Journey ID is required');
            return result;
        }

        try {
            List<Journey_Approval__c> steps = getJourneySteps(journeyId);

            if (steps.isEmpty()) {
                result.put('success', false);
                result.put('error', 'Journey not found');
                return result;
            }

            Journey_Approval__c firstStep = steps[0];

            // Count by status
            Integer pendingCount = 0;
            Integer approvedCount = 0;
            Integer declinedCount = 0;
            Integer sentCount = 0;

            // Count by channel
            Integer emailCount = 0;
            Integer smsCount = 0;
            Integer pushCount = 0;

            for (Journey_Approval__c step : steps) {
                if (step.Status__c == 'Pending') pendingCount++;
                else if (step.Status__c == 'Approved') approvedCount++;
                else if (step.Status__c == 'Declined') declinedCount++;
                else if (step.Status__c == 'Sent') sentCount++;

                if (step.Channel__c == 'Email') emailCount++;
                else if (step.Channel__c == 'SMS') smsCount++;
                else if (step.Channel__c == 'Push') pushCount++;
            }

            result.put('success', true);
            result.put('journeyId', journeyId);
            result.put('contactId', firstStep.Contact__c);
            result.put('contactName', firstStep.Contact__r.Name);
            result.put('eventType', firstStep.Event_Type__c);
            result.put('eventDate', firstStep.Event_Date__c);
            result.put('totalSteps', steps.size());
            result.put('pendingCount', pendingCount);
            result.put('approvedCount', approvedCount);
            result.put('declinedCount', declinedCount);
            result.put('sentCount', sentCount);
            result.put('emailCount', emailCount);
            result.put('smsCount', smsCount);
            result.put('pushCount', pushCount);
            result.put('steps', steps);
        } catch (Exception e) {
            result.put('success', false);
            result.put('error', e.getMessage());
        }

        return result;
    }

    /**
     * Generate a unique journey ID for a new multi-step journey
     *
     * @param contactId The contact ID
     * @param eventType The event type
     * @return Unique journey ID string
     */
    public static String generateJourneyId(Id contactId, String eventType) {
        String timestamp = String.valueOf(DateTime.now().getTime());
        String contactPrefix = contactId != null
            ? String.valueOf(contactId).substring(0, 10)
            : 'UNLINKED00';

        String eventCode = 'UNKNOWN';
        if (eventType != null) {
            String cleaned = eventType.replaceAll('[^a-zA-Z0-9]', '');
            eventCode = cleaned.substring(0, Math.min(cleaned.length(), 10));
        }

        return 'JRN-' + contactPrefix + '-' + eventCode + '-' + timestamp.right(8);
    }

    /**
     * Check if contact has opted in for a specific channel
     *
     * @param contactId The contact ID
     * @param channel The channel to check (Email, SMS, Push)
     * @return Boolean indicating opt-in status
     */
    @AuraEnabled(cacheable=true)
    public static Boolean isContactOptedIn(Id contactId, String channel) {
        if (contactId == null || String.isBlank(channel)) {
            return false;
        }

        try {
            Contact c = [
                SELECT Id, Email_Opt_In__c, SMS_Opt_In__c, Push_Opt_In__c
                FROM Contact
                WHERE Id = :contactId
                LIMIT 1
            ];

            switch on channel {
                when 'Email' {
                    return c.Email_Opt_In__c == true;
                }
                when 'SMS' {
                    return c.SMS_Opt_In__c == true;
                }
                when 'Push' {
                    return c.Push_Opt_In__c == true;
                }
                when else {
                    return false;
                }
            }
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Get all opted-in channels for a contact
     *
     * @param contactId The contact ID
     * @return List of channel names the contact is opted into
     */
    @AuraEnabled(cacheable=true)
    public static List<String> getContactChannels(Id contactId) {
        List<String> channels = new List<String>();

        if (contactId == null) {
            return channels;
        }

        try {
            Contact c = [
                SELECT Id, Email_Opt_In__c, SMS_Opt_In__c, Push_Opt_In__c
                FROM Contact
                WHERE Id = :contactId
                LIMIT 1
            ];

            if (c.Email_Opt_In__c == true) channels.add('Email');
            if (c.SMS_Opt_In__c == true) channels.add('SMS');
            if (c.Push_Opt_In__c == true) channels.add('Push');
        } catch (Exception e) {
            // Return empty list on error
        }

        return channels;
    }

    /**
     * Update the send delay for a specific journey step.
     *
     * @param approvalId The Journey_Approval__c record ID
     * @param delayDays Number of days to delay after previous step
     * @return Map with success status
     */
    @AuraEnabled
    public static Map<String, Object> updateStepTiming(Id approvalId, Integer delayDays) {
        Map<String, Object> result = new Map<String, Object>();

        try {
            Journey_Approval__c step = new Journey_Approval__c(
                Id = approvalId,
                Send_Delay_Days__c = delayDays
            );
            update step;

            result.put('success', true);
            result.put('message', 'Send timing updated');
        } catch (Exception e) {
            result.put('success', false);
            result.put('errorMessage', e.getMessage());
        }

        return result;
    }
}
