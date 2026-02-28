// Seed Campaign Decode records — maps UTM campaign params to rich context for agents & Data Cloud
// Run with: sf apex run -f salesforce/scripts/seed-campaign-decodes.apex --target-org my-org

// Delete existing records first
delete [SELECT Id FROM Campaign_Decode__c];

List<Campaign_Decode__c> decodes = new List<Campaign_Decode__c>();

// 1. Summer Glow Collection (Instagram)
decodes.add(new Campaign_Decode__c(
    Name = 'Summer Glow Collection',
    UTM_Campaign__c = 'summer-glow-2026',
    UTM_Source__c = 'instagram',
    UTM_Medium__c = 'paid_social',
    Campaign_Theme__c = 'summer-glow',
    Platform__c = 'Instagram',
    Targeting_Strategy__c = 'interest-based',
    Audience_Segment__c = 'Beauty Enthusiasts 25-40',
    Audience_Data_Signals__c = 'beauty purchase intent; skincare browser; lifestyle: wellness',
    Inferred_Interests__c = 'skincare; serums; radiance; summer beauty',
    Inferred_Intent_Signals__c = 'discovery; seasonal purchase; mid-funnel consideration',
    Creative_Headline__c = 'Your Summer Glow Starts Here',
    Creative_Description__c = 'Discover the serums and moisturizers that give you that lit-from-within radiance all season long.',
    Agent_Context_Summary__c = 'This customer clicked through from an Instagram story ad for our Summer Glow Collection. They were targeted as a beauty enthusiast (age 25-40) with skincare purchase intent and wellness lifestyle signals. They are likely interested in serums, moisturizers, and products that deliver radiance or a "glow" effect. This is a mid-funnel discovery visit — they are exploring seasonal beauty options and may need help finding the right products for a summer skincare routine. Recommend glow-enhancing serums, lightweight moisturizers, and SPF products.',
    Is_Active__c = true
));

// 2. Anti-Aging Science (YouTube)
decodes.add(new Campaign_Decode__c(
    Name = 'Anti-Aging Science',
    UTM_Campaign__c = 'anti-aging-science-q1',
    UTM_Source__c = 'youtube',
    UTM_Medium__c = 'video',
    Campaign_Theme__c = 'anti-aging',
    Platform__c = 'YouTube',
    Targeting_Strategy__c = 'lookalike',
    Audience_Segment__c = 'Luxury Skincare Buyers',
    Audience_Data_Signals__c = 'premium beauty purchaser; anti-aging search intent; income: $100K+',
    Inferred_Interests__c = 'anti-aging; retinol; luxury skincare; clinical beauty',
    Inferred_Intent_Signals__c = 'high purchase intent; brand switcher; research phase',
    Creative_Headline__c = 'The Science of Ageless Skin',
    Creative_Description__c = 'Clinically proven retinol and peptide formulas that turn back the clock. Watch the transformation.',
    Agent_Context_Summary__c = 'This customer arrived from a YouTube pre-roll video ad for our Anti-Aging Science campaign. They were identified as a luxury skincare buyer (income $100K+) with active anti-aging search intent — a modeled lookalike audience. They are in a research phase, comparing brands, and have high purchase intent. They likely value clinical efficacy, proven ingredients like retinol and peptides, and premium formulations. Lead with science-backed claims, clinical results, and luxury positioning. They may be open to switching from their current brand if convinced by efficacy.',
    Is_Active__c = true
));

