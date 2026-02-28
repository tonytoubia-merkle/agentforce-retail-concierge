/**
 * SegmentEvaluationService
 *
 * Evaluates whether contacts match segment criteria defined in Segment_Definition__c.
 * Queries each data source at most once for efficiency (batch-friendly).
 *
 * Supported sources: Contact, Loyalty, Order, Event, Browse, Profile
 * Supported operators: IN, EQUALS, CONTAINS_ANY, GREATER_THAN, LESS_THAN,
 *                      IS_NOT_NULL, IS_NULL, MONTH_EQUALS, DAYS_SINCE_GREATER_THAN
 */
public with sharing class SegmentEvaluationService {

    /**
     * Evaluate a single contact against one or more segments.
     */
    public static Map<String, Boolean> evaluateContactSegments(Id contactId, List<String> segmentApiNames) {
        Map<Id, Map<String, Boolean>> bulkResults = evaluateContactSegmentsBulk(
            new Set<Id>{ contactId }, segmentApiNames
        );
        return bulkResults.containsKey(contactId) ? bulkResults.get(contactId) : new Map<String, Boolean>();
    }

    /**
     * Evaluate multiple contacts against segments (batch-friendly).
     * Returns Map<ContactId, Map<SegmentApiName, Boolean>>
     */
    public static Map<Id, Map<String, Boolean>> evaluateContactSegmentsBulk(
        Set<Id> contactIds,
        List<String> segmentApiNames
    ) {
        Map<Id, Map<String, Boolean>> results = new Map<Id, Map<String, Boolean>>();
        if (contactIds.isEmpty() || segmentApiNames.isEmpty()) return results;

        // Initialize result maps
        for (Id cId : contactIds) {
            results.put(cId, new Map<String, Boolean>());
        }

        // Step 1: Load segment definitions
        Map<String, CriteriaSet> segmentCriteria = loadSegmentCriteria(segmentApiNames);
        if (segmentCriteria.isEmpty()) return results;

        // Step 2: Determine required data sources
        Set<String> requiredSources = new Set<String>();
        for (CriteriaSet cs : segmentCriteria.values()) {
            for (CriteriaRule rule : cs.rules) {
                requiredSources.add(rule.source);
            }
        }

        // Step 3: Pre-fetch data for all contacts (one query per source)
        Map<Id, ContactData> contactDataMap = fetchContactData(contactIds, requiredSources);

        // Step 4: Evaluate each segment for each contact
        for (Id cId : contactIds) {
            ContactData cd = contactDataMap.get(cId);
            if (cd == null) {
                cd = new ContactData();
            }

            for (String segApiName : segmentCriteria.keySet()) {
                CriteriaSet cs = segmentCriteria.get(segApiName);
                Boolean matches = evaluateCriteriaSet(cs, cd);
                results.get(cId).put(segApiName, matches);
            }
        }

        return results;
    }

    // ============ Criteria Loading ============

    private static Map<String, CriteriaSet> loadSegmentCriteria(List<String> segmentApiNames) {
        Map<String, CriteriaSet> criteriaMap = new Map<String, CriteriaSet>();

        for (Segment_Definition__c sd : [
            SELECT Api_Name__c, Criteria_JSON__c
            FROM Segment_Definition__c
            WHERE Api_Name__c IN :segmentApiNames AND Is_Active__c = true
        ]) {
            try {
                CriteriaSet cs = parseCriteriaJson(sd.Criteria_JSON__c);
                if (cs != null && !cs.rules.isEmpty()) {
                    criteriaMap.put(sd.Api_Name__c, cs);
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Failed to parse criteria for segment ' + sd.Api_Name__c + ': ' + e.getMessage());
            }
        }

        return criteriaMap;
    }

    private static CriteriaSet parseCriteriaJson(String jsonStr) {
        if (String.isBlank(jsonStr)) return null;

        Map<String, Object> raw = (Map<String, Object>) JSON.deserializeUntyped(jsonStr);
        CriteriaSet cs = new CriteriaSet();
        cs.logic = (String) raw.get('logic');
        if (cs.logic == null) cs.logic = 'AND';
        cs.rules = new List<CriteriaRule>();

        List<Object> rawRules = (List<Object>) raw.get('rules');
        if (rawRules == null) return cs;

        for (Object rObj : rawRules) {
            Map<String, Object> rMap = (Map<String, Object>) rObj;
            CriteriaRule rule = new CriteriaRule();
            rule.source = (String) rMap.get('source');
            rule.field = (String) rMap.get('field');
            rule.operator = (String) rMap.get('operator');
            rule.values = new List<String>();

            List<Object> vals = (List<Object>) rMap.get('values');
            if (vals != null) {
                for (Object v : vals) {
                    rule.values.add(String.valueOf(v));
                }
            }
            cs.rules.add(rule);
        }

        return cs;
    }

    // ============ Data Fetching ============

    private static Map<Id, ContactData> fetchContactData(Set<Id> contactIds, Set<String> requiredSources) {
        Map<Id, ContactData> dataMap = new Map<Id, ContactData>();
        for (Id cId : contactIds) {
            dataMap.put(cId, new ContactData());
        }

        // Convert Ids to strings for Customer_Id__c lookups
        Set<String> contactIdStrings = new Set<String>();
        for (Id cId : contactIds) {
            contactIdStrings.add(String.valueOf(cId));
        }

        // Contact fields
        if (requiredSources.contains('Contact')) {
            fetchContactFields(contactIds, dataMap);
        }

        // Loyalty
        if (requiredSources.contains('Loyalty')) {
            fetchLoyaltyData(contactIds, dataMap);
        }

        // Orders
        if (requiredSources.contains('Order')) {
            fetchOrderData(contactIds, dataMap);
        }

        // Events
        if (requiredSources.contains('Event')) {
            fetchEventData(contactIds, contactIdStrings, dataMap);
        }

        // Browse sessions
        if (requiredSources.contains('Browse')) {
            fetchBrowseData(contactIdStrings, dataMap, contactIds);
        }

        // Captured profile
        if (requiredSources.contains('Profile')) {
            fetchProfileData(contactIdStrings, dataMap, contactIds);
        }

        return dataMap;
    }

    private static void fetchContactFields(Set<Id> contactIds, Map<Id, ContactData> dataMap) {
        for (Contact c : [
            SELECT Id, MailingState, Clientelling_Tier__c, Skin_Type__c,
                   Preferred_Brands__c, Email_Opt_In__c
            FROM Contact
            WHERE Id IN :contactIds
        ]) {
            ContactData cd = dataMap.get(c.Id);
            if (cd != null) {
                cd.contactRecord = c;
            }
        }
    }

    private static void fetchLoyaltyData(Set<Id> contactIds, Map<Id, ContactData> dataMap) {
        try {
            // Query loyalty tier
            String tierQuery = 'SELECT LoyaltyProgramMember.ContactId, LoyaltyTier.Name'
                + ' FROM LoyaltyMemberTier'
                + ' WHERE LoyaltyProgramMember.ContactId IN :contactIds'
                + ' ORDER BY CreatedDate DESC';

            List<SObject> tiers = Database.query(tierQuery);
            for (SObject t : tiers) {
                Id contactId = (Id) t.getSObject('LoyaltyProgramMember').get('ContactId');
                String tierName = (String) t.getSObject('LoyaltyTier').get('Name');
                ContactData cd = dataMap.get(contactId);
                if (cd != null && cd.loyaltyTierName == null) {
                    cd.loyaltyTierName = tierName;
                }
            }

            // Query points balance
            String pointsQuery = 'SELECT LoyaltyProgramMember.ContactId, PointsBalance, TotalPointsAccrued'
                + ' FROM LoyaltyMemberCurrency'
                + ' WHERE LoyaltyProgramMember.ContactId IN :contactIds'
                + ' LIMIT 200';

            List<SObject> currencies = Database.query(pointsQuery);
            for (SObject cur : currencies) {
                Id contactId = (Id) cur.getSObject('LoyaltyProgramMember').get('ContactId');
                ContactData cd = dataMap.get(contactId);
                if (cd != null) {
                    cd.pointsBalance = (Decimal) cur.get('PointsBalance');
                    cd.totalPointsAccrued = (Decimal) cur.get('TotalPointsAccrued');
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.INFO, 'Loyalty data not available: ' + e.getMessage());
        }
    }

    private static void fetchOrderData(Set<Id> contactIds, Map<Id, ContactData> dataMap) {
        try {
            // Get AccountIds for contacts
            Map<Id, Id> contactToAccount = new Map<Id, Id>();
            for (Contact c : [SELECT Id, AccountId FROM Contact WHERE Id IN :contactIds AND AccountId != null]) {
                contactToAccount.put(c.Id, c.AccountId);
            }

            if (contactToAccount.isEmpty()) return;

            Set<Id> accountIds = new Set<Id>(contactToAccount.values());
            Map<Id, Id> accountToContact = new Map<Id, Id>();
            for (Id cId : contactToAccount.keySet()) {
                accountToContact.put(contactToAccount.get(cId), cId);
            }

            // Aggregate order data
            Date ninetyDaysAgo = Date.today().addDays(-90);

            for (AggregateResult ar : [
                SELECT AccountId acctId,
                       COUNT(Id) totalOrders,
                       SUM(TotalAmount) totalSpend,
                       MAX(EffectiveDate) lastOrderDate,
                       MIN(EffectiveDate) firstOrderDate
                FROM Order
                WHERE AccountId IN :accountIds
                AND Status = 'Activated'
                GROUP BY AccountId
            ]) {
                Id acctId = (Id) ar.get('acctId');
                Id contactId = accountToContact.get(acctId);
                if (contactId == null) continue;

                ContactData cd = dataMap.get(contactId);
                if (cd == null) continue;

                cd.orderLifetimeValue = (Decimal) ar.get('totalSpend');
                cd.lastOrderDate = (Date) ar.get('lastOrderDate');
                cd.firstOrderDate = (Date) ar.get('firstOrderDate');
            }

            // 90-day order count
            for (AggregateResult ar : [
                SELECT AccountId acctId, COUNT(Id) cnt
                FROM Order
                WHERE AccountId IN :accountIds
                AND Status = 'Activated'
                AND EffectiveDate >= :ninetyDaysAgo
                GROUP BY AccountId
            ]) {
                Id acctId = (Id) ar.get('acctId');
                Id contactId = accountToContact.get(acctId);
                if (contactId == null) continue;
                ContactData cd = dataMap.get(contactId);
                if (cd != null) cd.orderCount90Days = (Integer) ar.get('cnt');
            }

            // Holiday order count (Nov + Dec)
            for (AggregateResult ar : [
                SELECT AccountId acctId, COUNT(Id) cnt
                FROM Order
                WHERE AccountId IN :accountIds
                AND Status = 'Activated'
                AND CALENDAR_MONTH(EffectiveDate) IN (11, 12)
                GROUP BY AccountId
            ]) {
                Id acctId = (Id) ar.get('acctId');
                Id contactId = accountToContact.get(acctId);
                if (contactId == null) continue;
                ContactData cd = dataMap.get(contactId);
                if (cd != null) cd.orderCountHoliday = (Integer) ar.get('cnt');
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.INFO, 'Order data query failed: ' + e.getMessage());
        }
    }

    private static void fetchEventData(Set<Id> contactIds, Set<String> contactIdStrings, Map<Id, ContactData> dataMap) {
        Map<String, Id> stringToId = new Map<String, Id>();
        for (Id cId : contactIds) {
            stringToId.put(String.valueOf(cId), cId);
        }

        for (Meaningful_Event__c ev : [
            SELECT Contact__c, Customer_Id__c, Event_Type__c, Description__c, Event_Date__c
            FROM Meaningful_Event__c
            WHERE (Contact__c IN :contactIds OR Customer_Id__c IN :contactIdStrings)
            ORDER BY Captured_At__c DESC
            LIMIT 200
        ]) {
            Id contactId = ev.Contact__c;
            if (contactId == null && ev.Customer_Id__c != null) {
                contactId = stringToId.get(ev.Customer_Id__c);
            }
            if (contactId == null) continue;

            ContactData cd = dataMap.get(contactId);
            if (cd != null) {
                cd.events.add(ev);
            }
        }
    }

    private static void fetchBrowseData(Set<String> contactIdStrings, Map<Id, ContactData> dataMap, Set<Id> contactIds) {
        Map<String, Id> stringToId = new Map<String, Id>();
        for (Id cId : contactIds) {
            stringToId.put(String.valueOf(cId), cId);
        }

        for (Browse_Session__c bs : [
            SELECT Customer_Id__c, Categories_Browsed__c, Products_Viewed__c
            FROM Browse_Session__c
            WHERE Customer_Id__c IN :contactIdStrings
            ORDER BY Session_Date__c DESC
            LIMIT 200
        ]) {
            Id contactId = stringToId.get(bs.Customer_Id__c);
            if (contactId == null) continue;

            ContactData cd = dataMap.get(contactId);
            if (cd != null && String.isNotBlank(bs.Categories_Browsed__c)) {
                for (String cat : bs.Categories_Browsed__c.split('[,;]')) {
                    cd.allCategoriesBrowsed.add(cat.trim().toLowerCase());
                }
            }
        }
    }

    private static void fetchProfileData(Set<String> contactIdStrings, Map<Id, ContactData> dataMap, Set<Id> contactIds) {
        Map<String, Id> stringToId = new Map<String, Id>();
        for (Id cId : contactIds) {
            stringToId.put(String.valueOf(cId), cId);
        }

        for (Agent_Captured_Profile__c acp : [
            SELECT Customer_Id__c, Field_Name__c, Field_Value__c
            FROM Agent_Captured_Profile__c
            WHERE Customer_Id__c IN :contactIdStrings
            LIMIT 500
        ]) {
            Id contactId = stringToId.get(acp.Customer_Id__c);
            if (contactId == null) continue;

            ContactData cd = dataMap.get(contactId);
            if (cd != null && String.isNotBlank(acp.Field_Name__c)) {
                cd.capturedProfileFields.put(acp.Field_Name__c.toLowerCase(), acp.Field_Value__c);
            }
        }
    }

    // ============ Criteria Evaluation ============

    private static Boolean evaluateCriteriaSet(CriteriaSet cs, ContactData cd) {
        if (cs.rules.isEmpty()) return false;

        Boolean isAnd = cs.logic == 'AND';

        for (CriteriaRule rule : cs.rules) {
            Boolean ruleResult = evaluateRule(rule, cd);

            if (isAnd && !ruleResult) return false;  // AND: one false = all false
            if (!isAnd && ruleResult) return true;     // OR: one true = all true
        }

        return isAnd; // AND: all passed = true; OR: none passed = false
    }

    private static Boolean evaluateRule(CriteriaRule rule, ContactData cd) {
        try {
            String source = rule.source;
            String field = rule.field;
            String op = rule.operator;

            if (source == 'Contact') {
                return evaluateContactRule(field, op, rule.values, cd);
            } else if (source == 'Loyalty') {
                return evaluateLoyaltyRule(field, op, rule.values, cd);
            } else if (source == 'Order') {
                return evaluateOrderRule(field, op, rule.values, cd);
            } else if (source == 'Event') {
                return evaluateEventRule(field, op, rule.values, cd);
            } else if (source == 'Browse') {
                return evaluateBrowseRule(field, op, rule.values, cd);
            } else if (source == 'Profile') {
                return evaluateProfileRule(field, op, rule.values, cd);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Rule evaluation error: ' + e.getMessage());
        }
        return false;
    }

    private static Boolean evaluateContactRule(String field, String op, List<String> values, ContactData cd) {
        if (cd.contactRecord == null) return false;

        String fieldValue = null;
        if (field == 'MailingState') fieldValue = cd.contactRecord.MailingState;
        else if (field == 'Clientelling_Tier__c') fieldValue = cd.contactRecord.Clientelling_Tier__c;
        else if (field == 'Skin_Type__c') fieldValue = cd.contactRecord.Skin_Type__c;
        else if (field == 'Preferred_Brands__c') fieldValue = cd.contactRecord.Preferred_Brands__c;

        return evaluateStringOp(fieldValue, op, values);
    }

    private static Boolean evaluateLoyaltyRule(String field, String op, List<String> values, ContactData cd) {
        if (field == 'TierName') {
            return evaluateStringOp(cd.loyaltyTierName, op, values);
        } else if (field == 'PointsBalance') {
            return evaluateNumericOp(cd.pointsBalance, op, values);
        }
        return false;
    }

    private static Boolean evaluateOrderRule(String field, String op, List<String> values, ContactData cd) {
        if (field == 'LifetimeValue') {
            return evaluateNumericOp(cd.orderLifetimeValue, op, values);
        } else if (field == 'Count90Days') {
            return evaluateNumericOp(cd.orderCount90Days, op, values);
        } else if (field == 'HolidayOrderCount') {
            return evaluateNumericOp(cd.orderCountHoliday, op, values);
        } else if (field == 'DaysSinceLastOrder') {
            if (cd.lastOrderDate == null) return false;
            Integer days = cd.lastOrderDate.daysBetween(Date.today());
            return evaluateNumericOp(days, op, values);
        } else if (field == 'DaysSinceFirstOrder') {
            if (cd.firstOrderDate == null) return false;
            Integer days = cd.firstOrderDate.daysBetween(Date.today());
            return evaluateNumericOp(days, op, values);
        }
        return false;
    }

    private static Boolean evaluateEventRule(String field, String op, List<String> values, ContactData cd) {
        if (cd.events.isEmpty()) return false;

        // Check across all events for the contact
        for (Meaningful_Event__c ev : cd.events) {
            String fieldValue = null;
            if (field == 'Event_Type__c') fieldValue = ev.Event_Type__c;
            else if (field == 'Description__c') fieldValue = ev.Description__c;

            if (evaluateStringOp(fieldValue, op, values)) return true;
        }
        return false;
    }

    private static Boolean evaluateBrowseRule(String field, String op, List<String> values, ContactData cd) {
        if (cd.allCategoriesBrowsed.isEmpty()) return false;

        if (op == 'CONTAINS_ANY') {
            for (String v : values) {
                String vLower = v.toLowerCase();
                for (String cat : cd.allCategoriesBrowsed) {
                    if (cat.contains(vLower)) return true;
                }
            }
        }
        return false;
    }

    private static Boolean evaluateProfileRule(String field, String op, List<String> values, ContactData cd) {
        String profileValue = cd.capturedProfileFields.get(field.toLowerCase());

        if (op == 'IS_NOT_NULL') {
            return String.isNotBlank(profileValue);
        } else if (op == 'IS_NULL') {
            return String.isBlank(profileValue);
        } else if (op == 'MONTH_EQUALS') {
            if (String.isBlank(profileValue)) return false;
            String targetMonth = values.isEmpty() ? '' : values[0];
            if (targetMonth == 'CURRENT') {
                Integer currentMonth = Date.today().month();
                // Try to parse the profile value as a date or extract month
                try {
                    Date profileDate = Date.valueOf(profileValue);
                    return profileDate.month() == currentMonth;
                } catch (Exception e) {
                    // Try parsing as month number or name
                    try {
                        Integer monthNum = Integer.valueOf(profileValue);
                        return monthNum == currentMonth;
                    } catch (Exception e2) {
                        return false;
                    }
                }
            }
        }

        return evaluateStringOp(profileValue, op, values);
    }

    // ============ Operator Implementations ============

    private static Boolean evaluateStringOp(String fieldValue, String op, List<String> values) {
        if (op == 'IS_NOT_NULL') return String.isNotBlank(fieldValue);
        if (op == 'IS_NULL') return String.isBlank(fieldValue);
        if (String.isBlank(fieldValue)) return false;

        String fvLower = fieldValue.toLowerCase();

        if (op == 'EQUALS') {
            return !values.isEmpty() && fvLower == values[0].toLowerCase();
        } else if (op == 'IN') {
            for (String v : values) {
                if (fvLower == v.toLowerCase()) return true;
            }
            return false;
        } else if (op == 'CONTAINS_ANY') {
            for (String v : values) {
                if (fvLower.contains(v.toLowerCase())) return true;
            }
            return false;
        } else if (op == 'NOT_EQUALS') {
            return !values.isEmpty() && fvLower != values[0].toLowerCase();
        }

        return false;
    }

    private static Boolean evaluateNumericOp(Object fieldValue, String op, List<String> values) {
        if (fieldValue == null) return false;
        if (values.isEmpty()) return false;

        Decimal numValue;
        if (fieldValue instanceof Decimal) {
            numValue = (Decimal) fieldValue;
        } else if (fieldValue instanceof Integer) {
            numValue = (Integer) fieldValue;
        } else {
            return false;
        }

        Decimal compareValue;
        try {
            compareValue = Decimal.valueOf(values[0]);
        } catch (Exception e) {
            return false;
        }

        if (op == 'GREATER_THAN') return numValue > compareValue;
        if (op == 'LESS_THAN') return numValue < compareValue;
        if (op == 'EQUALS') return numValue == compareValue;
        if (op == 'GREATER_THAN_OR_EQUAL') return numValue >= compareValue;
        if (op == 'LESS_THAN_OR_EQUAL') return numValue <= compareValue;

        return false;
    }

    // ============ Inner Classes ============

    private class CriteriaSet {
        String logic; // AND or OR
        List<CriteriaRule> rules;
    }

    private class CriteriaRule {
        String source;    // Contact, Loyalty, Order, Event, Browse, Profile
        String field;
        String operator;
        List<String> values;
    }

    private class ContactData {
        Contact contactRecord;
        String loyaltyTierName;
        Decimal pointsBalance;
        Decimal totalPointsAccrued;
        Integer orderCount90Days = 0;
        Decimal orderLifetimeValue = 0;
        Date firstOrderDate;
        Date lastOrderDate;
        Integer orderCountHoliday = 0;
        List<Meaningful_Event__c> events = new List<Meaningful_Event__c>();
        Set<String> allCategoriesBrowsed = new Set<String>();
        Map<String, String> capturedProfileFields = new Map<String, String>();
    }
}
