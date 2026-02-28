// Grant FLS for UTM fields on Browse_Session__c to System Administrator PermissionSet
String permSetId = '0PSKa000006CX6gOAG';
String objectName = 'Browse_Session__c';

List<String> fields = new List<String>{
    'UTM_Campaign__c', 'UTM_Source__c', 'UTM_Medium__c'
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
    System.debug('Granted FLS on ' + perms.size() + ' Browse_Session__c UTM fields');
} catch (Exception e) {
    System.debug('FLS error (may already exist): ' + e.getMessage());
}
