// Seed demo data for the Clientelling Console
// Run: sf apex run -f salesforce/scripts/seed-clientelling-data.apex -o my-org
//
// This script creates:
// 1. Store_Appointment__c records for today (various statuses)
// 2. Consultation_Note__c records for past appointments
// 3. Store_Stock_Level__c + Price_Tier__c on existing Product2 records
// 4. Contact field updates (Last_Store_Visit__c, Preferred_Store__c, etc.)
//
// Prerequisites: Contacts and Products must already exist (run seed-salesforce.js first).

System.debug('=== SEEDING CLIENTELLING DEMO DATA ===');

// ─── 1. Look up existing Contacts by email ──────────────────────────

Map<String, Contact> contactsByEmail = new Map<String, Contact>();
for (Contact c : [
    SELECT Id, FirstName, LastName, Email
    FROM Contact
    WHERE Email IN (
        'sarah.chen@example.com',
        'james.rodriguez@example.com',
        'maya.thompson@example.com',
        'david.kim@example.com',
        'marcus.w@example.com'
    )
]) {
    contactsByEmail.put(c.Email, c);
}
System.debug('Found ' + contactsByEmail.size() + ' demo contacts');

if (contactsByEmail.isEmpty()) {
    System.debug('ERROR: No demo contacts found. Run seed-salesforce.js first.');
    return;
}

Contact sarah  = contactsByEmail.get('sarah.chen@example.com');
Contact james  = contactsByEmail.get('james.rodriguez@example.com');
Contact maya   = contactsByEmail.get('maya.thompson@example.com');
Contact david  = contactsByEmail.get('david.kim@example.com');
Contact marcus = contactsByEmail.get('marcus.w@example.com');

// ─── 2. Look up current user (rep) ──────────────────────────────────

Id currentUserId = UserInfo.getUserId();

// ─── 3. Clean up existing clientelling demo data ─────────────────────

delete [SELECT Id FROM Consultation_Note__c WHERE Store_Appointment__c != null];
delete [SELECT Id FROM Store_Appointment__c WHERE Store_Location__c = 'Flagship Store'];
System.debug('Cleaned up existing clientelling demo data');

// ─── 4. Create Store_Appointment__c records for today ────────────────

DateTime todayStart = DateTime.newInstance(Date.today(), Time.newInstance(0, 0, 0, 0));
String storeLocation = 'Flagship Store';

List<Store_Appointment__c> appointments = new List<Store_Appointment__c>();

// Appointment 1: Sarah Chen — 10:00 AM — Booked (known customer, rich 360)
if (sarah != null) {
    appointments.add(new Store_Appointment__c(
        Contact__c = sarah.Id,
        Store_Location__c = storeLocation,
        Appointment_DateTime__c = todayStart.addHours(10),
        Type__c = 'Skincare Consultation',
        Status__c = 'Booked',
        Assigned_Rep__c = currentUserId,
        Customer_Notes__c = 'Looking for a new anti-aging routine. Current routine isn\'t working well anymore.',
        Channel__c = 'Online',
        Identity_Tier__c = 'Known'
    ));
}

// Appointment 2: James Rodriguez — 11:00 AM — Confirmed (known customer)
if (james != null) {
    appointments.add(new Store_Appointment__c(
        Contact__c = james.Id,
        Store_Location__c = storeLocation,
        Appointment_DateTime__c = todayStart.addHours(11),
        Type__c = 'Product Demo',
        Status__c = 'Confirmed',
        Assigned_Rep__c = currentUserId,
        Customer_Notes__c = 'Interested in the new LUMIERE collection. Saw the ad on Instagram.',
        Channel__c = 'Online',
        Identity_Tier__c = 'Known'
    ));
}

