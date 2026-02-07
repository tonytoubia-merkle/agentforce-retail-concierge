/**
 * JourneyApprovalService - Handles approval, decline, and send actions
 * for personalized journey content.
 *
 * Called from the LWC Dashboard when marketers review and approve journeys.
 */
public with sharing class JourneyApprovalService {

    // ─── Input/Output Classes ─────────────────────────────────────────

    public class ApprovalActionRequest {
        @InvocableVariable(required=true label='Approval Record ID')
        public Id approvalId;

        @InvocableVariable(required=true label='Action')
        public String action; // approve, decline, regenerate_image, send

        @InvocableVariable(required=false label='Approved Subject')
        public String approvedSubject;

        @InvocableVariable(required=false label='Approved Body')
        public String approvedBody;

        @InvocableVariable(required=false label='Decline Reason')
        public String declineReason;

        @InvocableVariable(required=false label='New Firefly Prompt')
        public String newFireflyPrompt;
    }

    public class ApprovalActionResult {
        @InvocableVariable
        public Boolean success;

        @InvocableVariable
        public String message;

        @InvocableVariable
        public String newStatus;

        @InvocableVariable
        public String newImageUrl;

        @InvocableVariable
        public String errorMessage;
    }

    // ─── Invocable Method ─────────────────────────────────────────────

    @InvocableMethod(label='Process Journey Approval Action' description='Handles approve, decline, regenerate, and send actions')
    public static List<ApprovalActionResult> processActions(List<ApprovalActionRequest> requests) {
        List<ApprovalActionResult> results = new List<ApprovalActionResult>();

        for (ApprovalActionRequest req : requests) {
            ApprovalActionResult result = new ApprovalActionResult();
            try {
                Journey_Approval__c approval = [
                    SELECT Id, Status__c, Contact__c, Meaningful_Event__c,
                           Suggested_Subject__c, Suggested_Body__c,
                           Approved_Subject__c, Approved_Body__c,
                           Generated_Image_URL__c, Image_Content_Version_Id__c,
                           Firefly_Prompt__c, Event_Summary__c,
                           Reviewed_By__c, Reviewed_At__c
                    FROM Journey_Approval__c
                    WHERE Id = :req.approvalId
                    LIMIT 1
                ];

                switch on req.action.toLowerCase() {
                    when 'approve' {
                        result = approveJourney(approval, req);
                    }
                    when 'decline' {
                        result = declineJourney(approval, req);
                    }
                    when 'regenerate_image' {
                        result = regenerateImage(approval, req);
                    }
                    when 'send' {
                        result = sendJourney(approval);
                    }
                    when else {
                        result.success = false;
                        result.errorMessage = 'Unknown action: ' + req.action;
                    }
                }
            } catch (Exception e) {
                result.success = false;
                result.errorMessage = e.getMessage();
            }
            results.add(result);
        }

        return results;
    }

    // ─── Action Handlers ──────────────────────────────────────────────

    /**
     * Approve a journey - saves marketer edits and marks as approved.
     */
    private static ApprovalActionResult approveJourney(Journey_Approval__c approval, ApprovalActionRequest req) {
        ApprovalActionResult result = new ApprovalActionResult();

        // Save approved content (use suggested if not edited)
        approval.Approved_Subject__c = String.isNotBlank(req.approvedSubject)
            ? req.approvedSubject : approval.Suggested_Subject__c;
        approval.Approved_Body__c = String.isNotBlank(req.approvedBody)
            ? req.approvedBody : approval.Suggested_Body__c;

        // Update status and reviewer
        approval.Status__c = 'Approved';
        approval.Reviewed_By__c = UserInfo.getUserId();
        approval.Reviewed_At__c = Datetime.now();

        update approval;

        // Update source event
        updateSourceEvent(approval.Meaningful_Event__c, 'Journey Sent');

        result.success = true;
        result.message = 'Journey approved successfully';
        result.newStatus = 'Approved';

        return result;
    }

    /**
     * Decline a journey - records reason and marks as declined.
     */
    private static ApprovalActionResult declineJourney(Journey_Approval__c approval, ApprovalActionRequest req) {
        ApprovalActionResult result = new ApprovalActionResult();

        approval.Status__c = 'Declined';
        approval.Decline_Reason__c = req.declineReason;
        approval.Reviewed_By__c = UserInfo.getUserId();
        approval.Reviewed_At__c = Datetime.now();

        update approval;

        // Update source event
        updateSourceEvent(approval.Meaningful_Event__c, 'Declined');

        result.success = true;
        result.message = 'Journey declined';
        result.newStatus = 'Declined';

        return result;
    }

    /**
     * Regenerate the Firefly image with a new or modified prompt.
     */
    private static ApprovalActionResult regenerateImage(Journey_Approval__c approval, ApprovalActionRequest req) {
        ApprovalActionResult result = new ApprovalActionResult();

        String prompt = String.isNotBlank(req.newFireflyPrompt)
            ? req.newFireflyPrompt : approval.Firefly_Prompt__c;

        // Call Firefly service
        FireflyApexService.ImageGenerationRequest fireflyReq = new FireflyApexService.ImageGenerationRequest();
        fireflyReq.prompt = prompt;
        fireflyReq.saveToFiles = true;

        List<FireflyApexService.ImageGenerationResult> fireflyResults =
            FireflyApexService.generateImages(new List<FireflyApexService.ImageGenerationRequest>{fireflyReq});

        if (!fireflyResults.isEmpty() && fireflyResults[0].success) {
            approval.Generated_Image_URL__c = fireflyResults[0].imageUrl;
            approval.Image_Content_Version_Id__c = fireflyResults[0].contentVersionId;
            approval.Firefly_Prompt__c = prompt;

            update approval;

            result.success = true;
            result.message = 'Image regenerated successfully';
            result.newImageUrl = fireflyResults[0].imageUrl;
        } else {
            result.success = false;
            result.errorMessage = fireflyResults.isEmpty() ? 'No result' : fireflyResults[0].errorMessage;
        }

        return result;
    }

    /**
     * Send the approved journey to Marketing Cloud.
     */
    private static ApprovalActionResult sendJourney(Journey_Approval__c approval) {
        ApprovalActionResult result = new ApprovalActionResult();

        if (approval.Status__c != 'Approved') {
            result.success = false;
            result.errorMessage = 'Journey must be approved before sending';
            return result;
        }

        try {
            // Get contact email
            Contact contact = [SELECT Email, FirstName FROM Contact WHERE Id = :approval.Contact__c LIMIT 1];

            if (String.isBlank(contact.Email)) {
                result.success = false;
                result.errorMessage = 'Contact has no email address';
                return result;
            }

            // Fire journey entry to Marketing Cloud
            String journeyKey = fireMarketingCloudJourney(approval, contact);

            // Update approval record
            approval.Status__c = 'Sent';
            approval.MC_Journey_Key__c = journeyKey;
            approval.Sent_At__c = Datetime.now();

            update approval;

            // Update source event
            updateSourceEvent(approval.Meaningful_Event__c, 'Journey Sent');

            result.success = true;
            result.message = 'Journey sent to ' + contact.Email;
            result.newStatus = 'Sent';

        } catch (Exception e) {
            approval.Status__c = 'Failed';
            update approval;

            result.success = false;
            result.errorMessage = 'Send failed: ' + e.getMessage();
        }

        return result;
    }

    // ─── Marketing Cloud Integration ──────────────────────────────────

    /**
     * Fire a journey entry event to Marketing Cloud.
     * Uses the MC Advanced REST API.
     */
    private static String fireMarketingCloudJourney(Journey_Approval__c approval, Contact contact) {
        Marketing_Agent_Settings__c settings = Marketing_Agent_Settings__c.getOrgDefaults();
        String subdomain = settings?.MC_Subdomain__c;

        if (String.isBlank(subdomain)) {
            throw new JourneyApprovalException('Marketing Cloud subdomain not configured');
        }

        // Get MC access token
        String token = getMcAccessToken(subdomain);

        // Fire journey entry
        String eventKey = 'personalized-journey-entry';
        String journeyKey = 'personal-journey-' + approval.Id;

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://' + subdomain + '.rest.marketingcloudapis.com/interaction/v1/events');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + token);

        Map<String, Object> payload = new Map<String, Object>{
            'ContactKey' => contact.Email,
            'EventDefinitionKey' => eventKey,
            'Data' => new Map<String, Object>{
                'ContactKey' => contact.Email,
                'FirstName' => contact.FirstName,
                'Subject' => approval.Approved_Subject__c,
                'Body' => approval.Approved_Body__c,
                'ImageUrl' => approval.Generated_Image_URL__c,
                'JourneyApprovalId' => approval.Id
            }
        };

        req.setBody(JSON.serialize(payload));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200 && res.getStatusCode() != 201) {
            throw new JourneyApprovalException('MC API error: ' + res.getStatusCode() + ' - ' + res.getBody());
        }

        return journeyKey;
    }

    /**
     * Get Marketing Cloud access token.
     */
    private static String getMcAccessToken(String subdomain) {
        // In production, use Named Credentials or cache tokens
        // This is a simplified implementation

        Marketing_Agent_Settings__c settings = Marketing_Agent_Settings__c.getOrgDefaults();
        String clientId = settings?.get('MC_Client_Id__c')?.toString();
        String clientSecret = settings?.get('MC_Client_Secret__c')?.toString();

        if (String.isBlank(clientId) || String.isBlank(clientSecret)) {
            throw new JourneyApprovalException('Marketing Cloud credentials not configured');
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://' + subdomain + '.auth.marketingcloudapis.com/v2/token');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');

        Map<String, Object> body = new Map<String, Object>{
            'grant_type' => 'client_credentials',
            'client_id' => clientId,
            'client_secret' => clientSecret
        };
        req.setBody(JSON.serialize(body));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new JourneyApprovalException('MC OAuth failed: ' + res.getStatusCode());
        }

        Map<String, Object> tokenData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        return (String) tokenData.get('access_token');
    }

    // ─── Utility Methods ──────────────────────────────────────────────

    /**
     * Update the source Meaningful_Event__c record status.
     */
    private static void updateSourceEvent(Id eventId, String status) {
        if (eventId == null) return;

        try {
            Meaningful_Event__c event = new Meaningful_Event__c(Id = eventId);
            event.Approval_Status__c = status;
            if (status == 'Journey Sent') {
                event.Journey_Triggered__c = true;
            }
            update event;
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to update source event: ' + e.getMessage());
        }
    }

    // ─── AuraEnabled Methods for LWC ──────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static List<Journey_Approval__c> getPendingApprovals() {
        return [
            SELECT Id, Name, Status__c, Urgency__c, Event_Type__c, Event_Date__c,
                   Days_Until_Event__c, Event_Summary__c,
                   Suggested_Subject__c, Suggested_Body__c,
                   Approved_Subject__c, Approved_Body__c,
                   Generated_Image_URL__c, Firefly_Prompt__c,
                   Contact__c, Contact__r.Name, Contact__r.Email,
                   Meaningful_Event__c, CreatedDate
            FROM Journey_Approval__c
            WHERE Status__c = 'Pending'
            ORDER BY Days_Until_Event__c ASC NULLS LAST, CreatedDate DESC
            LIMIT 50
        ];
    }

    @AuraEnabled
    public static ApprovalActionResult approveJourneyFromLWC(Id approvalId, String subject, String body) {
        ApprovalActionRequest req = new ApprovalActionRequest();
        req.approvalId = approvalId;
        req.action = 'approve';
        req.approvedSubject = subject;
        req.approvedBody = body;

        List<ApprovalActionResult> results = processActions(new List<ApprovalActionRequest>{req});
        return results[0];
    }

    @AuraEnabled
    public static ApprovalActionResult declineJourneyFromLWC(Id approvalId, String reason) {
        ApprovalActionRequest req = new ApprovalActionRequest();
        req.approvalId = approvalId;
        req.action = 'decline';
        req.declineReason = reason;

        List<ApprovalActionResult> results = processActions(new List<ApprovalActionRequest>{req});
        return results[0];
    }

    @AuraEnabled
    public static ApprovalActionResult regenerateImageFromLWC(Id approvalId, String newPrompt) {
        ApprovalActionRequest req = new ApprovalActionRequest();
        req.approvalId = approvalId;
        req.action = 'regenerate_image';
        req.newFireflyPrompt = newPrompt;

        List<ApprovalActionResult> results = processActions(new List<ApprovalActionRequest>{req});
        return results[0];
    }

    @AuraEnabled
    public static ApprovalActionResult sendJourneyFromLWC(Id approvalId) {
        ApprovalActionRequest req = new ApprovalActionRequest();
        req.approvalId = approvalId;
        req.action = 'send';

        List<ApprovalActionResult> results = processActions(new List<ApprovalActionRequest>{req});
        return results[0];
    }

    // ─── Custom Exception ─────────────────────────────────────────────

    public class JourneyApprovalException extends Exception {}
}
