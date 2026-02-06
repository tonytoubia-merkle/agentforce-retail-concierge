// Add Contact.Merkury_Id__c field permission to the Data Cloud Salesforce Connector permission set
// Run: sf apex run -f salesforce/scripts/dc-connector-add-merkury-field.apex -o my-org

System.debug('=== ADDING MERKURY ID FIELD PERMISSION ===');

// Find the Data Cloud Salesforce Connector permission set
PermissionSet ps = [
    SELECT Id, Name, Label
    FROM PermissionSet
    WHERE Name = 'sfdc_a360_sfcrm_data_extract'
    LIMIT 1
];
System.debug('Permission Set: ' + ps.Label + ' (Id: ' + ps.Id + ')');

// Check if field permission already exists
List<FieldPermissions> existing = [
    SELECT Id, Field, PermissionsRead
    FROM FieldPermissions
    WHERE ParentId = :ps.Id AND Field = 'Contact.Merkury_Id__c'
];

if (!existing.isEmpty()) {
    System.debug('✓ Field permission already exists: Read=' + existing[0].PermissionsRead);
} else {
    // Create new field permission
    FieldPermissions fp = new FieldPermissions(
        ParentId = ps.Id,
        SobjectType = 'Contact',
        Field = 'Contact.Merkury_Id__c',
        PermissionsRead = true,
        PermissionsEdit = false
    );

    try {
        insert fp;
        System.debug('✓ Field permission created successfully');
    } catch (Exception e) {
        System.debug('✗ Failed to create field permission: ' + e.getMessage());
    }
}

// Verify
FieldPermissions verify = [
    SELECT Id, Field, PermissionsRead
    FROM FieldPermissions
    WHERE ParentId = :ps.Id AND Field = 'Contact.Merkury_Id__c'
    LIMIT 1
];
System.debug('');
System.debug('Verification: Contact.Merkury_Id__c Read=' + verify.PermissionsRead);
System.debug('');
System.debug('=== COMPLETE ===');
System.debug('The Data Cloud Salesforce Connector can now read Contact.Merkury_Id__c');
System.debug('Map this field to Party Identification in your Data Cloud data stream.');
