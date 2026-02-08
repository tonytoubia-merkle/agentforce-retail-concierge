/**
 * Demo Setup Script: Marketing Concierge Portfolios
 *
 * Creates sample portfolios for demonstrating the distributed marketer model.
 * Run this in Developer Console or via sf apex run.
 *
 * This script:
 * 1. Creates 4 sample portfolios (Regional, VIP, Event Specialist)
 * 2. Assigns the current user as primary marketer (for demo)
 * 3. Assigns sample contacts to portfolios
 * 4. Updates existing Journey_Approvals with portfolio assignments
 */

// Get current user for demo assignment
Id currentUserId = UserInfo.getUserId();
String currentUserName = UserInfo.getName();

System.debug('Setting up demo portfolios for: ' + currentUserName);

// Create sample portfolios
List<Marketer_Portfolio__c> portfolios = new List<Marketer_Portfolio__c>();

// 1. Regional Portfolio - Northeast
portfolios.add(new Marketer_Portfolio__c(
    Name = 'Northeast Region',
    Portfolio_Type__c = 'Regional',
    Region__c = 'Northeast',
    Primary_Marketer__c = currentUserId,
    Workload_Capacity__c = 50,
    Auto_Approval_Enabled__c = true,
    Auto_Approval_Confidence_Threshold__c = 85,
    Is_Active__c = true
));

// 2. Regional Portfolio - West
portfolios.add(new Marketer_Portfolio__c(
    Name = 'West Region',
    Portfolio_Type__c = 'Regional',
    Region__c = 'West',
    Primary_Marketer__c = currentUserId,
    Workload_Capacity__c = 50,
    Auto_Approval_Enabled__c = true,
    Auto_Approval_Confidence_Threshold__c = 80,
    Is_Active__c = true
));

// 3. VIP Portfolio
portfolios.add(new Marketer_Portfolio__c(
    Name = 'VIP Clients',
    Portfolio_Type__c = 'VIP',
    Primary_Marketer__c = currentUserId,
    Workload_Capacity__c = 25,
    Auto_Approval_Enabled__c = false, // VIPs always need review
    Is_Active__c = true
));

// 4. Event Specialist - Weddings
portfolios.add(new Marketer_Portfolio__c(
    Name = 'Wedding Specialists',
    Portfolio_Type__c = 'Event Specialist',
    Specialty_Events__c = 'Wedding;Anniversary',
    Primary_Marketer__c = currentUserId,
    Workload_Capacity__c = 30,
    Auto_Approval_Enabled__c = false,
    Is_Active__c = true
));

// 5. Event Specialist - Travel
portfolios.add(new Marketer_Portfolio__c(
    Name = 'Travel & Lifestyle',
    Portfolio_Type__c = 'Event Specialist',
    Specialty_Events__c = 'Travel;Birthday;Holiday',
    Primary_Marketer__c = currentUserId,
    Workload_Capacity__c = 40,
    Auto_Approval_Enabled__c = true,
    Auto_Approval_Confidence_Threshold__c = 75,
    Is_Active__c = true
));

// Check for existing portfolios to avoid duplicates
Set<String> existingNames = new Set<String>();
for (Marketer_Portfolio__c existing : [SELECT Name FROM Marketer_Portfolio__c]) {
    existingNames.add(existing.Name);
}

List<Marketer_Portfolio__c> toInsert = new List<Marketer_Portfolio__c>();
for (Marketer_Portfolio__c p : portfolios) {
    if (!existingNames.contains(p.Name)) {
        toInsert.add(p);
    } else {
        System.debug('Portfolio already exists: ' + p.Name);
    }
}

if (!toInsert.isEmpty()) {
    insert toInsert;
    System.debug('Created ' + toInsert.size() + ' portfolios');
}

// Get all portfolios (including newly created)
Map<String, Marketer_Portfolio__c> portfolioMap = new Map<String, Marketer_Portfolio__c>();
for (Marketer_Portfolio__c p : [SELECT Id, Name, Portfolio_Type__c, Specialty_Events__c FROM Marketer_Portfolio__c WHERE Is_Active__c = true]) {
    portfolioMap.put(p.Name, p);
}

// Assign contacts to portfolios based on their profiles
List<Portfolio_Member__c> members = new List<Portfolio_Member__c>();

