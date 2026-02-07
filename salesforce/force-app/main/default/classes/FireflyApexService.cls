/**
 * FireflyApexService - Server-side Adobe Firefly image generation.
 *
 * Handles OAuth token acquisition and image generation for personalized
 * journey content. Images are generated during nightly batch processing
 * and stored in Salesforce Files for use in Marketing Cloud emails.
 *
 * Required Custom Metadata or Named Credentials:
 *   - Firefly_Client_Id__c
 *   - Firefly_Client_Secret__c
 *
 * Or use Named Credential 'Firefly_API' with OAuth client credentials flow.
 */
public with sharing class FireflyApexService {

    private static final String TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
    private static final String GENERATE_URL = 'https://firefly-api.adobe.io/v3/images/generate';

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
     */
    public static String callFireflyAPI(String prompt) {
        String token = getAccessToken();
        String clientId = getCredential('Firefly_Client_Id');

        HttpRequest req = new HttpRequest();
        req.setEndpoint(GENERATE_URL);
        req.setMethod('POST');
        req.setHeader('Authorization', 'Bearer ' + token);
        req.setHeader('x-api-key', clientId);
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(120000); // 2 minute timeout for image generation

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

        if (res.getStatusCode() != 200) {
            throw new FireflyException('Firefly generation failed (' + res.getStatusCode() + '): ' + res.getBody());
        }

        Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

        // Parse response - handle different response structures
        String imageUrl = extractImageUrl(responseData);

        if (String.isBlank(imageUrl)) {
            throw new FireflyException('Firefly returned no image URL. Response: ' + res.getBody().left(500));
        }

        return imageUrl;
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

    // ─── Prompt Building ──────────────────────────────────────────────

    /**
     * Build a branded prompt with LUMIÈRE beauty brand guidelines.
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
