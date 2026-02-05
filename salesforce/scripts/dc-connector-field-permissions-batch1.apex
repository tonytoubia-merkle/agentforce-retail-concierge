// Enable Read on all permissionable fields for objects 1-26
// for the "Data Cloud Salesforce Connector" permission set.
// Run: sf apex run -f salesforce/scripts/dc-connector-field-permissions-batch1.apex -o my-org

PermissionSet ps = [
    SELECT Id FROM PermissionSet
    WHERE Name = 'sfdc_a360_sfcrm_data_extract' LIMIT 1
];

List<String> targetObjects = new List<String>{
    'Account', 'BenefitType', 'Benefit', 'Case', 'Contact',
    'JournalSubType', 'JournalType', 'LoyaltyAggrPointExprLedger',
    'LoyaltyLedger', 'LoyaltyMemberCurrency', 'LoyaltyMemberTier',
    'LoyaltyPartnerProduct', 'LoyaltyPgmEngmtAttrProm', 'LoyaltyPgmEngmtAttribute',
    'LoyaltyPgmGroupMbrRlnsp', 'LoyaltyPgmMbrAttributeVal', 'LoyaltyPgmPartnerPromotion',
    'LoyaltyProgramBadge', 'LoyaltyProgramCurrency', 'LoyaltyProgramMbrPromotion',
    'LoyaltyProgramMemberBadge', 'LoyaltyProgramMemberCase', 'LoyaltyProgramMember',
    'LoyaltyProgramPartner', 'LoyaltyProgram', 'LoyaltyTierBenefit'
};

// Filter to objects that exist
Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
List<String> existingObjects = new List<String>();
for (String obj : targetObjects) {
    if (globalDescribe.containsKey(obj)) {
        existingObjects.add(obj);
    }
}
System.debug('Processing ' + existingObjects.size() + ' objects (batch 1 of 2)');

// Query existing field permissions for these objects
Set<String> existingFieldKeys = new Set<String>();
for (FieldPermissions fp : [
    SELECT Field FROM FieldPermissions
    WHERE ParentId = :ps.Id AND SobjectType IN :existingObjects
]) {
    existingFieldKeys.add(fp.Field);
}
System.debug('Existing field permissions: ' + existingFieldKeys.size());

// Build field permission records
List<FieldPermissions> toInsert = new List<FieldPermissions>();
Integer alreadySet = 0;
Integer nonPermissionable = 0;

for (String obj : existingObjects) {
    try {
        Schema.DescribeSObjectResult objDescribe = globalDescribe.get(obj).getDescribe();
        for (Schema.SObjectField f : objDescribe.fields.getMap().values()) {
            Schema.DescribeFieldResult fd = f.getDescribe();
            if (fd.isPermissionable()) {
                String fieldKey = obj + '.' + fd.getName();
                if (!existingFieldKeys.contains(fieldKey)) {
                    toInsert.add(new FieldPermissions(
                        ParentId = ps.Id,
                        SobjectType = obj,
                        Field = fieldKey,
                        PermissionsRead = true,
                        PermissionsEdit = false
                    ));
                } else {
                    alreadySet++;
                }
            } else {
                nonPermissionable++;
            }
        }
    } catch (Exception e) {
        System.debug('DESCRIBE FAIL for ' + obj + ': ' + e.getMessage());
    }
}

System.debug('Field permissions to create: ' + toInsert.size());
System.debug('Already set: ' + alreadySet + ', Non-permissionable: ' + nonPermissionable);

Integer successCount = 0;
Integer failCount = 0;

if (!toInsert.isEmpty()) {
    for (Database.SaveResult sr : Database.insert(toInsert, false)) {
        if (sr.isSuccess()) { successCount++; }
        else { failCount++; System.debug('FIELD FAIL: ' + sr.getErrors()); }
    }
}

System.debug('=== FIELD PERMISSIONS BATCH 1 SUMMARY ===');
System.debug('Created: ' + successCount);
System.debug('Already set: ' + alreadySet);
System.debug('Failed: ' + failCount);
