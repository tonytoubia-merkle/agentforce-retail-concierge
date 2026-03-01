/**
 * FireflyApexService - Server-side Adobe Firefly image generation.
 *
 * Handles OAuth token acquisition and image generation for personalized
 * journey content. Images are generated during nightly batch processing
 * and stored in Salesforce Files for use in Marketing Cloud emails.
 *
 * Two generation modes:
 *   1. generateImages() - Text-to-image via Firefly Generate API
 *   2. generateWithProducts() - Product composite + Firefly Expand via Vercel API
 *
 * Required Custom Metadata or Named Credentials:
 *   - Firefly_Client_Id__c
 *   - Firefly_Client_Secret__c
 *
 * Or use Named Credential 'Firefly_API' with OAuth client credentials flow.
 */
public with sharing class FireflyApexService {

    private static final String TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
    private static final String GENERATE_URL = 'https://firefly-api.adobe.io/v3/images/generate-async';
    private static final String STATUS_URL = 'https://firefly-api.adobe.io/v3/status/';
    private static final String VERCEL_APP_URL = 'https://agentforce-retail-advisor.vercel.app';

    // Cache token in static variable (within transaction only)
    private static String cachedToken;
    private static Long tokenExpiresAt = 0;

    // ─── Input/Output Classes for Invocable Methods ───────────────────

    public class ImageGenerationRequest {
        @InvocableVariable(required=true label='Prompt')
        public String prompt;

        @InvocableVariable(required=false label='Event Type')
        public String eventType;

        @InvocableVariable(required=false label='Contact Name')
        public String contactName;

        @InvocableVariable(required=false label='Save to Files')
        public Boolean saveToFiles;
    }

    public class ImageGenerationResult {
        @InvocableVariable
        public Boolean success;

        @InvocableVariable
        public String imageUrl;

        @InvocableVariable
        public String contentVersionId;

        @InvocableVariable
        public String errorMessage;

        @AuraEnabled public Boolean usedFallback { get; set; }
        @AuraEnabled public Integer productCount { get; set; }
    }

    // ─── Invocable Method ─────────────────────────────────────────────

    @InvocableMethod(label='Generate Firefly Image' description='Generates an image using Adobe Firefly API')
    public static List<ImageGenerationResult> generateImages(List<ImageGenerationRequest> requests) {
        List<ImageGenerationResult> results = new List<ImageGenerationResult>();

        for (ImageGenerationRequest req : requests) {
            ImageGenerationResult result = new ImageGenerationResult();
            try {
                // Build the full prompt with brand guidelines
                String fullPrompt = buildBrandedPrompt(req.prompt, req.eventType);

                // Generate the image
                String imageUrl = callFireflyAPI(fullPrompt);
                result.imageUrl = imageUrl;

                // Optionally save to Salesforce Files
                if (req.saveToFiles == true && String.isNotBlank(imageUrl)) {
                    String fileName = 'journey-image-' + System.currentTimeMillis() + '.png';
                    String cvId = downloadAndSaveImage(imageUrl, fileName);
                    result.contentVersionId = cvId;
                }

                result.success = true;
            } catch (Exception e) {
                result.success = false;
                result.errorMessage = e.getMessage();
                System.debug(LoggingLevel.ERROR, 'Firefly generation failed: ' + e.getMessage());
            }
            results.add(result);
        }

        return results;
    }

    // ─── Product Composite + Firefly Expand ───────────────────────────

    /**
     * Input class for product-based image generation.
     */
    public class ProductImageRequest {
        public String productsJson;
        public String prompt;
        public String eventType;
        public Boolean saveToFiles;
    }

    /**
     * Generate an image by compositing products and using Firefly Expand.
     * This creates a scene around the actual product images.
     *
     * Called from JourneyApprovalService when regenerating images.
     * Note: Not an InvocableMethod since we already have one in this class.
     */
    public static List<ImageGenerationResult> generateWithProducts(List<ProductImageRequest> requests) {
        List<ImageGenerationResult> results = new List<ImageGenerationResult>();

        for (ProductImageRequest req : requests) {
            ImageGenerationResult result = new ImageGenerationResult();
            try {
                // Parse products JSON to extract image URLs
                List<Object> products = (List<Object>) JSON.deserializeUntyped(req.productsJson);
                List<Map<String, Object>> productList = new List<Map<String, Object>>();

                for (Object obj : products) {
                    Map<String, Object> prodMap = (Map<String, Object>) obj;
                    productList.add(new Map<String, Object>{
                        'imageUrl' => prodMap.get('imageUrl'),
                        'name' => prodMap.get('name')
                    });
                }

                if (productList.isEmpty()) {
                    throw new FireflyException('No products provided for image generation');
                }

                // Call Vercel API to composite and expand
                VercelImageResult vResult = callVercelImageApi(productList, req.prompt, req.eventType);
                result.imageUrl = vResult.imageUrl;
                result.usedFallback = vResult.usedFallback;
                result.productCount = vResult.productCount;

                // Optionally save to Salesforce Files
                if (req.saveToFiles == true && String.isNotBlank(vResult.imageUrl)) {
                    String fileName = 'journey-image-' + System.currentTimeMillis() + '.png';
                    String cvId = downloadAndSaveImage(vResult.imageUrl, fileName);
                    result.contentVersionId = cvId;
                }

                result.success = true;
            } catch (Exception e) {
                result.success = false;
                result.errorMessage = e.getMessage();
                System.debug(LoggingLevel.ERROR, 'Product image generation failed: ' + e.getMessage());
            }
            results.add(result);
        }

        return results;
    }

    /**
     * AuraEnabled method for LWC to generate image with products.
     */
    @AuraEnabled
    public static ImageGenerationResult generateImageWithProducts(String productsJson, String prompt, String eventType) {
        ProductImageRequest req = new ProductImageRequest();
        req.productsJson = productsJson;
        req.prompt = prompt;
        req.eventType = eventType;
        req.saveToFiles = true;

        List<ImageGenerationResult> results = generateWithProducts(new List<ProductImageRequest>{req});
        return results[0];
    }

    /**
     * Intermediate result from Vercel API call carrying fallback metadata.
     */
    private class VercelImageResult {
        String imageUrl;
        Boolean usedFallback = false;
        Integer productCount = 0;
    }

    /**
     * Call the Vercel API to composite products and generate expanded image.
     */
    private static VercelImageResult callVercelImageApi(List<Map<String, Object>> products, String prompt, String eventType) {
        System.debug(LoggingLevel.INFO, '[callVercelImageApi] Starting with ' + products.size() + ' products');
        for (Integer i = 0; i < products.size(); i++) {
            Map<String, Object> p = products[i];
            System.debug(LoggingLevel.INFO, '[callVercelImageApi] Product ' + i + ': ' + p.get('name') + ' -> ' + p.get('imageUrl'));
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint(VERCEL_APP_URL + '/api/generate-journey-image');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(120000); // 2 minute timeout

        // Safety net: Vercel API handles prompt length, but truncate if extremely long
        String safePrompt = prompt;
        if (String.isNotBlank(prompt) && prompt.length() > 600) {
            safePrompt = prompt.substring(0, 600);
        }

        Map<String, Object> requestBody = new Map<String, Object>{
            'products' => products,
            'prompt' => safePrompt,
            'eventType' => eventType
        };

        req.setBody(JSON.serialize(requestBody));

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new FireflyException('Vercel image generation failed (' + res.getStatusCode() + '): ' + res.getBody());
        }

        Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        System.debug(LoggingLevel.INFO, '[callVercelImageApi] Full response: ' + res.getBody());

        Boolean success = (Boolean) responseData.get('success');
        if (success != true) {
            String errorMsg = (String) responseData.get('error');
            throw new FireflyException('Image generation failed: ' + errorMsg);
        }

        // Check if Expand API failed and fell back to text-only generation
        Boolean usedFallback = responseData.containsKey('usedFallback') && (Boolean) responseData.get('usedFallback');
        Integer productCount = responseData.containsKey('productCount') ? (Integer) responseData.get('productCount') : 0;

        System.debug(LoggingLevel.INFO, '[callVercelImageApi] productCount: ' + productCount);
        System.debug(LoggingLevel.INFO, '[callVercelImageApi] usedFallback: ' + usedFallback);

        if (usedFallback) {
            System.debug(LoggingLevel.WARN, '[callVercelImageApi] WARNING: Firefly Expand failed - used text-only generation (no product images in output)');
        }

        String imageUrl = (String) responseData.get('imageUrl');
        if (String.isBlank(imageUrl)) {
            throw new FireflyException('No image URL in response');
        }

        VercelImageResult vResult = new VercelImageResult();
        vResult.imageUrl = imageUrl;
        vResult.usedFallback = usedFallback;
        vResult.productCount = productCount;
        return vResult;
    }

    // ─── Core API Methods ─────────────────────────────────────────────

    /**
     * Get OAuth access token from Adobe IMS.
     * Caches token in-memory for the duration of the transaction.
     */
    public static String getAccessToken() {
        // Check cache (within same transaction)
        if (String.isNotBlank(cachedToken) && System.currentTimeMillis() < tokenExpiresAt) {
            return cachedToken;
        }

        // Get credentials from Custom Metadata or Custom Settings
        String clientId = getCredential('Firefly_Client_Id');
        String clientSecret = getCredential('Firefly_Client_Secret');

        if (String.isBlank(clientId) || String.isBlank(clientSecret)) {
            throw new FireflyException('Firefly credentials not configured. Set Firefly_Client_Id and Firefly_Client_Secret in Custom Settings.');
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint(TOKEN_URL);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');

        String body = 'grant_type=client_credentials'
            + '&client_id=' + EncodingUtil.urlEncode(clientId, 'UTF-8')
            + '&client_secret=' + EncodingUtil.urlEncode(clientSecret, 'UTF-8')
            + '&scope=' + EncodingUtil.urlEncode('openid,AdobeID,firefly_api,ff_apis', 'UTF-8');
        req.setBody(body);
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new FireflyException('Adobe OAuth failed (' + res.getStatusCode() + '): ' + res.getBody());
        }

        Map<String, Object> tokenData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        cachedToken = (String) tokenData.get('access_token');

        // Cache for slightly less than expiry (5 min buffer)
        Integer expiresIn = tokenData.containsKey('expires_in')
            ? (Integer) tokenData.get('expires_in')
            : 1080;
        tokenExpiresAt = System.currentTimeMillis() + (expiresIn * 1000) - 300000;

        return cachedToken;
    }

    /**
     * Call Firefly API to generate an image from a prompt.
     * Uses Image Model 4 via the async endpoint: submit job, then poll for result.
     */
    public static String callFireflyAPI(String prompt) {
        String token = getAccessToken();
        String clientId = getCredential('Firefly_Client_Id');

        // Submit async generation job
        HttpRequest req = new HttpRequest();
        req.setEndpoint(GENERATE_URL);
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('x-api-key', clientId);
        req.setHeader('x-model-version', 'image4_standard');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Accept', 'application/json');
        req.setTimeout(30000);

        Map<String, Object> requestBody = new Map<String, Object>{
            'prompt' => prompt,
            'contentClass' => 'photo',
            'size' => new Map<String, Object>{
                'width' => 1024,
                'height' => 1024
            },
            'numVariations' => 1
        };

        req.setBody(JSON.serialize(requestBody));

        Http http = new Http();
        HttpResponse res = http.send(req);

        // Async endpoint returns 202 Accepted
        if (res.getStatusCode() != 202 && res.getStatusCode() != 200) {
            throw new FireflyException('Firefly generate-async failed (' + res.getStatusCode() + '): ' + res.getBody());
        }

        Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

        // Check for jobId (async response)
        String jobId = (String) responseData.get('jobId');
        if (String.isNotBlank(jobId)) {
            System.debug(LoggingLevel.INFO, '[callFireflyAPI] Async job submitted: ' + jobId);
            return pollForJobResult(jobId, token, clientId);
        }

        // Fallback: synchronous response (backward compat)
        String imageUrl = extractImageUrl(responseData);
        if (String.isNotBlank(imageUrl)) {
            return imageUrl;
        }

        throw new FireflyException('Firefly returned no jobId or image URL. Response: ' + res.getBody().left(500));
    }

    /**
     * Poll Firefly status endpoint until job completes.
     * Each HTTP callout waits for the response (network latency serves as natural delay).
     */
    private static String pollForJobResult(String jobId, String token, String clientId) {
        Integer maxAttempts = 30;
        Http http = new Http();

        for (Integer attempt = 0; attempt < maxAttempts; attempt++) {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(STATUS_URL + jobId);
            req.setMethod('GET');
            req.setHeader('Authorization', 'Bearer ' + token);
            req.setHeader('x-api-key', clientId);
            req.setHeader('Accept', 'application/json');
            req.setTimeout(10000);

            HttpResponse res = http.send(req);

            if (res.getStatusCode() != 200) {
                System.debug(LoggingLevel.WARN, '[pollForJobResult] Poll ' + (attempt + 1) + ' returned ' + res.getStatusCode());
                continue;
            }

            Map<String, Object> status = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            String jobStatus = (String) status.get('status');
            System.debug(LoggingLevel.INFO, '[pollForJobResult] Job ' + jobId + ' status: ' + jobStatus);

            if (jobStatus == 'succeeded') {
                String imageUrl = extractImageUrl(status);
                // Also try nested result object
                if (String.isBlank(imageUrl) && status.containsKey('result')) {
                    imageUrl = extractImageUrl((Map<String, Object>) status.get('result'));
                }
                if (String.isBlank(imageUrl)) {
                    throw new FireflyException('Job succeeded but returned no image URL');
                }
                return imageUrl;
            }

            if (jobStatus == 'failed' || jobStatus == 'cancelled') {
                String errMsg = status.containsKey('message') ? (String) status.get('message') : 'unknown error';
                throw new FireflyException('Firefly job ' + jobStatus + ': ' + errMsg);
            }

            // Still running - continue polling
        }

        throw new FireflyException('Firefly job timed out after ' + maxAttempts + ' poll attempts');
    }

    /**
     * Extract image URL from Firefly API response.
     * Handles different response structures.
     */
    private static String extractImageUrl(Map<String, Object> response) {
        // Try: outputs[0].image.presignedUrl
        if (response.containsKey('outputs')) {
            List<Object> outputs = (List<Object>) response.get('outputs');
            if (!outputs.isEmpty()) {
                Map<String, Object> firstOutput = (Map<String, Object>) outputs[0];
                if (firstOutput.containsKey('image')) {
                    Map<String, Object> image = (Map<String, Object>) firstOutput.get('image');
                    if (image.containsKey('presignedUrl')) {
                        return (String) image.get('presignedUrl');
                    }
                    if (image.containsKey('url')) {
                        return (String) image.get('url');
                    }
                }
            }
        }

        // Try: images[0].url
        if (response.containsKey('images')) {
            List<Object> images = (List<Object>) response.get('images');
            if (!images.isEmpty()) {
                Map<String, Object> firstImage = (Map<String, Object>) images[0];
                if (firstImage.containsKey('url')) {
                    return (String) firstImage.get('url');
                }
            }
        }

        // Try: result.images[0].url
        if (response.containsKey('result')) {
            Map<String, Object> result = (Map<String, Object>) response.get('result');
            if (result.containsKey('images')) {
                List<Object> images = (List<Object>) result.get('images');
                if (!images.isEmpty()) {
                    Map<String, Object> firstImage = (Map<String, Object>) images[0];
                    if (firstImage.containsKey('url')) {
                        return (String) firstImage.get('url');
                    }
                }
            }
        }

        return null;
    }

    /**
     * Download image from URL and save to Salesforce Files.
     * Returns the ContentVersion Id.
     */
    public static String downloadAndSaveImage(String imageUrl, String fileName) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(imageUrl);
        req.setMethod('GET');
        req.setTimeout(60000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new FireflyException('Failed to download image: ' + res.getStatusCode());
        }

        Blob imageBlob = res.getBodyAsBlob();

        ContentVersion cv = new ContentVersion();
        cv.Title = fileName;
        cv.PathOnClient = fileName;
        cv.VersionData = imageBlob;
        cv.Description = 'Firefly-generated image for personalized journey';
        insert cv;

        return cv.Id;
    }

    /**
     * Create a public URL for a ContentVersion by creating a ContentDistribution.
     * This allows the image to be displayed without authentication.
     *
     * Uses DistributionPublicUrl which is truly public (no auth required),
     * unlike ContentDownloadUrl which requires Salesforce authentication.
     */
    public static String createPublicUrl(Id contentVersionId) {
        System.debug(LoggingLevel.INFO, '[createPublicUrl] Creating public URL for ContentVersionId: ' + contentVersionId);

        // Get the ContentDocumentId
        ContentVersion cv = [
            SELECT Id, ContentDocumentId, Title
            FROM ContentVersion
            WHERE Id = :contentVersionId
            LIMIT 1
        ];
        System.debug(LoggingLevel.INFO, '[createPublicUrl] ContentVersion found: ' + cv.Title + ', ContentDocumentId: ' + cv.ContentDocumentId);

        // Check if a ContentDistribution already exists
        List<ContentDistribution> existingDist = [
            SELECT Id, DistributionPublicUrl, ContentDownloadUrl
            FROM ContentDistribution
            WHERE ContentVersionId = :contentVersionId
            LIMIT 1
        ];

        if (!existingDist.isEmpty()) {
            System.debug(LoggingLevel.INFO, '[createPublicUrl] Existing ContentDistribution found');
            System.debug(LoggingLevel.INFO, '[createPublicUrl] DistributionPublicUrl: ' + existingDist[0].DistributionPublicUrl);
            System.debug(LoggingLevel.INFO, '[createPublicUrl] ContentDownloadUrl: ' + existingDist[0].ContentDownloadUrl);
            // Use DistributionPublicUrl for unauthenticated access
            return existingDist[0].DistributionPublicUrl;
        }

        System.debug(LoggingLevel.INFO, '[createPublicUrl] No existing distribution, creating new one...');

        // Create a new ContentDistribution for public access
        ContentDistribution cd = new ContentDistribution();
        cd.Name = 'Journey Image';
        cd.ContentVersionId = contentVersionId;
        cd.PreferencesAllowViewInBrowser = true;
        cd.PreferencesLinkLatestVersion = true;
        cd.PreferencesNotifyOnVisit = false;
        cd.PreferencesPasswordRequired = false;
        cd.PreferencesAllowOriginalDownload = true;
        insert cd;
        System.debug(LoggingLevel.INFO, '[createPublicUrl] ContentDistribution created with Id: ' + cd.Id);

        // Re-query to get the generated URL
        cd = [
            SELECT Id, DistributionPublicUrl, ContentDownloadUrl
            FROM ContentDistribution
            WHERE Id = :cd.Id
            LIMIT 1
        ];

        System.debug(LoggingLevel.INFO, '[createPublicUrl] After insert - DistributionPublicUrl: ' + cd.DistributionPublicUrl);
        System.debug(LoggingLevel.INFO, '[createPublicUrl] After insert - ContentDownloadUrl: ' + cd.ContentDownloadUrl);

        // Use DistributionPublicUrl for unauthenticated access
        // Fall back to ContentDownloadUrl if DistributionPublicUrl is null
        if (String.isNotBlank(cd.DistributionPublicUrl)) {
            return cd.DistributionPublicUrl;
        } else if (String.isNotBlank(cd.ContentDownloadUrl)) {
            System.debug(LoggingLevel.WARN, '[createPublicUrl] DistributionPublicUrl is null, using ContentDownloadUrl');
            return cd.ContentDownloadUrl;
        } else {
            System.debug(LoggingLevel.ERROR, '[createPublicUrl] Both URLs are null!');
            throw new FireflyException('ContentDistribution URLs are not available');
        }
    }

    // ─── Prompt Building ──────────────────────────────────────────────

    /**
     * Build a branded prompt with BEAUTÉ beauty brand guidelines.
     */
    public static String buildBrandedPrompt(String basePrompt, String eventType) {
        String brandContext = 'Luxury beauty brand aesthetic. Soft, elegant, aspirational mood. '
            + 'Color palette: muted pastels, warm neutrals, soft rose gold accents. '
            + 'Lighting: soft diffused natural light, gentle highlights, no harsh shadows. '
            + 'Style: high-end editorial photography, magazine-quality, sophisticated.';

        String compositionGuidance = 'This image will be used as an email hero banner. '
            + 'Keep the CENTER of the image relatively simple to allow text overlay. '
            + 'Place visual interest toward the EDGES. Professional product photography, photorealistic.';

        // Event-specific adjustments
        String eventContext = '';
        if (eventType == 'life-event') {
            eventContext = 'Celebratory, personal, warm and inviting mood. ';
        } else if (eventType == 'preference') {
            eventContext = 'Clean, pure, authentic aesthetic. ';
        } else if (eventType == 'intent') {
            eventContext = 'Helpful, guiding, aspirational mood. ';
        }

        return basePrompt + '. ' + eventContext + brandContext + ' ' + compositionGuidance;
    }

    // ─── Utility Methods ──────────────────────────────────────────────

    /**
     * Get credential value from Custom Settings or Custom Metadata.
     * In production, use Named Credentials for better security.
     */
    private static String getCredential(String key) {
        // Try Custom Settings first
        Firefly_Settings__c settings = Firefly_Settings__c.getOrgDefaults();
        if (settings != null) {
            if (key == 'Firefly_Client_Id' && String.isNotBlank(settings.Client_Id__c)) {
                return settings.Client_Id__c;
            }
            if (key == 'Firefly_Client_Secret' && String.isNotBlank(settings.Client_Secret__c)) {
                return settings.Client_Secret__c;
            }
        }

        // Fallback: return null (will throw error in getAccessToken)
        return null;
    }

    // ─── Custom Exception ─────────────────────────────────────────────

    public class FireflyException extends Exception {}
}
