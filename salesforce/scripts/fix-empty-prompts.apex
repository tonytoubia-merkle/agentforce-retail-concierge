/**
 * Fix Empty Prompts Script
 *
 * Run this in Developer Console → Anonymous Apex to populate
 * Firefly_Prompt__c for any Journey_Approval__c records that
 * are missing it.
 */

// Get all pending approvals with empty prompts
List<Journey_Approval__c> approvalsToFix = [
    SELECT Id, Event_Type__c, Event_Summary__c, Recommended_Products__c,
           Firefly_Prompt__c, Contact__c
    FROM Journey_Approval__c
    WHERE Status__c = 'Pending'
    AND (Firefly_Prompt__c = null OR Firefly_Prompt__c = '')
];

System.debug('Found ' + approvalsToFix.size() + ' approvals with empty prompts');

if (approvalsToFix.isEmpty()) {
    // Also check if there are ANY pending approvals
    List<Journey_Approval__c> allPending = [
        SELECT Id, Firefly_Prompt__c, Event_Type__c, Event_Summary__c
        FROM Journey_Approval__c
        WHERE Status__c = 'Pending'
        LIMIT 5
    ];

    System.debug('Total pending approvals: ' + allPending.size());
    for (Journey_Approval__c a : allPending) {
        System.debug('Approval ' + a.Id + ' - Prompt: ' + (String.isBlank(a.Firefly_Prompt__c) ? '[EMPTY]' : a.Firefly_Prompt__c.substring(0, Math.min(50, a.Firefly_Prompt__c.length())) + '...'));
    }
}

for (Journey_Approval__c approval : approvalsToFix) {
    // Try to build prompt using JourneyPromptBuilder
    JourneyPromptBuilder.PromptResult result;

    if (String.isNotBlank(approval.Recommended_Products__c)) {
        // Rebuild from existing products
        result = JourneyPromptBuilder.rebuildPromptWithProducts(
            approval.Recommended_Products__c,
            approval.Event_Summary__c,
            approval.Event_Type__c
        );
    } else if (approval.Contact__c != null) {
        // Build from contact affinities
        result = JourneyPromptBuilder.buildEnrichedPrompt(
            approval.Contact__c,
            approval.Event_Summary__c,
            approval.Event_Type__c
        );
        // Also set the products
        approval.Recommended_Products__c = result.recommendedProductsJson;
    } else {
        // Use a default prompt based on event type
        String eventType = String.isNotBlank(approval.Event_Type__c) ? approval.Event_Type__c : 'life-event';
        result = JourneyPromptBuilder.rebuildPromptWithProducts(
            null,
            approval.Event_Summary__c,
            eventType
        );
        approval.Recommended_Products__c = result.recommendedProductsJson;
    }

    approval.Firefly_Prompt__c = result.prompt;

    System.debug('Fixed approval ' + approval.Id + ':');
    System.debug('  Event Type: ' + approval.Event_Type__c);
    System.debug('  Prompt: ' + result.prompt);
}

if (!approvalsToFix.isEmpty()) {
    update approvalsToFix;
    System.debug('');
    System.debug('═══════════════════════════════════════════════════════════════');
    System.debug('SUCCESS! Updated ' + approvalsToFix.size() + ' approval records with prompts');
    System.debug('═══════════════════════════════════════════════════════════════');
}
