// Grant FLS for all Campaign_Decode__c fields to System Administrator PermissionSet
String permSetId = '0PSKa000006CX6gOAG';
String objectName = 'Campaign_Decode__c';

List<String> fields = new List<String>{
    'UTM_Campaign__c', 'UTM_Source__c', 'UTM_Medium__c',
    'Campaign_Theme__c', 'Platform__c', 'Targeting_Strategy__c',
    'Audience_Segment__c', 'Audience_Data_Signals__c',
    'Inferred_Interests__c', 'Inferred_Intent_Signals__c',
    'Creative_Headline__c', 'Creative_Description__c',
    'Agent_Context_Summary__c', 'Is_Active__c'
};

List<FieldPermissions> perms = new List<FieldPermissions>();
for (String f : fields) {
    perms.add(new FieldPermissions(
        ParentId = permSetId,
        SobjectType = objectName,
        Field = objectName + '.' + f,
        PermissionsEdit = true,
        PermissionsRead = true
    ));
}

try {
    insert perms;
    System.debug('Granted FLS on ' + perms.size() + ' fields');
} catch (Exception e) {
    System.debug('FLS error (may already exist): ' + e.getMessage());
}
