// Describe TransactionJournal and related objects to find correct field names for crediting points

System.debug('=== TransactionJournal Fields ===');
for (Schema.SObjectField f : TransactionJournal.sObjectType.getDescribe().fields.getMap().values()) {
    Schema.DescribeFieldResult dfr = f.getDescribe();
    System.debug(dfr.getName() + ' (' + dfr.getType() + ')' + (dfr.isCreateable() ? '' : ' [READ-ONLY]'));
}

System.debug('');
System.debug('=== JournalType Fields ===');
for (Schema.SObjectField f : JournalType.sObjectType.getDescribe().fields.getMap().values()) {
    Schema.DescribeFieldResult dfr = f.getDescribe();
    System.debug(dfr.getName() + ' (' + dfr.getType() + ')' + (dfr.isCreateable() ? '' : ' [READ-ONLY]'));
}

System.debug('');
System.debug('=== Existing JournalTypes ===');
for (JournalType jt : [SELECT Id, Name FROM JournalType LIMIT 20]) {
    System.debug('  • ' + jt.Name + ' - ' + jt.Id);
}

System.debug('');
System.debug('=== LoyaltyLedger Fields (if exists) ===');
try {
    for (Schema.SObjectField f : LoyaltyLedger.sObjectType.getDescribe().fields.getMap().values()) {
        Schema.DescribeFieldResult dfr = f.getDescribe();
        System.debug(dfr.getName() + ' (' + dfr.getType() + ')' + (dfr.isCreateable() ? '' : ' [READ-ONLY]'));
    }
} catch (Exception e) {
    System.debug('LoyaltyLedger object not found: ' + e.getMessage());
}

System.debug('');
System.debug('=== TransactionJournalLineItem Fields ===');
try {
    for (Schema.SObjectField f : Schema.getGlobalDescribe().get('TransactionJournalLineItem').getDescribe().fields.getMap().values()) {
        Schema.DescribeFieldResult dfr = f.getDescribe();
        System.debug(dfr.getName() + ' (' + dfr.getType() + ')' + (dfr.isCreateable() ? '' : ' [READ-ONLY]'));
    }
} catch (Exception e) {
    System.debug('TransactionJournalLineItem: ' + e.getMessage());
}
