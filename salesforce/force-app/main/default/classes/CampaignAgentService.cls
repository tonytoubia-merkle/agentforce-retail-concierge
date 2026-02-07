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
            // Note: The actual object/field names may vary based on your org's setup
            List<SObject> agents = Database.query(
                'SELECT Id, DeveloperName FROM BotDefinition ' +
                'WHERE DeveloperName LIKE \'%Campaign%\' ' +
                'AND IsActive = true LIMIT 1'
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
        prompt += '\nBRAND: LUMIÈRE Beauty (luxury skincare, soft rose gold aesthetic)\n';
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
            Integer start = prompt.indexOf('EVENT TYPE:') + 11;
            Integer end = prompt.indexOf('\n', start);
            if (end > start) {
                eventType = prompt.substring(start, end).trim();
            }
        }

        if (prompt.contains('EVENT DESCRIPTION:')) {
            Integer start = prompt.indexOf('EVENT DESCRIPTION:') + 18;
            Integer end = prompt.indexOf('\n', start);
            if (end > start) {
                eventDescription = prompt.substring(start, end).trim();
            }
        }

        // Generate basic content
        content.put('briefContent', 'Personalized journey for ' + eventType + ': ' + eventDescription);
        content.put('subject', 'Something special just for you');
        content.put('body', '<p>We noticed something exciting coming up for you!</p>' +
            '<p>' + eventDescription + '</p>' +
            '<p>We\'d love to help you prepare with our curated selection of products.</p>' +
            '<p>Warm regards,<br/>The LUMIÈRE Team</p>');
        content.put('imagePrompt', 'Elegant ' + eventType + ' celebration, luxury beauty products, ' +
            'soft rose gold accents, warm natural lighting, sophisticated editorial style');

        return content;
    }

    // ─── Custom Exception ─────────────────────────────────────────────

    public class CampaignAgentException extends Exception {}
}
