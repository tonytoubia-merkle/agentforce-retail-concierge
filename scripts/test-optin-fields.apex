// Try direct SOQL to test if opt-in fields exist
try {
    List<Contact> contacts = [
        SELECT Id, Email, Email_Opt_In__c, SMS_Opt_In__c, Push_Opt_In__c
        FROM Contact
        WHERE Email = 'sarah.chen@example.com'
        LIMIT 1
    ];
    if (!contacts.isEmpty()) {
        Contact c = contacts[0];
        System.debug('SUCCESS - Sarah opt-ins: Email=' + c.Email_Opt_In__c + ', SMS=' + c.SMS_Opt_In__c + ', Push=' + c.Push_Opt_In__c);
    } else {
        System.debug('No contact found');
    }
} catch (Exception e) {
    System.debug('FIELD ERROR: ' + e.getMessage());
    // Fields don't exist, try to list available custom fields
    Map<String, Schema.SObjectField> fields = Schema.SObjectType.Contact.fields.getMap();
    List<String> customs = new List<String>();
    for (String f : fields.keySet()) {
        if (f.endsWith('__c')) {
            customs.add(f);
        }
    }
    customs.sort();
    System.debug('Custom fields on Contact: ' + String.join(customs, ', '));
}
