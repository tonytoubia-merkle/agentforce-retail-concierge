// Check if LedgerEntry or TransactionJournalEntry can link to currency
// Method 1: Try LedgerEntry
try {
    Map<String, Schema.SObjectField> ledgerFields = Schema.SObjectType.LedgerEntry.fields.getMap();
    System.debug('=== LedgerEntry writable fields ===');
    for (String f : ledgerFields.keySet()) {
        Schema.DescribeFieldResult dfr = ledgerFields.get(f).getDescribe();
        if (dfr.isCreateable() && (f.contains('currency') || f.contains('member') || f.contains('point') || f.contains('amount'))) {
            System.debug('  ' + f + ' (' + dfr.getType() + ') - ' + dfr.getLabel());
        }
    }
} catch (Exception e) {
    System.debug('LedgerEntry not available: ' + e.getMessage());
}

// Method 2: Try creating a ledger directly for Sarah's "Beauty Points" currency
Contact sarah = [SELECT Id FROM Contact WHERE Email = 'sarah.chen@example.com' LIMIT 1];
LoyaltyProgramMember member = [SELECT Id FROM LoyaltyProgramMember WHERE ContactId = :sarah.Id AND MemberStatus = 'Active' LIMIT 1];
LoyaltyMemberCurrency bpCurrency = [SELECT Id, Name FROM LoyaltyMemberCurrency WHERE LoyaltyMemberId = :member.Id AND Name = 'Beauty Points' LIMIT 1];

System.debug('=== Target currency: ' + bpCurrency.Id + ' (' + bpCurrency.Name + ') ===');

// Try creating a LedgerEntry
try {
    LedgerEntry le = new LedgerEntry();
    le.LoyaltyMemberCurrencyId = bpCurrency.Id;
    le.LoyaltyProgramMemberId = member.Id;
    le.Points = 2450;
    le.EventType = 'Accrual';
    insert le;
    System.debug('Created LedgerEntry: ' + le.Id);
} catch (Exception e) {
    System.debug('LedgerEntry failed: ' + e.getMessage());
}