// 3. Cart Abandonment Recovery (Google Display)
decodes.add(new Campaign_Decode__c(
    Name = 'Cart Abandonment Recovery',
    UTM_Campaign__c = 'retarget-cart-abandon',
    UTM_Source__c = 'google',
    UTM_Medium__c = 'display',
    Campaign_Theme__c = 'retargeting',
    Platform__c = 'Google Display',
    Targeting_Strategy__c = 'retargeting',
    Audience_Segment__c = 'Site Visitors: Cart Abandon 7d',
    Audience_Data_Signals__c = 'cart abandonment; product page views: 3+; session: 5+ min',
    Inferred_Interests__c = 'moisturizers; skincare routine',
    Inferred_Intent_Signals__c = 'high purchase intent; price sensitivity; urgency responsive',
    Creative_Headline__c = 'Still Thinking About It?',
    Creative_Description__c = 'The items in your cart are selling fast. Complete your order before they\'re gone.',
    Agent_Context_Summary__c = 'This customer is a retargeting visitor — they previously had items in their cart within the last 7 days but did not complete their purchase. They viewed 3+ product pages and spent over 5 minutes on site, indicating genuine interest. They are likely price-sensitive or were weighing options. This is a bottom-funnel conversion opportunity. Help them complete their purchase by addressing any hesitations. Mention free shipping thresholds, loyalty points earned on purchase, or limited availability. Do not over-pitch new products — focus on what they already showed interest in.',
    Is_Active__c = true
));

// 4. Glow Up Challenge (TikTok)
decodes.add(new Campaign_Decode__c(
    Name = 'Glow Up Challenge',
    UTM_Campaign__c = 'glow-up-challenge-2026',
    UTM_Source__c = 'tiktok',
    UTM_Medium__c = 'paid_social',
    Campaign_Theme__c = 'glow-up',
    Platform__c = 'TikTok',
    Targeting_Strategy__c = 'demographic',
    Audience_Segment__c = 'Gen Z Beauty Curious',
    Audience_Data_Signals__c = 'beauty content engagement; age: 18-25; social trend followers',
    Inferred_Interests__c = 'makeup; foundation; beauty trends; UGC content',
    Inferred_Intent_Signals__c = 'brand discovery; social proof driven; trend adoption',
    Creative_Headline__c = '#GlowUpChallenge',
    Creative_Description__c = 'Show us your before & after with BEAUTE products. 10K+ creators already have.',
    Agent_Context_Summary__c = 'This customer arrived from a TikTok UGC ad featuring the #GlowUpChallenge campaign. They are part of the Gen Z beauty curious audience (18-25), driven by social trends and creator content. They respond to social proof and before/after transformations. They are likely in brand discovery mode — new to our products and influenced by what is trending. Keep the tone fun and relatable. Recommend trending products, mention creator-favorite items, and highlight visible before/after results. They may appreciate bundle deals or starter kits.',
    Is_Active__c = true
));

// 5. Wedding Season 2026 (Pinterest)
decodes.add(new Campaign_Decode__c(
    Name = 'Wedding Season 2026',
    UTM_Campaign__c = 'wedding-season-2026',
    UTM_Source__c = 'pinterest',
    UTM_Medium__c = 'paid_social',
    Campaign_Theme__c = 'bridal-beauty',
    Platform__c = 'Pinterest',
    Targeting_Strategy__c = 'interest-based',
    Audience_Segment__c = 'Engaged / Wedding Planning',
    Audience_Data_Signals__c = 'wedding board activity; bridal search terms; registry behavior',
    Inferred_Interests__c = 'bridal beauty; lipstick; event makeup; wedding prep',
    Inferred_Intent_Signals__c = 'event-driven purchase; high spend occasion; gifting potential',
    Creative_Headline__c = 'Your Wedding Day Beauty Edit',
    Creative_Description__c = 'Curated looks for the bride, bridesmaids, and everyone celebrating love.',
    Agent_Context_Summary__c = 'This customer clicked through from a Pinterest carousel ad for our Wedding Season campaign. They are actively planning a wedding — detected via wedding board activity, bridal search terms, and registry behavior. This is a high-spend occasion with strong gifting potential. They are interested in bridal beauty, long-wear makeup, and event-ready looks. Recommend wedding-day products (long-wear foundation, transfer-proof lipstick, setting spray), bridal skincare prep routines, and bridesmaid gift sets. Be attentive to timelines — ask when the event is to tailor urgency.',
    Is_Active__c = true
));

