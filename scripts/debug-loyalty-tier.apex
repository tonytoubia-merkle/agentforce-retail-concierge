// Check LoyaltyTier fields to see if there's a rank/sequence
List<LoyaltyTier> tiers = [SELECT Id, Name FROM LoyaltyTier ORDER BY Name];
System.debug('=== LoyaltyTier records: ' + tiers.size() + ' ===');
for (LoyaltyTier t : tiers) {
    System.debug('  Tier: ' + t.Name + ' (' + t.Id + ')');
}
