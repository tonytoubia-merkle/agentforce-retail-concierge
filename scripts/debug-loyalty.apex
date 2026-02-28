// Debug loyalty data for Sarah Chen
Contact sarah = [SELECT Id, Name FROM Contact WHERE Email = 'sarah.chen@example.com' LIMIT 1];
System.debug('=== Contact: ' + sarah.Name + ' (' + sarah.Id + ') ===');

// Step 1: Find LoyaltyProgramMember
List<LoyaltyProgramMember> members = [
    SELECT Id, MembershipNumber, MemberStatus, EnrollmentDate, ContactId
    FROM LoyaltyProgramMember
    WHERE ContactId = :sarah.Id
];
System.debug('=== LoyaltyProgramMember records: ' + members.size() + ' ===');
for (LoyaltyProgramMember m : members) {
    System.debug('  Member: ' + m.Id + ' | Status: ' + m.MemberStatus + ' | Number: ' + m.MembershipNumber + ' | Enrolled: ' + m.EnrollmentDate);

    // Step 2: Find LoyaltyMemberTier
    List<LoyaltyMemberTier> tiers = [
        SELECT Id, LoyaltyTierId, LoyaltyTier.Name, CreatedDate
        FROM LoyaltyMemberTier
        WHERE LoyaltyMemberId = :m.Id
        ORDER BY CreatedDate DESC
    ];
    System.debug('  LoyaltyMemberTier records: ' + tiers.size());
    for (LoyaltyMemberTier t : tiers) {
        System.debug('    Tier: ' + t.LoyaltyTier.Name + ' | TierId: ' + t.LoyaltyTierId + ' | Created: ' + t.CreatedDate);
    }

    // Step 3: Find LoyaltyMemberCurrency
    List<LoyaltyMemberCurrency> currencies = [
        SELECT Id, Name, PointsBalance, TotalPointsAccrued
        FROM LoyaltyMemberCurrency
        WHERE LoyaltyMemberId = :m.Id
    ];
    System.debug('  LoyaltyMemberCurrency records: ' + currencies.size());
    for (LoyaltyMemberCurrency c : currencies) {
        System.debug('    Currency: ' + c.Name + ' | Balance: ' + c.PointsBalance + ' | Accrued: ' + c.TotalPointsAccrued);
    }
}

// Also check if any LoyaltyProgramMember exists WITHOUT Active filter
List<LoyaltyProgramMember> allMembers = [
    SELECT Id, MemberStatus, ContactId
    FROM LoyaltyProgramMember
    WHERE ContactId = :sarah.Id
];
System.debug('=== All members (any status): ' + allMembers.size() + ' ===');
for (LoyaltyProgramMember m : allMembers) {
    System.debug('  Status: ' + m.MemberStatus);
}
