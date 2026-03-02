/**
 * MerkuryActivationService - Mock Merkury identity resolution integration.
 *
 * In production, this would submit audience segments to a Data Cloud Activation Target
 * that routes through Merkury for identity resolution and paid media distribution
 * to walled gardens (CTV: Hulu/Roku, Social: Meta/Instagram).
 *
 * For POC, this service simulates the activation pipeline by updating
 * Journey_Approval__c records with activation status and mock reach data.
 */
public with sharing class MerkuryActivationService {

    /**
     * Submit a media activation for a Journey Approval record.
     * Builds the Merkury payload, validates required fields, and updates status.
     *
     * @param approvalId The Journey_Approval__c record to activate
     * @return A user-friendly result message
     */
    @AuraEnabled
    public static String submitActivation(Id approvalId) {
        Journey_Approval__c approval = [
            SELECT Id, Media_Platform__c, Media_Ad_Format__c, Media_Creative_Brief__c,
                   Media_Audience_Signals__c, Media_Estimated_Reach__c,
                   Merkury_Activation_Status__c, Channel__c,
                   Contact__c, Event_Type__c, Customer_Value_Score__c
            FROM Journey_Approval__c
            WHERE Id = :approvalId
            LIMIT 1
        ];

        if (approval.Channel__c != 'Media') {
            throw new AuraHandledException('This approval is not a Media channel step.');
        }

        if (approval.Merkury_Activation_Status__c == 'Submitted' ||
            approval.Merkury_Activation_Status__c == 'Active') {
            throw new AuraHandledException('This activation has already been submitted.');
        }

        // Build Merkury activation payload (would be sent to Data Cloud Activation Target)
        Map<String, Object> payload = new Map<String, Object>();
        payload.put('platform', approval.Media_Platform__c);
        payload.put('adFormat', approval.Media_Ad_Format__c);
        payload.put('creativeBrief', approval.Media_Creative_Brief__c);
        payload.put('estimatedReach', approval.Media_Estimated_Reach__c);
        payload.put('contactId', approval.Contact__c);
        payload.put('eventType', approval.Event_Type__c);
        payload.put('customerValueScore', approval.Customer_Value_Score__c);

        // Parse and include audience signals
        if (String.isNotBlank(approval.Media_Audience_Signals__c)) {
            try {
                Object signals = JSON.deserializeUntyped(approval.Media_Audience_Signals__c);
                payload.put('audienceSignals', signals);
            } catch (Exception e) {
                payload.put('audienceSignals', approval.Media_Audience_Signals__c);
            }
        }

        // Determine distribution destinations
        List<String> destinations = getDestinations(approval.Media_Platform__c);
        payload.put('destinations', destinations);

        System.debug('Merkury Activation Payload: ' + JSON.serializePretty(payload));

        // Mock: Update status to Submitted (in production, this would be an async callout)
        approval.Merkury_Activation_Status__c = 'Submitted';
        update approval;

        String platformLabel = approval.Media_Platform__c == 'CTV' ? 'CTV (Hulu, Roku)' : 'Social (Facebook, Instagram)';
        String reachStr = formatReach(approval.Media_Estimated_Reach__c);

        return 'Activation submitted to Merkury for ' + platformLabel
            + ' — estimated reach: ' + reachStr + ' users. '
            + 'Identity resolution and ad distribution will begin within 24 hours.';
    }

    /**
     * Get activation details for display in the UI.
     *
     * @param approvalId The Journey_Approval__c record
     * @return Map of activation details for LWC rendering
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getActivationDetails(Id approvalId) {
        Journey_Approval__c approval = [
            SELECT Id, Media_Platform__c, Media_Ad_Format__c, Media_Creative_Brief__c,
                   Media_Audience_Signals__c, Media_Estimated_Reach__c,
                   Merkury_Activation_Status__c, Customer_Value_Score__c
            FROM Journey_Approval__c
            WHERE Id = :approvalId
            LIMIT 1
        ];

        Map<String, Object> details = new Map<String, Object>();
        details.put('platform', approval.Media_Platform__c);
        details.put('adFormat', approval.Media_Ad_Format__c);
        details.put('creativeBrief', approval.Media_Creative_Brief__c);
        details.put('estimatedReach', approval.Media_Estimated_Reach__c);
        details.put('formattedReach', formatReach(approval.Media_Estimated_Reach__c));
        details.put('activationStatus', approval.Merkury_Activation_Status__c);
        details.put('customerValueScore', approval.Customer_Value_Score__c);
        details.put('destinations', getDestinations(approval.Media_Platform__c));

        // Parse audience signals for structured display
        if (String.isNotBlank(approval.Media_Audience_Signals__c)) {
            try {
                details.put('audienceSignals', JSON.deserializeUntyped(approval.Media_Audience_Signals__c));
            } catch (Exception e) {
                details.put('audienceSignals', approval.Media_Audience_Signals__c);
            }
        }

        return details;
    }

    /**
     * Get distribution destinations based on platform.
     */
    private static List<String> getDestinations(String platform) {
        if (platform == 'CTV') {
            return new List<String>{ 'Hulu', 'Roku' };
        } else if (platform == 'Social') {
            return new List<String>{ 'Facebook', 'Instagram' };
        }
        return new List<String>();
    }

    /**
     * Format reach number for display (e.g., 45000 → "45K", 1200000 → "1.2M").
     */
    private static String formatReach(Decimal reach) {
        if (reach == null || reach == 0) return '—';
        if (reach >= 1000000) {
            Decimal millions = reach / 1000000;
            return millions.setScale(1) + 'M';
        } else if (reach >= 1000) {
            Decimal thousands = reach / 1000;
            return thousands.setScale(0) + 'K';
        }
        return String.valueOf(reach.intValue());
    }
}
