/**
 * DataCloudSegmentService
 *
 * Provides available segments for portfolio administration.
 * Reads from Segment_Definition__c records. Use syncFromDataCloud() to
 * pull real Data Cloud segments (with population counts) into the local store.
 */
public with sharing class DataCloudSegmentService {

    /**
     * Get available segments for the portfolio segment picker.
     * Reads from Segment_Definition__c (fast, no callouts).
     */
    @AuraEnabled(cacheable=true)
    public static List<SegmentOption> getAvailableSegments() {
        List<SegmentOption> segments = new List<SegmentOption>();

        for (Segment_Definition__c sd : [
            SELECT Api_Name__c, Label__c, Description__c,
                   Estimated_Member_Count__c, Category__c
            FROM Segment_Definition__c
            WHERE Is_Active__c = true
            ORDER BY Category__c, Label__c
        ]) {
            SegmentOption opt = new SegmentOption();
            opt.apiName = sd.Api_Name__c;
            opt.label = sd.Label__c;
            opt.description = sd.Description__c;
            opt.memberCount = sd.Estimated_Member_Count__c != null
                ? sd.Estimated_Member_Count__c.intValue() : 0;
            opt.category = sd.Category__c;
            segments.add(opt);
        }

        return segments;
    }

    /**
     * Sync Data Cloud segments into Segment_Definition__c.
     * Calls the /ssot/segments REST API, upserts local records with
     * real population counts from the /ssot/query API.
     * Called via button in portfolio admin or scheduled job.
     */
    @AuraEnabled
    public static SyncResult syncFromDataCloud() {
        SyncResult result = new SyncResult();
        result.success = false;

        try {
            String baseUrl = URL.getOrgDomainUrl().toExternalForm();
            String sessionId = UserInfo.getSessionId();

            // Fetch DC segments
            HttpRequest req = new HttpRequest();
            req.setEndpoint(baseUrl + '/services/data/v60.0/ssot/segments?batchSize=100');
            req.setMethod('GET');
            req.setHeader('Authorization', 'Bearer ' + sessionId);
            req.setHeader('Content-Type', 'application/json');

            HttpResponse res = new Http().send(req);
            if (res.getStatusCode() != 200) {
                result.message = 'Data Cloud API returned ' + res.getStatusCode();
                return result;
            }

            Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            List<Object> segList = (List<Object>) body.get('segments');
            if (segList == null || segList.isEmpty()) {
                result.message = 'No segments found in Data Cloud';
                result.success = true;
                result.synced = 0;
                return result;
            }

            // Load existing Segment_Definition__c for upsert
            Map<String, Segment_Definition__c> existingByApi = new Map<String, Segment_Definition__c>();
            for (Segment_Definition__c sd : [SELECT Id, Api_Name__c FROM Segment_Definition__c]) {
                existingByApi.put(sd.Api_Name__c, sd);
            }

            List<Segment_Definition__c> toUpsert = new List<Segment_Definition__c>();

            for (Object sObj : segList) {
                Map<String, Object> seg = (Map<String, Object>) sObj;
                String apiName = (String) seg.get('apiName');
                String displayName = (String) seg.get('displayName');
                String dataSpace = (String) seg.get('dataSpace');
                String memberTable = (String) seg.get('segmentMembershipTable');

                // Get population count
                Integer memberCount = memberTable != null
                    ? querySegmentCount(baseUrl, sessionId, memberTable) : 0;

                Segment_Definition__c sd;
                if (existingByApi.containsKey(apiName)) {
                    sd = existingByApi.get(apiName);
                } else {
                    sd = new Segment_Definition__c();
                    sd.Api_Name__c = apiName;
                    sd.Is_Active__c = true;
                }
                sd.Label__c = displayName;
                sd.Description__c = 'Data Cloud segment in ' + dataSpace + ' data space';
                sd.Category__c = 'Data Cloud';
                sd.Estimated_Member_Count__c = memberCount;
                toUpsert.add(sd);
            }

            if (!toUpsert.isEmpty()) {
                upsert toUpsert;
            }

            result.success = true;
            result.synced = toUpsert.size();
            result.message = 'Synced ' + toUpsert.size() + ' segments from Data Cloud';
        } catch (Exception e) {
            result.message = 'Sync failed: ' + e.getMessage();
            System.debug(LoggingLevel.ERROR, 'DC segment sync error: ' + e.getMessage());
        }

        return result;
    }

    /**
     * Query Data Cloud segment membership table for population count.
     */
    private static Integer querySegmentCount(String baseUrl, String sessionId, String memberTable) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(baseUrl + '/services/data/v60.0/ssot/query');
            req.setMethod('POST');
            req.setHeader('Authorization', 'Bearer ' + sessionId);
            req.setHeader('Content-Type', 'application/json');
            req.setBody('{"sql":"SELECT COUNT(*) AS cnt FROM ' + String.escapeSingleQuotes(memberTable) + '"}');

            HttpResponse res = new Http().send(req);
            if (res.getStatusCode() == 201 || res.getStatusCode() == 200) {
                Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                List<Object> data = (List<Object>) body.get('data');
                if (data != null && !data.isEmpty()) {
                    Map<String, Object> row = (Map<String, Object>) data[0];
                    Object cnt = row.get('cnt');
                    if (cnt instanceof Integer) return (Integer) cnt;
                    if (cnt instanceof Long) return ((Long) cnt).intValue();
                    if (cnt instanceof Decimal) return ((Decimal) cnt).intValue();
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.INFO, 'Segment count query failed: ' + e.getMessage());
        }
        return 0;
    }

    /**
     * Get detailed segment info including criteria rules for display.
     */
    @AuraEnabled(cacheable=true)
    public static SegmentDetail getSegmentDetails(String apiName) {
        List<Segment_Definition__c> defs = [
            SELECT Api_Name__c, Label__c, Description__c,
                   Criteria_JSON__c, Category__c, Estimated_Member_Count__c
            FROM Segment_Definition__c
            WHERE Api_Name__c = :apiName AND Is_Active__c = true
            LIMIT 1
        ];

        if (defs.isEmpty()) return null;

        Segment_Definition__c sd = defs[0];
        SegmentDetail detail = new SegmentDetail();
        detail.apiName = sd.Api_Name__c;
        detail.label = sd.Label__c;
        detail.description = sd.Description__c;
        detail.category = sd.Category__c;
        detail.memberCount = sd.Estimated_Member_Count__c != null
            ? sd.Estimated_Member_Count__c.intValue() : 0;
        detail.criteriaRules = new List<CriteriaDisplayRule>();

        if (String.isNotBlank(sd.Criteria_JSON__c)) {
            try {
                Map<String, Object> raw = (Map<String, Object>) JSON.deserializeUntyped(sd.Criteria_JSON__c);
                detail.criteriaLogic = (String) raw.get('logic');

                List<Object> rules = (List<Object>) raw.get('rules');
                if (rules != null) {
                    for (Object rObj : rules) {
                        Map<String, Object> rMap = (Map<String, Object>) rObj;
                        CriteriaDisplayRule dr = new CriteriaDisplayRule();
                        dr.source = (String) rMap.get('source');
                        dr.field = (String) rMap.get('field');
                        dr.operator = (String) rMap.get('operator');

                        List<Object> vals = (List<Object>) rMap.get('values');
                        if (vals != null && !vals.isEmpty()) {
                            List<String> strVals = new List<String>();
                            for (Object v : vals) {
                                strVals.add(String.valueOf(v));
                            }
                            dr.valuesDisplay = String.join(strVals, ', ');
                        } else {
                            dr.valuesDisplay = '';
                        }
                        detail.criteriaRules.add(dr);
                    }
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Failed to parse criteria JSON: ' + e.getMessage());
            }
        }

        return detail;
    }

    public class SegmentOption {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String description;
        @AuraEnabled public Integer memberCount;
        @AuraEnabled public String category;
    }

    public class SegmentDetail {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String description;
        @AuraEnabled public String category;
        @AuraEnabled public Integer memberCount;
        @AuraEnabled public String criteriaLogic;
        @AuraEnabled public List<CriteriaDisplayRule> criteriaRules;
    }

    public class CriteriaDisplayRule {
        @AuraEnabled public String source;
        @AuraEnabled public String field;
        @AuraEnabled public String operator;
        @AuraEnabled public String valuesDisplay;
    }

    public class SyncResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public Integer synced;
    }
}
