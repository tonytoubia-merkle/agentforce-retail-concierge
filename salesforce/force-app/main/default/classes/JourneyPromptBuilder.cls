/**
 * JourneyPromptBuilder - Builds enriched Firefly prompts with personalized product recommendations.
 *
 * Fetches product recommendations from Contact_Product_Affinity__c records and constructs
 * scene-appropriate prompts that include:
 * 1. Event context (travel, wedding, birthday, etc.)
 * 2. Recommended product names
 * 3. Product image URLs (for Firefly reference image feature)
 *
 * For POC: Uses Contact_Product_Affinity__c records
 * Future: Will integrate with SF Personalization Recommenders API
 */
public with sharing class JourneyPromptBuilder {

    // Base URL for product images (from app deployment)
    private static final String APP_BASE_URL = 'https://agentforce-retail-advisor.vercel.app'; // TODO: Configure via Custom Setting

    // ─── Public Methods ────────────────────────────────────────────────

    /**
     * Build an enriched prompt for a Journey Approval with product recommendations.
     *
     * @param contactId The contact to get recommendations for
     * @param eventContext Brief description of the event (e.g., "Paris trip in 2 weeks")
     * @param eventType Type of event (travel, birthday, wedding, life-event)
     * @return PromptResult containing the enriched prompt and product JSON
     */
    public static PromptResult buildEnrichedPrompt(Id contactId, String eventContext, String eventType) {
        PromptResult result = new PromptResult();

        // Get recommended products for this contact
        List<ProductRecommendation> recommendations = getRecommendations(contactId, 3);

        if (recommendations.isEmpty()) {
            // Fallback to default products based on event type
            recommendations = getDefaultRecommendations(eventType);
        }

        // Store recommendations as JSON for LWC display
        result.recommendedProductsJson = JSON.serialize(recommendations);

        // Build the prompt text
        result.prompt = buildPromptText(eventContext, eventType, recommendations);

        // Extract reference image URLs for Firefly
        result.referenceImageUrls = new List<String>();
        for (ProductRecommendation rec : recommendations) {
            if (String.isNotBlank(rec.imageUrl)) {
                result.referenceImageUrls.add(rec.imageUrl);
            }
        }

        return result;
    }

    /**
     * Get product recommendations for a contact from Contact_Product_Affinity__c.
     * Orders by affinity score (highest first) and recency.
     */
    public static List<ProductRecommendation> getRecommendations(Id contactId, Integer maxCount) {
        List<ProductRecommendation> recommendations = new List<ProductRecommendation>();

        if (contactId == null) {
            return recommendations;
        }

        try {
            List<Contact_Product_Affinity__c> affinities = [
                SELECT Product_Name__c, Product_Code__c, Product_Image_URL__c,
                       Affinity_Type__c, Affinity_Score__c
                FROM Contact_Product_Affinity__c
                WHERE Contact__c = :contactId
                ORDER BY Affinity_Score__c DESC, Last_Interaction__c DESC
                LIMIT :maxCount
            ];

            for (Contact_Product_Affinity__c affinity : affinities) {
                ProductRecommendation rec = new ProductRecommendation();
                rec.name = affinity.Product_Name__c;
                rec.productCode = affinity.Product_Code__c;
                rec.imageUrl = affinity.Product_Image_URL__c;
                rec.affinityType = affinity.Affinity_Type__c;
                rec.score = affinity.Affinity_Score__c;
                recommendations.add(rec);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Failed to get recommendations: ' + e.getMessage());
        }

        return recommendations;
    }

    // ─── Prompt Building ───────────────────────────────────────────────

    /**
     * Build the prompt text with products incorporated into the scene.
     */
    private static String buildPromptText(String eventContext, String eventType, List<ProductRecommendation> products) {
        // Get scene template based on event type
        String sceneTemplate = getSceneTemplate(eventType, eventContext);

        // Build product list for prompt
        List<String> productNames = new List<String>();
        for (ProductRecommendation p : products) {
            productNames.add(p.name);
        }
        String productsPhrase = String.join(productNames, ', ');

        // Replace placeholder in template
        String prompt = sceneTemplate.replace('{products}', productsPhrase);
        prompt = prompt.replace('{context}', eventContext);

        return prompt;
    }

    /**
     * Get scene template based on event type.
     * Templates include {products} and {context} placeholders.
     */
    private static String getSceneTemplate(String eventType, String eventContext) {
        String contextLower = eventContext != null ? eventContext.toLowerCase() : '';

        // Check for specific destinations/themes in context
        if (contextLower.contains('paris') || contextLower.contains('france')) {
            return 'Elegant open travel bag on luxury Parisian hotel bed, {products} artfully arranged inside, ' +
                   'Eiffel Tower visible through sheer curtains, soft morning light, croissant on nightstand, ' +
                   'premium lifestyle photography, rose gold accents';
        }

        if (contextLower.contains('beach') || contextLower.contains('tropical') || contextLower.contains('hawaii')) {
            return 'Beach vacation scene, {products} arranged on white linen beside straw hat and sunglasses, ' +
                   'turquoise ocean visible through open villa doors, tropical flowers, golden hour lighting';
        }

        if (contextLower.contains('ski') || contextLower.contains('mountain') || contextLower.contains('winter')) {
            return 'Cozy mountain chalet scene, {products} on wooden vanity near frosted window, ' +
                   'snow-capped peaks visible outside, warm firelight glow, cashmere throw, luxury après-ski atmosphere';
        }

        // Event type templates
        Map<String, String> templates = new Map<String, String>{
            'travel' => 'Elegant open suitcase on luxury hotel bed, {products} beautifully arranged inside, ' +
                        'destination cityscape through window, soft natural light, jet-set lifestyle photography',

            'birthday' => 'Beautiful birthday gift arrangement, {products} wrapped with silk ribbons, ' +
                          'elegant gift boxes, rose petals scattered, soft bokeh lights, celebration atmosphere',

            'wedding' => 'Bridal preparation vanity scene, {products} arranged on white marble surface, ' +
                         'soft romantic lighting, white roses and champagne, luxury bridal suite atmosphere',

            'baby' => 'Gentle nursery setting, {products} arranged on soft white blanket, ' +
                      'pastel colors, soft diffused light, peaceful nurturing atmosphere',

            'anniversary' => 'Romantic celebration scene, {products} beside champagne flutes, ' +
                             'rose petals, candlelight, elegant marble surface, intimate atmosphere',

            'life-event' => 'Lifestyle flat-lay arrangement, {products} beautifully styled, ' +
                            'clean minimalist background, natural lighting, premium product photography'
        };

        String template = templates.get(eventType);
        if (template == null) {
            template = templates.get('life-event');
        }

        return template;
    }

    // ─── Default Recommendations ───────────────────────────────────────

    /**
     * Get default product recommendations based on event type when no affinity data exists.
     * These are hardcoded for POC - in production, would call SF Personalization API.
     */
    private static List<ProductRecommendation> getDefaultRecommendations(String eventType) {
        List<ProductRecommendation> defaults = new List<ProductRecommendation>();

        String eventLower = eventType != null ? eventType.toLowerCase() : '';

        if (eventLower.contains('travel')) {
            defaults.add(createRecommendation('Invisible Shield SPF 50', 'sunscreen-lightweight', '/assets/products/sunscreen-lightweight.png'));
            defaults.add(createRecommendation('Cooling Facial Mist', 'mist-refreshing', '/assets/products/mist-refreshing.png'));
            defaults.add(createRecommendation('Hydra-Calm Sensitive Moisturizer', 'moisturizer-sensitive', '/assets/products/moisturizer-sensitive.png'));
        } else if (eventLower.contains('wedding') || eventLower.contains('bridal')) {
            defaults.add(createRecommendation('Radiance Renewal Serum', 'serum-vitamin-c', '/assets/products/serum-vitamin-c.png'));
            defaults.add(createRecommendation('Deep Dew Hydrating Mask', 'mask-hydrating', '/assets/products/mask-hydrating.png'));
            defaults.add(createRecommendation('Velvet Matte Lipstick', 'lipstick-velvet', '/assets/products/lipstick-velvet.png'));
        } else if (eventLower.contains('birthday')) {
            defaults.add(createRecommendation('Peptide Lift Pro Serum', 'serum-anti-aging', '/assets/products/serum-anti-aging.png'));
            defaults.add(createRecommendation('Eye Revival Cream', 'eye-cream', '/assets/products/eye-cream.png'));
            defaults.add(createRecommendation('Hydra-Calm Sensitive Moisturizer', 'moisturizer-sensitive', '/assets/products/moisturizer-sensitive.png'));
        } else {
            // Generic luxury selection
            defaults.add(createRecommendation('Hydra-Calm Sensitive Moisturizer', 'moisturizer-sensitive', '/assets/products/moisturizer-sensitive.png'));
            defaults.add(createRecommendation('Radiance Renewal Serum', 'serum-vitamin-c', '/assets/products/serum-vitamin-c.png'));
            defaults.add(createRecommendation('Cloud Cream Cleanser', 'cleanser-gentle', '/assets/products/cleanser-gentle.png'));
        }

        return defaults;
    }

    private static ProductRecommendation createRecommendation(String name, String code, String imagePath) {
        ProductRecommendation rec = new ProductRecommendation();
        rec.name = name;
        rec.productCode = code;
        rec.imageUrl = APP_BASE_URL + imagePath;
        rec.affinityType = 'Recommended';
        rec.score = 50; // Default score
        return rec;
    }

    // ─── Rebuild Prompt from Custom Products ─────────────────────────

    /**
     * Rebuild prompt with a custom list of products (for marketer edits).
     * Called when marketer changes product selection in the approval card.
     *
     * @param productsJson JSON array of products from LWC
     * @param eventContext Brief description of the event
     * @param eventType Type of event (travel, birthday, wedding, etc.)
     * @return PromptResult with new prompt text
     */
    public static PromptResult rebuildPromptWithProducts(String productsJson, String eventContext, String eventType) {
        PromptResult result = new PromptResult();

        List<ProductRecommendation> products = new List<ProductRecommendation>();

        if (String.isNotBlank(productsJson)) {
            try {
                List<Object> parsed = (List<Object>) JSON.deserializeUntyped(productsJson);
                for (Object obj : parsed) {
                    Map<String, Object> prodMap = (Map<String, Object>) obj;
                    ProductRecommendation rec = new ProductRecommendation();
                    rec.name = (String) prodMap.get('name');
                    rec.productCode = (String) prodMap.get('productCode');
                    rec.imageUrl = (String) prodMap.get('imageUrl');
                    rec.affinityType = 'Selected';
                    rec.score = 100;
                    products.add(rec);
                }
            } catch (Exception e) {
                System.debug(LoggingLevel.WARN, 'Failed to parse products JSON: ' + e.getMessage());
            }
        }

        // If no products parsed, use defaults
        if (products.isEmpty()) {
            products = getDefaultRecommendations(eventType);
        }

        // Store as JSON
        result.recommendedProductsJson = productsJson;

        // Build prompt with new products
        result.prompt = buildPromptText(eventContext, eventType, products);

        // Extract reference image URLs
        result.referenceImageUrls = new List<String>();
        for (ProductRecommendation rec : products) {
            if (String.isNotBlank(rec.imageUrl)) {
                result.referenceImageUrls.add(rec.imageUrl);
            }
        }

        return result;
    }

    // ─── Step-Aware Prompt Templates ───────────────────────────────────

    /**
     * Pre-built prompt templates keyed by eventType and step position.
     * Eliminates dynamic prompt building at generation time.
     * Each template includes {products} placeholder for product names.
     *
     * Step positions: 'first', 'middle', 'last', 'single'
     */
    private static Map<String, Map<String, String>> stepTemplatesCache;

    private static Map<String, Map<String, String>> getStepTemplates() {
        if (stepTemplatesCache != null) return stepTemplatesCache;

        stepTemplatesCache = new Map<String, Map<String, String>>();

        // Travel templates
        stepTemplatesCache.put('travel', new Map<String, String>{
            'first' => 'Elegant open suitcase on luxury hotel bed, {products} beautifully arranged inside, '
                     + 'destination cityscape through window, soft natural light, jet-set lifestyle photography, '
                     + 'rose gold accents, premium editorial composition',
            'middle' => 'Travel-ready beauty flat lay, {products} arranged on white marble vanity, '
                      + 'designer travel case, passport and sunglasses, bright natural lighting, '
                      + 'wanderlust aesthetic, clean editorial photography',
            'last' => 'Final packing scene, {products} nestled in designer travel pouch, '
                    + 'boarding pass visible, golden hour through hotel window, '
                    + 'luxury travel lifestyle, warm cinematic lighting',
            'single' => 'Elegant open suitcase on luxury hotel bed, {products} beautifully arranged inside, '
                      + 'destination cityscape through window, soft natural light, jet-set lifestyle photography'
        });

        // Wedding templates
        stepTemplatesCache.put('wedding', new Map<String, String>{
            'first' => 'Bridal preparation vanity scene, {products} arranged on white marble surface, '
                     + 'soft romantic lighting, white roses and champagne, luxury bridal suite atmosphere, '
                     + 'silk ribbon accents, editorial wedding photography',
            'middle' => 'Wedding countdown beauty moment, {products} on elegant mirrored tray, '
                      + 'soft-focus floral backdrop, warm candlelight, romantic atmosphere, '
                      + 'delicate lace details, editorial bridal beauty',
            'last' => 'Morning-of bridal scene, {products} on vanity beside wedding veil, '
                    + 'soft morning light streaming through sheer curtains, white roses, '
                    + 'champagne flute, intimate celebration atmosphere',
            'single' => 'Bridal preparation vanity scene, {products} arranged on white marble surface, '
                      + 'soft romantic lighting, white roses and champagne, luxury bridal suite atmosphere'
        });

        // Birthday templates
        stepTemplatesCache.put('birthday', new Map<String, String>{
            'first' => 'Beautiful birthday gift arrangement, {products} wrapped with silk ribbons, '
                     + 'elegant gift boxes, rose petals scattered, soft bokeh lights, '
                     + 'celebration atmosphere, premium product photography',
            'middle' => 'Birthday beauty prep scene, {products} on stylish vanity, '
                      + 'birthday card visible, gold confetti details, soft warm lighting, '
                      + 'getting-ready atmosphere, editorial beauty photography',
            'last' => 'Birthday morning glow scene, {products} beside birthday flowers, '
                    + 'morning sunlight, soft pink and gold palette, '
                    + 'celebration-ready atmosphere, joyful editorial photography',
            'single' => 'Beautiful birthday gift arrangement, {products} wrapped with silk ribbons, '
                      + 'elegant gift boxes, rose petals scattered, soft bokeh lights, celebration atmosphere'
        });

        // Anniversary templates
        stepTemplatesCache.put('anniversary', new Map<String, String>{
            'first' => 'Romantic celebration scene, {products} beside champagne flutes, '
                     + 'rose petals, candlelight, elegant marble surface, '
                     + 'intimate atmosphere, premium editorial photography',
            'middle' => 'Anniversary beauty ritual, {products} on elegant tray, '
                      + 'soft candlelight, red roses in background, silk fabric, '
                      + 'warm intimate setting, luxury editorial',
            'last' => 'Anniversary evening preparation, {products} on vanity beside jewelry, '
                    + 'golden hour light, champagne, elegant dressing table, '
                    + 'romantic getting-ready moment',
            'single' => 'Romantic celebration scene, {products} beside champagne flutes, '
                      + 'rose petals, candlelight, elegant marble surface, intimate atmosphere'
        });

        // Baby/pregnancy templates
        stepTemplatesCache.put('baby', new Map<String, String>{
            'first' => 'Gentle nursery setting, {products} arranged on soft white blanket, '
                     + 'pastel colors, soft diffused light, peaceful nurturing atmosphere, '
                     + 'cotton details, tender motherhood moment',
            'middle' => 'Self-care moment for new parents, {products} on bathroom shelf, '
                      + 'soft towels, peaceful morning light, calming neutral tones, '
                      + 'gentle wellness atmosphere',
            'last' => 'Nurturing skincare ritual, {products} beside warm cup of tea, '
                    + 'soft blanket, serene morning light, gentle self-care moment',
            'single' => 'Gentle nursery setting, {products} arranged on soft white blanket, '
                      + 'pastel colors, soft diffused light, peaceful nurturing atmosphere'
        });

        // Default life-event templates
        stepTemplatesCache.put('life-event', new Map<String, String>{
            'first' => 'Lifestyle flat-lay arrangement, {products} beautifully styled, '
                     + 'clean minimalist background, natural lighting, '
                     + 'premium product photography, rose gold accents',
            'middle' => 'Modern beauty shelfie scene, {products} on elegant shelf, '
                      + 'soft natural light, minimalist decor, curated lifestyle, '
                      + 'aspirational editorial photography',
            'last' => 'Special moment preparation, {products} artfully arranged, '
                    + 'warm golden lighting, sophisticated atmosphere, '
                    + 'editorial beauty photography, clean composition',
            'single' => 'Lifestyle flat-lay arrangement, {products} beautifully styled, '
                      + 'clean minimalist background, natural lighting, premium product photography'
        });

        return stepTemplatesCache;
    }

    /**
     * Get a pre-built prompt for a specific journey step.
     * Uses static templates keyed by event type + step position for consistency and speed.
     *
     * @param eventType Event type (travel, wedding, birthday, etc.)
     * @param eventContext Brief event description for destination-specific overrides
     * @param stepNumber Current step number (1-based)
     * @param totalSteps Total steps in journey
     * @param productNames List of product names to inject
     * @return Ready-to-use prompt string
     */
    public static String getStepPrompt(String eventType, String eventContext, Integer stepNumber, Integer totalSteps, List<String> productNames) {
        // Determine step position
        String position;
        if (totalSteps == null || totalSteps <= 1) {
            position = 'single';
        } else if (stepNumber == 1) {
            position = 'first';
        } else if (stepNumber == totalSteps) {
            position = 'last';
        } else {
            position = 'middle';
        }

        // Check for destination-specific override first
        String contextLower = eventContext != null ? eventContext.toLowerCase() : '';
        String template = getDestinationOverride(contextLower, position);

        // Fall back to event type template
        if (template == null) {
            String eventKey = normalizeEventType(eventType);
            // If eventType normalizes to generic 'life-event', also check the description
            // for contextual keywords (e.g., "traveling to Dubai" → 'travel')
            if (eventKey == 'life-event' && String.isNotBlank(contextLower)) {
                String contextKey = normalizeEventType(contextLower);
                if (contextKey != 'life-event') {
                    eventKey = contextKey;
                }
            }
            Map<String, String> typeTemplates = getStepTemplates().get(eventKey);
            if (typeTemplates == null) {
                typeTemplates = getStepTemplates().get('life-event');
            }
            template = typeTemplates.get(position);
            if (template == null) {
                template = typeTemplates.get('single');
            }
        }

        // Inject product names
        String productsPhrase = productNames != null && !productNames.isEmpty()
            ? String.join(productNames, ', ')
            : 'luxury beauty products';

        return template.replace('{products}', productsPhrase);
    }

    /**
     * Destination-specific prompt overrides (Paris, beach, mountain, etc.)
     */
    private static String getDestinationOverride(String contextLower, String position) {
        if (contextLower.contains('paris') || contextLower.contains('france')) {
            if (position == 'first' || position == 'single') {
                return 'Elegant open travel bag on luxury Parisian hotel bed, {products} artfully arranged inside, '
                     + 'Eiffel Tower visible through sheer curtains, soft morning light, croissant on nightstand, '
                     + 'premium lifestyle photography, rose gold accents';
            }
            return 'Parisian beauty moment, {products} on marble vanity, '
                 + 'warm Parisian light through tall windows, macarons and espresso, '
                 + 'luxury French apartment atmosphere, editorial photography';
        }

        if (contextLower.contains('beach') || contextLower.contains('tropical') || contextLower.contains('hawaii')) {
            if (position == 'first' || position == 'single') {
                return 'Beach vacation scene, {products} arranged on white linen beside straw hat and sunglasses, '
                     + 'turquoise ocean visible through open villa doors, tropical flowers, golden hour lighting';
            }
            return 'Tropical beauty essentials, {products} on rattan tray, '
                 + 'palm shadows, ocean breeze atmosphere, natural light, '
                 + 'resort lifestyle photography';
        }

        if (contextLower.contains('ski') || contextLower.contains('mountain') || contextLower.contains('winter')) {
            if (position == 'first' || position == 'single') {
                return 'Cozy mountain chalet scene, {products} on wooden vanity near frosted window, '
                     + 'snow-capped peaks visible outside, warm firelight glow, cashmere throw, luxury après-ski atmosphere';
            }
            return 'Après-ski beauty scene, {products} beside hot cocoa, '
                 + 'warm knit textures, frosted window, cozy mountain lodge, '
                 + 'warm candlelight atmosphere';
        }

        return null;
    }

    /**
     * Normalize event type strings for template lookup.
     */
    private static String normalizeEventType(String eventType) {
        if (String.isBlank(eventType)) return 'life-event';
        String lower = eventType.toLowerCase();
        if (lower.contains('travel') || lower.contains('trip') || lower.contains('vacation')) return 'travel';
        if (lower.contains('wedding') || lower.contains('bridal')) return 'wedding';
        if (lower.contains('birthday')) return 'birthday';
        if (lower.contains('anniversary')) return 'anniversary';
        if (lower.contains('baby') || lower.contains('pregnant')) return 'baby';
        return 'life-event';
    }

    // ─── Data Classes ──────────────────────────────────────────────────

    public class PromptResult {
        public String prompt;
        public String recommendedProductsJson;
        public List<String> referenceImageUrls;
    }

    public class ProductRecommendation {
        public String name;
        public String productCode;
        public String imageUrl;
        public String affinityType;
        public Decimal score;
    }
}
