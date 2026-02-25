/**
 * AppointmentService - CRUD operations for Store_Appointment__c.
 * Provides appointment management for the in-store clientelling console:
 * today's schedule, check-in, completion, walk-in creation, and auto-generated prep notes.
 */
global with sharing class AppointmentService {

    // ─── Inner Classes ───────────────────────────────────────────────

    public class AppointmentWrapper {
        @AuraEnabled public Id appointmentId;
        @AuraEnabled public String name;
        @AuraEnabled public Id contactId;
        @AuraEnabled public String contactName;
        @AuraEnabled public String contactEmail;
        @AuraEnabled public String contactPhone;
        @AuraEnabled public String storeLocation;
        @AuraEnabled public String appointmentDateTime;
        @AuraEnabled public String type_x;
        @AuraEnabled public String status;
        @AuraEnabled public String assignedRepName;
        @AuraEnabled public String customerNotes;
        @AuraEnabled public String repPrepNotes;
        @AuraEnabled public String repPostNotes;
        @AuraEnabled public String channel;
        @AuraEnabled public String identityTier;
        @AuraEnabled public String clientellingTier;
        @AuraEnabled public Integer durationMinutes;
        @AuraEnabled public Integer satisfactionRating;
    }

    // ─── Today's Appointments ─────────────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static List<AppointmentWrapper> getTodaysAppointments(String storeLocation) {
        List<AppointmentWrapper> results = new List<AppointmentWrapper>();

        Date today = Date.today();
        Datetime dayStart = Datetime.newInstance(today, Time.newInstance(0, 0, 0, 0));
        Datetime dayEnd = Datetime.newInstance(today.addDays(1), Time.newInstance(0, 0, 0, 0));

        String soql = 'SELECT Id, Name, Contact__c, Contact__r.FirstName, Contact__r.LastName,'
            + ' Contact__r.Email, Contact__r.Phone, Contact__r.Clientelling_Tier__c,'
            + ' Store_Location__c, Appointment_DateTime__c, Type__c, Status__c,'
            + ' Assigned_Rep__c, Assigned_Rep__r.Name, Customer_Notes__c,'
            + ' Rep_Prep_Notes__c, Rep_Post_Notes__c, Channel__c, Identity_Tier__c,'
            + ' Duration_Minutes__c, Satisfaction_Rating__c'
            + ' FROM Store_Appointment__c'
            + ' WHERE Appointment_DateTime__c >= :dayStart'
            + ' AND Appointment_DateTime__c < :dayEnd';

        if (String.isNotBlank(storeLocation)) {
            soql += ' AND Store_Location__c = :storeLocation';
        }

        soql += ' ORDER BY Appointment_DateTime__c ASC';

        for (Store_Appointment__c appt : Database.query(soql)) {
            results.add(mapToWrapper(appt));
        }

        return results;
    }

    // ─── Check-In Customer ────────────────────────────────────────────

    @AuraEnabled
    public static AppointmentWrapper checkInCustomer(Id appointmentId) {
        Store_Appointment__c appt = [
            SELECT Id, Status__c FROM Store_Appointment__c
            WHERE Id = :appointmentId LIMIT 1
        ];

        appt.Status__c = 'Checked-In';
        update appt;

        // Update Contact's last visit date
        Store_Appointment__c full = queryFullAppointment(appointmentId);
        if (full.Contact__c != null) {
            Contact c = new Contact(Id = full.Contact__c);
            c.Last_Store_Visit__c = Date.today();
            c.Total_Store_Visits__c = getIncrementedVisitCount(full.Contact__c);
            update c;
        }

        return mapToWrapper(queryFullAppointment(appointmentId));
    }

    // ─── Complete Appointment ─────────────────────────────────────────

    @AuraEnabled
    public static void completeAppointment(
        Id appointmentId,
        String repNotes,
        String productsDiscussed,
        Integer satisfaction
    ) {
        Store_Appointment__c appt = [
            SELECT Id, Status__c, Contact__c FROM Store_Appointment__c
            WHERE Id = :appointmentId LIMIT 1
        ];

        appt.Status__c = 'Completed';
        appt.Rep_Post_Notes__c = repNotes;
        appt.Satisfaction_Rating__c = satisfaction;

        if (String.isNotBlank(productsDiscussed)) {
            appt.Products_Discussed__c = productsDiscussed;
        }

        update appt;
    }

    // ─── Create Walk-In Appointment ───────────────────────────────────

    @AuraEnabled
    public static Id createWalkInAppointment(Id contactId, String storeLocation) {
        Store_Appointment__c appt = new Store_Appointment__c();
        appt.Contact__c = contactId;
        appt.Store_Location__c = String.isNotBlank(storeLocation) ? storeLocation : 'Flagship Store';
        appt.Appointment_DateTime__c = Datetime.now();
        appt.Type__c = 'Skincare Consultation';
        appt.Status__c = 'In Progress';
        appt.Channel__c = 'In-Store Walk-in';
        appt.Identity_Tier__c = determineIdentityTier(contactId);

        insert appt;

        // Update Contact last visit
        Contact c = new Contact(Id = contactId);
        c.Last_Store_Visit__c = Date.today();
        c.Total_Store_Visits__c = getIncrementedVisitCount(contactId);
        update c;

        return appt.Id;
    }

    // ─── Generate Prep Notes ──────────────────────────────────────────

    @AuraEnabled
    public static String generatePrepNotes(Id appointmentId) {
        Store_Appointment__c appt = [
            SELECT Id, Contact__c, Contact__r.FirstName, Contact__r.LastName,
                   Contact__r.Skin_Type__c, Contact__r.Skin_Concerns__c,
                   Contact__r.Beauty_Priority__c, Contact__r.Preferred_Brands__c,
                   Contact__r.Clientelling_Tier__c, Contact__r.Merkury_Id__c,
                   Contact__r.Demo_Profile__c,
                   Type__c, Customer_Notes__c, Identity_Tier__c
            FROM Store_Appointment__c
            WHERE Id = :appointmentId LIMIT 1
        ];

        List<String> notes = new List<String>();
        Contact c = appt.Contact__r;

        // Customer name and tier
        String custName = ((c.FirstName != null ? c.FirstName : '') + ' ' +
                          (c.LastName != null ? c.LastName : '')).trim();
        notes.add('Customer: ' + custName);

        // Identity and clientelling tier
        if (String.isNotBlank(appt.Identity_Tier__c)) {
            notes.add('Identity: ' + appt.Identity_Tier__c);
        }
        if (String.isNotBlank(c.Clientelling_Tier__c)) {
            notes.add('Tier: ' + c.Clientelling_Tier__c);
        }

        // Appointment type
        if (String.isNotBlank(appt.Type__c)) {
            notes.add('Consultation type: ' + appt.Type__c);
        }

        // Loyalty info
        try {
            String loyaltyQuery = 'SELECT MemberStatus FROM LoyaltyProgramMember'
                + ' WHERE ContactId = \'' + String.escapeSingleQuotes(String.valueOf(c.Id)) + '\''
                + ' LIMIT 1';
            List<SObject> members = Database.query(loyaltyQuery);
            if (!members.isEmpty()) {
                String status = String.valueOf(members[0].get('MemberStatus'));
                notes.add('Loyalty member: ' + (status != null ? status : 'Active'));
            }
        } catch (Exception e) {
            // Loyalty may not be available
        }

        // 1P declared data — safe to reference directly
        if (String.isNotBlank(c.Skin_Type__c)) {
            notes.add('Skin type: ' + c.Skin_Type__c);
        }
        if (String.isNotBlank(c.Skin_Concerns__c)) {
            notes.add('Concerns: ' + c.Skin_Concerns__c);
        }
        if (String.isNotBlank(c.Beauty_Priority__c)) {
            notes.add('Beauty priority: ' + c.Beauty_Priority__c);
        }
        if (String.isNotBlank(c.Preferred_Brands__c)) {
            notes.add('Preferred brands: ' + c.Preferred_Brands__c);
        }

        // Recent purchase (1P observed)
        try {
            List<Order> recentOrders = [
                SELECT OrderNumber, EffectiveDate,
                       (SELECT Product2.Name FROM OrderItems LIMIT 3)
                FROM Order
                WHERE AccountId IN (SELECT AccountId FROM Contact WHERE Id = :c.Id)
                ORDER BY EffectiveDate DESC
                LIMIT 1
            ];
            if (!recentOrders.isEmpty()) {
                Order lastOrder = recentOrders[0];
                String orderInfo = 'Last purchase: ';
                List<String> productNames = new List<String>();
                if (lastOrder.OrderItems != null) {
                    for (OrderItem oi : lastOrder.OrderItems) {
                        if (oi.Product2 != null) {
                            productNames.add(oi.Product2.Name);
                        }
                    }
                }
                if (!productNames.isEmpty()) {
                    orderInfo += String.join(productNames, ', ');
                } else {
                    orderInfo += 'Order ' + lastOrder.OrderNumber;
                }
                orderInfo += ' (' + lastOrder.EffectiveDate.format() + ')';
                notes.add(orderInfo);
            }
        } catch (Exception e) {
            // Orders may not be available
        }

        // Previous consultation notes
        try {
            List<Consultation_Note__c> prevNotes = [
                SELECT Note_Type__c, Note_Text__c
                FROM Consultation_Note__c
                WHERE Contact__c = :c.Id
                ORDER BY Captured_At__c DESC
                LIMIT 2
            ];
            if (!prevNotes.isEmpty()) {
                notes.add('--- Previous consultation notes ---');
                for (Consultation_Note__c cn : prevNotes) {
                    notes.add('[' + cn.Note_Type__c + '] ' + cn.Note_Text__c);
                }
            }
        } catch (Exception e) {
            // Notes may not be available
        }

        // Customer notes from booking
        if (String.isNotBlank(appt.Customer_Notes__c)) {
            notes.add('Customer notes: ' + appt.Customer_Notes__c);
        }

        // 3P appended — translate to recommendations, NEVER show raw data
        if (c.Demo_Profile__c == 'Merkury' || String.isNotBlank(c.Merkury_Id__c)) {
            notes.add('--- Staff recommendations (based on enrichment signals) ---');
            if (String.isNotBlank(c.Skin_Concerns__c) && c.Skin_Concerns__c.toLowerCase().contains('aging')) {
                notes.add('Recommend: LUMIERE Renewal Collection (anti-aging line)');
            }
            if (String.isNotBlank(c.Preferred_Brands__c) && c.Preferred_Brands__c.contains('LUMIERE')) {
                notes.add('Recommend: New LUMIERE Night Serum + complementary eye cream');
            }
            notes.add('(Profile enriched via identity resolution — use recommendations as conversation starters)');
        }

        String prepNotesText = String.join(notes, '\n');

        // Save prep notes to the appointment
        Store_Appointment__c toUpdate = new Store_Appointment__c(Id = appointmentId);
        toUpdate.Rep_Prep_Notes__c = prepNotesText;
        update toUpdate;

        return prepNotesText;
    }

    // ─── Capture Consultation Note ────────────────────────────────────

    @AuraEnabled
    public static Id captureConsultationNote(
        Id contactId,
        Id appointmentId,
        String noteType,
        String noteText,
        String productsReferenced
    ) {
        Consultation_Note__c note = new Consultation_Note__c();
        note.Contact__c = contactId;
        note.Store_Appointment__c = appointmentId;
        note.Note_Type__c = noteType;
        note.Note_Text__c = noteText;
        note.Captured_At__c = Datetime.now();
        if (String.isNotBlank(productsReferenced)) {
            note.Products_Referenced__c = productsReferenced;
        }
        insert note;
        return note.Id;
    }

    // ─── Online Booking (called from React proxy) ─────────────────────

    @AuraEnabled
    public static Id bookAppointment(
        Id contactId,
        String storeLocation,
        String appointmentDateTime,
        String appointmentType,
        String customerNotes
    ) {
        Store_Appointment__c appt = new Store_Appointment__c();
        appt.Contact__c = contactId;
        appt.Store_Location__c = storeLocation;
        appt.Appointment_DateTime__c = Datetime.valueOf(appointmentDateTime);
        appt.Type__c = appointmentType;
        appt.Status__c = 'Booked';
        appt.Channel__c = 'Online';
        appt.Customer_Notes__c = customerNotes;
        appt.Identity_Tier__c = determineIdentityTier(contactId);

        insert appt;
        return appt.Id;
    }

    // ─── Private Helpers ──────────────────────────────────────────────

    private static Store_Appointment__c queryFullAppointment(Id appointmentId) {
        return [
            SELECT Id, Name, Contact__c, Contact__r.FirstName, Contact__r.LastName,
                   Contact__r.Email, Contact__r.Phone, Contact__r.Clientelling_Tier__c,
                   Store_Location__c, Appointment_DateTime__c, Type__c, Status__c,
                   Assigned_Rep__c, Assigned_Rep__r.Name, Customer_Notes__c,
                   Rep_Prep_Notes__c, Rep_Post_Notes__c, Channel__c, Identity_Tier__c,
                   Duration_Minutes__c, Satisfaction_Rating__c
            FROM Store_Appointment__c
            WHERE Id = :appointmentId LIMIT 1
        ];
    }

    private static AppointmentWrapper mapToWrapper(Store_Appointment__c appt) {
        AppointmentWrapper w = new AppointmentWrapper();
        w.appointmentId = appt.Id;
        w.name = appt.Name;
        w.contactId = appt.Contact__c;
        w.contactName = ((appt.Contact__r.FirstName != null ? appt.Contact__r.FirstName : '') + ' ' +
                        (appt.Contact__r.LastName != null ? appt.Contact__r.LastName : '')).trim();
        w.contactEmail = appt.Contact__r.Email;
        w.contactPhone = appt.Contact__r.Phone;
        w.storeLocation = appt.Store_Location__c;
        w.appointmentDateTime = String.valueOf(appt.Appointment_DateTime__c);
        w.type_x = appt.Type__c;
        w.status = appt.Status__c;
        w.assignedRepName = appt.Assigned_Rep__r != null ? appt.Assigned_Rep__r.Name : null;
        w.customerNotes = appt.Customer_Notes__c;
        w.repPrepNotes = appt.Rep_Prep_Notes__c;
        w.repPostNotes = appt.Rep_Post_Notes__c;
        w.channel = appt.Channel__c;
        w.identityTier = appt.Identity_Tier__c;
        w.clientellingTier = appt.Contact__r.Clientelling_Tier__c;
        w.durationMinutes = appt.Duration_Minutes__c != null ? appt.Duration_Minutes__c.intValue() : null;
        w.satisfactionRating = appt.Satisfaction_Rating__c != null ? appt.Satisfaction_Rating__c.intValue() : null;
        return w;
    }

    private static String determineIdentityTier(Id contactId) {
        try {
            Contact c = [
                SELECT Demo_Profile__c, Merkury_Id__c, Email
                FROM Contact WHERE Id = :contactId LIMIT 1
            ];
            if (c.Demo_Profile__c == 'Merkury') return 'Appended';
            if (String.isNotBlank(c.Email)) return 'Known';
            return 'Anonymous';
        } catch (Exception e) {
            return 'Anonymous';
        }
    }

    private static Decimal getIncrementedVisitCount(Id contactId) {
        try {
            Contact c = [SELECT Total_Store_Visits__c FROM Contact WHERE Id = :contactId LIMIT 1];
            return (c.Total_Store_Visits__c != null ? c.Total_Store_Visits__c : 0) + 1;
        } catch (Exception e) {
            return 1;
        }
    }
}
