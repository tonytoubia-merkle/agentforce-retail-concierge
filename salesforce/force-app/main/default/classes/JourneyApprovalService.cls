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

        @InvocableVariable(required=false label='Products JSON')
        public String productsJson;
    }

    public class ApprovalActionResult {
        @AuraEnabled @InvocableVariable
        public Boolean success;

        @AuraEnabled @InvocableVariable
        public String message;

        @AuraEnabled @InvocableVariable
        public String newStatus;

        @AuraEnabled @InvocableVariable
        public String newImageUrl;

        @AuraEnabled @InvocableVariable
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
                           Firefly_Prompt__c, Event_Summary__c, Event_Type__c,
                           Recommended_Products__c,
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
                    when 'update_products' {
                        result = updateProducts(approval, req);
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
     * Update products and regenerate the Firefly prompt.
     * Called when marketer changes product selection.
     */
    private static ApprovalActionResult updateProducts(Journey_Approval__c approval, ApprovalActionRequest req) {
        ApprovalActionResult result = new ApprovalActionResult();

        try {
            // Update products JSON
            approval.Recommended_Products__c = req.productsJson;

            // Rebuild prompt with new products
            JourneyPromptBuilder.PromptResult promptResult = JourneyPromptBuilder.rebuildPromptWithProducts(
                req.productsJson,
                approval.Event_Summary__c,
                approval.Event_Type__c
            );

            approval.Firefly_Prompt__c = promptResult.prompt;

            // Clear existing generated image since products changed
            approval.Generated_Image_URL__c = null;
            approval.Image_Content_Version_Id__c = null;

            update approval;

            result.success = true;
            result.message = 'Products updated and prompt regenerated';

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = 'Failed to update products: ' + e.getMessage();
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

    // ─── MC Advanced Integration via Platform Events ──────────────────

    /**
     * Publish a Platform Event to trigger MC Advanced Marketing Flow.
     * MC Advanced flows subscribe to Journey_Send_Request__e events
     * and handle the email send with personalized content.
     *
     * To configure in MC Advanced:
     * 1. Create a Marketing Flow triggered by Journey_Send_Request__e
     * 2. Use event fields for email personalization (Subject__c, Body__c, etc.)
     * 3. Configure email send action with dynamic content from event fields
     */
    private static String fireMarketingCloudJourney(Journey_Approval__c approval, Contact contact) {
        // Create Platform Event for MC Advanced
        Journey_Send_Request__e sendEvent = new Journey_Send_Request__e(
            Contact_Id__c = String.valueOf(contact.Id),
            Email__c = contact.Email,
            First_Name__c = contact.FirstName,
            Subject__c = approval.Approved_Subject__c,
            Body__c = approval.Approved_Body__c,
            Image_URL__c = approval.Generated_Image_URL__c,
            Approval_Id__c = String.valueOf(approval.Id),
            Event_Type__c = approval.Event_Type__c
        );

        // Publish the event
        Database.SaveResult result = EventBus.publish(sendEvent);

        if (!result.isSuccess()) {
            String errorMsg = '';
            for (Database.Error err : result.getErrors()) {
                errorMsg += err.getMessage() + '; ';
            }
            throw new JourneyApprovalException('Failed to publish journey event: ' + errorMsg);
        }

        // Return event ID as journey key
        return 'pe-' + result.getId();
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
                   Recommended_Products__c,
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

    @AuraEnabled
    public static ApprovalActionResult updateProductsFromLWC(Id approvalId, String productsJson) {
        ApprovalActionRequest req = new ApprovalActionRequest();
        req.approvalId = approvalId;
        req.action = 'update_products';
        req.productsJson = productsJson;

        List<ApprovalActionResult> results = processActions(new List<ApprovalActionRequest>{req});
        return results[0];
    }

    // ─── Custom Exception ─────────────────────────────────────────────

    public class JourneyApprovalException extends Exception {}
}
