/**
 * ProductCatalogService - Invocable Apex for Agentforce product queries.
 * Called by Agentforce topics to search and retrieve product data
 * from Commerce Cloud via Connect API or direct SOQL.
 */
global with sharing class ProductCatalogService {

    public class ProductSearchRequest {
        @InvocableVariable(required=false)
        public String query;

        @InvocableVariable(required=false)
        public String category;

        @InvocableVariable(required=false)
        public String skinType;

        @InvocableVariable(required=false)
        public String concerns;

        @InvocableVariable(required=false)
        public Integer maxResults;
    }

    public class ProductResult {
        @InvocableVariable
        public String productId;

        @InvocableVariable
        public String name;

        @InvocableVariable
        public String brand;

        @InvocableVariable
        public String category;

        @InvocableVariable
        public Decimal price;

        @InvocableVariable
        public String description;

        @InvocableVariable
        public String imageUrl;

        @InvocableVariable
        public String skinTypes;

        @InvocableVariable
        public String concerns;

        @InvocableVariable
        public Decimal rating;

        @InvocableVariable
        public Boolean isTravel;

        @InvocableVariable
        public Boolean inStock;
    }

    @InvocableMethod(label='Search Product Catalog' description='Searches the product catalog based on criteria and returns JSON')
    public static List<String> searchProducts(List<ProductSearchRequest> requests) {
        List<String> allResults = new List<String>();

        for (ProductSearchRequest request : requests) {
            List<ProductResult> results = executeSearch(request);
            allResults.add(JSON.serialize(results));
        }

        return allResults;
    }

    private static List<ProductResult> executeSearch(ProductSearchRequest request) {
        String soql = 'SELECT Id, Name, Brand__c, Category__c, Price__c, Description__c, ' +
                       'Image_URL__c, Skin_Types__c, Concerns__c, Rating__c, Is_Travel__c, In_Stock__c ' +
                       'FROM Product2 WHERE IsActive = true AND Category__c != null';

        List<String> conditions = new List<String>();

        // Normalize category to proper case (Salesforce picklist values are case-sensitive)
        String category = request.category;
        if (String.isNotBlank(category)) {
            // Convert to Title Case to match picklist values like 'Lipstick', 'Moisturizer', etc.
            category = category.toLowerCase();
            category = category.substring(0, 1).toUpperCase() + category.substring(1);
            // Handle special cases
            if (category == 'Eye care') category = 'Eye Care';
            if (category == 'Spot treatment') category = 'Spot Treatment';
            conditions.add('Category__c = :category');
        }
        if (String.isNotBlank(request.skinType)) {
            conditions.add('Skin_Types__c INCLUDES (:skinType)');
        }
        if (String.isNotBlank(request.query)) {
            conditions.add('(Name LIKE :searchQuery)');
        }

        if (!conditions.isEmpty()) {
            soql += ' AND ' + String.join(conditions, ' AND ');
        }

        Integer maxResults = request.maxResults != null ? request.maxResults : 10;
        soql += ' ORDER BY Rating__c DESC LIMIT ' + maxResults;

        // category is already declared and normalized above
        String skinType = request.skinType;
        String searchQuery = request.query != null ? '%' + request.query + '%' : '';

        List<Product2> products = Database.query(soql);
        List<ProductResult> results = new List<ProductResult>();

        for (Product2 product : products) {
            ProductResult result = new ProductResult();
            result.productId = product.Id;
            result.name = product.Name;
            result.brand = (String) product.get('Brand__c');
            result.category = (String) product.get('Category__c');
            result.price = (Decimal) product.get('Price__c');
            result.description = (String) product.get('Description__c');
            result.imageUrl = (String) product.get('Image_URL__c');
            result.skinTypes = (String) product.get('Skin_Types__c');
            result.concerns = (String) product.get('Concerns__c');
            result.rating = (Decimal) product.get('Rating__c');
            result.isTravel = (Boolean) product.get('Is_Travel__c');
            result.inStock = (Boolean) product.get('In_Stock__c');
            results.add(result);
        }

        return results;
    }
}
