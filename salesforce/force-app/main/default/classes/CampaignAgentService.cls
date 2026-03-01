/**
 * CampaignAgentService - Invokes the OOTB Salesforce Campaign Creation Agent
 * to generate marketing briefs and email content from meaningful events.
 *
 * Uses the Agent API to communicate with the Campaign Creation Agent,
 * passing event context and receiving generated content.
 *
 * Prerequisites:
 *   - Agentforce Employee Agent enabled in Setup
 *   - Campaign Creation Agent enabled in Setup
 *   - Marketing Cloud Next Growth or Advanced Edition
 */
public with sharing class CampaignAgentService {

    // Agent API endpoints (relative to My Domain)
    private static final String AGENT_SESSIONS_ENDPOINT = '/services/data/v60.0/einstein/ai-agent/sessions';
    private static final String AGENT_MESSAGES_ENDPOINT = '/services/data/v60.0/einstein/ai-agent/sessions/{sessionId}/messages';

    // Campaign Creation Agent ID - set via Custom Settings or find dynamically
    private static final String CAMPAIGN_AGENT_NAME = 'Campaign Creation Agent';

    // ─── Input/Output Classes ─────────────────────────────────────────

    public class BriefGenerationRequest {
        @InvocableVariable(required=true label='Event Type')
        public String eventType;

        @InvocableVariable(required=true label='Event Description')
        public String eventDescription;

        @InvocableVariable(required=false label='Contact Name')
        public String contactName;

        @InvocableVariable(required=false label='Event Date')
        public Date eventDate;

        @InvocableVariable(required=false label='Suggested Products')
        public String suggestedProducts;

        @InvocableVariable(required=false label='Additional Context')
        public String additionalContext;
    }

    public class BriefGenerationResult {
        @InvocableVariable
        public Boolean success;

        @InvocableVariable
        public String briefContent;

        @InvocableVariable
        public String suggestedSubject;

        @InvocableVariable
        public String suggestedBody;

        @InvocableVariable
        public String fireflyPromptSuggestion;

        @InvocableVariable
        public String errorMessage;

        @InvocableVariable
        public String sessionId;
    }

    // ─── Invocable Method ─────────────────────────────────────────────

    @InvocableMethod(label='Generate Campaign Brief' description='Uses Campaign Creation Agent to generate marketing brief and email content')
    public static List<BriefGenerationResult> generateBriefs(List<BriefGenerationRequest> requests) {
        List<BriefGenerationResult> results = new List<BriefGenerationResult>();

        for (BriefGenerationRequest req : requests) {
            BriefGenerationResult result = new BriefGenerationResult();
            try {
                // Build the prompt for the Campaign Creation Agent
                String agentPrompt = buildAgentPrompt(req);

                // Invoke the agent and get response
                Map<String, String> agentResponse = invokeAgent(agentPrompt);

                result.success = true;
                result.briefContent = agentResponse.get('briefContent');
                result.suggestedSubject = agentResponse.get('subject');
                result.suggestedBody = agentResponse.get('body');
                result.fireflyPromptSuggestion = agentResponse.get('imagePrompt');
                result.sessionId = agentResponse.get('sessionId');

            } catch (Exception e) {
                result.success = false;
                result.errorMessage = e.getMessage();
                System.debug(LoggingLevel.ERROR, 'Campaign agent invocation failed: ' + e.getMessage());
            }
            results.add(result);
        }

        return results;
    }

    // ─── Agent Invocation ─────────────────────────────────────────────

    /**
     * Invoke the Campaign Creation Agent with a prompt.
     * Returns a map with extracted content fields.
     */
    public static Map<String, String> invokeAgent(String prompt) {
        Map<String, String> response = new Map<String, String>();

        // Get the Campaign Creation Agent ID
        String agentId = getCampaignAgentId();

        if (String.isBlank(agentId)) {
            // Fallback: Generate content locally if agent not available
            System.debug(LoggingLevel.WARN, 'Campaign Creation Agent not found. Using fallback generation.');
            return generateContentFallback(prompt);
        }

        // Create agent session
        String sessionId = createAgentSession(agentId);
        response.put('sessionId', sessionId);

        // Send message and get response
        String agentReply = sendAgentMessage(sessionId, prompt);

        // Parse the agent's response to extract structured content
        response.putAll(parseAgentResponse(agentReply));

        return response;
    }

    /**
     * Get the Campaign Creation Agent ID from the org.
     */
    private static String getCampaignAgentId() {
        try {
            // Query for the agent by name
            // BotDefinition uses Status field, not IsActive
            List<SObject> agents = Database.query(
                'SELECT Id, DeveloperName FROM BotDefinition ' +
                'WHERE DeveloperName LIKE \'%Campaign%\' ' +
                'LIMIT 1'
            );

            if (!agents.isEmpty()) {
                return (String) agents[0].get('Id');
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Could not query for Campaign Agent: ' + e.getMessage());
        }

        // Try Custom Settings
        Marketing_Agent_Settings__c settings = Marketing_Agent_Settings__c.getOrgDefaults();
        if (settings != null && String.isNotBlank(settings.Campaign_Agent_Id__c)) {
            return settings.Campaign_Agent_Id__c;
        }

        return null;
    }

    /**
     * Create a new agent session.
     */
    private static String createAgentSession(String agentId) {
        String baseUrl = URL.getOrgDomainUrl().toExternalForm();

        HttpRequest req = new HttpRequest();
        req.setEndpoint(baseUrl + AGENT_SESSIONS_ENDPOINT);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());

        Map<String, Object> body = new Map<String, Object>{
            'agentId' => agentId,
            'bypassUser' => false
        };
        req.setBody(JSON.serialize(body));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200 && res.getStatusCode() != 201) {
            throw new CampaignAgentException('Failed to create agent session: ' + res.getStatusCode() + ' - ' + res.getBody());
        }

        Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        return (String) responseData.get('sessionId');
    }

    /**
     * Send a message to the agent and get the response.
     */
    private static String sendAgentMessage(String sessionId, String message) {
        String baseUrl = URL.getOrgDomainUrl().toExternalForm();
        String endpoint = baseUrl + AGENT_MESSAGES_ENDPOINT.replace('{sessionId}', sessionId);

        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());

        Map<String, Object> body = new Map<String, Object>{
            'message' => message
        };
        req.setBody(JSON.serialize(body));
        req.setTimeout(120000); // 2 minute timeout for agent processing

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new CampaignAgentException('Agent message failed: ' + res.getStatusCode() + ' - ' + res.getBody());
        }

        Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

        // Extract the agent's reply text
        if (responseData.containsKey('messages')) {
            List<Object> messages = (List<Object>) responseData.get('messages');
            for (Object msg : messages) {
                Map<String, Object> msgMap = (Map<String, Object>) msg;
                if (msgMap.get('role') == 'assistant') {
                    return (String) msgMap.get('content');
                }
            }
        }

        return (String) responseData.get('response');
    }

    // ─── Prompt Building ──────────────────────────────────────────────

    /**
     * Build a structured prompt for the Campaign Creation Agent.
     */
    private static String buildAgentPrompt(BriefGenerationRequest req) {
        String prompt = 'Create a personalized email campaign for a customer based on this meaningful event:\n\n';

        prompt += 'EVENT TYPE: ' + req.eventType + '\n';
        prompt += 'EVENT DESCRIPTION: ' + req.eventDescription + '\n';

        if (String.isNotBlank(req.contactName)) {
            prompt += 'CUSTOMER NAME: ' + req.contactName + '\n';
        }

        if (req.eventDate != null) {
            prompt += 'EVENT DATE: ' + req.eventDate.format() + '\n';
            Integer daysUntil = Date.today().daysBetween(req.eventDate);
            prompt += 'DAYS UNTIL EVENT: ' + daysUntil + '\n';
        }

        if (String.isNotBlank(req.suggestedProducts)) {
            prompt += 'SUGGESTED PRODUCTS: ' + req.suggestedProducts + '\n';
        }

        if (String.isNotBlank(req.additionalContext)) {
            prompt += 'ADDITIONAL CONTEXT: ' + req.additionalContext + '\n';
        }

        prompt += '\nPLEASE PROVIDE:\n';
        prompt += '1. A brief marketing campaign summary (2-3 sentences)\n';
        prompt += '2. An email subject line (under 60 characters)\n';
        prompt += '3. Email body content (personalized, warm, celebratory tone)\n';
        prompt += '4. A suggested image prompt for generating a hero banner\n';
        prompt += '\nBRAND: BEAUTÉ Beauty (luxury skincare, soft rose gold aesthetic)\n';
        prompt += 'TONE: Personal, celebratory, helpful, elegant\n';

        return prompt;
    }

    // ─── Response Parsing ─────────────────────────────────────────────

    /**
     * Parse the agent's response to extract structured content fields.
     */
    private static Map<String, String> parseAgentResponse(String response) {
        Map<String, String> parsed = new Map<String, String>();

        if (String.isBlank(response)) {
            return parsed;
        }

        // Store full response as brief content
        parsed.put('briefContent', response);

        // Try to extract structured sections
        String lower = response.toLowerCase();

        // Extract subject line
        if (lower.contains('subject:') || lower.contains('subject line:')) {
            String subject = extractSection(response, new List<String>{'Subject:', 'Subject Line:'});
            if (String.isNotBlank(subject)) {
                parsed.put('subject', subject.left(255));
            }
        }

        // Extract email body
        if (lower.contains('body:') || lower.contains('email body:') || lower.contains('email content:')) {
            String body = extractSection(response, new List<String>{'Body:', 'Email Body:', 'Email Content:'});
            if (String.isNotBlank(body)) {
                parsed.put('body', body);
            }
        }

        // Extract image prompt
        if (lower.contains('image prompt:') || lower.contains('hero banner:') || lower.contains('image suggestion:')) {
            String imagePrompt = extractSection(response, new List<String>{'Image Prompt:', 'Hero Banner:', 'Image Suggestion:'});
            if (String.isNotBlank(imagePrompt)) {
                parsed.put('imagePrompt', imagePrompt);
            }
        }

        return parsed;
    }

    /**
     * Extract a section from the response based on header markers.
     */
    private static String extractSection(String response, List<String> headers) {
        for (String header : headers) {
            Integer startIdx = response.indexOfIgnoreCase(header);
            if (startIdx >= 0) {
                String remaining = response.substring(startIdx + header.length()).trim();

                // Find the end of this section (next numbered item or end)
                Integer endIdx = remaining.length();
                for (Integer i = 1; i <= 10; i++) {
                    Integer nextSection = remaining.indexOf(i + '.');
                    if (nextSection > 0 && nextSection < endIdx) {
                        endIdx = nextSection;
                    }
                }

                // Also check for common section headers
                List<String> sectionMarkers = new List<String>{'\n\n', '\nSubject:', '\nBody:', '\nImage:'};
                for (String marker : sectionMarkers) {
                    Integer markerIdx = remaining.indexOf(marker);
                    if (markerIdx > 0 && markerIdx < endIdx) {
                        endIdx = markerIdx;
                    }
                }

                return remaining.substring(0, endIdx).trim();
            }
        }
        return null;
    }

    // ─── Fallback Generation ──────────────────────────────────────────

    /**
     * Generate content locally if Campaign Agent is not available.
     * This is a simple fallback - the OOTB agent provides much better results.
     */
    private static Map<String, String> generateContentFallback(String prompt) {
        Map<String, String> content = new Map<String, String>();

        // Extract event info from prompt
        String eventType = '';
        String eventDescription = '';

        if (prompt.contains('EVENT TYPE:')) {
            Integer startPos = prompt.indexOf('EVENT TYPE:') + 11;
            Integer endPos = prompt.indexOf('\n', startPos);
            if (endPos > startPos) {
                eventType = prompt.substring(startPos, endPos).trim();
            }
        }

        if (prompt.contains('EVENT DESCRIPTION:')) {
            Integer startPos = prompt.indexOf('EVENT DESCRIPTION:') + 18;
            Integer endPos = prompt.indexOf('\n', startPos);
            if (endPos > startPos) {
                eventDescription = prompt.substring(startPos, endPos).trim();
            }
        }

        // Generate event-specific content
        String eventLower = eventDescription.toLowerCase();
        String subject = 'Something special just for you';
        String body = '';

        if (eventLower.contains('wedding')) {
            subject = 'Your wedding glow awaits ✨';
            body = '<div style="font-family: Georgia, serif; color: #333; max-width: 600px;">' +
                '<p style="font-size: 18px; line-height: 1.7;">Every love story deserves its own glow.</p>' +
                '<p style="font-size: 16px; line-height: 1.7; color: #444;">We heard there\'s a beautiful celebration on the horizon! Whether you\'re walking down the aisle or celebrating someone you love, we\'ve thoughtfully selected pieces designed to make you radiant — from the rehearsal dinner to the last dance.</p>' +
                '<p style="margin: 25px 0;"><a href="#" style="display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500;">Discover Your Selection</a></p>' +
                '<p style="color: #666; font-style: italic;">With love,</p><p style="color: #B76E79; font-weight: 600;">The BEAUTÉ Team</p></div>';
        } else if (eventLower.contains('travel') || eventLower.contains('trip') || eventLower.contains('vacation')) {
            subject = 'Travel beauty essentials for your adventure';
            body = '<div style="font-family: Georgia, serif; color: #333; max-width: 600px;">' +
                '<p style="font-size: 18px; line-height: 1.7;">Adventure awaits! 🌟</p>' +
                '<p style="font-size: 16px; line-height: 1.7; color: #444;">Before you embark on your journey, we\'ve assembled the perfect travel companions for your beauty ritual. From protective SPF to hydrating essentials that survive any climate — arrive at every destination looking refreshed and radiant.</p>' +
                '<p style="margin: 25px 0;"><a href="#" style="display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500;">Shop Travel Essentials</a></p>' +
                '<p style="color: #666; font-style: italic;">With love,</p><p style="color: #B76E79; font-weight: 600;">The BEAUTÉ Team</p></div>';
        } else if (eventLower.contains('birthday')) {
            subject = 'Birthday glow time! 🎂';
            body = '<div style="font-family: Georgia, serif; color: #333; max-width: 600px;">' +
                '<p style="font-size: 18px; line-height: 1.7;">A birthday means celebrating the most important person — you!</p>' +
                '<p style="font-size: 16px; line-height: 1.7; color: #444;">This year, gift yourself the glow you deserve. We\'ve selected pieces that will make you feel as radiant as the day itself. Because every year more beautiful deserves to be seen.</p>' +
                '<p style="margin: 25px 0;"><a href="#" style="display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500;">Celebrate You</a></p>' +
                '<p style="color: #666; font-style: italic;">With love,</p><p style="color: #B76E79; font-weight: 600;">The BEAUTÉ Team</p></div>';
        } else if (eventLower.contains('anniversary')) {
            subject = 'Celebrating your beautiful milestone 💕';
            body = '<div style="font-family: Georgia, serif; color: #333; max-width: 600px;">' +
                '<p style="font-size: 18px; line-height: 1.7;">Another year of beautiful moments deserves to be celebrated.</p>' +
                '<p style="font-size: 16px; line-height: 1.7; color: #444;">We\'ve curated something special for this milestone. From luxurious fragrances to skin that tells a story of happiness — here\'s to looking and feeling your most radiant.</p>' +
                '<p style="margin: 25px 0;"><a href="#" style="display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500;">Discover Your Selection</a></p>' +
                '<p style="color: #666; font-style: italic;">With love,</p><p style="color: #B76E79; font-weight: 600;">The BEAUTÉ Team</p></div>';
        } else {
            subject = 'Something special for your upcoming moment ✨';
            body = '<div style="font-family: Georgia, serif; color: #333; max-width: 600px;">' +
                '<p style="font-size: 18px; line-height: 1.7;">Something wonderful is on the horizon!</p>' +
                '<p style="font-size: 16px; line-height: 1.7; color: #444;">We noticed ' + eventDescription + ' — and we couldn\'t help but want to help you prepare in the most beautiful way possible. We\'ve selected a collection designed to make you feel confident, radiant, and ready for your special moment.</p>' +
                '<p style="margin: 25px 0;"><a href="#" style="display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500;">Discover Your Selection</a></p>' +
                '<p style="color: #666; font-style: italic;">With love,</p><p style="color: #B76E79; font-weight: 600;">The BEAUTÉ Team</p></div>';
        }

        content.put('briefContent', 'Personalized journey for ' + eventType + ': ' + eventDescription);
        content.put('subject', subject);
        content.put('body', body);
        content.put('imagePrompt', buildFallbackImagePrompt(eventLower));

        return content;
    }

    // ─── Fallback Image Prompt Builder ──────────────────────────────

    private static String buildFallbackImagePrompt(String eventDescLower) {
        if (eventDescLower.contains('wedding') || eventDescLower.contains('bridal')) {
            return 'Bridal preparation vanity scene, luxury beauty products arranged on white marble surface, '
                 + 'soft romantic lighting, white roses and champagne, luxury bridal suite atmosphere, '
                 + 'silk ribbon accents, editorial wedding photography';
        }
        if (eventDescLower.contains('travel') || eventDescLower.contains('trip') || eventDescLower.contains('vacation')) {
            return 'Elegant open suitcase on luxury hotel bed, luxury beauty products beautifully arranged inside, '
                 + 'destination cityscape through window, soft natural light, jet-set lifestyle photography, '
                 + 'rose gold accents, premium editorial composition';
        }
        if (eventDescLower.contains('birthday')) {
            return 'Beautiful birthday gift arrangement, luxury beauty products wrapped with silk ribbons, '
                 + 'elegant gift boxes, rose petals scattered, soft bokeh lights, '
                 + 'celebration atmosphere, premium product photography';
        }
        if (eventDescLower.contains('anniversary')) {
            return 'Romantic celebration scene, luxury beauty products beside champagne flutes, '
                 + 'rose petals, candlelight, elegant marble surface, intimate atmosphere, '
                 + 'premium editorial photography';
        }
        if (eventDescLower.contains('baby') || eventDescLower.contains('pregnant')) {
            return 'Gentle nursery setting, luxury beauty products arranged on soft white blanket, '
                 + 'pastel colors, soft diffused light, peaceful nurturing atmosphere, '
                 + 'cotton details, tender motherhood moment';
        }
        return 'Lifestyle flat-lay arrangement, luxury beauty products beautifully styled, '
             + 'clean minimalist background, natural lighting, premium product photography, '
             + 'soft rose gold accents, warm editorial composition';
    }

    // ─── Engagement-Based Campaign Generation ─────────────────────────

    /**
     * Request class for engagement-based campaigns (daily browse visitors).
     * Unlike BriefGenerationRequest which centers on a life event,
     * this captures the full engagement context: browse behavior, campaign
     * attribution, chat interactions, and enriched profile data.
     */
    public class EngagementBriefRequest {
        public String contactName;
        public String browseContext;
        public String campaignContext;
        public String chatContext;
        public String profileContext;
        public String loyaltyContext;
        public String suggestedProducts;
    }

    /**
     * Generate campaign briefs for engagement-based journeys.
     * Uses the same Campaign Creation Agent but with a browse/engagement prompt.
     * Called directly from DailyEngagementProcessor (not invocable — only one
     * @InvocableMethod allowed per class, and generateBriefs already has it).
     */
    public static List<BriefGenerationResult> generateEngagementBriefs(List<EngagementBriefRequest> requests) {
        List<BriefGenerationResult> results = new List<BriefGenerationResult>();

        for (EngagementBriefRequest req : requests) {
            BriefGenerationResult result = new BriefGenerationResult();
            try {
                String agentPrompt = buildEngagementPrompt(req);
                Map<String, String> agentResponse = invokeAgent(agentPrompt);

                result.success = true;
                result.briefContent = agentResponse.get('briefContent');
                result.suggestedSubject = agentResponse.get('subject');
                result.suggestedBody = agentResponse.get('body');
                result.fireflyPromptSuggestion = agentResponse.get('imagePrompt');
                result.sessionId = agentResponse.get('sessionId');

                // Extract SMS if present (engagement prompts request it)
                if (agentResponse.containsKey('sms')) {
                    // Store SMS in briefContent addendum since BriefGenerationResult
                    // doesn't have a dedicated SMS field — caller can parse it
                    result.briefContent += '\n\nSMS: ' + agentResponse.get('sms');
                }

            } catch (Exception e) {
                result.success = false;
                result.errorMessage = e.getMessage();
                System.debug(LoggingLevel.ERROR, 'Engagement campaign agent invocation failed: ' + e.getMessage());
            }
            results.add(result);
        }

        return results;
    }

    /**
     * Build an engagement-focused prompt for the Campaign Creation Agent.
     * Unlike the event prompt, this centers on browse behavior and campaign context.
     */
    private static String buildEngagementPrompt(EngagementBriefRequest req) {
        String prompt = 'Create a personalized follow-up email campaign for a customer who recently browsed our store:\n\n';

        prompt += 'CUSTOMER NAME: ' + req.contactName + '\n';
        prompt += 'INTERACTION DATE: ' + Date.today().addDays(-1).format() + '\n\n';

        prompt += 'CAMPAIGN ATTRIBUTION:\n';
        prompt += String.isNotBlank(req.campaignContext) ? req.campaignContext : 'Organic visit — no paid attribution';
        prompt += '\n\n';

        prompt += 'BROWSE ACTIVITY:\n';
        prompt += req.browseContext + '\n\n';

        prompt += 'CHAT CONTEXT:\n';
        prompt += String.isNotBlank(req.chatContext) ? req.chatContext : 'No agent interaction';
        prompt += '\n\n';

        if (String.isNotBlank(req.profileContext)) {
            prompt += 'CUSTOMER PROFILE:\n' + req.profileContext + '\n\n';
        }

        if (String.isNotBlank(req.loyaltyContext)) {
            prompt += 'LOYALTY:\n' + req.loyaltyContext + '\n\n';
        }

        if (String.isNotBlank(req.suggestedProducts)) {
            prompt += 'SUGGESTED PRODUCTS:\n' + req.suggestedProducts + '\n\n';
        }

        prompt += 'PLEASE PROVIDE:\n';
        prompt += '1. A brief campaign summary (2-3 sentences)\n';
        prompt += '2. An email subject line (under 60 characters)\n';
        prompt += '3. Email body content (warm, helpful — reference their browse interests)\n';
        prompt += '4. SMS follow-up (under 160 characters)\n';
        prompt += '5. A suggested image prompt for a hero banner\n';
        prompt += '\nBRAND: BEAUTÉ Beauty (luxury skincare, soft rose gold aesthetic)\n';
        prompt += 'TONE: Personalized re-engagement — curious, helpful, not sales-y\n';

        return prompt;
    }

    // ─── Engagement Fallback Generation ──────────────────────────────

    /**
     * Generate engagement campaign content locally when Campaign Agent is unavailable.
     * Category-aware templates (unlike event-type templates in the event fallback).
     */
    public static Map<String, String> generateEngagementFallback(String browseContext, String contactName) {
        Map<String, String> content = new Map<String, String>();
        String lower = (browseContext != null) ? browseContext.toLowerCase() : '';

        String subject;
        String body;
        String sms;

        String ctaStyle = 'display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); '
            + 'color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500;';
        String wrapOpen = '<div style="font-family: Georgia, serif; color: #333; max-width: 600px;">';
        String signOff = '</div>';
        String name = String.isNotBlank(contactName) ? contactName : 'there';

        if (lower.contains('serum') || lower.contains('moisturizer') || lower.contains('cleanser') || lower.contains('skincare')) {
            subject = 'Your skincare picks are waiting';
            body = wrapOpen
                + '<p style="font-size: 18px; line-height: 1.7;">Hi ' + name + ', we noticed you exploring our skincare collection.</p>'
                + '<p style="font-size: 16px; line-height: 1.7; color: #444;">Great taste — those are some of our most-loved formulas. Whether you\'re building a new routine or refining your existing one, we\'d love to help you find the perfect match for your skin.</p>'
                + '<p style="margin: 25px 0;"><a href="#" style="' + ctaStyle + '">Complete Your Routine</a></p>'
                + signOff;
            sms = 'Hi ' + name + '! The skincare picks you browsed are still waiting. Shop your curated selection: [link]';
        } else if (lower.contains('fragrance') || lower.contains('perfume') || lower.contains('cologne')) {
            subject = 'Discover your signature scent';
            body = wrapOpen
                + '<p style="font-size: 18px; line-height: 1.7;">Hi ' + name + ', still searching for that perfect scent?</p>'
                + '<p style="font-size: 16px; line-height: 1.7; color: #444;">We saw you exploring our fragrance collection — and we\'re not surprised. Each fragrance tells its own story. Let us help you find the one that tells yours.</p>'
                + '<p style="margin: 25px 0;"><a href="#" style="' + ctaStyle + '">Explore Fragrances</a></p>'
                + signOff;
            sms = 'Hi ' + name + '! Find your signature scent from the fragrances you loved: [link]';
        } else if (lower.contains('lipstick') || lower.contains('foundation') || lower.contains('makeup') || lower.contains('mascara')) {
            subject = 'The looks you loved are still here';
            body = wrapOpen
                + '<p style="font-size: 18px; line-height: 1.7;">Hi ' + name + ', ready to add to your beauty toolkit?</p>'
                + '<p style="font-size: 16px; line-height: 1.7; color: #444;">You browsed some stunning pieces from our makeup collection. From everyday essentials to show-stopping finishes, let\'s make sure you have exactly what you need for your next look.</p>'
                + '<p style="margin: 25px 0;"><a href="#" style="' + ctaStyle + '">Shop Your Picks</a></p>'
                + signOff;
            sms = 'Hi ' + name + '! Your makeup picks are still available. Complete your look: [link]';
        } else if (lower.contains('shampoo') || lower.contains('conditioner') || lower.contains('hair')) {
            subject = 'Gorgeous hair starts here';
            body = wrapOpen
                + '<p style="font-size: 18px; line-height: 1.7;">Hi ' + name + ', your hair deserves the best.</p>'
                + '<p style="font-size: 16px; line-height: 1.7; color: #444;">We noticed you browsing our haircare collection. From nourishing treatments to styling essentials, we\'ve curated pieces to help you achieve salon-quality results at home.</p>'
                + '<p style="margin: 25px 0;"><a href="#" style="' + ctaStyle + '">Explore Haircare</a></p>'
                + signOff;
            sms = 'Hi ' + name + '! Salon-quality haircare you browsed is waiting: [link]';
        } else {
            subject = 'We saved your beauty picks';
            body = wrapOpen
                + '<p style="font-size: 18px; line-height: 1.7;">Hi ' + name + ', thanks for stopping by!</p>'
                + '<p style="font-size: 16px; line-height: 1.7; color: #444;">We noticed you exploring some beautiful pieces in our collection. If anything caught your eye, we\'ve saved your favorites so you can pick up right where you left off.</p>'
                + '<p style="margin: 25px 0;"><a href="#" style="' + ctaStyle + '">Continue Shopping</a></p>'
                + signOff;
            sms = 'Hi ' + name + '! Your BEAUTÉ picks are saved and waiting for you: [link]';
        }

        content.put('briefContent', 'Engagement re-engagement campaign for ' + name + ' based on browse activity');
        content.put('subject', subject);
        content.put('body', body);
        content.put('sms', sms);
        content.put('imagePrompt', buildEngagementFallbackImage(lower));

        return content;
    }

    private static String buildEngagementFallbackImage(String browseContextLower) {
        if (browseContextLower.contains('serum') || browseContextLower.contains('moisturizer') || browseContextLower.contains('skincare')) {
            return 'Elegant skincare routine flat-lay, luxury serum bottles and moisturizer jars on marble surface, '
                 + 'morning light, fresh botanicals, dewy droplets, clean minimalist aesthetic, premium editorial photography';
        }
        if (browseContextLower.contains('fragrance') || browseContextLower.contains('perfume')) {
            return 'Luxury perfume bottle on draped silk fabric, soft golden hour light, '
                 + 'scattered flower petals, elegant vanity scene, warm amber tones, editorial fragrance photography';
        }
        if (browseContextLower.contains('lipstick') || browseContextLower.contains('makeup')) {
            return 'Curated makeup collection artfully arranged, luxury lipsticks and palettes, '
                 + 'rose gold accents, soft studio lighting, clean white background, premium beauty editorial';
        }
        return 'Luxury beauty products styled on clean marble surface, soft natural lighting, '
             + 'rose gold accents, botanical elements, warm inviting atmosphere, premium editorial photography';
    }

    // ─── Custom Exception ─────────────────────────────────────────────

    public class CampaignAgentException extends Exception {}
}