// 6. Luxury Fragrance Film (CTV / Hulu)
decodes.add(new Campaign_Decode__c(
    Name = 'Luxury Fragrance Film',
    UTM_Campaign__c = 'luxury-fragrance-film-q1',
    UTM_Source__c = 'hulu',
    UTM_Medium__c = 'ctv',
    Campaign_Theme__c = 'luxury-fragrance',
    Platform__c = 'Hulu (CTV)',
    Targeting_Strategy__c = 'household',
    Audience_Segment__c = 'Affluent Beauty Buyers',
    Audience_Data_Signals__c = 'luxury purchase history; income: $150K+; fragrance category affinity',
    Inferred_Interests__c = 'luxury fragrance; premium beauty; gifting',
    Inferred_Intent_Signals__c = 'brand affinity; aspirational purchase; top-of-funnel awareness',
    Creative_Headline__c = 'Luxury, Bottled.',
    Creative_Description__c = 'An immersive fragrance experience for those who demand the extraordinary.',
    Agent_Context_Summary__c = 'This customer arrived from a Hulu CTV 30-second cinematic spot for our luxury fragrance line. They were household-targeted as an affluent beauty buyer (income $150K+) with fragrance category affinity and luxury purchase history. This is a top-of-funnel awareness visit — they may be browsing or exploring after seeing the ad. They appreciate premium positioning and aspirational branding. Recommend luxury fragrances, premium gift sets, and exclusive collections. Maintain an elevated tone. They may also be interested in gifting options.',
    Is_Active__c = true
));

// 7. Loyalty Double Points (Email / CRM)
decodes.add(new Campaign_Decode__c(
    Name = 'Loyalty Double Points',
    UTM_Campaign__c = 'loyalty-double-points-feb',
    UTM_Source__c = 'email',
    UTM_Medium__c = 'crm',
    Campaign_Theme__c = 'loyalty-engagement',
    Platform__c = 'Email',
    Targeting_Strategy__c = 'first-party',
    Audience_Segment__c = 'Gold+ Loyalty Members',
    Audience_Data_Signals__c = 'loyalty tier: Gold/Platinum; email engaged: 90d; avg order value: $65+',
    Inferred_Interests__c = 'loyalty rewards; skincare masks; value-driven purchase',
    Inferred_Intent_Signals__c = 'repeat purchase; loyalty-motivated; weekend shopper',
    Creative_Headline__c = 'Double Points Weekend',
    Creative_Description__c = 'Earn 2x loyalty points on every purchase this weekend. Exclusive for Gold+ members.',
    Agent_Context_Summary__c = 'This customer clicked through from a CRM email promoting Double Points Weekend, targeted exclusively at Gold and Platinum loyalty members. They are a known, engaged repeat customer (email active in last 90 days, avg order $65+). They are loyalty-motivated and respond to points incentives. Acknowledge their loyalty status, mention the double points promotion, and recommend replenishment products or new items that complement their purchase history. They are likely to convert quickly — this is a bottom-funnel, incentive-driven visit.',
    Is_Active__c = true
));

// 8. Men's Skincare Starter (Instagram)
decodes.add(new Campaign_Decode__c(
    Name = 'Men\'s Skincare Starter',
    UTM_Campaign__c = 'mens-skincare-starter-2026',
    UTM_Source__c = 'instagram',
    UTM_Medium__c = 'paid_social',
    Campaign_Theme__c = 'mens-skincare',
    Platform__c = 'Instagram',
    Targeting_Strategy__c = 'contextual',
    Audience_Segment__c = 'Men\'s Grooming Interest',
    Audience_Data_Signals__c = 'male grooming content; age: 25-45; first-time skincare signals',
    Inferred_Interests__c = 'mens skincare; cleansers; simple routines',
    Inferred_Intent_Signals__c = 'category entry; education-driven; low barrier trial',
    Creative_Headline__c = 'Skincare. No BS.',
    Creative_Description__c = 'Simple, effective routines built for guys who want great skin without the fuss.',
    Agent_Context_Summary__c = 'This customer arrived from an Instagram ad targeting men interested in skincare (age 25-45) with first-time skincare signals. They are likely new to skincare and looking for a simple, no-fuss routine. They respond to straightforward, jargon-free communication. Recommend starter kits, simple 2-3 step routines, and multi-purpose products. Avoid overwhelming them with complex regimens. Focus on education — explain what a cleanser, moisturizer, and SPF do without being condescending. This is a category-entry customer with strong lifetime value potential.',
    Is_Active__c = true
));

