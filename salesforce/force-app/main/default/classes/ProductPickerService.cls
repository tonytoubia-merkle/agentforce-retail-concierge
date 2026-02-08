/**
 * ProductPickerService - Provides product catalog data for the Journey Approval product picker.
 *
 * Returns product data matching the app's mock products for marketer selection.
 * Products are organized by category with search and filter capabilities.
 */
public with sharing class ProductPickerService {

    // Base URL for product images (configure via Custom Setting in production)
    private static final String APP_BASE_URL = 'https://lumiere-beauty.demo.com';

    // ─── Product Data Classes ──────────────────────────────────────────

    public class ProductItem {
        @AuraEnabled public String productCode { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String brand { get; set; }
        @AuraEnabled public String category { get; set; }
        @AuraEnabled public Decimal price { get; set; }
        @AuraEnabled public String imageUrl { get; set; }
        @AuraEnabled public String shortDescription { get; set; }
        @AuraEnabled public List<String> tags { get; set; }
        @AuraEnabled public Boolean isTravel { get; set; }
        @AuraEnabled public Boolean isSelected { get; set; }
    }

    public class CategoryGroup {
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public List<ProductItem> products { get; set; }
    }

    // ─── AuraEnabled Methods for LWC ───────────────────────────────────

    /**
     * Get all products organized by category for the picker.
     */
    @AuraEnabled(cacheable=true)
    public static List<CategoryGroup> getProductsByCategory() {
        Map<String, CategoryGroup> categoryMap = new Map<String, CategoryGroup>();

        for (ProductItem product : getAllProducts()) {
            String catKey = product.category.toLowerCase().replace(' ', '-');

            if (!categoryMap.containsKey(catKey)) {
                CategoryGroup catGroup = new CategoryGroup();
                catGroup.name = catKey;
                catGroup.label = product.category;
                catGroup.products = new List<ProductItem>();
                categoryMap.put(catKey, catGroup);
            }

            categoryMap.get(catKey).products.add(product);
        }

        return categoryMap.values();
    }

    /**
     * Search products by query string.
     */
    @AuraEnabled
    public static List<ProductItem> searchProducts(String query) {
        List<ProductItem> results = new List<ProductItem>();
        String queryLower = query.toLowerCase();

        for (ProductItem product : getAllProducts()) {
            if (product.name.toLowerCase().contains(queryLower) ||
                product.brand.toLowerCase().contains(queryLower) ||
                product.shortDescription.toLowerCase().contains(queryLower) ||
                hasMatchingTag(product.tags, queryLower)) {
                results.add(product);
            }
        }

        return results;
    }

    /**
     * Filter products by tags (e.g., 'sensitive', 'travel', 'anti-aging').
     */
    @AuraEnabled
    public static List<ProductItem> filterByTags(List<String> tags) {
        List<ProductItem> results = new List<ProductItem>();

        for (ProductItem product : getAllProducts()) {
            if (hasAnyTag(product.tags, tags) || (tags.contains('travel') && product.isTravel)) {
                results.add(product);
            }
        }

        return results;
    }

    /**
     * Get a flat list of all products.
     */
    @AuraEnabled(cacheable=true)
    public static List<ProductItem> getAllProducts() {
        return getProductCatalog();
    }

    /**
     * Get available filter tags.
     */
    @AuraEnabled(cacheable=true)
    public static List<String> getAvailableTags() {
        return new List<String>{
            'sensitive',
            'anti-aging',
            'hydrating',
            'travel',
            'brightening',
            'acne',
            'oil-control',
            'luxury'
        };
    }

    // ─── Helper Methods ────────────────────────────────────────────────

    private static Boolean hasMatchingTag(List<String> tags, String query) {
        if (tags == null) return false;
        for (String tag : tags) {
            if (tag.toLowerCase().contains(query)) return true;
        }
        return false;
    }

    private static Boolean hasAnyTag(List<String> productTags, List<String> filterTags) {
        if (productTags == null) return false;
        for (String productTag : productTags) {
            for (String filterTag : filterTags) {
                if (productTag.toLowerCase() == filterTag.toLowerCase()) return true;
            }
        }
        return false;
    }

    // ─── Product Catalog Data ──────────────────────────────────────────

    /**
     * Returns the full product catalog matching the app's mock products.
     * In production, this would query Product2 or an external API.
     */
    private static List<ProductItem> getProductCatalog() {
        List<ProductItem> products = new List<ProductItem>();

        // SERENE (Skincare)
        products.add(createProduct('moisturizer-sensitive', 'Hydra-Calm Sensitive Moisturizer', 'SERENE', 'Moisturizer', 58.00, 'Gentle hydration for sensitive skin', new List<String>{'sensitive', 'hydrating'}, false));
        products.add(createProduct('sunscreen-lightweight', 'Invisible Shield SPF 50', 'SERENE', 'Sunscreen', 42.00, 'Weightless daily SPF protection', new List<String>{'travel', 'sensitive'}, true));
        products.add(createProduct('mist-refreshing', 'Cooling Facial Mist', 'SERENE', 'Toner', 28.00, 'Instant refresh and hydration', new List<String>{'hydrating', 'travel'}, true));
        products.add(createProduct('blotting-sheets', 'Oil Control Blotting Papers', 'SERENE', 'Accessories', 12.00, 'Instant oil control on-the-go', new List<String>{'oil-control', 'travel'}, true));
        products.add(createProduct('cleanser-gentle', 'Cloud Cream Cleanser', 'SERENE', 'Cleanser', 36.00, 'Gentle cream cleanser for all skin types', new List<String>{'sensitive', 'hydrating'}, false));
        products.add(createProduct('mask-hydrating', 'Deep Dew Hydrating Mask', 'SERENE', 'Mask', 45.00, 'Overnight hydration sleeping mask', new List<String>{'hydrating', 'luxury'}, false));
        products.add(createProduct('toner-aha', 'Glow Tonic AHA Toner', 'SERENE', 'Toner', 34.00, 'Exfoliating toner for radiant skin', new List<String>{'brightening', 'acne'}, false));

        // LUMIÈRE (Premium Anti-Aging)
        products.add(createProduct('serum-vitamin-c', 'Radiance Renewal Serum', 'LUMIÈRE', 'Serum', 89.00, '20% Vitamin C brightening serum', new List<String>{'brightening', 'anti-aging', 'luxury'}, false));
        products.add(createProduct('serum-peptide', 'Peptide Lift Pro Serum', 'LUMIÈRE', 'Serum', 125.00, 'Advanced peptide anti-aging complex', new List<String>{'anti-aging', 'luxury'}, false));
        products.add(createProduct('eye-cream', 'Eye Revival Cream', 'LUMIÈRE', 'Eye Care', 68.00, 'Depuffing and dark circle treatment', new List<String>{'anti-aging', 'hydrating'}, false));
        products.add(createProduct('retinol-night', 'Retinol Night Repair', 'LUMIÈRE', 'Treatment', 95.00, 'Overnight retinol renewal treatment', new List<String>{'anti-aging', 'luxury'}, false));
        products.add(createProduct('collagen-cream', 'Collagen Boost Cream', 'LUMIÈRE', 'Moisturizer', 110.00, 'Firming collagen-infused moisturizer', new List<String>{'anti-aging', 'luxury', 'hydrating'}, false));

        // AURA (Color Cosmetics)
        products.add(createProduct('lipstick-velvet', 'Velvet Matte Lipstick', 'AURA', 'Lipstick', 32.00, 'Long-wearing matte lipstick', new List<String>{'luxury'}, false));
        products.add(createProduct('lip-gloss', 'Crystal Shine Lip Gloss', 'AURA', 'Lipstick', 24.00, 'High-shine hydrating gloss', new List<String>{'hydrating'}, false));
        products.add(createProduct('foundation-dewy', 'Skin Glow Foundation', 'AURA', 'Foundation', 48.00, 'Dewy finish buildable coverage', new List<String>{'hydrating'}, false));
        products.add(createProduct('concealer', 'Brightening Concealer', 'AURA', 'Concealer', 28.00, 'Full coverage brightening concealer', new List<String>{'brightening'}, false));
        products.add(createProduct('blush-cream', 'Cream Blush Duo', 'AURA', 'Blush', 34.00, 'Natural flush cream blush', new List<String>{}, false));
        products.add(createProduct('mascara-volume', 'Volume Boost Mascara', 'AURA', 'Mascara', 26.00, 'Volumizing lengthening mascara', new List<String>{}, false));

        // PURE (Clean Beauty)
        products.add(createProduct('oil-face', 'Botanical Face Oil', 'PURE', 'Treatment', 52.00, 'Nourishing organic face oil', new List<String>{'hydrating', 'sensitive'}, false));
        products.add(createProduct('balm-lip', 'Honey Lip Balm', 'PURE', 'Lip Care', 16.00, 'Organic honey lip treatment', new List<String>{'hydrating', 'travel'}, true));
        products.add(createProduct('body-lotion', 'Shea Body Lotion', 'PURE', 'Body', 38.00, 'Rich shea butter body cream', new List<String>{'hydrating'}, false));

        return products;
    }

    private static ProductItem createProduct(String code, String name, String brand, String category, Decimal price, String description, List<String> tags, Boolean isTravel) {
        ProductItem p = new ProductItem();
        p.productCode = code;
        p.name = name;
        p.brand = brand;
        p.category = category;
        p.price = price;
        p.imageUrl = APP_BASE_URL + '/assets/products/' + code + '.png';
        p.shortDescription = description;
        p.tags = tags;
        p.isTravel = isTravel;
        p.isSelected = false;
        return p;
    }
}
