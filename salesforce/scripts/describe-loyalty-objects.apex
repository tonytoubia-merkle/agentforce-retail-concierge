// Describe Loyalty Management objects to find correct field names
System.debug('=== LoyaltyProgram Fields ===');
for (Schema.SObjectField f : LoyaltyProgram.sObjectType.getDescribe().fields.getMap().values()) {
    System.debug(f.getDescribe().getName() + ' (' + f.getDescribe().getType() + ')');
}

System.debug('=== LoyaltyTierGroup Fields ===');
for (Schema.SObjectField f : LoyaltyTierGroup.sObjectType.getDescribe().fields.getMap().values()) {
    System.debug(f.getDescribe().getName() + ' (' + f.getDescribe().getType() + ')');
}

System.debug('=== LoyaltyTier Fields ===');
for (Schema.SObjectField f : LoyaltyTier.sObjectType.getDescribe().fields.getMap().values()) {
    System.debug(f.getDescribe().getName() + ' (' + f.getDescribe().getType() + ')');
}

System.debug('=== LoyaltyProgramCurrency Fields ===');
for (Schema.SObjectField f : LoyaltyProgramCurrency.sObjectType.getDescribe().fields.getMap().values()) {
    System.debug(f.getDescribe().getName() + ' (' + f.getDescribe().getType() + ')');
}

System.debug('=== LoyaltyProgramMember Fields ===');
for (Schema.SObjectField f : LoyaltyProgramMember.sObjectType.getDescribe().fields.getMap().values()) {
    System.debug(f.getDescribe().getName() + ' (' + f.getDescribe().getType() + ')');
}

System.debug('=== LoyaltyMemberCurrency Fields ===');
for (Schema.SObjectField f : LoyaltyMemberCurrency.sObjectType.getDescribe().fields.getMap().values()) {
    System.debug(f.getDescribe().getName() + ' (' + f.getDescribe().getType() + ')');
}

System.debug('=== LoyaltyMemberTier Fields ===');
for (Schema.SObjectField f : LoyaltyMemberTier.sObjectType.getDescribe().fields.getMap().values()) {
    System.debug(f.getDescribe().getName() + ' (' + f.getDescribe().getType() + ')');
}
