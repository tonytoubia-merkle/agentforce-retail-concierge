// Describe TransactionJournal fields
Map<String, Schema.SObjectField> fields = TransactionJournal.sObjectType.getDescribe().fields.getMap();
for (String f : fields.keySet()) {
    Schema.DescribeFieldResult dfr = fields.get(f).getDescribe();
    if (dfr.isCreateable()) {
        System.debug(f + ' (' + dfr.getType() + ') - ' + dfr.getLabel());
    }
}
