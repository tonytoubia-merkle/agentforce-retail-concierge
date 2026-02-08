/**
 * Setup Script: Product Affinities for Demo Contacts
 *
 * Run this script in Developer Console → Anonymous Apex to set up
 * product browsing history and affinities for demo contacts.
 *
 * This enables personalized product recommendations in journey prompts.
 */

// ─── Configuration ─────────────────────────────────────────────────

// App base URL for product images (update to your deployment URL)
String appBaseUrl = 'https://agentforce-retail-advisor.vercel.app';

// Product data (matching app's mock products)
Map<String, Map<String, String>> products = new Map<String, Map<String, String>>{
    'moisturizer-sensitive' => new Map<String, String>{
        'name' => 'Hydra-Calm Sensitive Moisturizer',
        'image' => '/assets/products/moisturizer-sensitive.png'
    },
    'sunscreen-lightweight' => new Map<String, String>{
        'name' => 'Invisible Shield SPF 50',
        'image' => '/assets/products/sunscreen-lightweight.png'
    },
    'mist-refreshing' => new Map<String, String>{
        'name' => 'Cooling Facial Mist',
        'image' => '/assets/products/mist-refreshing.png'
    },
    'serum-vitamin-c' => new Map<String, String>{
        'name' => 'Radiance Renewal Serum',
        'image' => '/assets/products/serum-vitamin-c.png'
    },
    'serum-peptide' => new Map<String, String>{
        'name' => 'Peptide Lift Pro Serum',
        'image' => '/assets/products/serum-peptide.png'
    },
    'eye-cream' => new Map<String, String>{
        'name' => 'Eye Revival Cream',
        'image' => '/assets/products/eye-cream.png'
    },
    'mask-hydrating' => new Map<String, String>{
        'name' => 'Deep Dew Hydrating Mask',
        'image' => '/assets/products/mask-hydrating.png'
    },
    'cleanser-gentle' => new Map<String, String>{
        'name' => 'Cloud Cream Cleanser',
        'image' => '/assets/products/cleanser-gentle.png'
    },
    'lipstick-velvet' => new Map<String, String>{
        'name' => 'Velvet Matte Lipstick',
        'image' => '/assets/products/lipstick-velvet.png'
    },
    'blotting-sheets' => new Map<String, String>{
        'name' => 'Oil Control Blotting Papers',
        'image' => '/assets/products/blotting-sheets.png'
    }
};

// ─── Find Demo Contacts ────────────────────────────────────────────

// Try to find Sarah Chen
Contact sarahChen;
List<Contact> sarahContacts = [
    SELECT Id, FirstName, LastName, Email
    FROM Contact
    WHERE (FirstName = 'Sarah' AND LastName = 'Chen')
       OR Email LIKE '%sarah%chen%'
       OR Email LIKE 'sarah@%'
    LIMIT 1
];

if (sarahContacts.isEmpty()) {
    // Create Sarah Chen if not found
    sarahChen = new Contact(
        FirstName = 'Sarah',
        LastName = 'Chen',
        Email = 'sarah.chen@example.com'
    );
    insert sarahChen;
    System.debug('Created Sarah Chen: ' + sarahChen.Id);
} else {
    sarahChen = sarahContacts[0];
    System.debug('Found Sarah Chen: ' + sarahChen.Id + ' (' + sarahChen.Email + ')');
}

// ─── Clear Existing Affinities ─────────────────────────────────────

List<Contact_Product_Affinity__c> existingAffinities = [
    SELECT Id FROM Contact_Product_Affinity__c
    WHERE Contact__c = :sarahChen.Id
];
if (!existingAffinities.isEmpty()) {
    delete existingAffinities;
    System.debug('Cleared ' + existingAffinities.size() + ' existing affinities');
}

// ─── Create Product Affinities for Sarah Chen ──────────────────────

// Sarah's profile: Sensitive skin, interested in travel, anti-aging
// She has browsed travel products and purchased moisturizers
List<Contact_Product_Affinity__c> affinities = new List<Contact_Product_Affinity__c>();

// Purchased products (highest affinity)
affinities.add(createAffinity(sarahChen.Id, 'moisturizer-sensitive', 'Purchased', 5, appBaseUrl, products));
affinities.add(createAffinity(sarahChen.Id, 'cleanser-gentle', 'Purchased', 5, appBaseUrl, products));

// Added to cart but not purchased
affinities.add(createAffinity(sarahChen.Id, 'serum-peptide', 'Added to Cart', 3, appBaseUrl, products));