// Appointment 3: Maya Thompson — 1:00 PM — Checked-In (known customer, in-progress)
if (maya != null) {
    appointments.add(new Store_Appointment__c(
        Contact__c = maya.Id,
        Store_Location__c = storeLocation,
        Appointment_DateTime__c = todayStart.addHours(13),
        Type__c = 'Color Match',
        Status__c = 'Checked-In',
        Assigned_Rep__c = currentUserId,
        Customer_Notes__c = 'Need help finding the right foundation shade for summer.',
        Channel__c = 'Online',
        Identity_Tier__c = 'Known'
    ));
}

// Appointment 4: David Kim — 2:30 PM — Booked (known customer)
if (david != null) {
    appointments.add(new Store_Appointment__c(
        Contact__c = david.Id,
        Store_Location__c = storeLocation,
        Appointment_DateTime__c = todayStart.addHours(14).addMinutes(30),
        Type__c = 'Follow-up',
        Status__c = 'Booked',
        Assigned_Rep__c = currentUserId,
        Customer_Notes__c = 'Follow-up from last month\'s skincare consultation. Want to check progress.',
        Channel__c = 'Phone',
        Identity_Tier__c = 'Known'
    ));
}

// Appointment 5: Marcus Williams — 4:00 PM — Booked (known customer, gift shopping)
if (marcus != null) {
    appointments.add(new Store_Appointment__c(
        Contact__c = marcus.Id,
        Store_Location__c = storeLocation,
        Appointment_DateTime__c = todayStart.addHours(16),
        Type__c = 'Skincare Consultation',
        Status__c = 'Booked',
        Assigned_Rep__c = currentUserId,
        Customer_Notes__c = 'Looking for a gift set for my wife\'s birthday next week.',
        Channel__c = 'Online',
        Identity_Tier__c = 'Known'
    ));
}

insert appointments;
System.debug('Created ' + appointments.size() + ' appointments for today');

// ─── 5. Create Consultation_Note__c records (past consults) ──────────

List<Consultation_Note__c> notes = new List<Consultation_Note__c>();

if (sarah != null && appointments.size() > 0) {
    // Notes from a past consultation with Sarah
    notes.add(new Consultation_Note__c(
        Contact__c = sarah.Id,
        Note_Type__c = 'Observation',
        Note_Text__c = 'Customer has noticeably dry patches on cheeks. Current moisturizer seems insufficient for winter months.',
        Captured_By__c = currentUserId,
        Captured_At__c = DateTime.now().addDays(-14)
    ));
    notes.add(new Consultation_Note__c(
        Contact__c = sarah.Id,
        Note_Type__c = 'Preference',
        Note_Text__c = 'Prefers fragrance-free products. Very interested in clean beauty and sustainability. Mentioned she switched to all-vegan skincare last year.',
        Captured_By__c = currentUserId,
        Captured_At__c = DateTime.now().addDays(-14)
    ));
    notes.add(new Consultation_Note__c(
        Contact__c = sarah.Id,
        Note_Type__c = 'Recommendation',
        Note_Text__c = 'Recommended SERENE Ultra Rich Barrier Cream and Hyaluronic Serum combo. Customer was very interested, said she\'d think about it.',
        Captured_By__c = currentUserId,
        Captured_At__c = DateTime.now().addDays(-14)
    ));
}

if (maya != null) {
    notes.add(new Consultation_Note__c(
        Contact__c = maya.Id,
        Note_Type__c = 'Concern',
        Note_Text__c = 'Mentioned she had a reaction to a foundation with bismuth oxychloride. Added to allergy notes.',
        Captured_By__c = currentUserId,
        Captured_At__c = DateTime.now().addDays(-30)
    ));
    notes.add(new Consultation_Note__c(
        Contact__c = maya.Id,
        Note_Type__c = 'Follow-up',
        Note_Text__c = 'Wants to come back for a summer shade match — her skin tone shifts significantly with sun exposure. Suggested booking for late June.',
        Captured_By__c = currentUserId,
        Captured_At__c = DateTime.now().addDays(-30)
    ));
}

if (david != null) {
    notes.add(new Consultation_Note__c(
        Contact__c = david.Id,
        Note_Type__c = 'Observation',
        Note_Text__c = 'Started a retinol routine 4 weeks ago. Skin showing mild peeling but improving. Advised to continue with extra hydration.',
        Captured_By__c = currentUserId,
        Captured_At__c = DateTime.now().addDays(-28)
    ));
}

