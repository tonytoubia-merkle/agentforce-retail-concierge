// Verify Merkury ID setup for Data Cloud integration
// Run: sf apex run -f salesforce/scripts/dc-verify-merkury-setup.apex -o my-org

System.debug('=== MERKURY ID DATA CLOUD SETUP VERIFICATION ===');
System.debug('');

// 1. Check Contact.Merkury_Id__c field exists
System.debug('1. Checking Contact.Merkury_Id__c field...');
try {
    Schema.DescribeFieldResult fieldDesc = Contact.Merkury_Id__c.getDescribe();
    System.debug('   ✓ Field exists: ' + fieldDesc.getName());
    System.debug('   ✓ Type: ' + fieldDesc.getType());
    System.debug('   ✓ External ID: ' + fieldDesc.isExternalId());
    System.debug('   ✓ Unique: ' + fieldDesc.isUnique());
    System.debug('   ✓ Length: ' + fieldDesc.getLength());
} catch (Exception e) {
    System.debug('   ✗ Field NOT found: ' + e.getMessage());
    System.debug('   → Deploy: sf project deploy start -d salesforce/force-app/main/default/objects/Contact/fields/Merkury_Id__c.field-meta.xml');
}
System.debug('');

// 2. Count Contacts with Merkury ID populated
System.debug('2. Checking Contacts with Merkury ID...');
Integer contactsWithMerkury = [SELECT COUNT() FROM Contact WHERE Merkury_Id__c != null];
Integer totalContacts = [SELECT COUNT() FROM Contact];
System.debug('   Contacts with Merkury ID: ' + contactsWithMerkury + ' / ' + totalContacts);
if (contactsWithMerkury > 0) {
    System.debug('   ✓ Sample Merkury IDs:');
    for (Contact c : [SELECT Id, Name, Merkury_Id__c FROM Contact WHERE Merkury_Id__c != null LIMIT 3]) {
        System.debug('     - ' + c.Name + ': ' + c.Merkury_Id__c);
    }
}
System.debug('');

// 3. Check Data Cloud Salesforce Connector permission set has Contact access
System.debug('3. Checking Data Cloud Connector permissions on Contact...');
try {
    PermissionSet ps = [
        SELECT Id, Name, Label
        FROM PermissionSet
        WHERE Name = 'sfdc_a360_sfcrm_data_extract'
        LIMIT 1
    ];
    System.debug('   ✓ Permission Set found: ' + ps.Label + ' (' + ps.Name + ')');

    // Check object permission
    List<ObjectPermissions> objPerms = [
        SELECT Id, SobjectType, PermissionsRead, PermissionsViewAllRecords
        FROM ObjectPermissions
        WHERE ParentId = :ps.Id AND SobjectType = 'Contact'
    ];
    if (!objPerms.isEmpty()) {
        System.debug('   ✓ Contact object permission: Read=' + objPerms[0].PermissionsRead + ', ViewAll=' + objPerms[0].PermissionsViewAllRecords);
    } else {
        System.debug('   ✗ Contact object permission NOT found');
    }

    // Check Merkury_Id__c field permission
    List<FieldPermissions> fieldPerms = [
        SELECT Id, Field, PermissionsRead
        FROM FieldPermissions
        WHERE ParentId = :ps.Id AND Field = 'Contact.Merkury_Id__c'
    ];
    if (!fieldPerms.isEmpty()) {
        System.debug('   ✓ Contact.Merkury_Id__c field permission: Read=' + fieldPerms[0].PermissionsRead);
    } else {
        System.debug('   ✗ Contact.Merkury_Id__c field permission NOT found');
        System.debug('   → Run: sf apex run -f salesforce/scripts/dc-connector-add-merkury-field.apex');
    }
} catch (Exception e) {
    System.debug('   ✗ Permission Set check failed: ' + e.getMessage());
}
System.debug('');

// 4. Data Cloud configuration reminders
System.debug('4. Data Cloud Configuration Checklist (manual steps):');
System.debug('   □ Web Connector deployed with partyIdentification schema');
System.debug('   □ Data Stream mapping: partyIdentification → Party Identification DMO');
System.debug('   □ Field mapping: IDName → IdentificationNumber, IDType → IdentificationType');
System.debug('   □ Identity Resolution Ruleset includes Merkury ID match rule');
System.debug('   □ Segment Activation Target configured for LiveRamp/Merkury');
System.debug('');

System.debug('=== VERIFICATION COMPLETE ===');
System.debug('See: salesforce/data-cloud/MERKURY_IDENTITY_SETUP.md for full setup guide');
