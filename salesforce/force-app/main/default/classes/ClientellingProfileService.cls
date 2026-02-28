/**
 * ClientellingProfileService - Central controller for the in-store clientelling LWC app.
 * Assembles a provenance-aware 360 customer profile for rep-facing use.
 *
 * KEY DESIGN PRINCIPLE: This service NEVER exposes raw 3P appended data
 * (household income, demographics, etc.) to the UI. Instead, it translates
 * those signals into brand-tier recommendations and category suggestions
 * via the private translateAppendedSignals() method.
 */
global with sharing class ClientellingProfileService {

    // ─── Brand/Tier Mapping (for 3P → recommendation translation) ────
    private static final Map<String, String> BRAND_TIER_MAP = new Map<String, String>{
        'Luxury' => 'LUMIERE',
        'Premium' => 'MAISON',
        'Mid-Range' => 'BOTANICA',
        'Value' => 'SERENE'
    };

    private static final Map<String, List<String>> INTEREST_CATEGORY_MAP = new Map<String, List<String>>{
        'clean beauty' => new List<String>{ 'SERENE', 'BOTANICA' },
        'luxury beauty' => new List<String>{ 'LUMIERE', 'MAISON' },
        'anti-aging' => new List<String>{ 'anti-aging', 'premium skincare' },
        'wellness' => new List<String>{ 'serums', 'masks', 'self-care' },
        'sustainability' => new List<String>{ 'SERENE', 'eco-conscious' },
        'skincare' => new List<String>{ 'moisturizers', 'serums', 'cleansers' },
        'yoga' => new List<String>{ 'wellness', 'natural beauty' },
        'fitness' => new List<String>{ 'post-workout', 'SPF', 'hydration' },
        'organic food' => new List<String>{ 'clean beauty', 'natural ingredients' }
    };

    private static final Map<String, String> LIFESTYLE_CONTEXT_MAP = new Map<String, String>{
        'urban professional' => 'Urban professional lifestyle',
        'eco-conscious' => 'Eco-conscious lifestyle',
        'fitness-active' => 'Active fitness lifestyle',
        'outdoor-enthusiast' => 'Active outdoor lifestyle',
        'luxury-seeker' => 'Luxury-oriented lifestyle',
        'conscious-consumer' => 'Values-driven consumer'
    };

    // ─── Inner Classes ───────────────────────────────────────────────

    public class ProfileSection {
        @AuraEnabled public String skinType;
        @AuraEnabled public String skinConcerns;
        @AuraEnabled public String allergies;
        @AuraEnabled public String beautyPriority;
        @AuraEnabled public String preferredBrands;
        @AuraEnabled public String priceRange;
        @AuraEnabled public String sustainabilityPreference;
        @AuraEnabled public String climateContext;
    }

    public class OrderSummary {
        @AuraEnabled public String orderId;
        @AuraEnabled public String orderDate;
        @AuraEnabled public Decimal totalAmount;
        @AuraEnabled public String status;
        @AuraEnabled public List<LineItemSummary> lineItems;
    }

    public class LineItemSummary {
        @AuraEnabled public String productId;
        @AuraEnabled public String productName;
        @AuraEnabled public Decimal quantity;
        @AuraEnabled public Decimal unitPrice;
    }

    public class LoyaltySnapshot {
        @AuraEnabled public String tier;
        @AuraEnabled public Decimal pointsBalance;
        @AuraEnabled public Decimal lifetimePoints;
        @AuraEnabled public String memberSince;
    }

    public class EventSnapshot {
        @AuraEnabled public String eventType;
        @AuraEnabled public String description;
        @AuraEnabled public String capturedAt;
        @AuraEnabled public String agentNote;
        @AuraEnabled public String eventDate;
        @AuraEnabled public String eventEndDate;
        @AuraEnabled public String urgency;       // Dynamic: Immediate, This Week, This Month, Future
        @AuraEnabled public String urgencyClass;   // CSS class for badge color
        @AuraEnabled public String timeContext;     // Smart text: "tomorrow", "in 3 days", "2 weeks ago"
        @AuraEnabled public Integer daysUntil;      // Raw number from formula field
    }

    public class ChatSnapshot {
        @AuraEnabled public String sessionDate;
        @AuraEnabled public String summary;
        @AuraEnabled public String sentiment;
        @AuraEnabled public List<String> topicsDiscussed;
    }

    public class BrowseSnapshot {
        @AuraEnabled public String sessionDate;
        @AuraEnabled public List<String> categoriesBrowsed;
        @AuraEnabled public List<String> productsViewed;
        @AuraEnabled public Decimal durationMinutes;
        @AuraEnabled public String device;
    }

    public class CapturedField {
        @AuraEnabled public String fieldName;
        @AuraEnabled public String value;
        @AuraEnabled public String capturedAt;
        @AuraEnabled public String confidence;
    }

    public class AppointmentSnapshot {
        @AuraEnabled public Id appointmentId;
        @AuraEnabled public String appointmentDateTime;
        @AuraEnabled public String type_x;
        @AuraEnabled public String status;
        @AuraEnabled public String customerNotes;
        @AuraEnabled public String repPrepNotes;
        @AuraEnabled public String channel;
        @AuraEnabled public String identityTier;
    }

    public class CustomerSearchResult {
        @AuraEnabled public Id contactId;
        @AuraEnabled public String name;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String identityTier;
        @AuraEnabled public String clientellingTier;
        @AuraEnabled public String loyaltyTier;
    }

    public class ProductRecommendation {
        @AuraEnabled public String productId;
        @AuraEnabled public String name;
        @AuraEnabled public String brand;
        @AuraEnabled public Decimal price;
        @AuraEnabled public String category;
        @AuraEnabled public String imageUrl;
        @AuraEnabled public String recommendationSource; // "Staff Pick", "Complementary", "Trending"
    }

    public class ClientellingProfileWrapper {
        // Identity
        @AuraEnabled public Id contactId;
        @AuraEnabled public String name;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String identityTier;
        @AuraEnabled public String clientellingTier;

        // 1P Direct-display sections
        @AuraEnabled public ProfileSection beautyProfile;
        @AuraEnabled public List<OrderSummary> recentOrders;
        @AuraEnabled public LoyaltySnapshot loyalty;
        @AuraEnabled public List<EventSnapshot> meaningfulEvents;
        @AuraEnabled public List<ChatSnapshot> chatHistory;
        @AuraEnabled public List<BrowseSnapshot> browseActivity;
        @AuraEnabled public List<CapturedField> capturedProfile;

        // 3P Translated recommendations (NEVER raw appended data)
        @AuraEnabled public List<String> recommendedBrandTiers;
        @AuraEnabled public List<String> recommendedCategories;
        @AuraEnabled public String lifestyleContext;

        // Appointments
        @AuraEnabled public List<AppointmentSnapshot> upcomingAppointments;
        @AuraEnabled public AppointmentSnapshot todaysAppointment;

        // Consultation notes
        @AuraEnabled public List<Map<String, Object>> consultationNotes;

        // Communication channel preferences
        @AuraEnabled public Boolean emailOptIn;
        @AuraEnabled public Boolean smsOptIn;
        @AuraEnabled public Boolean pushOptIn;
    }

    // ─── Main Profile Assembly ───────────────────────────────────────

    @AuraEnabled
    public static ClientellingProfileWrapper getCustomerProfileForRep(Id contactId) {
        ClientellingProfileWrapper wrapper = new ClientellingProfileWrapper();

        // Fetch Contact record
        Contact c = [
            SELECT Id, FirstName, LastName, Email, Phone,
                   Skin_Type__c, Skin_Concerns__c, Allergies__c,
                   Beauty_Priority__c, Preferred_Brands__c, Price_Range__c,
                   Sustainability_Preference__c, Climate_Context__c,
                   Clientelling_Tier__c, Merkury_Id__c, Demo_Profile__c,
                   Email_Opt_In__c, SMS_Opt_In__c, Push_Opt_In__c
            FROM Contact
            WHERE Id = :contactId
            LIMIT 1
        ];

        wrapper.contactId = c.Id;
        wrapper.name = (c.FirstName != null ? c.FirstName : '') + ' ' + (c.LastName != null ? c.LastName : '');
        wrapper.name = wrapper.name.trim();
        wrapper.email = c.Email;
        wrapper.phone = c.Phone;
        wrapper.clientellingTier = c.Clientelling_Tier__c != null ? c.Clientelling_Tier__c : 'New';

        // Determine identity tier
        if (c.Demo_Profile__c == 'Merkury') {
            wrapper.identityTier = 'appended';
        } else if (String.isNotBlank(c.Email)) {
            wrapper.identityTier = 'known';
        } else {
            wrapper.identityTier = 'anonymous';
        }

        // 1P Beauty profile (declared)
        ProfileSection bp = new ProfileSection();
        bp.skinType = c.Skin_Type__c;
        bp.skinConcerns = c.Skin_Concerns__c;
        bp.allergies = c.Allergies__c;
        bp.beautyPriority = c.Beauty_Priority__c;
        bp.preferredBrands = c.Preferred_Brands__c;
        bp.priceRange = c.Price_Range__c;
        bp.sustainabilityPreference = c.Sustainability_Preference__c;
        bp.climateContext = c.Climate_Context__c;
        wrapper.beautyProfile = bp;

        // Communication channel preferences
        wrapper.emailOptIn = c.Email_Opt_In__c == true;
        wrapper.smsOptIn = c.SMS_Opt_In__c == true;
        wrapper.pushOptIn = c.Push_Opt_In__c == true;

        // Reuse DataCloudProfileService sub-queries
        String custId = String.valueOf(contactId);

        // Orders (observed)
        wrapper.recentOrders = buildOrderSummaries(custId);

        // Chat summaries (observed)
        wrapper.chatHistory = buildChatSnapshots(custId);

        // Meaningful events (stated/agent_inferred)
        wrapper.meaningfulEvents = buildEventSnapshots(custId);

        // Browse sessions (inferred)
        wrapper.browseActivity = buildBrowseSnapshots(custId);

        // Loyalty (observed)
        wrapper.loyalty = buildLoyaltySnapshot(custId);

        // Agent-captured profile (stated/agent_inferred)
        wrapper.capturedProfile = buildCapturedFields(custId);

        // Appointments
        wrapper.upcomingAppointments = getUpcomingAppointments(contactId);
        wrapper.todaysAppointment = getTodaysAppointment(contactId);

        // Consultation notes
        wrapper.consultationNotes = getRecentConsultationNotes(custId);

        // 3P Translated recommendations — NEVER raw appended data
        translateAppendedSignals(wrapper, c);

        return wrapper;
    }

    // ─── Update Customer Profile ──────────────────────────────────────

    @AuraEnabled
    public static void updateCustomerProfile(Id contactId, Map<String, String> fields) {
        Contact c = new Contact(Id = contactId);
        if (fields.containsKey('skinType')) c.Skin_Type__c = fields.get('skinType');
        if (fields.containsKey('skinConcerns')) c.Skin_Concerns__c = fields.get('skinConcerns');
        if (fields.containsKey('allergies')) c.Allergies__c = fields.get('allergies');
        if (fields.containsKey('beautyPriority')) c.Beauty_Priority__c = fields.get('beautyPriority');
        if (fields.containsKey('preferredBrands')) c.Preferred_Brands__c = fields.get('preferredBrands');
        if (fields.containsKey('priceRange')) c.Price_Range__c = fields.get('priceRange');
        if (fields.containsKey('sustainabilityPreference')) c.Sustainability_Preference__c = fields.get('sustainabilityPreference');
        if (fields.containsKey('climateContext')) c.Climate_Context__c = fields.get('climateContext');
        update c;
    }

    // ─── Customer Search ─────────────────────────────────────────────

    @AuraEnabled
    public static List<CustomerSearchResult> searchCustomers(String searchTerm) {
        List<CustomerSearchResult> results = new List<CustomerSearchResult>();
        if (String.isBlank(searchTerm) || searchTerm.length() < 2) return results;

        String term = '%' + searchTerm + '%';

        List<Contact> contacts = [
            SELECT Id, FirstName, LastName, Email, Phone,
                   Clientelling_Tier__c, Merkury_Id__c, Demo_Profile__c
            FROM Contact
            WHERE Email LIKE :term
               OR Phone LIKE :term
               OR FirstName LIKE :term
               OR LastName LIKE :term
            ORDER BY LastName ASC
            LIMIT 20
        ];

        for (Contact c : contacts) {
            CustomerSearchResult r = new CustomerSearchResult();
            r.contactId = c.Id;
            r.name = ((c.FirstName != null ? c.FirstName : '') + ' ' + (c.LastName != null ? c.LastName : '')).trim();
            r.email = c.Email;
            r.phone = c.Phone;
            r.clientellingTier = c.Clientelling_Tier__c;

            if (c.Demo_Profile__c == 'Merkury') {
                r.identityTier = 'appended';
            } else if (String.isNotBlank(c.Email)) {
                r.identityTier = 'known';
            } else {
                r.identityTier = 'anonymous';
            }

            results.add(r);
        }

        return results;
    }

    // ─── Walk-In Customer Resolution ─────────────────────────────────

    @AuraEnabled
    public static ClientellingProfileWrapper resolveWalkInCustomer(String email, String firstName, String lastName) {
        return resolveWalkInCustomerWithProfile(email, firstName, lastName, null);
    }

    @AuraEnabled
    public static ClientellingProfileWrapper resolveWalkInCustomerWithProfile(
            String email, String firstName, String lastName, String merkuryArchetypeId) {
        // Check if contact exists
        List<Contact> existing = [
            SELECT Id FROM Contact WHERE Email = :email LIMIT 1
        ];

        Id contactId;
        if (!existing.isEmpty()) {
            contactId = existing[0].Id;
            // If a Merkury profile was selected, link identity only — NEVER write 3P data to profile fields
            if (String.isNotBlank(merkuryArchetypeId)) {
                applyMerkuryIdentity(contactId, merkuryArchetypeId);
            }
        } else {
            // Create new contact
            Contact newContact = new Contact();
            newContact.FirstName = firstName;
            newContact.LastName = String.isNotBlank(lastName) ? lastName : 'Walk-In';
            newContact.Email = email;
            newContact.Clientelling_Tier__c = 'New';

            // Walk-in contacts are real people with CRM records — always 'Created'.
            // Merkury enrichment is linked via Merkury_Id__c separately.
            newContact.Demo_Profile__c = 'Created';

            if (String.isNotBlank(merkuryArchetypeId)) {
                // Link Merkury identity for 3P signal enrichment at runtime
                MerkuryArchetype arch = getMerkuryArchetypeMap().get(merkuryArchetypeId);
                if (arch != null) {
                    newContact.Merkury_Id__c = arch.merkuryPid;
                }
            }

            insert newContact;
            contactId = newContact.Id;
        }

        return getCustomerProfileForRep(contactId);
    }

    /**
     * Links a Merkury identity to an existing Contact.
     * Sets ONLY the Merkury_Id__c for 3P signal enrichment at runtime.
     * Does NOT change Demo_Profile__c — the contact keeps its original category
     * (Seeded, Created, etc.) since it's a real CRM record, not a 3P-only ghost.
     * Does NOT write 3P appended data to 1P profile fields.
     */
    private static void applyMerkuryIdentity(Id contactId, String archetypeId) {
        MerkuryArchetype arch = getMerkuryArchetypeMap().get(archetypeId);
        if (arch == null) return;

        Contact c = new Contact(Id = contactId);
        c.Merkury_Id__c = arch.merkuryPid;
        update c;
    }

    // ─── Merkury Archetypes ─────────────────────────────────────────

    public class MerkuryArchetype {
        @AuraEnabled public String id;
        @AuraEnabled public String label;
        @AuraEnabled public String archetype;
        @AuraEnabled public String merkuryPid;
        @AuraEnabled public String merkuryHid;
        @AuraEnabled public String skinType;
        @AuraEnabled public String concerns;
        @AuraEnabled public String preferredBrands;
        @AuraEnabled public String beautyPriority;
        @AuraEnabled public String priceTier;
        @AuraEnabled public List<String> interests;
    }

    @AuraEnabled(cacheable=true)
    public static List<MerkuryArchetype> getMerkuryArchetypes() {
        return getMerkuryArchetypeMap().values();
    }

    private static Map<String, MerkuryArchetype> merkuryCache;

    private static Map<String, MerkuryArchetype> getMerkuryArchetypeMap() {
        if (merkuryCache != null) return merkuryCache;
        merkuryCache = new Map<String, MerkuryArchetype>();

        merkuryCache.put('merkury-urban-clean', buildArch(
            'merkury-urban-clean', 'Clean Beauty Urbanite', 'F 28-35 · $80-120k · SF Bay Area',
            'PID-UC-20001', 'HID-H001', 'Combination', 'hydration;brightening',
            'SERENE', 'Glow-focused minimalist routine', 'mid-range',
            new List<String>{'clean beauty', 'sustainability', 'yoga'}
        ));
        merkuryCache.put('merkury-luxury-parent', buildArch(
            'merkury-luxury-parent', 'Luxury Suburban Parent', 'F 40-50 · $150-250k · Dallas Metro',
            'PID-LP-20002', 'HID-H003', 'Normal', 'anti-aging;firmness',
            'LUMIERE;MAISON', 'Results-driven anti-aging regimen', 'luxury',
            new List<String>{'luxury lifestyle', 'family', 'wine'}
        ));
        merkuryCache.put('merkury-kbeauty-pro', buildArch(
            'merkury-kbeauty-pro', 'K-Beauty Professional', 'F 22-28 · $60-80k · Los Angeles',
            'PID-KB-20003', 'HID-H004', 'Normal', 'brightening;glow;pores',
            'LUMIERE', 'Multi-step glow routine', 'mid-range',
            new List<String>{'K-beauty', 'skincare trends', 'wellness'}
        ));
        merkuryCache.put('merkury-premium-retiree', buildArch(
            'merkury-premium-retiree', 'Premium Retiree', 'F 55-65 · $200k+ · Palm Beach',
            'PID-PR-20004', 'HID-H003', 'Mature', 'anti-aging;hydration;firmness',
            'LUMIERE;MAISON', 'Luxury age-defying routine', 'luxury',
            new List<String>{'luxury travel', 'golf', 'philanthropy'}
        ));
        merkuryCache.put('merkury-budget-student', buildArch(
            'merkury-budget-student', 'Budget-Conscious Student', 'F 18-22 · <$30k · College Town',
            'PID-BS-20005', 'HID-H005', 'Oily', 'acne;oil control',
            'DERMAFIX', 'Simple affordable essentials', 'value',
            new List<String>{'social media', 'college life', 'budget beauty'}
        ));
        merkuryCache.put('merkury-male-minimal', buildArch(
            'merkury-male-minimal', 'Male Grooming Minimalist', 'M 30-40 · $100-150k · Chicago',
            'PID-MM-20006', 'HID-H001', 'Combination', 'oil control;razor irritation',
            'DERMAFIX', 'Quick and effective grooming', 'mid-range',
            new List<String>{'fitness', 'tech', 'minimal grooming'}
        ));
        merkuryCache.put('merkury-wellness-mom', buildArch(
            'merkury-wellness-mom', 'Wellness Mom', 'F 35-45 · $120-180k · Suburban',
            'PID-WM-20007', 'HID-H002', 'Sensitive', 'hydration;redness',
            'SERENE', 'Gentle clean routine for sensitive skin', 'mid-range',
            new List<String>{'wellness', 'family activities', 'clean living'}
        ));
        merkuryCache.put('merkury-genz-social', buildArch(
            'merkury-genz-social', 'Gen Z Social Beauty', 'NB 18-25 · $30-50k · NYC',
            'PID-GZ-20008', 'HID-H006', 'Normal', 'brightening;glow',
            'LUMIERE', 'Trend-forward glow-up routine', 'mid-range',
            new List<String>{'social media', 'TikTok beauty', 'self-expression'}
        ));
        merkuryCache.put('merkury-antiaging-pro', buildArch(
            'merkury-antiaging-pro', 'Anti-Aging Professional', 'F 45-55 · $150-200k · Boston',
            'PID-AP-20009', 'HID-H007', 'Combination', 'anti-aging;texture;dark spots',
            'LUMIERE;DERMAFIX', 'Science-backed anti-aging program', 'premium',
            new List<String>{'career', 'fine dining', 'clinical skincare'}
        ));
        merkuryCache.put('merkury-active-outdoor', buildArch(
            'merkury-active-outdoor', 'Active Outdoors SPF', 'M 25-35 · $70-100k · Denver',
            'PID-AO-20010', 'HID-H002', 'Normal', 'sun protection;hydration',
            'SERENE', 'Sun protection and recovery', 'mid-range',
            new List<String>{'hiking', 'cycling', 'outdoor sports'}
        ));

        return merkuryCache;
    }

    private static MerkuryArchetype buildArch(
            String id, String label, String archetype,
            String pid, String hid, String skinType, String concerns,
            String brands, String priority, String priceTier, List<String> interests) {
        MerkuryArchetype a = new MerkuryArchetype();
        a.id = id;
        a.label = label;
        a.archetype = archetype;
        a.merkuryPid = pid;
        a.merkuryHid = hid;
        a.skinType = skinType;
        a.concerns = concerns;
        a.preferredBrands = brands;
        a.beautyPriority = priority;
        a.priceTier = priceTier;
        a.interests = interests;
        return a;
    }

    // ─── Provenance-Aware Product Recommendations ────────────────────

    @AuraEnabled(cacheable=true)
    public static List<ProductRecommendation> getCustomerRecommendations(Id contactId) {
        List<ProductRecommendation> recs = new List<ProductRecommendation>();

        Contact c = [
            SELECT Skin_Type__c, Skin_Concerns__c, Preferred_Brands__c,
                   Price_Range__c, Merkury_Id__c, Demo_Profile__c
            FROM Contact
            WHERE Id = :contactId
            LIMIT 1
        ];

        // Build product search query factoring in profile
        String soql = 'SELECT Id, Name, Brand__c, Price__c, Category__c, Image_URL__c'
            + ' FROM Product2 WHERE IsActive = true AND In_Stock__c = true';

        // If known customer with preferences, filter by skin type
        if (String.isNotBlank(c.Skin_Type__c)) {
            String st = c.Skin_Type__c;
            soql += ' AND Skin_Types__c INCLUDES (\'' + String.escapeSingleQuotes(st) + '\')';
        }

        // If 3P Merkury signals exist, use archetype price tier to filter silently
        // The UI labels these as "Staff Picks", never "Based on your profile"
        if (c.Demo_Profile__c == 'Merkury' || String.isNotBlank(c.Merkury_Id__c)) {
            MerkuryArchetype arch = findArchetypeByPid(c.Merkury_Id__c);
            if (arch != null && String.isNotBlank(arch.priceTier)) {
                String tier = arch.priceTier.toLowerCase();
                if (tier == 'luxury') {
                    soql += ' AND Price_Tier__c IN (\'Luxury\', \'Premium\')';
                } else if (tier == 'value') {
                    soql += ' AND Price_Tier__c IN (\'Value\', \'Mid-Range\')';
                }
            }
        }

        soql += ' ORDER BY Rating__c DESC LIMIT 6';

        List<Product2> products = Database.query(soql);

        for (Product2 p : products) {
            ProductRecommendation rec = new ProductRecommendation();
            rec.productId = p.Id;
            rec.name = p.Name;
            rec.brand = (String) p.get('Brand__c');
            rec.price = (Decimal) p.get('Price__c');
            rec.category = (String) p.get('Category__c');
            rec.imageUrl = (String) p.get('Image_URL__c');
            rec.recommendationSource = 'Staff Pick'; // NEVER "Based on your profile"
            recs.add(rec);
        }

        return recs;
    }

    // ─── Private Helpers ─────────────────────────────────────────────

    /**
     * Translates 3P Merkury appended signals into brand-tier recommendations.
     * This ensures raw demographic data (HH income, age, etc.) is NEVER exposed
     * to the rep UI. Instead, it produces brand and category suggestions.
     *
     * PROVENANCE MODEL: Reads appended data from the Merkury archetype at runtime
     * (looked up by Merkury_Id__c), NOT from Contact profile fields. Contact fields
     * like Skin_Type__c are reserved for 1P declared/observed data only.
     */
    private static void translateAppendedSignals(ClientellingProfileWrapper wrapper, Contact c) {
        wrapper.recommendedBrandTiers = new List<String>();
        wrapper.recommendedCategories = new List<String>();
        wrapper.lifestyleContext = '';

        // For non-appended customers, skip 3P translation
        if (c.Demo_Profile__c != 'Merkury' && String.isBlank(c.Merkury_Id__c)) {
            return;
        }

        // Look up the Merkury archetype by PID — this is where 3P data lives
        MerkuryArchetype arch = findArchetypeByPid(c.Merkury_Id__c);
        if (arch == null) {
            wrapper.lifestyleContext = 'Beauty-conscious consumer';
            return;
        }

        // Price tier → brand recommendations (3P signal → curated suggestion)
        String tier = arch.priceTier != null ? arch.priceTier.toLowerCase() : '';
        if (tier == 'luxury') {
            wrapper.recommendedBrandTiers.addAll(new List<String>{ 'LUMIERE', 'MAISON' });
        } else if (tier == 'premium') {
            wrapper.recommendedBrandTiers.addAll(new List<String>{ 'LUMIERE', 'BOTANICA' });
        } else if (tier == 'mid-range') {
            wrapper.recommendedBrandTiers.addAll(new List<String>{ 'BOTANICA', 'MAISON' });
        } else {
            wrapper.recommendedBrandTiers.addAll(new List<String>{ 'SERENE', 'BOTANICA' });
        }

        // Archetype concerns → category suggestions (3P signal → category, not raw concern text)
        if (String.isNotBlank(arch.concerns)) {
            for (String concern : arch.concerns.split(';')) {
                concern = concern.trim().toLowerCase();
                if (concern.contains('aging') || concern.contains('wrinkle') || concern.contains('firmness')) {
                    wrapper.recommendedCategories.add('anti-aging');
                } else if (concern.contains('acne') || concern.contains('oil control')) {
                    wrapper.recommendedCategories.add('acne care');
                } else if (concern.contains('dry') || concern.contains('hydration')) {
                    wrapper.recommendedCategories.add('hydration');
                } else if (concern.contains('sensitive') || concern.contains('redness')) {
                    wrapper.recommendedCategories.add('gentle skincare');
                } else if (concern.contains('brightening') || concern.contains('glow')) {
                    wrapper.recommendedCategories.add('brightening');
                } else if (concern.contains('sun') || concern.contains('spf')) {
                    wrapper.recommendedCategories.add('sun protection');
                }
            }
        }

        // Archetype interests → lifestyle context
        if (arch.interests != null && !arch.interests.isEmpty()) {
            wrapper.lifestyleContext = String.join(arch.interests, ', ');
        } else {
            wrapper.lifestyleContext = 'Beauty-conscious consumer';
        }
    }

    /**
     * Finds a Merkury archetype by its PID (e.g., 'PID-UC-20001').
     * Used at runtime to read 3P signals without persisting them to Contact.
     */
    private static MerkuryArchetype findArchetypeByPid(String merkuryPid) {
        if (String.isBlank(merkuryPid)) return null;
        for (MerkuryArchetype arch : getMerkuryArchetypeMap().values()) {
            if (arch.merkuryPid == merkuryPid) return arch;
        }
        return null;
    }

    private static List<OrderSummary> buildOrderSummaries(String customerId) {
        List<OrderSummary> summaries = new List<OrderSummary>();
        try {
            List<Order> orders = [
                SELECT OrderNumber, EffectiveDate, TotalAmount, Status,
                       (SELECT Product2.Name, Product2Id, Quantity, UnitPrice FROM OrderItems)
                FROM Order
                WHERE AccountId IN (SELECT AccountId FROM Contact WHERE Id = :customerId)
                ORDER BY EffectiveDate DESC
                LIMIT 5
            ];
            for (Order o : orders) {
                OrderSummary s = new OrderSummary();
                s.orderId = o.OrderNumber;
                s.orderDate = String.valueOf(o.EffectiveDate);
                s.totalAmount = o.TotalAmount;
                s.status = o.Status == 'Activated' ? 'completed' : o.Status?.toLowerCase();
                s.lineItems = new List<LineItemSummary>();
                if (o.OrderItems != null) {
                    for (OrderItem oi : o.OrderItems) {
                        LineItemSummary li = new LineItemSummary();
                        li.productId = oi.Product2Id;
                        li.productName = oi.Product2?.Name;
                        li.quantity = oi.Quantity;
                        li.unitPrice = oi.UnitPrice;
                        s.lineItems.add(li);
                    }
                }
                summaries.add(s);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'ClientellingProfileService.buildOrderSummaries: ' + e.getMessage());
        }
        return summaries;
    }

    private static List<ChatSnapshot> buildChatSnapshots(String customerId) {
        List<ChatSnapshot> snapshots = new List<ChatSnapshot>();
        try {
            for (Chat_Summary__c r : [
                SELECT Session_Date__c, Summary_Text__c, Sentiment__c, Topics_Discussed__c
                FROM Chat_Summary__c WHERE Customer_Id__c = :customerId
                ORDER BY Session_Date__c DESC LIMIT 5
            ]) {
                ChatSnapshot s = new ChatSnapshot();
                s.sessionDate = String.valueOf(r.Session_Date__c);
                s.summary = r.Summary_Text__c;
                s.sentiment = r.Sentiment__c;
                s.topicsDiscussed = r.Topics_Discussed__c != null
                    ? r.Topics_Discussed__c.split(';') : new List<String>();
                snapshots.add(s);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'ClientellingProfileService.buildChatSnapshots: ' + e.getMessage());
        }
        return snapshots;
    }

    private static List<EventSnapshot> buildEventSnapshots(String customerId) {
        List<EventSnapshot> snapshots = new List<EventSnapshot>();
        try {
            // Filter out expired time-bound events (Event_End_Date__c in the past).
            // Events with no end date are always shown (preferences, concerns, milestones).
            for (Meaningful_Event__c r : [
                SELECT Event_Type__c, Description__c, Captured_At__c, Agent_Note__c,
                       Event_Date__c, Event_End_Date__c, Days_Until_Event__c
                FROM Meaningful_Event__c
                WHERE Customer_Id__c = :customerId
                  AND (Event_End_Date__c = null OR Event_End_Date__c >= :Date.today())
                ORDER BY Captured_At__c DESC LIMIT 10
            ]) {
                EventSnapshot s = new EventSnapshot();
                s.eventType = r.Event_Type__c;
                s.description = r.Description__c;
                s.capturedAt = String.valueOf(r.Captured_At__c);
                s.agentNote = r.Agent_Note__c;
                s.eventDate = r.Event_Date__c != null ? String.valueOf(r.Event_Date__c) : null;
                s.eventEndDate = r.Event_End_Date__c != null ? String.valueOf(r.Event_End_Date__c) : null;

                // Dynamic urgency and contextual time — recalculated every read
                if (r.Event_Date__c != null) {
                    Integer days = Date.today().daysBetween(r.Event_Date__c);
                    s.daysUntil = days;
                    s.urgency = computeUrgency(days);
                    s.urgencyClass = computeUrgencyClass(days);
                    s.timeContext = computeTimeContext(days);
                }

                snapshots.add(s);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'ClientellingProfileService.buildEventSnapshots: ' + e.getMessage());
        }
        return snapshots;
    }

    /**
     * Compute urgency label dynamically from days until event.
     */
    private static String computeUrgency(Integer daysUntil) {
        if (daysUntil < 0) return 'Past';
        if (daysUntil == 0) return 'Today';
        if (daysUntil <= 3) return 'Immediate';
        if (daysUntil <= 7) return 'This Week';
        if (daysUntil <= 30) return 'This Month';
        return 'Future';
    }

    /**
     * Compute CSS class for urgency badge.
     */
    private static String computeUrgencyClass(Integer daysUntil) {
        if (daysUntil < 0) return 'urgency-badge urgency-past';
        if (daysUntil == 0) return 'urgency-badge urgency-today';
        if (daysUntil <= 3) return 'urgency-badge urgency-immediate';
        if (daysUntil <= 7) return 'urgency-badge urgency-thisweek';
        if (daysUntil <= 30) return 'urgency-badge urgency-thismonth';
        return 'urgency-badge urgency-future';
    }

    /**
     * Generate human-readable contextual time text that ages naturally.
     * E.g., "tomorrow", "in 3 days", "in 2 weeks", "3 days ago"
     */
    private static String computeTimeContext(Integer daysUntil) {
        if (daysUntil == 0) return 'today';
        if (daysUntil == 1) return 'tomorrow';
        if (daysUntil == -1) return 'yesterday';

        if (daysUntil < -1) {
            Integer absDays = Math.abs(daysUntil);
            if (absDays < 7) return absDays + ' days ago';
            if (absDays < 14) return '1 week ago';
            if (absDays < 30) return (absDays / 7) + ' weeks ago';
            return (absDays / 30) + ' month' + (absDays / 30 > 1 ? 's' : '') + ' ago';
        }

        // Future
        if (daysUntil <= 6) return 'in ' + daysUntil + ' days';
        if (daysUntil == 7) return 'in 1 week';
        if (daysUntil <= 13) return 'in ' + daysUntil + ' days';
        if (daysUntil <= 20) return 'in 2 weeks';
        if (daysUntil <= 27) return 'in 3 weeks';
        if (daysUntil <= 45) return 'in about a month';
        if (daysUntil <= 75) return 'in about 2 months';
        return 'in ' + (daysUntil / 30) + ' months';
    }

    private static List<BrowseSnapshot> buildBrowseSnapshots(String customerId) {
        List<BrowseSnapshot> snapshots = new List<BrowseSnapshot>();
        try {
            for (Browse_Session__c r : [
                SELECT Session_Date__c, Categories_Browsed__c, Products_Viewed__c,
                       Duration_Minutes__c, Device__c
                FROM Browse_Session__c WHERE Customer_Id__c = :customerId
                ORDER BY Session_Date__c DESC LIMIT 5
            ]) {
                BrowseSnapshot s = new BrowseSnapshot();
                s.sessionDate = String.valueOf(r.Session_Date__c);
                s.categoriesBrowsed = r.Categories_Browsed__c != null
                    ? r.Categories_Browsed__c.split(';') : new List<String>();
                s.productsViewed = r.Products_Viewed__c != null
                    ? r.Products_Viewed__c.split(';') : new List<String>();
                s.durationMinutes = r.Duration_Minutes__c;
                s.device = r.Device__c;
                snapshots.add(s);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'ClientellingProfileService.buildBrowseSnapshots: ' + e.getMessage());
        }
        return snapshots;
    }

    private static LoyaltySnapshot buildLoyaltySnapshot(String customerId) {
        try {
            List<LoyaltyProgramMember> members = [
                SELECT Id, MembershipNumber, MemberStatus, EnrollmentDate
                FROM LoyaltyProgramMember
                WHERE ContactId = :customerId AND MemberStatus = 'Active'
                LIMIT 1
            ];
            if (members.isEmpty()) return null;

            LoyaltyProgramMember member = members[0];
            LoyaltySnapshot s = new LoyaltySnapshot();
            s.memberSince = String.valueOf(member.EnrollmentDate);

            // Fetch tier from LoyaltyMemberTier → LoyaltyTier
            // Query all tiers and pick the highest-ranked one (CreatedDate ordering
            // is unreliable when tiers are seeded at the same instant)
            String tierName = 'bronze';
            try {
                Map<String, Integer> tierRank = new Map<String, Integer>{
                    'bronze' => 1, 'silver' => 2, 'gold' => 3, 'platinum' => 4
                };
                List<LoyaltyMemberTier> memberTiers = [
                    SELECT LoyaltyTier.Name
                    FROM LoyaltyMemberTier
                    WHERE LoyaltyMemberId = :member.Id
                ];
                Integer bestRank = 0;
                for (LoyaltyMemberTier mt : memberTiers) {
                    String name = mt.LoyaltyTier?.Name?.toLowerCase();
                    if (name != null) {
                        name = name.replace(' tier', '');
                        Integer rank = tierRank.containsKey(name) ? tierRank.get(name) : 0;
                        if (rank > bestRank) {
                            bestRank = rank;
                            tierName = name;
                        }
                    }
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'buildLoyaltySnapshot tier lookup: ' + e.getMessage());
            }
            s.tier = tierName;

            // Fetch points from LoyaltyMemberCurrency
            // Sum across all currency records (e.g. "Points" + "Beauty Points")
            Decimal pointsBalance = 0;
            Decimal lifetimePoints = 0;
            try {
                List<LoyaltyMemberCurrency> currencies = [
                    SELECT PointsBalance, TotalPointsAccrued
                    FROM LoyaltyMemberCurrency
                    WHERE LoyaltyMemberId = :member.Id
                ];
                for (LoyaltyMemberCurrency c : currencies) {
                    Decimal bal = c.PointsBalance != null ? c.PointsBalance : 0;
                    Decimal acc = c.TotalPointsAccrued != null ? c.TotalPointsAccrued : 0;
                    if (bal > pointsBalance) pointsBalance = bal;
                    if (acc > lifetimePoints) lifetimePoints = acc;
                }
                if (lifetimePoints == 0 && pointsBalance > 0) lifetimePoints = pointsBalance;
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'buildLoyaltySnapshot points lookup: ' + e.getMessage());
            }
            s.pointsBalance = pointsBalance;
            s.lifetimePoints = lifetimePoints;

            // Demo fallback: Loyalty Management accrual engine hasn't processed
            // points for seeded contacts — use expected values for known demos.
            if (pointsBalance == 0) {
                try {
                    Contact c = [SELECT Email FROM Contact WHERE Id = :customerId LIMIT 1];
                    Map<String, Decimal[]> demoPoints = new Map<String, Decimal[]>{
                        'sarah.chen@example.com' => new Decimal[]{ 2450, 4800 },
                        'maya.thompson@example.com' => new Decimal[]{ 5200, 12400 },
                        'aisha.patel@example.com' => new Decimal[]{ 980, 1460 }
                    };
                    if (c.Email != null && demoPoints.containsKey(c.Email)) {
                        Decimal[] pts = demoPoints.get(c.Email);
                        s.pointsBalance = pts[0];
                        s.lifetimePoints = pts[1];
                    }
                } catch (Exception e) { /* best-effort */ }
            }

            return s;
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'ClientellingProfileService.buildLoyaltySnapshot: ' + e.getMessage());
        }
        return null;
    }

    private static List<CapturedField> buildCapturedFields(String customerId) {
        List<CapturedField> fields = new List<CapturedField>();
        try {
            for (Agent_Captured_Profile__c r : [
                SELECT Field_Name__c, Field_Value__c, Captured_At__c, Confidence__c
                FROM Agent_Captured_Profile__c WHERE Customer_Id__c = :customerId
            ]) {
                CapturedField f = new CapturedField();
                f.fieldName = r.Field_Name__c;
                f.value = r.Field_Value__c;
                f.capturedAt = String.valueOf(r.Captured_At__c);
                f.confidence = r.Confidence__c;
                fields.add(f);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'ClientellingProfileService.buildCapturedFields: ' + e.getMessage());
        }
        return fields;
    }

    private static List<AppointmentSnapshot> getUpcomingAppointments(Id contactId) {
        List<AppointmentSnapshot> appts = new List<AppointmentSnapshot>();
        try {
            for (Store_Appointment__c r : [
                SELECT Id, Appointment_DateTime__c, Type__c, Status__c,
                       Customer_Notes__c, Rep_Prep_Notes__c, Channel__c, Identity_Tier__c
                FROM Store_Appointment__c
                WHERE Contact__c = :contactId
                  AND Appointment_DateTime__c >= :Datetime.now()
                  AND Status__c NOT IN ('Completed', 'Cancelled', 'No-Show')
                ORDER BY Appointment_DateTime__c ASC
                LIMIT 5
            ]) {
                appts.add(mapAppointment(r));
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'ClientellingProfileService.getUpcomingAppointments: ' + e.getMessage());
        }
        return appts;
    }

    private static AppointmentSnapshot getTodaysAppointment(Id contactId) {
        try {
            Date today = Date.today();
            List<Store_Appointment__c> records = [
                SELECT Id, Appointment_DateTime__c, Type__c, Status__c,
                       Customer_Notes__c, Rep_Prep_Notes__c, Channel__c, Identity_Tier__c
                FROM Store_Appointment__c
                WHERE Contact__c = :contactId
                  AND Appointment_DateTime__c >= :Datetime.newInstance(today, Time.newInstance(0, 0, 0, 0))
                  AND Appointment_DateTime__c < :Datetime.newInstance(today.addDays(1), Time.newInstance(0, 0, 0, 0))
                ORDER BY Appointment_DateTime__c ASC
                LIMIT 1
            ];
            if (!records.isEmpty()) {
                return mapAppointment(records[0]);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'ClientellingProfileService.getTodaysAppointment: ' + e.getMessage());
        }
        return null;
    }

    private static List<Map<String, Object>> getRecentConsultationNotes(String customerId) {
        List<Map<String, Object>> notes = new List<Map<String, Object>>();
        try {
            for (Consultation_Note__c r : [
                SELECT Note_Type__c, Note_Text__c, Captured_At__c, Products_Referenced__c
                FROM Consultation_Note__c
                WHERE Contact__c = :customerId
                ORDER BY Captured_At__c DESC
                LIMIT 10
            ]) {
                Map<String, Object> m = new Map<String, Object>();
                m.put('noteType', r.Note_Type__c);
                m.put('noteText', r.Note_Text__c);
                m.put('capturedAt', String.valueOf(r.Captured_At__c));
                m.put('productsReferenced', r.Products_Referenced__c);
                notes.add(m);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'ClientellingProfileService.getRecentConsultationNotes: ' + e.getMessage());
        }
        return notes;
    }

    private static AppointmentSnapshot mapAppointment(Store_Appointment__c r) {
        AppointmentSnapshot a = new AppointmentSnapshot();
        a.appointmentId = r.Id;
        a.appointmentDateTime = String.valueOf(r.Appointment_DateTime__c);
        a.type_x = r.Type__c;
        a.status = r.Status__c;
        a.customerNotes = r.Customer_Notes__c;
        a.repPrepNotes = r.Rep_Prep_Notes__c;
        a.channel = r.Channel__c;
        a.identityTier = r.Identity_Tier__c;
        return a;
    }
}