// Recently viewed (travel products for upcoming trip)
affinities.add(createAffinity(sarahChen.Id, 'sunscreen-lightweight', 'Viewed', 2, appBaseUrl, products));
affinities.add(createAffinity(sarahChen.Id, 'mist-refreshing', 'Viewed', 2, appBaseUrl, products));
affinities.add(createAffinity(sarahChen.Id, 'blotting-sheets', 'Viewed', 1, appBaseUrl, products));

// On wishlist
affinities.add(createAffinity(sarahChen.Id, 'eye-cream', 'Wishlist', 2, appBaseUrl, products));

insert affinities;
System.debug('Created ' + affinities.size() + ' product affinities for Sarah Chen');

// ─── Test the JourneyPromptBuilder ─────────────────────────────────

JourneyPromptBuilder.PromptResult result = JourneyPromptBuilder.buildEnrichedPrompt(
    sarahChen.Id,
    'Paris trip in 2 weeks',
    'travel'
);

System.debug('─── ENRICHED PROMPT ───');
System.debug(result.prompt);
System.debug('');
System.debug('─── RECOMMENDED PRODUCTS JSON ───');
System.debug(result.recommendedProductsJson);
System.debug('');
System.debug('─── REFERENCE IMAGE URLS ───');
for (String url : result.referenceImageUrls) {
    System.debug(url);
}

// ─── Create a Test Journey Approval with Enriched Prompt ───────────

// First create a meaningful event
Meaningful_Event__c event = new Meaningful_Event__c(
    Contact__c = sarahChen.Id,
    Customer_Id__c = String.valueOf(sarahChen.Id),
    Event_Type__c = 'life-event',
    Description__c = 'Planning a romantic Paris trip in two weeks with husband for anniversary',
    Relative_Time_Text__c = 'in two weeks',
    Event_Date__c = Date.today().addDays(14),
    Urgency__c = 'This Week',
    Captured_At__c = DateTime.now()
);
insert event;
System.debug('Created Meaningful Event: ' + event.Id);

// Now create the Journey Approval with enriched prompt
Journey_Approval__c approval = new Journey_Approval__c(
    Contact__c = sarahChen.Id,
    Meaningful_Event__c = event.Id,
    Event_Type__c = 'travel',
    Event_Summary__c = 'Romantic Paris anniversary trip in two weeks',
    Event_Date__c = Date.today().addDays(14),
    Status__c = 'Pending',
    Urgency__c = 'This Week',
    Suggested_Subject__c = 'Paris is calling, Sarah! ✨ Your travel beauty essentials await',
    Suggested_Body__c = '<p>Dear Sarah,</p>' +
        '<p>We heard you\'re planning a romantic getaway to Paris – how exciting! ' +
        'The City of Lights deserves your most radiant self.</p>' +
        '<p>We\'ve curated the perfect travel companions based on your favorites:</p>' +
        '<ul>' +
        '<li><strong>Hydra-Calm Sensitive Moisturizer</strong> – Your go-to, now in travel size</li>' +
        '<li><strong>Invisible Shield SPF 50</strong> – Essential for café terrace moments</li>' +
        '<li><strong>Cooling Facial Mist</strong> – Refresh between museum visits</li>' +
        '</ul>' +
        '<p>Bon voyage!</p>' +
        '<p>With love,<br/>The LUMIÈRE Team</p>',
    Firefly_Prompt__c = result.prompt,
    Recommended_Products__c = result.recommendedProductsJson
);
insert approval;

System.debug('');
System.debug('═══════════════════════════════════════════════════════════════');
System.debug('SUCCESS! Created Journey Approval with enriched prompt');
System.debug('Approval ID: ' + approval.Id);
System.debug('═══════════════════════════════════════════════════════════════');

// ─── Helper Function ───────────────────────────────────────────────

private Contact_Product_Affinity__c createAffinity(
    Id contactId,
    String productCode,
    String affinityType,
    Integer score,
    String baseUrl,
    Map<String, Map<String, String>> productData
) {
    Map<String, String> product = productData.get(productCode);

    Contact_Product_Affinity__c affinity = new Contact_Product_Affinity__c();
    affinity.Contact__c = contactId;
    affinity.Product_Code__c = productCode;
    affinity.Product_Name__c = product.get('name');
    affinity.Product_Image_URL__c = baseUrl + product.get('image');
    affinity.Affinity_Type__c = affinityType;
    affinity.Affinity_Score__c = score;
    affinity.Last_Interaction__c = DateTime.now().addDays(-Math.mod(Math.abs(productCode.hashCode()), 14));

    return affinity;
}
