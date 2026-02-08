// Create Multi-Step Journey - Run in Anonymous Apex
String baseUrl = 'https://agentforce-retail-advisor.vercel.app';
String jid = 'JRN-' + DateTime.now().getTime();

// Find/Create Contact
Contact c;
List<Contact> cl = [SELECT Id FROM Contact WHERE FirstName='Sarah' AND LastName='Chen' LIMIT 1];
if(cl.isEmpty()) {
    c = new Contact(FirstName='Sarah', LastName='Chen', Email='sarah.chen@example.com');
    insert c;
} else { c = cl[0]; }

// Create Event
Meaningful_Event__c evt = new Meaningful_Event__c(
    Contact__c=c.Id, Customer_Id__c=String.valueOf(c.Id), Event_Type__c='travel',
    Description__c='Paris trip in 2 weeks', Event_Date__c=Date.today().addDays(14),
    Urgency__c='This Week', Captured_At__c=DateTime.now()
);
insert evt;

// Products JSON
String prods = '[{"name":"Invisible Shield SPF 50","productCode":"sunscreen-lightweight","imageUrl":"'+baseUrl+'/assets/products/sunscreen-lightweight.png"},{"name":"Cooling Facial Mist","productCode":"mist-refreshing","imageUrl":"'+baseUrl+'/assets/products/mist-refreshing.png"},{"name":"Hydra-Calm Moisturizer","productCode":"moisturizer-sensitive","imageUrl":"'+baseUrl+'/assets/products/moisturizer-sensitive.png"}]';

// Guardrails
String guard = '{"maxEmailsPerWeek":2,"exitOnPurchase":true,"minDaysBetweenMessages":2}';

// Prompts
String p1 = 'Elegant travel bag on Parisian hotel bed, skincare products arranged, Eiffel Tower visible, soft morning light, premium lifestyle photography';
String p2 = 'Final reminder scene, skincare on marble vanity, passport visible, golden hour lighting, luxury travel aesthetic';

// Create 3 Journey Steps
List<Journey_Approval__c> steps = new List<Journey_Approval__c>();

// Step 1: Email
steps.add(new Journey_Approval__c(
    Contact__c=c.Id, Meaningful_Event__c=evt.Id, Event_Type__c='travel',
    Event_Summary__c='Paris anniversary trip', Event_Date__c=Date.today().addDays(14),
    Status__c='Pending', Urgency__c='This Week',
    Journey_Id__c=jid, Step_Number__c=1, Total_Steps__c=3, Channel__c='Email', Send_Delay_Days__c=0,
    Journey_Guardrails__c=guard, Firefly_Prompt__c=p1, Recommended_Products__c=prods,
    Suggested_Subject__c='Sarah, Paris is calling! Your travel essentials await',
    Suggested_Body__c='<p>Dear Sarah,</p><p>Paris awaits! We curated travel essentials for you:</p><ul><li><strong>Invisible Shield SPF 50</strong></li><li><strong>Cooling Facial Mist</strong></li><li><strong>Hydra-Calm Moisturizer</strong></li></ul><p>With love,<br/>LUMIÈRE</p>'
));

// Step 2: SMS
steps.add(new Journey_Approval__c(
    Contact__c=c.Id, Meaningful_Event__c=evt.Id, Event_Type__c='travel',
    Event_Summary__c='Paris anniversary trip', Event_Date__c=Date.today().addDays(14),
    Status__c='Pending', Urgency__c='This Week',
    Journey_Id__c=jid, Step_Number__c=2, Total_Steps__c=3, Channel__c='SMS', Send_Delay_Days__c=3,
    Journey_Guardrails__c=guard, Recommended_Products__c=prods,
    Suggested_Subject__c='Paris Reminder',
    SMS_Body__c='Hi Sarah! Your Paris trip is coming up! Get your travel skincare: lumiere.co/travel',
    Suggested_Body__c='Hi Sarah! Your Paris trip is coming up! Get your travel skincare: lumiere.co/travel'
));

// Step 3: Email
steps.add(new Journey_Approval__c(
    Contact__c=c.Id, Meaningful_Event__c=evt.Id, Event_Type__c='travel',
    Event_Summary__c='Paris anniversary trip', Event_Date__c=Date.today().addDays(14),
    Status__c='Pending', Urgency__c='Immediate',
    Journey_Id__c=jid, Step_Number__c=3, Total_Steps__c=3, Channel__c='Email', Send_Delay_Days__c=5,
    Journey_Guardrails__c=guard, Firefly_Prompt__c=p2, Recommended_Products__c=prods,
    Suggested_Subject__c='Sarah, last chance before Paris! Free shipping ends tonight',
    Suggested_Body__c='<p>Dear Sarah,</p><p>2 days until Paris! Last chance for free shipping:</p><ul><li><strong>Invisible Shield SPF 50</strong></li><li><strong>Cooling Facial Mist</strong></li><li><strong>Hydra-Calm Moisturizer</strong></li></ul><p>Bon voyage!<br/>LUMIÈRE</p>'
));

insert steps;
System.debug('Created 3-step journey: ' + jid);
System.debug('Step 1 (Email): ' + steps[0].Id);
System.debug('Step 2 (SMS): ' + steps[1].Id);
System.debug('Step 3 (Email): ' + steps[2].Id);
