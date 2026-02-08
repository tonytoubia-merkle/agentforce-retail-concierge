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

        @AuraEnabled @InvocableVariable
        public Id marketingFlowId;
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
     * If products are available, uses product composite + Firefly Expand.
     * Otherwise, falls back to text-only generation.
     */
    private static ApprovalActionResult regenerateImage(Journey_Approval__c approval, ApprovalActionRequest req) {
        ApprovalActionResult result = new ApprovalActionResult();

        String prompt = String.isNotBlank(req.newFireflyPrompt)
            ? req.newFireflyPrompt : approval.Firefly_Prompt__c;

        FireflyApexService.ImageGenerationResult fireflyResult;

        // Check if we have products to composite
        if (String.isNotBlank(approval.Recommended_Products__c)) {
            // Use product composite + Firefly Expand
            FireflyApexService.ProductImageRequest productReq = new FireflyApexService.ProductImageRequest();
            productReq.productsJson = approval.Recommended_Products__c;
            productReq.prompt = prompt;
            productReq.eventType = approval.Event_Type__c;
            productReq.saveToFiles = true;

            List<FireflyApexService.ImageGenerationResult> fireflyResults =
                FireflyApexService.generateWithProducts(new List<FireflyApexService.ProductImageRequest>{productReq});

            fireflyResult = fireflyResults.isEmpty() ? null : fireflyResults[0];
        } else {
            // Fall back to text-only generation
            FireflyApexService.ImageGenerationRequest textReq = new FireflyApexService.ImageGenerationRequest();
            textReq.prompt = prompt;
            textReq.saveToFiles = true;

            List<FireflyApexService.ImageGenerationResult> fireflyResults =
                FireflyApexService.generateImages(new List<FireflyApexService.ImageGenerationRequest>{textReq});

            fireflyResult = fireflyResults.isEmpty() ? null : fireflyResults[0];
        }

        if (fireflyResult != null && fireflyResult.success) {
            approval.Generated_Image_URL__c = fireflyResult.imageUrl;
            approval.Image_Content_Version_Id__c = fireflyResult.contentVersionId;
            approval.Firefly_Prompt__c = prompt;

            update approval;

            result.success = true;
            result.message = 'Image regenerated successfully';
            result.newImageUrl = fireflyResult.imageUrl;
        } else {
            result.success = false;
            result.errorMessage = fireflyResult == null ? 'No result' : fireflyResult.errorMessage;
        }

        return result;
    }

    /**
     * Update products and regenerate the Firefly prompt AND email body.
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

            // Also rebuild the email body with new product names
            String newBody = rebuildEmailBodyWithProducts(
                approval.Suggested_Body__c,
                req.productsJson,
                approval.Event_Type__c
            );
            approval.Suggested_Body__c = newBody;

            // Clear existing generated image since products changed
            approval.Generated_Image_URL__c = null;
            approval.Image_Content_Version_Id__c = null;

            update approval;

            result.success = true;
            result.message = 'Products updated - prompt and email body regenerated';

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = 'Failed to update products: ' + e.getMessage();
        }

        return result;
    }

    /**
     * Rebuild email body HTML with updated product recommendations.
     * Replaces the product section in the email with the new products.
     */
    private static String rebuildEmailBodyWithProducts(String currentBody, String productsJson, String eventType) {
        if (String.isBlank(productsJson)) {
            return currentBody;
        }

        // Parse products
        List<String> productNames = new List<String>();
        try {
            List<Object> parsed = (List<Object>) JSON.deserializeUntyped(productsJson);
            for (Object obj : parsed) {
                Map<String, Object> prodMap = (Map<String, Object>) obj;
                String name = (String) prodMap.get('name');
                if (String.isNotBlank(name)) {
                    productNames.add(name);
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to parse products: ' + e.getMessage());
            return currentBody;
        }

        if (productNames.isEmpty()) {
            return currentBody;
        }

        // Build product list HTML
        String productListHtml = '<ul style="margin: 16px 0; padding-left: 24px;">\n';
        for (String name : productNames) {
            productListHtml += '<li style="margin-bottom: 8px;"><strong>' + name + '</strong></li>\n';
        }
        productListHtml += '</ul>';

        // Try to replace existing product list in the body
        // Look for common patterns: <ul>...</ul> that contains product names
        String updatedBody = currentBody;

        // Pattern 1: Replace existing <ul>...</ul> section (simple approach)
        Pattern ulPattern = Pattern.compile('(?i)<ul[^>]*>.*?</ul>');
        Matcher ulMatcher = ulPattern.matcher(currentBody);
        if (ulMatcher.find()) {
            updatedBody = ulMatcher.replaceFirst(productListHtml);
        } else {
            // No existing list - append products before closing paragraph
            // Insert product section before "</p>" if the body has content
            if (updatedBody.contains('</p>')) {
                Integer lastPIndex = updatedBody.lastIndexOf('</p>');
                String beforeLast = updatedBody.substring(0, lastPIndex + 4);
                String afterLast = updatedBody.substring(lastPIndex + 4);
                updatedBody = beforeLast + '\n<p>Here are some products we think you\'ll love:</p>\n' + productListHtml + afterLast;
            }
        }

        return updatedBody;
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
                   Meaningful_Event__c, CreatedDate,
                   // Multi-step journey fields
                   Journey_Id__c, Step_Number__c, Total_Steps__c,
                   Channel__c, Send_Delay_Days__c, Scheduled_Send_Date__c,
                   SMS_Body__c, Journey_Guardrails__c
            FROM Journey_Approval__c
            WHERE Status__c = 'Pending'
            ORDER BY Journey_Id__c NULLS LAST, Step_Number__c ASC, Days_Until_Event__c ASC NULLS LAST, CreatedDate DESC
            LIMIT 100
        ];
    }

    /**
     * Approve all steps in a journey at once.
     * Returns the result of the operation.
     */
    @AuraEnabled
    public static ApprovalActionResult approveAllJourneySteps(String journeyId) {
        ApprovalActionResult result = new ApprovalActionResult();

        if (String.isBlank(journeyId)) {
            result.success = false;
            result.errorMessage = 'Journey ID is required';
            return result;
        }

        try {
            // Get all pending steps for this journey
            List<Journey_Approval__c> steps = [
                SELECT Id, Status__c, Step_Number__c, Send_Delay_Days__c,
                       Suggested_Subject__c, Suggested_Body__c
                FROM Journey_Approval__c
                WHERE Journey_Id__c = :journeyId
                AND Status__c = 'Pending'
            ];

            if (steps.isEmpty()) {
                result.success = false;
                result.errorMessage = 'No pending steps found for this journey';
                return result;
            }

            // Calculate scheduled send dates and approve all steps
            DateTime baseTime = DateTime.now();
            for (Journey_Approval__c step : steps) {
                step.Status__c = 'Approved';
                step.Reviewed_By__c = UserInfo.getUserId();
                step.Reviewed_At__c = DateTime.now();

                // Copy suggested to approved if not already set
                if (String.isBlank(step.Approved_Subject__c)) {
                    step.Approved_Subject__c = step.Suggested_Subject__c;
                }
                if (String.isBlank(step.Approved_Body__c)) {
                    step.Approved_Body__c = step.Suggested_Body__c;
                }

                // Calculate scheduled send date
                Integer delayDays = step.Send_Delay_Days__c != null ?
                    (Integer)step.Send_Delay_Days__c : 0;
                step.Scheduled_Send_Date__c = baseTime.addDays(delayDays);
            }

            update steps;

            result.success = true;
            result.message = 'Approved ' + steps.size() + ' journey steps';
            result.newStatus = 'Approved';

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = 'Failed to approve journey: ' + e.getMessage();
        }

        return result;
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

    /**
     * Send all approved steps in a journey to Marketing Cloud Advanced.
     * Creates a multi-step Marketing Flow via Platform Events.
     *
     * @param journeyId The unique journey identifier (Journey_Id__c)
     * @return ApprovalActionResult with success/error info
     */
    @AuraEnabled
    public static ApprovalActionResult sendJourneyToMarketingFlow(String journeyId) {
        ApprovalActionResult result = new ApprovalActionResult();

        if (String.isBlank(journeyId)) {
            result.success = false;
            result.errorMessage = 'Journey ID is required';
            return result;
        }

        try {
            // Get all approved steps for this journey
            List<Journey_Approval__c> steps = [
                SELECT Id, Status__c, Contact__c, Contact__r.Email, Contact__r.FirstName,
                       Approved_Subject__c, Approved_Body__c, Suggested_Subject__c, Suggested_Body__c,
                       SMS_Body__c, Generated_Image_URL__c, Event_Type__c,
                       Step_Number__c, Total_Steps__c, Channel__c,
                       Send_Delay_Days__c, Scheduled_Send_Date__c,
                       Meaningful_Event__c
                FROM Journey_Approval__c
                WHERE Journey_Id__c = :journeyId
                AND Status__c = 'Approved'
                ORDER BY Step_Number__c ASC
            ];

            if (steps.isEmpty()) {
                result.success = false;
                result.errorMessage = 'No approved steps found for this journey';
                return result;
            }

            // Validate contact email
            Contact contact = [
                SELECT Id, Email, FirstName
                FROM Contact
                WHERE Id = :steps[0].Contact__c
                LIMIT 1
            ];

            if (String.isBlank(contact.Email)) {
                result.success = false;
                result.errorMessage = 'Contact has no email address';
                return result;
            }

            // Create Marketing_Flow__c record to track this flow
            Marketing_Flow__c marketingFlow = new Marketing_Flow__c(
                Journey_Id__c = journeyId,
                Contact__c = contact.Id,
                Status__c = 'Pending',
                Steps_Count__c = steps.size(),
                Event_Type__c = steps[0].Event_Type__c,
                Sent_Date__c = Datetime.now()
            );
            insert marketingFlow;

            // Create Platform Events for each step
            // MC Advanced Marketing Flow will handle timing/delays based on step order
            List<Journey_Send_Request__e> events = new List<Journey_Send_Request__e>();

            for (Journey_Approval__c step : steps) {
                String subject = String.isNotBlank(step.Approved_Subject__c) ?
                    step.Approved_Subject__c : step.Suggested_Subject__c;
                String body = step.Channel__c == 'Email' ?
                    (String.isNotBlank(step.Approved_Body__c) ? step.Approved_Body__c : step.Suggested_Body__c) :
                    step.SMS_Body__c;

                Journey_Send_Request__e sendEvent = new Journey_Send_Request__e(
                    Contact_Id__c = String.valueOf(contact.Id),
                    Email__c = contact.Email,
                    First_Name__c = contact.FirstName,
                    Subject__c = subject,
                    Body__c = body,
                    Image_URL__c = step.Generated_Image_URL__c,
                    Approval_Id__c = String.valueOf(step.Id),
                    Event_Type__c = step.Event_Type__c,
                    Journey_Id__c = journeyId,
                    Step_Number__c = step.Step_Number__c,
                    Total_Steps__c = step.Total_Steps__c,
                    Channel__c = step.Channel__c,
                    Send_Delay_Days__c = step.Send_Delay_Days__c
                );

                events.add(sendEvent);
            }

            // Publish all events
            List<Database.SaveResult> publishResults = EventBus.publish(events);

            // Check results and update steps
            Integer successCount = 0;
            for (Integer i = 0; i < publishResults.size(); i++) {
                if (publishResults[i].isSuccess()) {
                    steps[i].Status__c = 'Sent';
                    steps[i].Sent_At__c = Datetime.now();
                    steps[i].MC_Journey_Key__c = 'pe-' + publishResults[i].getId();
                    steps[i].Marketing_Flow__c = marketingFlow.Id;
                    successCount++;
                } else {
                    steps[i].Status__c = 'Failed';
                }
            }

            update steps;

            // Update Marketing Flow status based on results
            if (successCount == steps.size()) {
                marketingFlow.Status__c = 'Created';
            } else if (successCount > 0) {
                marketingFlow.Status__c = 'Created'; // Partial success still counts as created
            } else {
                marketingFlow.Status__c = 'Failed';
            }
            update marketingFlow;

            // Update source event
            if (steps[0].Meaningful_Event__c != null) {
                updateSourceEvent(steps[0].Meaningful_Event__c, 'Journey Sent');
            }

            result.success = true;
            result.message = 'Sent ' + successCount + ' of ' + steps.size() + ' steps to Marketing Flow';
            result.newStatus = 'Sent';
            result.marketingFlowId = marketingFlow.Id;

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = 'Failed to send journey: ' + e.getMessage();
        }

        return result;
    }

    // ─── Custom Exception ─────────────────────────────────────────────

    public class JourneyApprovalException extends Exception {}
}
