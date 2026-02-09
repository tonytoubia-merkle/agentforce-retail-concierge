/**
 * Fix Demo_Profile__c field for ALL demo contacts
 *
 * The ProfileDropdown queries contacts WHERE Demo_Profile__c != null.
 * This script sets Demo_Profile__c for all demo contacts so they appear in the dropdown.
 *
 * Run: sf apex run --file salesforce/scripts/fix-demo-profile-field.apex -o <your-org>
 */

// All demo contact emails mapped to their profile type
// 'Seeded' = Rich history profiles (known customers with orders/chats)
Map<String, String> DEMO_CONTACTS = new Map<String, String>{
    // Known customers with rich history
    'sarah.chen@example.com' => 'Seeded',
    'james.rodriguez@example.com' => 'Seeded',
    'maya.thompson@example.com' => 'Seeded',
    'david.kim@example.com' => 'Seeded',
    'marcus.w@example.com' => 'Seeded'
    // Note: Aisha Patel and Priya Sharma have no email (Merkury appended only)
    // They won't appear in Salesforce CRM but work in mock mode
};

System.debug('═══════════════════════════════════════════════════════════════════');
System.debug('FIX DEMO PROFILE FIELD');
System.debug('═══════════════════════════════════════════════════════════════════');
System.debug('');

// Find and update contacts
List<Contact> toUpdate = new List<Contact>();
Set<String> foundEmails = new Set<String>();

for (Contact c : [
    SELECT Id, FirstName, LastName, Email, Demo_Profile__c
    FROM Contact
    WHERE Email IN :DEMO_CONTACTS.keySet()
]) {
    String expectedProfile = DEMO_CONTACTS.get(c.Email?.toLowerCase());
    foundEmails.add(c.Email?.toLowerCase());

    if (c.Demo_Profile__c != expectedProfile) {
        c.Demo_Profile__c = expectedProfile;
        toUpdate.add(c);
        System.debug('Updating ' + c.FirstName + ' ' + c.LastName + ' → Demo_Profile__c = ' + expectedProfile);
    } else {
        System.debug('✓ ' + c.FirstName + ' ' + c.LastName + ' already has Demo_Profile__c = ' + c.Demo_Profile__c);
    }
}

// Report missing contacts
Set<String> missingEmails = DEMO_CONTACTS.keySet().clone();
missingEmails.removeAll(foundEmails);
if (!missingEmails.isEmpty()) {
    System.debug('');
    System.debug('⚠ Missing contacts (need to create):');
    for (String email : missingEmails) {
        System.debug('  • ' + email);
    }
}

// Update contacts
if (!toUpdate.isEmpty()) {
    update toUpdate;
    System.debug('');
    System.debug('✓ Updated ' + toUpdate.size() + ' contacts');
}

// Show current state of all demo contacts
System.debug('');
System.debug('═══════════════════════════════════════════════════════════════════');
System.debug('CURRENT DEMO CONTACTS');
System.debug('═══════════════════════════════════════════════════════════════════');
for (Contact c : [
    SELECT Id, FirstName, LastName, Email, Demo_Profile__c, Merkury_Id__c
    FROM Contact
    WHERE Demo_Profile__c != null
    ORDER BY Demo_Profile__c, LastName
]) {
    System.debug('  • ' + c.Demo_Profile__c + ': ' + c.FirstName + ' ' + c.LastName + ' (' + c.Email + ')');
}
System.debug('═══════════════════════════════════════════════════════════════════');
