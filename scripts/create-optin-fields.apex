// List all custom fields on Contact to see what's actually there
Map<String, Schema.SObjectField> fields = Schema.SObjectType.Contact.fields.getMap();
List<String> customs = new List<String>();
for (String f : fields.keySet()) {
    if (f.endsWith('__c')) {
        customs.add(f);
    }
}
customs.sort();
System.debug('=== Custom fields on Contact (' + customs.size() + ') ===');
for (String f : customs) {
    System.debug('  ' + f);
}

// Check if ContactPointConsent exists (Data Cloud consent model)
try {
    Schema.SObjectType cpcType = Schema.getGlobalDescribe().get('ContactPointConsent');
    if (cpcType != null) {
        System.debug('=== ContactPointConsent EXISTS ===');
        Map<String, Schema.SObjectField> cpcFields = cpcType.getDescribe().fields.getMap();
        for (String f : cpcFields.keySet()) {
            Schema.DescribeFieldResult dfr = cpcFields.get(f).getDescribe();
            if (dfr.isCreateable()) {
                System.debug('  ' + f + ' (' + dfr.getType() + ') - ' + dfr.getLabel());
            }
        }
    } else {
        System.debug('ContactPointConsent NOT available');
    }
} catch (Exception e) {
    System.debug('ContactPointConsent error: ' + e.getMessage());
}

// Check ContactPointEmail
try {
    Schema.SObjectType cpeType = Schema.getGlobalDescribe().get('ContactPointEmail');
    if (cpeType != null) {
        System.debug('=== ContactPointEmail EXISTS ===');
    } else {
        System.debug('ContactPointEmail NOT available');
    }
} catch (Exception e) {
    System.debug('ContactPointEmail error: ' + e.getMessage());
}

// Check ContactPointPhone
try {
    Schema.SObjectType cppType = Schema.getGlobalDescribe().get('ContactPointPhone');
    if (cppType != null) {
        System.debug('=== ContactPointPhone EXISTS ===');
    } else {
        System.debug('ContactPointPhone NOT available');
    }
} catch (Exception e) {
    System.debug('ContactPointPhone error: ' + e.getMessage());
}

// Check Individual
try {
    Schema.SObjectType indType = Schema.getGlobalDescribe().get('Individual');
    if (indType != null) {
        System.debug('=== Individual EXISTS ===');
    } else {
        System.debug('Individual NOT available');
    }
} catch (Exception e) {
    System.debug('Individual error: ' + e.getMessage());
}
