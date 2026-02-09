/**
 * Setup Beaute Loyalty Program
 *
 * Configures the complete loyalty program with:
 * - Loyalty Program (Beaute Loyalty)
 * - Tier Group and Tiers (Bronze, Silver, Gold, Platinum)
 * - Points Currency (Beauty Points)
 * - Enrolls demo contacts as members with points
 *
 * Run in Anonymous Apex via Developer Console or SF CLI:
 * sf apex run --file salesforce/scripts/setup-loyalty-program.apex -o <your-org>
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

String PROGRAM_NAME = 'Beaute Loyalty';
String TIER_GROUP_NAME = 'Beaute Tiers';
String CURRENCY_NAME = 'Beauty Points';

// Tier thresholds (qualifying points)
Map<String, Integer> TIER_THRESHOLDS = new Map<String, Integer>{
    'Bronze' => 0,
    'Silver' => 500,
    'Gold' => 1500,
    'Platinum' => 5000
};

// Demo member configurations: Contact Email -> { points, enrollmentDate }
// Matching the mock persona data from customerPersonas.ts
Map<String, Map<String, Object>> DEMO_MEMBERS = new Map<String, Map<String, Object>>{
    'sarah.chen@example.com' => new Map<String, Object>{
        'points' => 2450,
        'lifetimePoints' => 4800,
        'enrollmentDate' => Date.newInstance(2024, 11, 1),
        'note' => 'Gold tier - sensitive skin, recent Mumbai trip'
    },
    'maya.thompson@example.com' => new Map<String, Object>{
        'points' => 5200,
        'lifetimePoints' => 12400,
        'enrollmentDate' => Date.newInstance(2024, 3, 1),
        'note' => 'Platinum tier - makeup enthusiast, heavy buyer'
    },
    'david.kim@example.com' => new Map<String, Object>{
        'points' => 980,
        'lifetimePoints' => 1460,
        'enrollmentDate' => Date.newInstance(2025, 8, 15),
        'note' => 'Silver tier - methodical routine builder'
    },
    'james.rodriguez@example.com' => new Map<String, Object>{
        'points' => 250,
        'lifetimePoints' => 250,
        'enrollmentDate' => Date.today(),
        'note' => 'Bronze tier - new enrollee (no loyalty in mock)'
    },
    'marcus.w@example.com' => new Map<String, Object>{
        'points' => 100,
        'lifetimePoints' => 100,
        'enrollmentDate' => Date.today(),
        'note' => 'Bronze tier - brand new customer'
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1: Find or verify the Loyalty Program
// ═══════════════════════════════════════════════════════════════════════════════

System.debug('═══ STEP 1: Loyalty Program ═══');

List<LoyaltyProgram> programs = [
    SELECT Id, Name, Status
    FROM LoyaltyProgram
    WHERE Name = :PROGRAM_NAME
    LIMIT 1
];

LoyaltyProgram program;
if (programs.isEmpty()) {
    System.debug('Creating new Loyalty Program: ' + PROGRAM_NAME);
    program = new LoyaltyProgram(
        Name = PROGRAM_NAME,
        Status = 'Active'
    );
    insert program;
    System.debug('✓ Created program: ' + program.Id);
} else {
    program = programs[0];
    System.debug('✓ Found existing program: ' + program.Id + ' (Status: ' + program.Status + ')');
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2: Create Tier Group
// ═══════════════════════════════════════════════════════════════════════════════

System.debug('═══ STEP 2: Tier Group ═══');

List<LoyaltyTierGroup> tierGroups = [
    SELECT Id, Name
    FROM LoyaltyTierGroup
    WHERE LoyaltyProgramId = :program.Id AND Name = :TIER_GROUP_NAME
    LIMIT 1
];

LoyaltyTierGroup tierGroup;
if (tierGroups.isEmpty()) {
    System.debug('Creating Tier Group: ' + TIER_GROUP_NAME);
    tierGroup = new LoyaltyTierGroup(
        Name = TIER_GROUP_NAME,
        LoyaltyProgramId = program.Id,
        IsActive = true,
        TierModel = 'Anniversary',  // Anniversary model doesn't require fixed reset date
        QpResetPeriod = 'Years',    // Qualifying points reset period
        QpResetFrequency = 1        // Reset every 1 year
    );
    insert tierGroup;
    System.debug('✓ Created tier group: ' + tierGroup.Id);
} else {
    tierGroup = tierGroups[0];
    System.debug('✓ Found existing tier group: ' + tierGroup.Id);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3: Create Tiers
// ═══════════════════════════════════════════════════════════════════════════════

System.debug('═══ STEP 3: Loyalty Tiers ═══');

// Get existing tiers
Map<String, LoyaltyTier> existingTiers = new Map<String, LoyaltyTier>();
for (LoyaltyTier t : [
    SELECT Id, Name, LoyaltyTierGroupId
    FROM LoyaltyTier
    WHERE LoyaltyTierGroupId = :tierGroup.Id
]) {
    existingTiers.put(t.Name, t);
}

List<LoyaltyTier> tiersToInsert = new List<LoyaltyTier>();
Integer tierSequence = 1;

for (String tierName : new List<String>{'Bronze', 'Silver', 'Gold', 'Platinum'}) {
    if (!existingTiers.containsKey(tierName)) {
        System.debug('Creating tier: ' + tierName + ' (min points: ' + TIER_THRESHOLDS.get(tierName) + ')');
        // Note: QualifyingPointsLowerBound may not exist in all orgs - tier thresholds
        // are typically configured in Loyalty Management setup, not programmatically
        LoyaltyTier tier = new LoyaltyTier(
            Name = tierName,
            LoyaltyTierGroupId = tierGroup.Id,
            SequenceNumber = tierSequence
        );
        tiersToInsert.add(tier);
    } else {
        System.debug('✓ Tier exists: ' + tierName);
    }
    tierSequence++;
}

if (!tiersToInsert.isEmpty()) {
    insert tiersToInsert;
    System.debug('✓ Created ' + tiersToInsert.size() + ' tiers');
}

// Refresh tier map
Map<String, Id> tierNameToId = new Map<String, Id>();
for (LoyaltyTier t : [
    SELECT Id, Name
    FROM LoyaltyTier
    WHERE LoyaltyTierGroupId = :tierGroup.Id
]) {
    tierNameToId.put(t.Name, t.Id);
    System.debug('  • ' + t.Name + ': ' + t.Id);
}

// Note: Default tier configuration may need to be done via Loyalty Management Setup UI
// The DefaultLoyaltyTierId field may not be available programmatically in all orgs
System.debug('Note: Set Bronze as default tier via Loyalty Management Setup if member enrollment fails');

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4: Create Program Currency (Points)
// ═══════════════════════════════════════════════════════════════════════════════

System.debug('═══ STEP 4: Program Currency ═══');

List<LoyaltyProgramCurrency> currencies = [
    SELECT Id, Name, CurrencyType
    FROM LoyaltyProgramCurrency
    WHERE LoyaltyProgramId = :program.Id AND Name = :CURRENCY_NAME
    LIMIT 1
];

LoyaltyProgramCurrency programCurrency;
if (currencies.isEmpty()) {
    System.debug('Creating currency: ' + CURRENCY_NAME);
    programCurrency = new LoyaltyProgramCurrency(
        Name = CURRENCY_NAME,
        LoyaltyProgramId = program.Id,
        LoyaltyTierGroupId = tierGroup.Id,  // Required for Qualifying currency type
        CurrencyType = 'Qualifying', // Qualifying points count toward tier status
        IsActive = true
    );
    insert programCurrency;
    System.debug('✓ Created currency: ' + programCurrency.Id);
} else {
    programCurrency = currencies[0];
    System.debug('✓ Found existing currency: ' + programCurrency.Id + ' (Type: ' + programCurrency.CurrencyType + ')');
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 5: Enroll Demo Contacts as Members
// ═══════════════════════════════════════════════════════════════════════════════

System.debug('═══ STEP 5: Member Enrollment ═══');

// Get demo contacts
Set<String> demoEmails = DEMO_MEMBERS.keySet();
Map<String, Contact> contactsByEmail = new Map<String, Contact>();
for (Contact c : [
    SELECT Id, FirstName, LastName, Email, AccountId
    FROM Contact
    WHERE Email IN :demoEmails
]) {
    contactsByEmail.put(c.Email.toLowerCase(), c);
}

System.debug('Found ' + contactsByEmail.size() + ' matching contacts');

// Get existing members
Set<Id> contactIds = new Set<Id>();
for (Contact c : contactsByEmail.values()) {
    contactIds.add(c.Id);
}

Map<Id, LoyaltyProgramMember> existingMembers = new Map<Id, LoyaltyProgramMember>();
for (LoyaltyProgramMember m : [
    SELECT Id, ContactId, MembershipNumber, MemberStatus
    FROM LoyaltyProgramMember
    WHERE ProgramId = :program.Id AND ContactId IN :contactIds
]) {
    existingMembers.put(m.ContactId, m);
}

// Create new members
List<LoyaltyProgramMember> membersToInsert = new List<LoyaltyProgramMember>();
Integer memberNum = 1000;

for (String email : DEMO_MEMBERS.keySet()) {
    Contact c = contactsByEmail.get(email.toLowerCase());
    if (c == null) {
        System.debug('⚠ Contact not found: ' + email);
        continue;
    }

    if (existingMembers.containsKey(c.Id)) {
        System.debug('✓ Already a member: ' + c.FirstName + ' ' + c.LastName);
        continue;
    }

    Map<String, Object> memberConfig = DEMO_MEMBERS.get(email);
    Date enrollmentDate = (Date) memberConfig.get('enrollmentDate');

    memberNum++;
    String membershipNum = 'BL-' + String.valueOf(memberNum).leftPad(6, '0');

    System.debug('Enrolling: ' + c.FirstName + ' ' + c.LastName + ' (' + membershipNum + ') - ' + memberConfig.get('note'));

    LoyaltyProgramMember member = new LoyaltyProgramMember(
        ProgramId = program.Id,
        ContactId = c.Id,
        // Note: AccountId not allowed for Individual MemberType
        MembershipNumber = membershipNum,
        MemberStatus = 'Active',
        EnrollmentDate = enrollmentDate,
        MemberType = 'Individual'
    );
    membersToInsert.add(member);
}

if (!membersToInsert.isEmpty()) {
    insert membersToInsert;
    System.debug('✓ Enrolled ' + membersToInsert.size() + ' new members');
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 6: Create Member Currency Records & Credit Points via Ledger
// ═══════════════════════════════════════════════════════════════════════════════

System.debug('═══ STEP 6: Assign Points ═══');

// Refresh member list
Map<Id, LoyaltyProgramMember> allMembers = new Map<Id, LoyaltyProgramMember>();
for (LoyaltyProgramMember m : [
    SELECT Id, ContactId, Contact.Email, Contact.FirstName, Contact.LastName, MembershipNumber
    FROM LoyaltyProgramMember
    WHERE ProgramId = :program.Id AND ContactId IN :contactIds
]) {
    allMembers.put(m.ContactId, m);
}

// Get existing member currencies
Set<Id> memberIds = new Set<Id>();
for (LoyaltyProgramMember m : allMembers.values()) {
    memberIds.add(m.Id);
}

Map<Id, LoyaltyMemberCurrency> existingMemberCurrencies = new Map<Id, LoyaltyMemberCurrency>();
for (LoyaltyMemberCurrency mc : [
    SELECT Id, LoyaltyMemberId, LoyaltyProgramCurrencyId, PointsBalance
    FROM LoyaltyMemberCurrency
    WHERE LoyaltyMemberId IN :memberIds AND LoyaltyProgramCurrencyId = :programCurrency.Id
]) {
    existingMemberCurrencies.put(mc.LoyaltyMemberId, mc);
}

// Create member currency records (without points - those are calculated from ledger)
List<LoyaltyMemberCurrency> currenciesToInsert = new List<LoyaltyMemberCurrency>();

for (String email : DEMO_MEMBERS.keySet()) {
    Contact c = contactsByEmail.get(email.toLowerCase());
    if (c == null) continue;

    LoyaltyProgramMember member = allMembers.get(c.Id);
    if (member == null) continue;

    LoyaltyMemberCurrency mc = existingMemberCurrencies.get(member.Id);
    if (mc == null) {
        // PointsBalance is calculated - only set the relationship fields
        mc = new LoyaltyMemberCurrency(
            LoyaltyMemberId = member.Id,
            LoyaltyProgramCurrencyId = programCurrency.Id
        );
        currenciesToInsert.add(mc);
        System.debug('Creating currency record for ' + c.FirstName);
    } else {
        System.debug('✓ Currency record exists for ' + c.FirstName + ' (' + mc.PointsBalance + ' pts)');
    }
}

if (!currenciesToInsert.isEmpty()) {
    insert currenciesToInsert;
    System.debug('✓ Created currency records for ' + currenciesToInsert.size() + ' members');

    // Refresh the map after insert
    for (LoyaltyMemberCurrency mc : currenciesToInsert) {
        existingMemberCurrencies.put(mc.LoyaltyMemberId, mc);
    }
}

// Credit initial points via LoyaltyLedger
// Note: In this org, TransactionJournal doesn't have LoyaltyProgramMemberId field
// We create LoyaltyLedger entries directly to credit points

// Check existing ledger entries to avoid duplicates
Map<Id, Decimal> existingLedgerPoints = new Map<Id, Decimal>();
for (LoyaltyLedger ll : [
    SELECT LoyaltyProgramMemberId, Points
    FROM LoyaltyLedger
    WHERE LoyaltyProgramMemberId IN :memberIds
    AND LoyaltyProgramCurrencyId = :programCurrency.Id
    AND EventType = 'Credit'
]) {
    Decimal currentPts = existingLedgerPoints.get(ll.LoyaltyProgramMemberId);
    if (currentPts == null) currentPts = 0;
    existingLedgerPoints.put(ll.LoyaltyProgramMemberId, currentPts + ll.Points);
}

List<LoyaltyLedger> ledgersToInsert = new List<LoyaltyLedger>();

for (String email : DEMO_MEMBERS.keySet()) {
    Contact c = contactsByEmail.get(email.toLowerCase());
    if (c == null) continue;

    LoyaltyProgramMember member = allMembers.get(c.Id);
    if (member == null) continue;

    Map<String, Object> memberConfig = DEMO_MEMBERS.get(email);
    Integer targetPoints = (Integer) memberConfig.get('points');
    Date enrollmentDate = (Date) memberConfig.get('enrollmentDate');

    // Check if already has enough points
    Decimal existingPts = existingLedgerPoints.get(member.Id);
    if (existingPts != null && existingPts >= targetPoints) {
        System.debug('✓ Points already credited for ' + c.FirstName + ' (' + existingPts.intValue() + ' pts)');
        continue;
    }

    // Calculate points to add (avoid duplicating if partial credit exists)
    Integer pointsToAdd = targetPoints;
    if (existingPts != null) {
        pointsToAdd = targetPoints - existingPts.intValue();
    }

    if (pointsToAdd > 0) {
        LoyaltyLedger ledger = new LoyaltyLedger(
            LoyaltyProgramMemberId = member.Id,
            LoyaltyProgramCurrencyId = programCurrency.Id,
            Points = pointsToAdd,
            EventType = 'Credit',
            ActivityDate = Datetime.newInstance(enrollmentDate, Time.newInstance(12, 0, 0, 0))
        );
        ledgersToInsert.add(ledger);
        System.debug('Crediting ' + pointsToAdd + ' points to ' + c.FirstName);
    }
}

if (!ledgersToInsert.isEmpty()) {
    try {
        insert ledgersToInsert;
        System.debug('✓ Created ' + ledgersToInsert.size() + ' loyalty ledger entries');
    } catch (Exception e) {
        System.debug('⚠ LoyaltyLedger creation failed: ' + e.getMessage());
        System.debug('  Points may need to be credited via Loyalty Management UI');
    }
} else {
    System.debug('✓ All members already have initial points credited');
}
System.debug('');

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 7: Assign Tiers to Members
// ═══════════════════════════════════════════════════════════════════════════════

System.debug('═══ STEP 7: Assign Tiers ═══');

// Determine tier based on points
String getTierForPoints(Integer points) {
    if (points >= 5000) return 'Platinum';
    if (points >= 1500) return 'Gold';
    if (points >= 500) return 'Silver';
    return 'Bronze';
}

// Get existing member tiers
Map<Id, LoyaltyMemberTier> existingMemberTiers = new Map<Id, LoyaltyMemberTier>();
for (LoyaltyMemberTier mt : [
    SELECT Id, LoyaltyMemberId, LoyaltyTierId, LoyaltyTier.Name
    FROM LoyaltyMemberTier
    WHERE LoyaltyMemberId IN :memberIds
]) {
    existingMemberTiers.put(mt.LoyaltyMemberId, mt);
}

List<LoyaltyMemberTier> tiersToUpsert = new List<LoyaltyMemberTier>();

for (String email : DEMO_MEMBERS.keySet()) {
    Contact c = contactsByEmail.get(email.toLowerCase());
    if (c == null) continue;

    LoyaltyProgramMember member = allMembers.get(c.Id);
    if (member == null) continue;

    Map<String, Object> memberConfig = DEMO_MEMBERS.get(email);
    Integer points = (Integer) memberConfig.get('points');
    Date enrollmentDate = (Date) memberConfig.get('enrollmentDate');
    String tierName = getTierForPoints(points);
    Id tierId = tierNameToId.get(tierName);

    if (tierId == null) {
        System.debug('⚠ Tier not found: ' + tierName);
        continue;
    }

    LoyaltyMemberTier mt = existingMemberTiers.get(member.Id);
    if (mt == null) {
        mt = new LoyaltyMemberTier(
            LoyaltyMemberId = member.Id,
            LoyaltyTierId = tierId,
            EffectiveDate = enrollmentDate,
            Status = 'Active'
        );
        System.debug('Assigning ' + c.FirstName + ' to ' + tierName + ' tier');
    } else if (mt.LoyaltyTierId != tierId) {
        mt.LoyaltyTierId = tierId;
        mt.EffectiveDate = Date.today();
        System.debug('Updating ' + c.FirstName + ' to ' + tierName + ' tier');
    } else {
        System.debug('✓ ' + c.FirstName + ' already in ' + tierName + ' tier');
        continue;
    }
    tiersToUpsert.add(mt);
}

if (!tiersToUpsert.isEmpty()) {
    upsert tiersToUpsert;
    System.debug('✓ Updated tiers for ' + tiersToUpsert.size() + ' members');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

System.debug('');
System.debug('═══════════════════════════════════════════════════════════════════');
System.debug('LOYALTY PROGRAM SETUP COMPLETE');
System.debug('═══════════════════════════════════════════════════════════════════');
System.debug('Program: ' + PROGRAM_NAME + ' (' + program.Id + ')');
System.debug('Tier Group: ' + TIER_GROUP_NAME + ' (' + tierGroup.Id + ')');
System.debug('Currency: ' + CURRENCY_NAME + ' (' + programCurrency.Id + ')');
System.debug('');
System.debug('Tiers:');
System.debug('  • Bronze: 0+ points');
System.debug('  • Silver: 500+ points');
System.debug('  • Gold: 1500+ points');
System.debug('  • Platinum: 5000+ points');
System.debug('');
System.debug('Members enrolled: ' + allMembers.size());
for (LoyaltyProgramMember m : allMembers.values()) {
    Map<String, Object> memberConfig = DEMO_MEMBERS.get(m.Contact.Email.toLowerCase());
    if (memberConfig != null) {
        Integer pts = (Integer) memberConfig.get('points');
        String tier = getTierForPoints(pts);
        System.debug('  • ' + m.Contact.FirstName + ' ' + m.Contact.LastName + ': ' + pts + ' pts (' + tier + ')');
    }
}
System.debug('');
System.debug('Points Earning Rate: 10 points per $100 spent (10% back)');
System.debug('  $50 purchase → 5 points');
System.debug('  $100 purchase → 10 points');
System.debug('  $250 purchase → 25 points');
System.debug('═══════════════════════════════════════════════════════════════════');
