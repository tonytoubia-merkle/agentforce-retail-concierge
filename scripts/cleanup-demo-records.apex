// Find demo contacts
List<Contact> contacts = [
    SELECT Id, Name, Email
    FROM Contact
    WHERE Email IN (
        'sarah.chen@example.com',
        'james.rodriguez@example.com',
        'maya.thompson@example.com',
        'david.kim@example.com',
        'marcus.w@example.com'
    )
];

System.debug('=== Found ' + contacts.size() + ' demo contacts ===');
Set<String> customerIds = new Set<String>();
for (Contact c : contacts) {
    System.debug('Contact: ' + c.Name + ' (' + c.Id + ') - ' + c.Email);
    customerIds.add(c.Id);
}

// Delete Chat Summaries
List<Chat_Summary__c> chats = [
    SELECT Id, Customer_Id__c FROM Chat_Summary__c WHERE Customer_Id__c IN :customerIds
];
System.debug('=== Deleting ' + chats.size() + ' Chat_Summary__c records ===');
if (!chats.isEmpty()) delete chats;

// Delete Meaningful Events
List<Meaningful_Event__c> events = [
    SELECT Id, Customer_Id__c FROM Meaningful_Event__c WHERE Customer_Id__c IN :customerIds
];
System.debug('=== Deleting ' + events.size() + ' Meaningful_Event__c records ===');
if (!events.isEmpty()) delete events;

// Delete Agent Captured Profile
List<Agent_Captured_Profile__c> captured = [
    SELECT Id, Customer_Id__c FROM Agent_Captured_Profile__c WHERE Customer_Id__c IN :customerIds
];
System.debug('=== Deleting ' + captured.size() + ' Agent_Captured_Profile__c records ===');
if (!captured.isEmpty()) delete captured;

// Delete Browse Sessions
List<Browse_Session__c> sessions = [
    SELECT Id, Customer_Id__c FROM Browse_Session__c WHERE Customer_Id__c IN :customerIds
];
System.debug('=== Deleting ' + sessions.size() + ' Browse_Session__c records ===');
if (!sessions.isEmpty()) delete sessions;

System.debug('=== Cleanup complete ===');
