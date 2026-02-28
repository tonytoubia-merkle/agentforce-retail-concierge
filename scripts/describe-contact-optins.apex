Map<String, Schema.SObjectField> fields = Schema.SObjectType.Contact.fields.getMap();
for (String f : fields.keySet()) {
    if (f.contains('opt') || f.contains('sms') || f.contains('push') || f.contains('email_opt')) {
        System.debug('FOUND: ' + f);
    }
}
System.debug('Total Contact fields: ' + fields.size());
