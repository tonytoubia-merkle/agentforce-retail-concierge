/**
 * CampaignDecodeService - Looks up Campaign_Decode__c records to translate
 * raw UTM campaign parameters into rich, agent-consumable context.
 *
 * Used by:
 *   - Beauty Concierge agent (consumer-facing) to personalize conversations
 *     based on which ad the customer clicked through
 *   - Clientelling Copilot (rep-facing) to give reps context on campaign attribution
 *   - Data Cloud engagement data for enriched campaign attribution
 *   - Vercel proxy API for real-time decode lookups
 */
public with sharing class CampaignDecodeService {

    // ─── Invocable: Agent-Friendly Lookup ──────────────────────────────

    public class DecodeRequest {
        @InvocableVariable(required=true label='UTM Campaign')
        public String utmCampaign;
    }

    public class DecodeResult {
        @InvocableVariable
        public Boolean found;

        @InvocableVariable
        public String campaignName;

        @InvocableVariable
        public String agentContextSummary;

        @InvocableVariable
        public String inferredInterests;

        @InvocableVariable
        public String inferredIntentSignals;

        @InvocableVariable
        public String audienceSegment;

        @InvocableVariable
        public String targetingStrategy;

        @InvocableVariable
        public String platform;

        @InvocableVariable
        public String campaignTheme;

        @InvocableVariable
        public String creativeHeadline;
    }

    @InvocableMethod(label='Decode Campaign UTM' description='Looks up a utm_campaign value and returns rich campaign context including inferred interests, intent signals, audience segment, and a pre-written agent summary')
    public static List<DecodeResult> decodeCampaign(List<DecodeRequest> requests) {
        List<DecodeResult> results = new List<DecodeResult>();

        // Collect all UTM campaign values
        Set<String> utmValues = new Set<String>();
        for (DecodeRequest req : requests) {
            if (String.isNotBlank(req.utmCampaign)) {
                utmValues.add(req.utmCampaign);
            }
        }

        // Bulk query
        Map<String, Campaign_Decode__c> decodeMap = new Map<String, Campaign_Decode__c>();
        if (!utmValues.isEmpty()) {
            for (Campaign_Decode__c d : [
                SELECT Name, UTM_Campaign__c, UTM_Source__c, UTM_Medium__c,
                       Campaign_Theme__c, Platform__c, Targeting_Strategy__c,
                       Audience_Segment__c, Audience_Data_Signals__c,
                       Inferred_Interests__c, Inferred_Intent_Signals__c,
                       Creative_Headline__c, Creative_Description__c,
                       Agent_Context_Summary__c
                FROM Campaign_Decode__c
                WHERE UTM_Campaign__c IN :utmValues
                  AND Is_Active__c = true
            ]) {
                decodeMap.put(d.UTM_Campaign__c, d);
            }
        }

        // Build results
        for (DecodeRequest req : requests) {
            DecodeResult result = new DecodeResult();
            Campaign_Decode__c d = decodeMap.get(req.utmCampaign);

            if (d != null) {
                result.found = true;
                result.campaignName = d.Name;
                result.agentContextSummary = d.Agent_Context_Summary__c;
                result.inferredInterests = d.Inferred_Interests__c;
                result.inferredIntentSignals = d.Inferred_Intent_Signals__c;
                result.audienceSegment = d.Audience_Segment__c;
                result.targetingStrategy = d.Targeting_Strategy__c;
                result.platform = d.Platform__c;
                result.campaignTheme = d.Campaign_Theme__c;
                result.creativeHeadline = d.Creative_Headline__c;
            } else {
                result.found = false;
                result.campaignName = 'Unknown Campaign';
                result.agentContextSummary = 'No campaign decode found for utm_campaign=' + req.utmCampaign + '. This visitor arrived via an unrecognized campaign link.';
            }

            results.add(result);
        }

        return results;
    }

    // ─── REST-Callable: For Vercel proxy / API layer ───────────────────

    @AuraEnabled
    public static Map<String, Object> lookupByUTM(String utmCampaign) {
        Map<String, Object> result = new Map<String, Object>();

        if (String.isBlank(utmCampaign)) {
            result.put('found', false);
            return result;
        }

        List<Campaign_Decode__c> decodes = [
            SELECT Name, UTM_Campaign__c, UTM_Source__c, UTM_Medium__c,
                   Campaign_Theme__c, Platform__c, Targeting_Strategy__c,
                   Audience_Segment__c, Audience_Data_Signals__c,
                   Inferred_Interests__c, Inferred_Intent_Signals__c,
                   Creative_Headline__c, Creative_Description__c,
                   Agent_Context_Summary__c
            FROM Campaign_Decode__c
            WHERE UTM_Campaign__c = :utmCampaign
              AND Is_Active__c = true
            LIMIT 1
        ];

        if (decodes.isEmpty()) {
            result.put('found', false);
            return result;
        }

        Campaign_Decode__c d = decodes[0];
        result.put('found', true);
        result.put('campaignName', d.Name);
        result.put('utmCampaign', d.UTM_Campaign__c);
        result.put('utmSource', d.UTM_Source__c);
        result.put('utmMedium', d.UTM_Medium__c);
        result.put('campaignTheme', d.Campaign_Theme__c);
        result.put('platform', d.Platform__c);
        result.put('targetingStrategy', d.Targeting_Strategy__c);
        result.put('audienceSegment', d.Audience_Segment__c);
        result.put('audienceDataSignals', d.Audience_Data_Signals__c);
        result.put('inferredInterests', d.Inferred_Interests__c);
        result.put('inferredIntentSignals', d.Inferred_Intent_Signals__c);
        result.put('creativeHeadline', d.Creative_Headline__c);
        result.put('creativeDescription', d.Creative_Description__c);
        result.put('agentContextSummary', d.Agent_Context_Summary__c);

        return result;
    }

    // ─── Utility: Get all active campaign decodes ─────────────────────

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getAllActiveDecodes() {
        List<Map<String, String>> results = new List<Map<String, String>>();

        for (Campaign_Decode__c d : [
            SELECT Name, UTM_Campaign__c, Campaign_Theme__c, Platform__c,
                   Inferred_Interests__c, Audience_Segment__c
            FROM Campaign_Decode__c
            WHERE Is_Active__c = true
            ORDER BY Name
        ]) {
            results.add(new Map<String, String>{
                'name' => d.Name,
                'utmCampaign' => d.UTM_Campaign__c,
                'theme' => d.Campaign_Theme__c,
                'platform' => d.Platform__c,
                'interests' => d.Inferred_Interests__c,
                'audience' => d.Audience_Segment__c
            });
        }

        return results;
    }
}