// Get contacts with demo profiles
for (Contact c : [SELECT Id, Name, Demo_Profile__c, MailingState FROM Contact WHERE Demo_Profile__c != null LIMIT 100]) {
    Marketer_Portfolio__c portfolio = null;

    // Assign based on demo profile
    String profile = c.Demo_Profile__c?.toLowerCase();
    if (profile != null) {
        if (profile.contains('wedding') || profile.contains('bridal')) {
            portfolio = portfolioMap.get('Wedding Specialists');
        } else if (profile.contains('travel') || profile.contains('jet')) {
            portfolio = portfolioMap.get('Travel & Lifestyle');
        } else if (profile.contains('vip') || profile.contains('platinum')) {
            portfolio = portfolioMap.get('VIP Clients');
        }
    }

    // Fallback to regional based on state
    if (portfolio == null && c.MailingState != null) {
        String state = c.MailingState.toUpperCase();
        Set<String> northeast = new Set<String>{'CT', 'DE', 'MA', 'MD', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'};
        Set<String> west = new Set<String>{'AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'};

        if (northeast.contains(state)) {
            portfolio = portfolioMap.get('Northeast Region');
        } else if (west.contains(state)) {
            portfolio = portfolioMap.get('West Region');
        }
    }

    // Default to Travel & Lifestyle if no match
    if (portfolio == null) {
        portfolio = portfolioMap.get('Travel & Lifestyle');
    }

    if (portfolio != null) {
        members.add(new Portfolio_Member__c(
            Portfolio__c = portfolio.Id,
            Contact__c = c.Id,
            Assignment_Reason__c = 'Manual Assignment',
            Is_Primary__c = true
        ));
    }
}

// Remove existing memberships and insert new ones
delete [SELECT Id FROM Portfolio_Member__c];
if (!members.isEmpty()) {
    insert members;
    System.debug('Created ' + members.size() + ' portfolio memberships');
}

// Now assign existing Journey_Approvals to portfolios
List<Journey_Approval__c> approvalsToUpdate = new List<Journey_Approval__c>();

for (Journey_Approval__c ja : [
    SELECT Id, Contact__c, Contact__r.Demo_Profile__c, Contact__r.MailingState,
           Meaningful_Event__r.Event_Type__c, Assigned_Portfolio__c,
           Confidence_Score__c, Customer_Value_Score__c
    FROM Journey_Approval__c
    WHERE Status__c = 'Pending'
    AND Assigned_Portfolio__c = null
]) {
    Marketer_Portfolio__c portfolio = null;

    // Check for event specialty match first
    String eventType = ja.Meaningful_Event__r?.Event_Type__c;
    if (eventType != null) {
        if (eventType.containsIgnoreCase('wedding') || eventType.containsIgnoreCase('bridal')) {
            portfolio = portfolioMap.get('Wedding Specialists');
        } else if (eventType.containsIgnoreCase('travel') || eventType.containsIgnoreCase('trip')) {
            portfolio = portfolioMap.get('Travel & Lifestyle');
        } else if (eventType.containsIgnoreCase('birthday')) {
            portfolio = portfolioMap.get('Travel & Lifestyle');
        }
    }

    // Check demo profile
    if (portfolio == null) {
        String profile = ja.Contact__r?.Demo_Profile__c?.toLowerCase();
        if (profile != null) {
            if (profile.contains('wedding') || profile.contains('bridal')) {
                portfolio = portfolioMap.get('Wedding Specialists');
            } else if (profile.contains('travel') || profile.contains('jet')) {
                portfolio = portfolioMap.get('Travel & Lifestyle');
            } else if (profile.contains('vip') || profile.contains('platinum')) {
                portfolio = portfolioMap.get('VIP Clients');
            }
        }
    }

    // Regional fallback
    if (portfolio == null && ja.Contact__r?.MailingState != null) {
        String state = ja.Contact__r.MailingState.toUpperCase();
        Set<String> northeast = new Set<String>{'CT', 'DE', 'MA', 'MD', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'};
        Set<String> west = new Set<String>{'AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'};

        if (northeast.contains(state)) {
            portfolio = portfolioMap.get('Northeast Region');
        } else if (west.contains(state)) {
            portfolio = portfolioMap.get('West Region');
        }
    }

    // Default to Travel & Lifestyle
    if (portfolio == null) {
        portfolio = portfolioMap.get('Travel & Lifestyle');
    }

    if (portfolio != null) {
        ja.Assigned_Portfolio__c = portfolio.Id;
        ja.Reviewed_By__c = portfolio.Primary_Marketer__c;

        // Set confidence score if not set
        if (ja.Confidence_Score__c == null) {
            ja.Confidence_Score__c = Math.round(Math.random() * 40 + 50); // 50-90
        }

        // Set customer value score if not set
        if (ja.Customer_Value_Score__c == null) {
            ja.Customer_Value_Score__c = Math.round(Math.random() * 50 + 30); // 30-80
        }

        // Calculate approval tier
        Integer confidence = ja.Confidence_Score__c.intValue();
        if (confidence >= 90 && portfolio.Auto_Approval_Enabled__c) {
            ja.Approval_Tier__c = 'Auto-Send';
        } else if (confidence >= 70) {
            ja.Approval_Tier__c = 'Soft Review';
            ja.Auto_Send_Deadline__c = DateTime.now().addHours(4);
        } else if (confidence >= 40) {
            ja.Approval_Tier__c = 'Review Required';
        } else {
            ja.Approval_Tier__c = 'Escalate';
        }

        // Calculate priority score
        Decimal priorityScore = 0;
        if (ja.Days_Until_Event__c != null) {
            if (ja.Days_Until_Event__c <= 1) priorityScore += 40;
            else if (ja.Days_Until_Event__c <= 3) priorityScore += 30;
            else if (ja.Days_Until_Event__c <= 7) priorityScore += 20;
            else if (ja.Days_Until_Event__c <= 14) priorityScore += 10;
        }
        if (ja.Customer_Value_Score__c != null) {
            priorityScore += (ja.Customer_Value_Score__c / 100) * 30;
        }
        if (ja.Confidence_Score__c != null) {
            priorityScore += ((100 - ja.Confidence_Score__c) / 100) * 20;
        }
        ja.Priority_Score__c = priorityScore.setScale(2);

        approvalsToUpdate.add(ja);
    }
}

if (!approvalsToUpdate.isEmpty()) {
    update approvalsToUpdate;
    System.debug('Updated ' + approvalsToUpdate.size() + ' journey approvals with portfolio assignments');
}

// Update portfolio workload counts
for (Marketer_Portfolio__c p : portfolioMap.values()) {
    Integer workload = [SELECT COUNT() FROM Journey_Approval__c WHERE Assigned_Portfolio__c = :p.Id AND Status__c = 'Pending'];
    p.Current_Workload__c = workload;
}
update portfolioMap.values();

System.debug('Demo setup complete!');
System.debug('Portfolios created: ' + toInsert.size());
System.debug('Portfolio members created: ' + members.size());
System.debug('Journey approvals assigned: ' + approvalsToUpdate.size());
