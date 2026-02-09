/**
 * Award Purchase Points to Loyalty Member
 *
 * Credits points to a loyalty member based on their purchase amount.
 * Earning rate: 10 points per $100 spent (10% back in points)
 *
 * Usage: Update the variables below and run in Anonymous Apex
 *
 * sf apex run --file salesforce/scripts/award-purchase-points.apex -o <your-org>
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION - UPDATE THESE FOR EACH PURCHASE
// ═══════════════════════════════════════════════════════════════════════════════

String MEMBER_EMAIL = 'sarah.chen@example.com';  // Customer email
Decimal PURCHASE_AMOUNT = 125.00;                 // Purchase total in dollars
String ORDER_NUMBER = 'ORD-2025-001234';          // Order reference number
String NOTES = 'Online purchase - skincare products';

// Points earning rate: 10% back (10 points per $100)
Decimal POINTS_RATE = 0.10;

// ═══════════════════════════════════════════════════════════════════════════════
// PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

System.debug('═══ Award Purchase Points ═══');
System.debug('Customer: ' + MEMBER_EMAIL);
System.debug('Purchase Amount: $' + PURCHASE_AMOUNT);

// Calculate points to award
Integer pointsToAward = (Integer) Math.floor(PURCHASE_AMOUNT * POINTS_RATE);
System.debug('Points to Award: ' + pointsToAward + ' (' + (POINTS_RATE * 100) + '% rate)');

if (pointsToAward < 1) {
    System.debug('⚠ Purchase amount too small to earn points (minimum $10 for 1 point)');
    return;
}

// Find the loyalty program
List<LoyaltyProgram> programs = [
    SELECT Id, Name FROM LoyaltyProgram WHERE Name = 'Beaute Loyalty' LIMIT 1
];

if (programs.isEmpty()) {
    System.debug('⚠ Beaute Loyalty program not found');
    return;
}

LoyaltyProgram program = programs[0];
System.debug('Program: ' + program.Name);

// Find the member by email
List<LoyaltyProgramMember> members = [
    SELECT Id, ContactId, Contact.FirstName, Contact.LastName, MembershipNumber
    FROM LoyaltyProgramMember
    WHERE ProgramId = :program.Id
    AND Contact.Email = :MEMBER_EMAIL
    LIMIT 1
];

if (members.isEmpty()) {
    System.debug('⚠ Member not found for email: ' + MEMBER_EMAIL);
    return;
}

LoyaltyProgramMember member = members[0];
System.debug('Member: ' + member.Contact.FirstName + ' ' + member.Contact.LastName + ' (' + member.MembershipNumber + ')');

// Get the Accrual JournalType for purchase-based points
List<JournalType> journalTypes = [
    SELECT Id, Name FROM JournalType WHERE Name = 'Accrual' LIMIT 1
];

if (journalTypes.isEmpty()) {
    System.debug('⚠ JournalType "Accrual" not found');
    return;
}

JournalType accrualType = journalTypes[0];

// Get the program currency
List<LoyaltyProgramCurrency> currencies = [
    SELECT Id, Name FROM LoyaltyProgramCurrency
    WHERE LoyaltyProgramId = :program.Id AND Name = 'Beauty Points'
    LIMIT 1
];

if (currencies.isEmpty()) {
    System.debug('⚠ Beauty Points currency not found');
    return;
}

LoyaltyProgramCurrency programCurrency = currencies[0];

// Create the TransactionJournal for the purchase accrual
TransactionJournal tj = new TransactionJournal(
    Name = 'Purchase Accrual - ' + ORDER_NUMBER,
    JournalTypeId = accrualType.Id,
    LoyaltyProgramId = program.Id,
    LoyaltyProgramMemberId = member.Id,
    PointsChange = pointsToAward,
    TransactionAmount = PURCHASE_AMOUNT,
    JournalDate = Date.today(),
    Status = 'Processed',
    ReferenceNumber = ORDER_NUMBER,
    AdditionalNotes = NOTES + ' | Earned ' + pointsToAward + ' pts on $' + PURCHASE_AMOUNT + ' purchase'
);

insert tj;
System.debug('✓ Created TransactionJournal: ' + tj.Id);

// Create LoyaltyLedger entry
List<LoyaltyMemberCurrency> memberCurrencies = [
    SELECT Id FROM LoyaltyMemberCurrency
    WHERE LoyaltyMemberId = :member.Id AND LoyaltyProgramCurrencyId = :programCurrency.Id
    LIMIT 1
];

if (!memberCurrencies.isEmpty()) {
    try {
        LoyaltyLedger ledger = new LoyaltyLedger(
            LoyaltyProgramMemberId = member.Id,
            LoyaltyProgramCurrencyId = programCurrency.Id,
            TransactionJournalId = tj.Id,
            Points = pointsToAward,
            EventType = 'Credit'
        );
        insert ledger;
        System.debug('✓ Created LoyaltyLedger: ' + ledger.Id);
    } catch (Exception e) {
        System.debug('⚠ LoyaltyLedger creation skipped (may auto-populate): ' + e.getMessage());
    }
}

// Query updated balance
List<LoyaltyMemberCurrency> updatedCurrencies = [
    SELECT PointsBalance FROM LoyaltyMemberCurrency
    WHERE LoyaltyMemberId = :member.Id AND LoyaltyProgramCurrencyId = :programCurrency.Id
    LIMIT 1
];

System.debug('');
System.debug('═══════════════════════════════════════════════════════════════════');
System.debug('PURCHASE POINTS AWARDED');
System.debug('═══════════════════════════════════════════════════════════════════');
System.debug('Customer: ' + member.Contact.FirstName + ' ' + member.Contact.LastName);
System.debug('Order: ' + ORDER_NUMBER);
System.debug('Purchase: $' + PURCHASE_AMOUNT);
System.debug('Points Earned: ' + pointsToAward);
if (!updatedCurrencies.isEmpty()) {
    System.debug('New Balance: ' + updatedCurrencies[0].PointsBalance + ' pts');
}
System.debug('═══════════════════════════════════════════════════════════════════');
