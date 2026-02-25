/**
 * DataCloudProfileService - Read/write customer profile data from/to Data Cloud.
 * Queries Data Cloud DMOs (Data Model Objects) for orders, chat summaries,
 * meaningful events, browse sessions, loyalty, and agent-captured profile fields.
 * Also provides write methods for persisting new records.
 */
global with sharing class DataCloudProfileService {

    // ─── READ Operations ────────────────────────────────────────────

    public class ProfileRequest {
        @InvocableVariable(required=true)
        public String customerId;
    }

    @InvocableMethod(label='Get Full Customer Profile' description='Retrieves the complete customer profile from Data Cloud including orders, chat summaries, events, and captured profile fields')
    public static List<String> getFullCustomerProfile(List<ProfileRequest> requests) {
        List<String> results = new List<String>();
        for (ProfileRequest req : requests) {
            results.add(buildFullProfile(req.customerId));
        }
        return results;
    }

    private static String buildFullProfile(String customerId) {
        Map<String, Object> profile = new Map<String, Object>();

        profile.put('orders', getOrders(customerId));
        profile.put('chatSummaries', getChatSummaries(customerId));
        profile.put('meaningfulEvents', getMeaningfulEvents(customerId));
        profile.put('browseSessions', getBrowseSessions(customerId));
        profile.put('loyalty', getLoyalty(customerId));
        profile.put('agentCapturedProfile', getCapturedProfileFields(customerId));
        profile.put('appointments', getAppointments(customerId));
        profile.put('consultationNotes', getConsultationNotes(customerId));

        return JSON.serialize(profile);
    }

    private static List<Map<String, Object>> getOrders(String customerId) {
        List<Map<String, Object>> orders = new List<Map<String, Object>>();

        // Query orders from the Order object (or ssot__Order__dlm if using Data Cloud DMOs)
        // Adjust the object/field names to match your org's data model
        try {
            List<Order> orderRecords = [
                SELECT Id, OrderNumber, EffectiveDate, Status, TotalAmount,
                       (SELECT Id, Product2.Name, Product2Id, Quantity, UnitPrice
                        FROM OrderItems)
                FROM Order
                WHERE AccountId IN (SELECT AccountId FROM Contact WHERE Id = :customerId)
                ORDER BY EffectiveDate DESC
                LIMIT 10
            ];

            for (Order o : orderRecords) {
                Map<String, Object> orderMap = new Map<String, Object>();
                orderMap.put('orderId', o.OrderNumber);
                orderMap.put('orderDate', String.valueOf(o.EffectiveDate));
                orderMap.put('channel', 'online'); // Default; extend with custom field Order.Channel__c
                orderMap.put('totalAmount', o.TotalAmount);
                orderMap.put('status', o.Status == 'Activated' ? 'completed' : o.Status?.toLowerCase());

                List<Map<String, Object>> lineItems = new List<Map<String, Object>>();
                if (o.OrderItems != null) {
                    for (OrderItem oi : o.OrderItems) {
                        Map<String, Object> li = new Map<String, Object>();
                        li.put('productId', oi.Product2Id);
                        li.put('productName', oi.Product2?.Name);
                        li.put('quantity', oi.Quantity);
                        li.put('unitPrice', oi.UnitPrice);
                        lineItems.add(li);
                    }
                }
                orderMap.put('lineItems', lineItems);
                orders.add(orderMap);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to query orders: ' + e.getMessage());
        }

        return orders;
    }

    private static List<Map<String, Object>> getChatSummaries(String customerId) {
        List<Map<String, Object>> summaries = new List<Map<String, Object>>();

        try {
            List<Chat_Summary__c> records = [
                SELECT Session_Date__c, Summary_Text__c, Sentiment__c, Topics_Discussed__c
                FROM Chat_Summary__c
                WHERE Customer_Id__c = :customerId
                ORDER BY Session_Date__c DESC
                LIMIT 5
            ];

            for (Chat_Summary__c r : records) {
                Map<String, Object> m = new Map<String, Object>();
                m.put('sessionDate', String.valueOf(r.Session_Date__c));
                m.put('summary', r.Summary_Text__c);
                m.put('sentiment', r.Sentiment__c);
                m.put('topicsDiscussed', r.Topics_Discussed__c != null
                    ? r.Topics_Discussed__c.split(';') : new List<String>());
                summaries.add(m);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to query chat summaries: ' + e.getMessage());
        }

        return summaries;
    }

    private static List<Map<String, Object>> getMeaningfulEvents(String customerId) {
        List<Map<String, Object>> events = new List<Map<String, Object>>();

        try {
            List<Meaningful_Event__c> records = [
                SELECT Event_Type__c, Description__c, Captured_At__c, Agent_Note__c, Metadata_JSON__c
                FROM Meaningful_Event__c
                WHERE Customer_Id__c = :customerId
                ORDER BY Captured_At__c DESC
            ];

            for (Meaningful_Event__c r : records) {
                Map<String, Object> m = new Map<String, Object>();
                m.put('eventType', r.Event_Type__c);
                m.put('description', r.Description__c);
                m.put('capturedAt', String.valueOf(r.Captured_At__c));
                m.put('agentNote', r.Agent_Note__c);
                if (String.isNotBlank(r.Metadata_JSON__c)) {
                    m.put('metadata', JSON.deserializeUntyped(r.Metadata_JSON__c));
                }
                events.add(m);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to query meaningful events: ' + e.getMessage());
        }

        return events;
    }

    private static List<Map<String, Object>> getBrowseSessions(String customerId) {
        List<Map<String, Object>> sessions = new List<Map<String, Object>>();

        try {
            List<Browse_Session__c> records = [
                SELECT Session_Date__c, Categories_Browsed__c, Products_Viewed__c,
                       Duration_Minutes__c, Device__c
                FROM Browse_Session__c
                WHERE Customer_Id__c = :customerId
                ORDER BY Session_Date__c DESC
                LIMIT 5
            ];

            for (Browse_Session__c r : records) {
                Map<String, Object> m = new Map<String, Object>();
                m.put('sessionDate', String.valueOf(r.Session_Date__c));
                m.put('categoriesBrowsed', r.Categories_Browsed__c != null
                    ? r.Categories_Browsed__c.split(';') : new List<String>());
                m.put('productsViewed', r.Products_Viewed__c != null
                    ? r.Products_Viewed__c.split(';') : new List<String>());
                m.put('durationMinutes', r.Duration_Minutes__c);
                m.put('device', r.Device__c);
                sessions.add(m);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to query browse sessions: ' + e.getMessage());
        }

        return sessions;
    }

    private static Map<String, Object> getLoyalty(String customerId) {
        try {
            // Use dynamic SOQL to avoid compile-time errors if Loyalty Management
            // fields differ across orgs. Adjust field names to match your org's schema.
            String query = 'SELECT MembershipNumber, MemberStatus, EnrollmentDate'
                + ' FROM LoyaltyProgramMember'
                + ' WHERE ContactId = \'' + String.escapeSingleQuotes(customerId) + '\''
                + ' LIMIT 1';

            List<SObject> members = Database.query(query);

            if (!members.isEmpty()) {
                SObject member = members[0];
                Map<String, Object> loyalty = new Map<String, Object>();

                // Try to read tier/points fields dynamically — names vary by org
                String tierName = 'bronze';
                Decimal pointsAccrued = 0;
                Decimal pointsRedeemed = 0;
                try { tierName = String.valueOf(member.get('TierName')); } catch (Exception e) { /* field may not exist */ }
                try { pointsAccrued = (Decimal) member.get('TotalPointsAccrued'); } catch (Exception e) { /* field may not exist */ }
                try { pointsRedeemed = (Decimal) member.get('TotalPointsRedeemed'); } catch (Exception e) { /* field may not exist */ }

                loyalty.put('tier', tierName != null ? tierName.toLowerCase() : 'bronze');
                loyalty.put('pointsBalance', (pointsAccrued != null ? pointsAccrued : 0) - (pointsRedeemed != null ? pointsRedeemed : 0));
                loyalty.put('lifetimePoints', pointsAccrued);
                loyalty.put('memberSince', String.valueOf(member.get('EnrollmentDate')));

                Object tierExpiry = null;
                try { tierExpiry = member.get('TierExpirationDate'); } catch (Exception e) { /* field may not exist */ }
                loyalty.put('tierExpiryDate', tierExpiry != null ? String.valueOf(tierExpiry) : null);
                loyalty.put('rewardsAvailable', new List<Object>());
                return loyalty;
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to query loyalty: ' + e.getMessage());
        }

        return null;
    }

    private static Map<String, Object> getCapturedProfileFields(String customerId) {
        Map<String, Object> profile = new Map<String, Object>();

        try {
            List<Agent_Captured_Profile__c> records = [
                SELECT Field_Name__c, Field_Value__c, Captured_At__c,
                       Captured_From__c, Confidence__c, Data_Type__c
                FROM Agent_Captured_Profile__c
                WHERE Customer_Id__c = :customerId
            ];

            for (Agent_Captured_Profile__c r : records) {
                Map<String, Object> field = new Map<String, Object>();
                String fieldValue = r.Field_Value__c;

                // Parse arrays from JSON
                if (r.Data_Type__c == 'array' && String.isNotBlank(fieldValue)) {
                    field.put('value', JSON.deserializeUntyped(fieldValue));
                } else {
                    field.put('value', fieldValue);
                }

                field.put('capturedAt', String.valueOf(r.Captured_At__c));
                field.put('capturedFrom', r.Captured_From__c);
                field.put('confidence', r.Confidence__c);

                profile.put(r.Field_Name__c, field);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to query captured profile: ' + e.getMessage());
        }

        return profile;
    }

    // ─── Appointment & Consultation Queries ─────────────────────────

    private static List<Map<String, Object>> getAppointments(String customerId) {
        List<Map<String, Object>> appointments = new List<Map<String, Object>>();

        try {
            List<Store_Appointment__c> records = [
                SELECT Id, Name, Appointment_DateTime__c, Type__c, Status__c,
                       Store_Location__c, Channel__c, Identity_Tier__c,
                       Customer_Notes__c, Rep_Prep_Notes__c, Duration_Minutes__c,
                       Satisfaction_Rating__c
                FROM Store_Appointment__c
                WHERE Contact__c = :customerId
                ORDER BY Appointment_DateTime__c DESC
                LIMIT 10
            ];

            for (Store_Appointment__c r : records) {
                Map<String, Object> m = new Map<String, Object>();
                m.put('appointmentId', r.Id);
                m.put('name', r.Name);
                m.put('appointmentDateTime', String.valueOf(r.Appointment_DateTime__c));
                m.put('type', r.Type__c);
                m.put('status', r.Status__c);
                m.put('storeLocation', r.Store_Location__c);
                m.put('channel', r.Channel__c);
                m.put('identityTier', r.Identity_Tier__c);
                m.put('customerNotes', r.Customer_Notes__c);
                m.put('durationMinutes', r.Duration_Minutes__c);
                m.put('satisfactionRating', r.Satisfaction_Rating__c);
                appointments.add(m);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to query appointments: ' + e.getMessage());
        }

        return appointments;
    }

    private static List<Map<String, Object>> getConsultationNotes(String customerId) {
        List<Map<String, Object>> notes = new List<Map<String, Object>>();

        try {
            List<Consultation_Note__c> records = [
                SELECT Id, Note_Type__c, Note_Text__c, Captured_At__c,
                       Captured_By__r.Name, Products_Referenced__c,
                       Store_Appointment__r.Name
                FROM Consultation_Note__c
                WHERE Contact__c = :customerId
                ORDER BY Captured_At__c DESC
                LIMIT 20
            ];

            for (Consultation_Note__c r : records) {
                Map<String, Object> m = new Map<String, Object>();
                m.put('noteId', r.Id);
                m.put('noteType', r.Note_Type__c);
                m.put('noteText', r.Note_Text__c);
                m.put('capturedAt', String.valueOf(r.Captured_At__c));
                m.put('capturedBy', r.Captured_By__r != null ? r.Captured_By__r.Name : null);
                m.put('productsReferenced', r.Products_Referenced__c);
                m.put('appointmentName', r.Store_Appointment__r != null ? r.Store_Appointment__r.Name : null);
                notes.add(m);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to query consultation notes: ' + e.getMessage());
        }

        return notes;
    }

    // ─── WRITE Operations ───────────────────────────────────────────

    public static void writeChatSummary(String customerId, String sessionId,
                                         String sessionDate, String summaryText,
                                         String sentiment, String topicsDiscussed) {
        Chat_Summary__c record = new Chat_Summary__c();
        record.Customer_Id__c = customerId;
        record.Session_Id__c = sessionId;
        record.Session_Date__c = Date.valueOf(sessionDate);
        record.Summary_Text__c = summaryText;
        record.Sentiment__c = sentiment;
        record.Topics_Discussed__c = topicsDiscussed;
        insert record;
    }

    public static void writeMeaningfulEvent(String customerId, String sessionId,
                                             String eventType, String description,
                                             String agentNote, String metadataJson) {
        Meaningful_Event__c record = new Meaningful_Event__c();
        record.Customer_Id__c = customerId;
        record.Session_Id__c = sessionId;
        record.Event_Type__c = eventType;
        record.Description__c = description;
        record.Captured_At__c = Datetime.now();
        record.Agent_Note__c = agentNote;
        record.Metadata_JSON__c = metadataJson;
        insert record;
    }

    /**
     * Enhanced version that includes temporal context for journey orchestration.
     * @param customerId       Contact or Customer ID
     * @param sessionId        Chat session ID
     * @param eventType        preference, milestone, life-event, concern, intent
     * @param description      Human-readable event description
     * @param agentNote        Agent's internal note
     * @param metadataJson     Additional metadata as JSON
     * @param relativeTimeText Original temporal phrase (e.g., "in two weeks")
     * @param eventDate        Calculated actual event date
     * @param urgency          Immediate, This Week, This Month, Future, No Date
     * @return                 The created Meaningful_Event__c record Id
     */
    public static Id writeMeaningfulEventEnhanced(
        String customerId, String sessionId,
        String eventType, String description,
        String agentNote, String metadataJson,
        String relativeTimeText, Date eventDate,
        String urgency
    ) {
        Meaningful_Event__c record = new Meaningful_Event__c();
        record.Customer_Id__c = customerId;
        record.Session_Id__c = sessionId;
        record.Event_Type__c = eventType;
        record.Description__c = description;
        record.Captured_At__c = Datetime.now();
        record.Agent_Note__c = agentNote;
        record.Metadata_JSON__c = metadataJson;

        // New temporal fields
        record.Relative_Time_Text__c = relativeTimeText;
        record.Event_Date__c = eventDate;
        record.Urgency__c = urgency != null ? urgency : 'No Date';

        // Set journey start date (default to today for immediate journeys)
        if (eventDate != null) {
            record.Journey_Start_Date__c = Date.today();
        }

        insert record;
        return record.Id;
    }

    public static void writeCapturedProfileField(String customerId, String sessionId,
                                                   String fieldName, String fieldValue,
                                                   String confidence, String dataType) {
        // Upsert: if this field already exists for this customer, update it
        List<Agent_Captured_Profile__c> existing = [
            SELECT Id FROM Agent_Captured_Profile__c
            WHERE Customer_Id__c = :customerId AND Field_Name__c = :fieldName
            LIMIT 1
        ];

        Agent_Captured_Profile__c record;
        if (!existing.isEmpty()) {
            record = existing[0];
        } else {
            record = new Agent_Captured_Profile__c();
            record.Customer_Id__c = customerId;
            record.Field_Name__c = fieldName;
        }

        record.Field_Value__c = fieldValue;
        record.Captured_At__c = Datetime.now();
        record.Captured_From__c = 'chat session ' + sessionId;
        record.Confidence__c = confidence;
        record.Data_Type__c = dataType != null ? dataType : 'string';

        upsert record;
    }
}
