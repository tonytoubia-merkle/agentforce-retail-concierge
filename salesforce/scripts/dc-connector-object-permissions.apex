// Enable Read + View All on all 52 Loyalty Management objects
// for the "Data Cloud Salesforce Connector" permission set.
// Run: sf apex run -f salesforce/scripts/dc-connector-object-permissions.apex -o my-org

PermissionSet ps = [
    SELECT Id FROM PermissionSet
    WHERE Name = 'sfdc_a360_sfcrm_data_extract' LIMIT 1
];
System.debug('Permission Set Id: ' + ps.Id);

List<String> targetObjects = new List<String>{
    'Account', 'BenefitType', 'Benefit', 'Case', 'Contact',
    'JournalSubType', 'JournalType', 'LoyaltyAggrPointExprLedger',
    'LoyaltyLedger', 'LoyaltyMemberCurrency', 'LoyaltyMemberTier',
    'LoyaltyPartnerProduct', 'LoyaltyPgmEngmtAttrProm', 'LoyaltyPgmEngmtAttribute',
    'LoyaltyPgmGroupMbrRlnsp', 'LoyaltyPgmMbrAttributeVal', 'LoyaltyPgmPartnerPromotion',
    'LoyaltyProgramBadge', 'LoyaltyProgramCurrency', 'LoyaltyProgramMbrPromotion',
    'LoyaltyProgramMemberBadge', 'LoyaltyProgramMemberCase', 'LoyaltyProgramMember',
    'LoyaltyProgramPartner', 'LoyaltyProgram', 'LoyaltyTierBenefit',
    'LoyaltyTierGroup', 'LoyaltyTier', 'MarketSegment',
    'MemberBenefit', 'Product2', 'ProductCategory',
    'PromotionLoyaltyPtnrProdt', 'PromotionMarketSegment', 'Promotion',
    'TransactionJournal', 'UnitOfMeasure', 'VoucherDefinition',
    'Voucher', 'EngagementChannelType', 'ProductCatalog',
    'GameDefinition', 'GameParticipant', 'GameParticipantReward',
    'GameReward', 'LoyaltyMembershipLifecycle', 'LoyaltyProgramMemberMerge',
    'LoyaltyLedgerTraceability', 'LoyaltyPgmPartnerCurrency', 'LoyaltyPgmPtnrLdgrSummary',
    'LoyaltyPgmPtnrPrepaidPack', 'LoyaltyProgramPartnerLedger'
};

// Filter to objects that actually exist in this org
Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
List<String> existingObjects = new List<String>();
List<String> missingObjects = new List<String>();
for (String obj : targetObjects) {
    if (globalDescribe.containsKey(obj)) {
        existingObjects.add(obj);
    } else {
        missingObjects.add(obj);
    }
}
System.debug('Objects found: ' + existingObjects.size() + ' / ' + targetObjects.size());
if (!missingObjects.isEmpty()) {
    System.debug('Missing objects: ' + String.join(missingObjects, ', '));
}

// Query existing object permissions on this permission set
Map<String, ObjectPermissions> existingPerms = new Map<String, ObjectPermissions>();
for (ObjectPermissions op : [
    SELECT Id, SobjectType, PermissionsRead, PermissionsViewAllRecords
    FROM ObjectPermissions
    WHERE ParentId = :ps.Id AND SobjectType IN :existingObjects
]) {
    existingPerms.put(op.SobjectType, op);
}

// Build insert / update lists
List<ObjectPermissions> toInsert = new List<ObjectPermissions>();
List<ObjectPermissions> toUpdate = new List<ObjectPermissions>();
Integer alreadyCorrect = 0;

for (String obj : existingObjects) {
    if (existingPerms.containsKey(obj)) {
        ObjectPermissions op = existingPerms.get(obj);
        if (!op.PermissionsRead || !op.PermissionsViewAllRecords) {
            op.PermissionsRead = true;
            op.PermissionsViewAllRecords = true;
            toUpdate.add(op);
        } else {
            alreadyCorrect++;
        }
    } else {
        toInsert.add(new ObjectPermissions(
            ParentId = ps.Id,
            SobjectType = obj,
            PermissionsRead = true,
            PermissionsViewAllRecords = true
        ));
    }
}

Integer successCount = 0;
Integer failCount = 0;

if (!toUpdate.isEmpty()) {
    for (Database.SaveResult sr : Database.update(toUpdate, false)) {
        if (sr.isSuccess()) { successCount++; }
        else { failCount++; System.debug('UPDATE FAIL: ' + sr.getErrors()); }
    }
}
if (!toInsert.isEmpty()) {
    for (Database.SaveResult sr : Database.insert(toInsert, false)) {
        if (sr.isSuccess()) { successCount++; }
        else { failCount++; System.debug('INSERT FAIL: ' + sr.getErrors()); }
    }
}

System.debug('=== OBJECT PERMISSIONS SUMMARY ===');
System.debug('Created/updated: ' + successCount);
System.debug('Already correct: ' + alreadyCorrect);
System.debug('Failed: ' + failCount);
System.debug('Missing from org: ' + missingObjects.size());