insert notes;
System.debug('Created ' + notes.size() + ' consultation notes');

// ─── 6. Update Contact clientelling fields ───────────────────────────

List<Contact> contactUpdates = new List<Contact>();

if (sarah != null) {
    contactUpdates.add(new Contact(
        Id = sarah.Id,
        Last_Store_Visit__c = Date.today().addDays(-14),
        Preferred_Store__c = 'Flagship Store',
        Clientelling_Tier__c = 'VIP',
        Total_Store_Visits__c = 8
    ));
}
if (james != null) {
    contactUpdates.add(new Contact(
        Id = james.Id,
        Last_Store_Visit__c = Date.today().addDays(-45),
        Preferred_Store__c = 'Flagship Store',
        Clientelling_Tier__c = 'Active',
        Total_Store_Visits__c = 3
    ));
}
if (maya != null) {
    contactUpdates.add(new Contact(
        Id = maya.Id,
        Last_Store_Visit__c = Date.today().addDays(-30),
        Preferred_Store__c = 'Flagship Store',
        Clientelling_Tier__c = 'Active',
        Total_Store_Visits__c = 5
    ));
}
if (david != null) {
    contactUpdates.add(new Contact(
        Id = david.Id,
        Last_Store_Visit__c = Date.today().addDays(-28),
        Preferred_Store__c = 'Downtown Boutique',
        Clientelling_Tier__c = 'New',
        Total_Store_Visits__c = 2
    ));
}
if (marcus != null) {
    contactUpdates.add(new Contact(
        Id = marcus.Id,
        Last_Store_Visit__c = Date.today().addDays(-60),
        Preferred_Store__c = 'Flagship Store',
        Clientelling_Tier__c = 'Active',
        Total_Store_Visits__c = 4
    ));
}

update contactUpdates;
System.debug('Updated ' + contactUpdates.size() + ' contacts with clientelling fields');

// ─── 7. Set Store_Stock_Level__c + Price_Tier__c on products ─────────

// Map brand → price tier
Map<String, String> brandTierMap = new Map<String, String>{
    'SERENE' => 'Value',
    'BOTANICA' => 'Mid-Range',
    'MAISON' => 'Premium',
    'LUMIERE' => 'Luxury'
};

List<Product2> productsToUpdate = new List<Product2>();
Integer stockCounter = 0;

for (Product2 p : [
    SELECT Id, Family, ProductCode
    FROM Product2
    WHERE IsActive = true AND ProductCode != null
    LIMIT 50
]) {
    // Assign price tier based on brand/family
    String tier = brandTierMap.get(p.Family);
    if (tier == null) tier = 'Mid-Range';

    // Assign random-ish stock levels for demo variety
    Integer stockLevel;
    Integer mod = Math.mod(stockCounter, 5);
    if (mod == 0) stockLevel = 0;       // Out of stock
    else if (mod == 1) stockLevel = 3;   // Low stock
    else if (mod == 2) stockLevel = 12;  // In stock
    else if (mod == 3) stockLevel = 25;  // In stock
    else stockLevel = 8;                 // In stock

    productsToUpdate.add(new Product2(
        Id = p.Id,
        Store_Stock_Level__c = stockLevel,
        Price_Tier__c = tier
    ));
    stockCounter++;
}

update productsToUpdate;
System.debug('Updated ' + productsToUpdate.size() + ' products with stock levels and price tiers');

// ─── Done ────────────────────────────────────────────────────────────

System.debug('=== CLIENTELLING DEMO DATA SEEDING COMPLETE ===');
System.debug('Summary:');
System.debug('  Appointments created: ' + appointments.size());
System.debug('  Consultation notes created: ' + notes.size());
System.debug('  Contacts updated: ' + contactUpdates.size());
System.debug('  Products updated: ' + productsToUpdate.size());