// 9. SPF Season (Google Display)
decodes.add(new Campaign_Decode__c(
    Name = 'SPF Season',
    UTM_Campaign__c = 'spf-season-2026',
    UTM_Source__c = 'google',
    UTM_Medium__c = 'display',
    Campaign_Theme__c = 'spf-season',
    Platform__c = 'Google Display',
    Targeting_Strategy__c = 'interest-based',
    Audience_Segment__c = 'Outdoor / Active Lifestyle',
    Audience_Data_Signals__c = 'outdoor activity signals; fitness app usage; travel intent',
    Inferred_Interests__c = 'sunscreen; SPF protection; outdoor beauty; active lifestyle',
    Inferred_Intent_Signals__c = 'seasonal purchase; health-motivated; replenishment cycle',
    Creative_Headline__c = 'SPF Season is Here',
    Creative_Description__c = 'Lightweight, invisible sunscreens that actually feel good. Dermatologist recommended.',
    Agent_Context_Summary__c = 'This customer clicked a Google Display ad for SPF Season, targeted at outdoor and active lifestyle audiences (fitness app users, travel intenders). They are health-motivated and care about sun protection that does not interfere with their active lifestyle. Recommend lightweight, invisible-finish sunscreens, sport/water-resistant formulas, and SPF-infused moisturizers. Emphasize dermatologist recommendations and comfortable wear. They may be on a seasonal replenishment cycle — this is likely a practical, needs-based purchase rather than a discovery visit.',
    Is_Active__c = true
));

// 10. K-Beauty Essentials (TikTok)
decodes.add(new Campaign_Decode__c(
    Name = 'K-Beauty Essentials',
    UTM_Campaign__c = 'kbeauty-essentials-2026',
    UTM_Source__c = 'tiktok',
    UTM_Medium__c = 'paid_social',
    Campaign_Theme__c = 'k-beauty',
    Platform__c = 'TikTok',
    Targeting_Strategy__c = 'lookalike',
    Audience_Segment__c = 'K-Beauty Purchasers Lookalike',
    Audience_Data_Signals__c = 'K-beauty purchase history; skincare routine content; Asian beauty brand affinity',
    Inferred_Interests__c = 'K-beauty; hyaluronic acid; glass skin; skincare routines',
    Inferred_Intent_Signals__c = 'trend adoption; routine builder; multi-product purchase',
    Creative_Headline__c = '10-Step K-Beauty in 5 Minutes',
    Creative_Description__c = 'The viral Korean skincare routine simplified. Glass skin is one click away.',
    Agent_Context_Summary__c = 'This customer arrived from a TikTok tutorial ad for K-Beauty Essentials, targeted at a lookalike audience based on existing K-beauty purchasers. They are interested in Korean skincare routines, "glass skin" results, and trend-driven products like hyaluronic acid serums and sheet masks. They are likely a routine builder who buys multiple products in a system. Recommend multi-step routines, K-beauty inspired products, hydration-focused serums, and sheet masks. They may respond well to bundled routine kits. Highlight the simplified "5-minute" angle — they want results without complexity.',
    Is_Active__c = true
));

insert decodes;

System.debug('Inserted ' + decodes.size() + ' Campaign Decode records');

// Verify
for (Campaign_Decode__c d : [SELECT Name, UTM_Campaign__c, Inferred_Interests__c FROM Campaign_Decode__c ORDER BY Name]) {
    System.debug(d.Name + ' | ' + d.UTM_Campaign__c + ' | ' + d.Inferred_Interests__c);
}
