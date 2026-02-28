// Seed diverse channel opt-in preferences for demo contacts
// so that journey channel selection reflects real preference data.

List<Contact> contacts = [
    SELECT Id, Email, Email_Opt_In__c, SMS_Opt_In__c, Push_Opt_In__c
    FROM Contact
    WHERE Email IN (
        'sarah.chen@example.com',
        'james.rodriguez@example.com',
        'maya.thompson@example.com',
        'david.kim@example.com',
        'marcus.w@example.com'
    )
];

Map<String, Boolean[]> optIns = new Map<String, Boolean[]>{
    //                                    Email  SMS    Push
    'sarah.chen@example.com'        => new Boolean[]{ true,  true,  false },  // Email + SMS
    'james.rodriguez@example.com'   => new Boolean[]{ true,  false, false },  // Email only
    'maya.thompson@example.com'     => new Boolean[]{ true,  true,  true },   // All channels
    'david.kim@example.com'         => new Boolean[]{ true,  false, true },   // Email + Push
    'marcus.w@example.com'          => new Boolean[]{ false, true,  true }    // SMS + Push (no email)
};

for (Contact c : contacts) {
    if (optIns.containsKey(c.Email)) {
        Boolean[] prefs = optIns.get(c.Email);
        c.Email_Opt_In__c = prefs[0];
        c.SMS_Opt_In__c   = prefs[1];
        c.Push_Opt_In__c  = prefs[2];
        System.debug('Setting ' + c.Email + ' → Email=' + prefs[0] + ', SMS=' + prefs[1] + ', Push=' + prefs[2]);
    }
}

update contacts;
System.debug('=== Updated ' + contacts.size() + ' contacts with channel opt-in preferences ===');
