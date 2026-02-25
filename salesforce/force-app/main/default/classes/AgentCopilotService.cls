/**
 * AgentCopilotService - Apex proxy for the Agentforce REST API.
 * Used by the agentCopilotPanel LWC to embed an AI co-pilot chat
 * directly in the Service Cloud clientelling console.
 *
 * Mirrors the React AgentforceClient but runs server-side from Apex,
 * using the same Connected App credentials for OAuth 2.0 client_credentials flow.
 */
global with sharing class AgentCopilotService {

    // ─── Configuration (Custom Metadata or Org defaults) ─────────────
    // In production, these should come from Named Credentials or Custom Metadata.
    // For the POC, we read from a simple Custom Setting or hardcode fallback.

    private static String getAgentId(String agentType) {
        try {
            Agentforce_Config__c config = Agentforce_Config__c.getOrgDefaults();
            if (config != null) {
                // Clientelling Copilot agent
                if (agentType == 'clientelling'
                    && String.isNotBlank(config.Clientelling_Agent_Id__c)) {
                    return config.Clientelling_Agent_Id__c;
                }
                // Beauty Concierge agent (default)
                if (String.isNotBlank(config.Agent_Id__c)) {
                    return config.Agent_Id__c;
                }
            }
        } catch (Exception e) { /* Custom Setting may not exist yet */ }
        return ''; // Must be configured in Custom Setting
    }

    private static String getBaseUrl() {
        return 'https://api.salesforce.com/einstein/ai-agent/v1';
    }

    private static String getInstanceUrl() {
        return URL.getOrgDomainUrl().toExternalForm();
    }

    // ─── Inner Classes ───────────────────────────────────────────────

    public class SessionResult {
        @AuraEnabled public String sessionId;
        @AuraEnabled public String welcomeMessage;
        @AuraEnabled public Boolean success;
        @AuraEnabled public String errorMessage;
    }

    public class MessageResult {
        @AuraEnabled public String message;
        @AuraEnabled public List<ProductCard> products;
        @AuraEnabled public String action;
        @AuraEnabled public List<CaptureNotification> captures;
        @AuraEnabled public List<String> suggestedActions;
        @AuraEnabled public Boolean success;
        @AuraEnabled public String errorMessage;
    }

    public class ProductCard {
        @AuraEnabled public String productId;
        @AuraEnabled public String name;
        @AuraEnabled public String description;
        @AuraEnabled public Decimal price;
        @AuraEnabled public String imageUrl;
        @AuraEnabled public String brand;
        @AuraEnabled public String category;
    }

    public class CaptureNotification {
        @AuraEnabled public String captureType;
        @AuraEnabled public String label;
    }

    // ─── Session Management ──────────────────────────────────────────

    @AuraEnabled
    public static SessionResult initSession(Id contactId, String agentType) {
        SessionResult result = new SessionResult();
        result.success = false;
        Boolean isClientelling = (agentType == 'clientelling');

        try {
            // Build customer context variables
            Contact c = [
                SELECT Id, FirstName, LastName, Email, Phone,
                       Skin_Type__c, Skin_Concerns__c, Allergies__c,
                       Beauty_Priority__c, Preferred_Brands__c, Price_Range__c,
                       Sustainability_Preference__c, Climate_Context__c,
                       Clientelling_Tier__c, Merkury_Id__c, Demo_Profile__c
                FROM Contact WHERE Id = :contactId LIMIT 1
            ];

            String accessToken = getAccessToken();
            String agentId = getAgentId(agentType);

            if (String.isBlank(agentId)) {
                String settingField = isClientelling ? 'Clientelling_Agent_Id__c' : 'Agent_Id__c';
                result.errorMessage = 'Agentforce Agent ID not configured. Set Agentforce_Config__c.' + settingField + '.';
                return result;
            }

            String customerName = ((c.FirstName != null ? c.FirstName : '') + ' ' + (c.LastName != null ? c.LastName : '')).trim();

            // Build session variables
            List<Map<String, String>> variables = new List<Map<String, String>>();
            addVariable(variables, 'customerId', String.valueOf(c.Id));
            addVariable(variables, 'customerEmail', c.Email);
            addVariable(variables, 'customerName', customerName);

            // Identity tier
            String identityTier = 'anonymous';
            if (c.Demo_Profile__c == 'Merkury') identityTier = 'appended';
            else if (String.isNotBlank(c.Email)) identityTier = 'known';
            addVariable(variables, 'identityTier', identityTier);

            // Build comprehensive customer context summary
            String contextSummary = buildCustomerContextSummary(c, contactId, customerName, identityTier);
            addVariable(variables, 'customerContext', contextSummary);

            // Individual fields (for backward compatibility with existing topics)
            if (String.isNotBlank(c.Skin_Type__c))
                addVariable(variables, 'skinType', c.Skin_Type__c);
            if (String.isNotBlank(c.Skin_Concerns__c))
                addVariable(variables, 'concerns', c.Skin_Concerns__c);
            if (String.isNotBlank(c.Preferred_Brands__c))
                addVariable(variables, 'recentPurchases', c.Preferred_Brands__c);

            // Loyalty
            try {
                String loyaltyQuery = 'SELECT MemberStatus FROM LoyaltyProgramMember'
                    + ' WHERE ContactId = \'' + String.escapeSingleQuotes(String.valueOf(c.Id)) + '\''
                    + ' LIMIT 1';
                List<SObject> members = Database.query(loyaltyQuery);
                if (!members.isEmpty()) {
                    String tierName = String.valueOf(members[0].get('MemberStatus'));
                    addVariable(variables, 'loyaltyTier', tierName != null ? tierName.toLowerCase() : 'bronze');
                }
            } catch (Exception e) { /* Loyalty may not be available */ }

            // Build request body
            Map<String, Object> body = new Map<String, Object>();
            body.put('externalSessionKey', 'lwc-' + String.valueOf(contactId) + '-' + String.valueOf(Datetime.now().getTime()));
            body.put('instanceConfig', new Map<String, Object>{
                'endpoint' => getInstanceUrl()
            });
            body.put('streamingCapabilities', new Map<String, Object>{
                'chunkTypes' => new List<String>{ 'Text' }
            });
            body.put('bypassUser', true);
            body.put('variables', variables);

            // Call API
            String endpoint = getBaseUrl() + '/agents/' + agentId + '/sessions';
            HttpRequest req = new HttpRequest();
            req.setEndpoint(endpoint);
            req.setMethod('POST');
            req.setHeader('Authorization', 'Bearer ' + accessToken);
            req.setHeader('Content-Type', 'application/json');
            req.setBody(JSON.serialize(body));
            req.setTimeout(30000);

            Http http = new Http();
            HttpResponse resp = http.send(req);

            if (resp.getStatusCode() == 200 || resp.getStatusCode() == 201) {
                Map<String, Object> respBody = (Map<String, Object>) JSON.deserializeUntyped(resp.getBody());
                result.sessionId = (String) respBody.get('sessionId');
                result.success = true;

                // Send automatic context message so the agent sees the customer profile
                // in the conversation (not just as unused session variables)
                String contextMsg;
                if (isClientelling) {
                    contextMsg = 'I am an in-store beauty rep starting a consultation. '
                        + 'Here is the customer profile I have on screen — use it to answer my questions:\n\n'
                        + contextSummary
                        + '\n\nPlease acknowledge you have this customer context and briefly greet me as a co-pilot ready to help with this consultation.';
                } else {
                    contextMsg = 'Here is my customer profile for personalization:\n\n'
                        + contextSummary
                        + '\n\nPlease greet me warmly as a beauty concierge and offer to help.';
                }

                String fallback = isClientelling
                    ? 'Co-pilot session started for ' + customerName + '. How can I help with this consultation?'
                    : 'Welcome! I\'m your beauty concierge. How can I help you today?';

                try {
                    MessageResult contextResp = sendMessageInternal(result.sessionId, contextMsg, 1, accessToken);
                    if (contextResp.success && String.isNotBlank(contextResp.message)) {
                        result.welcomeMessage = contextResp.message;
                    } else {
                        result.welcomeMessage = fallback;
                    }
                } catch (Exception contextErr) {
                    System.debug(LoggingLevel.WARN, 'Context injection failed: ' + contextErr.getMessage());
                    result.welcomeMessage = fallback;
                }
            } else {
                result.errorMessage = 'Session creation failed: HTTP ' + resp.getStatusCode()
                    + ' - ' + resp.getBody().left(500);
            }
        } catch (Exception e) {
            result.errorMessage = 'Error: ' + e.getMessage();
        }

        return result;
    }

    // ─── Send Message ────────────────────────────────────────────────

    @AuraEnabled
    public static MessageResult sendMessage(String sessionId, String message, Integer sequenceId) {
        String accessToken = getAccessToken();
        return sendMessageInternal(sessionId, message, sequenceId, accessToken);
    }

    private static MessageResult sendMessageInternal(String sessionId, String message, Integer sequenceId, String accessToken) {
        MessageResult result = new MessageResult();
        result.success = false;
        result.products = new List<ProductCard>();
        result.captures = new List<CaptureNotification>();
        result.suggestedActions = new List<String>();

        try {
            Map<String, Object> body = new Map<String, Object>();
            body.put('message', new Map<String, Object>{
                'sequenceId' => sequenceId,
                'type' => 'Text',
                'text' => message
            });

            String endpoint = getBaseUrl() + '/sessions/' + sessionId + '/messages';
            HttpRequest req = new HttpRequest();
            req.setEndpoint(endpoint);
            req.setMethod('POST');
            req.setHeader('Authorization', 'Bearer ' + accessToken);
            req.setHeader('Content-Type', 'application/json');
            req.setBody(JSON.serialize(body));
            req.setTimeout(60000);

            Http http = new Http();
            HttpResponse resp = http.send(req);

            if (resp.getStatusCode() == 200 || resp.getStatusCode() == 201) {
                Map<String, Object> respBody = (Map<String, Object>) JSON.deserializeUntyped(resp.getBody());

                // Extract message text from response
                String fullText = extractFullResponseText(respBody);

                // Parse UI directive from response
                Map<String, Object> directive = extractDirective(fullText);

                if (directive != null) {
                    // Extract action
                    result.action = (String) directive.get('action');

                    // Extract products
                    Map<String, Object> payload = directive.containsKey('payload')
                        ? (Map<String, Object>) directive.get('payload')
                        : directive;

                    if (payload.containsKey('products')) {
                        List<Object> products = (List<Object>) payload.get('products');
                        for (Object p : products) {
                            Map<String, Object> pm = (Map<String, Object>) p;
                            ProductCard card = new ProductCard();
                            card.productId = (String) pm.get('id');
                            card.name = (String) pm.get('name');
                            card.description = (String) pm.get('description');
                            card.price = pm.get('price') != null ? Decimal.valueOf(String.valueOf(pm.get('price'))) : null;
                            card.imageUrl = (String) pm.get('image');
                            card.brand = (String) pm.get('brand');
                            card.category = (String) pm.get('category');
                            result.products.add(card);
                        }
                    }

                    // Extract captures
                    if (payload.containsKey('captures')) {
                        List<Object> captures = (List<Object>) payload.get('captures');
                        for (Object cap : captures) {
                            Map<String, Object> cm = (Map<String, Object>) cap;
                            CaptureNotification cn = new CaptureNotification();
                            cn.captureType = (String) cm.get('type');
                            cn.label = (String) cm.get('label');
                            result.captures.add(cn);
                        }
                    }

                    // Extract suggested actions
                    if (payload.containsKey('suggestedActions')) {
                        List<Object> actions = (List<Object>) payload.get('suggestedActions');
                        for (Object a : actions) {
                            result.suggestedActions.add(String.valueOf(a));
                        }
                    }

                    // Extract prose text (before/after JSON block)
                    result.message = extractProseText(fullText);
                } else {
                    // No directive found — plain text response
                    result.message = fullText;
                }

                result.success = true;
            } else {
                result.errorMessage = 'Message failed: HTTP ' + resp.getStatusCode()
                    + ' - ' + resp.getBody().left(200);
            }
        } catch (Exception e) {
            result.errorMessage = 'Error: ' + e.getMessage();
        }

        return result;
    }

    // ─── End Session ─────────────────────────────────────────────────

    @AuraEnabled
    public static void endSession(String sessionId) {
        try {
            String accessToken = getAccessToken();
            String endpoint = getBaseUrl() + '/sessions/' + sessionId;

            HttpRequest req = new HttpRequest();
            req.setEndpoint(endpoint);
            req.setMethod('DELETE');
            req.setHeader('Authorization', 'Bearer ' + accessToken);
            req.setTimeout(15000);

            Http http = new Http();
            http.send(req);
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'AgentCopilotService.endSession: ' + e.getMessage());
        }
    }

    // ─── OAuth Token Management ──────────────────────────────────────

    // Simple in-memory cache (per transaction). For production, use Platform Cache.
    private static String cachedToken;

    private static String getAccessToken() {
        if (String.isNotBlank(cachedToken)) {
            return cachedToken;
        }

        // Read credentials from Custom Setting
        String clientId = '';
        String clientSecret = '';

        try {
            Agentforce_Config__c config = Agentforce_Config__c.getOrgDefaults();
            if (config != null) {
                clientId = config.Client_Id__c;
                clientSecret = config.Client_Secret__c;
            }
        } catch (Exception e) { /* Custom Setting may not exist yet */ }

        if (String.isBlank(clientId) || String.isBlank(clientSecret)) {
            throw new AuraHandledException('Agentforce credentials not configured. Set Agentforce_Config__c.');
        }

        String instanceUrl = getInstanceUrl();
        String tokenEndpoint = instanceUrl + '/services/oauth2/token';

        HttpRequest req = new HttpRequest();
        req.setEndpoint(tokenEndpoint);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');

        String body = 'grant_type=client_credentials'
            + '&client_id=' + EncodingUtil.urlEncode(clientId, 'UTF-8')
            + '&client_secret=' + EncodingUtil.urlEncode(clientSecret, 'UTF-8');
        req.setBody(body);
        req.setTimeout(15000);

        Http http = new Http();
        HttpResponse resp = http.send(req);

        if (resp.getStatusCode() == 200) {
            Map<String, Object> respBody = (Map<String, Object>) JSON.deserializeUntyped(resp.getBody());
            cachedToken = (String) respBody.get('access_token');
            return cachedToken;
        }

        throw new AuraHandledException('OAuth token request failed: HTTP ' + resp.getStatusCode());
    }

    // ─── Response Parsing Helpers ────────────────────────────────────

    private static String extractMessageText(Map<String, Object> msg) {
        if (msg.containsKey('message')) return (String) msg.get('message');
        if (msg.containsKey('text')) return (String) msg.get('text');
        if (msg.containsKey('content')) return (String) msg.get('content');
        return '';
    }

    private static String extractFullResponseText(Map<String, Object> respBody) {
        List<String> parts = new List<String>();

        // Try messages array
        if (respBody.containsKey('messages')) {
            List<Object> messages = (List<Object>) respBody.get('messages');
            for (Object m : messages) {
                Map<String, Object> msg = (Map<String, Object>) m;
                String text = extractMessageText(msg);
                if (String.isNotBlank(text)) parts.add(text);
            }
        }

        // Try responseMessages array
        if (parts.isEmpty() && respBody.containsKey('responseMessages')) {
            List<Object> messages = (List<Object>) respBody.get('responseMessages');
            for (Object m : messages) {
                Map<String, Object> msg = (Map<String, Object>) m;
                String text = extractMessageText(msg);
                if (String.isNotBlank(text)) parts.add(text);
            }
        }

        // Flat text fallback
        if (parts.isEmpty()) {
            if (respBody.containsKey('text')) parts.add((String) respBody.get('text'));
            else if (respBody.containsKey('response')) parts.add((String) respBody.get('response'));
        }

        return String.join(parts, ' ');
    }

    /**
     * Extract a JSON uiDirective block from the agent's text response.
     * The agent embeds JSON as { "uiDirective": {...} } or just { "action": "..." ... }
     * within its prose text.
     */
    private static Map<String, Object> extractDirective(String text) {
        if (String.isBlank(text)) return null;

        Integer braceStart = text.indexOf('{');
        if (braceStart < 0) return null;

        // Find matching closing brace (basic nesting support)
        Integer depth = 0;
        Integer braceEnd = -1;
        for (Integer i = braceStart; i < text.length(); i++) {
            String ch = text.substring(i, i + 1);
            if (ch == '{') depth++;
            else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    braceEnd = i;
                    break;
                }
            }
        }

        if (braceEnd < 0) return null;

        String jsonStr = text.substring(braceStart, braceEnd + 1);

        try {
            Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(jsonStr);

            // Unwrap uiDirective wrapper if present
            if (parsed.containsKey('uiDirective')) {
                return (Map<String, Object>) parsed.get('uiDirective');
            }

            // Check if it has action or recognizable directive structure
            if (parsed.containsKey('action') || parsed.containsKey('payload')
                || parsed.containsKey('products') || parsed.containsKey('captures')) {
                return parsed;
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'AgentCopilotService: Failed to parse directive JSON: ' + e.getMessage());
        }

        return null;
    }

    /**
     * Extract the prose text before/after a JSON block in the agent response.
     */
    private static String extractProseText(String text) {
        if (String.isBlank(text)) return '';

        Integer braceStart = text.indexOf('{');
        if (braceStart < 0) return text;

        // Find matching closing brace
        Integer depth = 0;
        Integer braceEnd = -1;
        for (Integer i = braceStart; i < text.length(); i++) {
            String ch = text.substring(i, i + 1);
            if (ch == '{') depth++;
            else if (ch == '}') {
                depth--;
                if (depth == 0) {
                    braceEnd = i;
                    break;
                }
            }
        }

        if (braceEnd < 0) braceEnd = text.length() - 1;

        String before = braceStart > 0 ? text.substring(0, braceStart).trim() : '';
        String after = braceEnd < text.length() - 1 ? text.substring(braceEnd + 1).trim() : '';

        List<String> parts = new List<String>();
        if (String.isNotBlank(before)) parts.add(before);
        if (String.isNotBlank(after)) parts.add(after);

        return parts.isEmpty() ? '' : String.join(parts, ' ');
    }

    // ─── Customer Context Builder ─────────────────────────────────

    private static String buildCustomerContextSummary(Contact c, Id contactId, String customerName, String identityTier) {
        List<String> ctx = new List<String>();
        ctx.add('CUSTOMER PROFILE: ' + customerName);
        ctx.add('Identity Tier: ' + identityTier);
        if (String.isNotBlank(c.Clientelling_Tier__c))
            ctx.add('Clientelling Tier: ' + c.Clientelling_Tier__c);

        // 1P Declared beauty profile
        List<String> beauty = new List<String>();
        if (String.isNotBlank(c.Skin_Type__c)) beauty.add('Skin Type: ' + c.Skin_Type__c);
        if (String.isNotBlank(c.Skin_Concerns__c)) beauty.add('Concerns: ' + c.Skin_Concerns__c);
        if (String.isNotBlank(c.Allergies__c)) beauty.add('Allergies: ' + c.Allergies__c);
        if (String.isNotBlank(c.Beauty_Priority__c)) beauty.add('Beauty Priority: ' + c.Beauty_Priority__c);
        if (String.isNotBlank(c.Preferred_Brands__c)) beauty.add('Preferred Brands: ' + c.Preferred_Brands__c);
        if (String.isNotBlank(c.Price_Range__c)) beauty.add('Price Range: ' + c.Price_Range__c);
        if (String.isNotBlank(c.Sustainability_Preference__c)) beauty.add('Sustainability: ' + c.Sustainability_Preference__c);
        if (String.isNotBlank(c.Climate_Context__c)) beauty.add('Climate: ' + c.Climate_Context__c);
        if (!beauty.isEmpty()) {
            ctx.add('--- BEAUTY PROFILE (declared) ---');
            ctx.addAll(beauty);
        }

        // Recent orders
        try {
            List<Order> orders = [
                SELECT OrderNumber, EffectiveDate, TotalAmount, Status,
                       (SELECT Product2.Name, Quantity, UnitPrice FROM OrderItems LIMIT 5)
                FROM Order
                WHERE AccountId IN (SELECT AccountId FROM Contact WHERE Id = :contactId)
                ORDER BY EffectiveDate DESC LIMIT 3
            ];
            if (!orders.isEmpty()) {
                ctx.add('--- RECENT ORDERS ---');
                for (Order o : orders) {
                    String orderLine = o.OrderNumber + ' (' + String.valueOf(o.EffectiveDate) + ', $' + o.TotalAmount + ', ' + o.Status + ')';
                    List<String> items = new List<String>();
                    if (o.OrderItems != null) {
                        for (OrderItem oi : o.OrderItems) {
                            items.add(oi.Product2.Name);
                        }
                    }
                    if (!items.isEmpty()) orderLine += ' — Products: ' + String.join(items, ', ');
                    ctx.add(orderLine);
                }
            }
        } catch (Exception e) { /* Orders may not be available */ }

        // Meaningful events
        try {
            List<SObject> events = Database.query(
                'SELECT Event_Type__c, Event_Detail__c, CreatedDate FROM Meaningful_Event__c'
                + ' WHERE Contact__c = \'' + String.escapeSingleQuotes(String.valueOf(contactId)) + '\''
                + ' ORDER BY CreatedDate DESC LIMIT 5'
            );
            if (!events.isEmpty()) {
                ctx.add('--- KEY EVENTS ---');
                for (SObject ev : events) {
                    String evType = (String) ev.get('Event_Type__c');
                    String evDetail = (String) ev.get('Event_Detail__c');
                    ctx.add(evType + ': ' + (evDetail != null ? evDetail : ''));
                }
            }
        } catch (Exception e) { /* Meaningful events may not exist */ }

        // Agent-captured profile fields
        try {
            List<SObject> captured = Database.query(
                'SELECT Field_Label__c, Captured_Value__c, Confidence__c FROM Agent_Captured_Profile__c'
                + ' WHERE Contact__c = \'' + String.escapeSingleQuotes(String.valueOf(contactId)) + '\''
                + ' ORDER BY CreatedDate DESC LIMIT 10'
            );
            if (!captured.isEmpty()) {
                ctx.add('--- AGENT-CAPTURED NOTES ---');
                for (SObject cap : captured) {
                    String label = (String) cap.get('Field_Label__c');
                    String val = (String) cap.get('Captured_Value__c');
                    ctx.add(label + ': ' + (val != null ? val : ''));
                }
            }
        } catch (Exception e) { /* Agent captured profile may not exist */ }

        // Loyalty — include full details so the agent can reference them
        try {
            List<SObject> members = Database.query(
                'SELECT Id, MemberStatus, TotalPointsAccrued, TotalPointsRedeemed, EnrollmentDate,'
                + ' CurrentTierExpirationDate'
                + ' FROM LoyaltyProgramMember'
                + ' WHERE ContactId = \'' + String.escapeSingleQuotes(String.valueOf(contactId)) + '\''
                + ' LIMIT 1'
            );
            if (!members.isEmpty()) {
                SObject m = members[0];
                String tier = (String) m.get('MemberStatus');
                Decimal accrued = (Decimal) m.get('TotalPointsAccrued');
                Decimal redeemed = (Decimal) m.get('TotalPointsRedeemed');
                Decimal balance = (accrued != null ? accrued : 0) - (redeemed != null ? redeemed : 0);
                Date enrollDate = (Date) m.get('EnrollmentDate');
                Date tierExpiry = (Date) m.get('CurrentTierExpirationDate');

                String tierName = tier != null ? tier : 'Unknown';
                ctx.add('--- LOYALTY ---');
                ctx.add('Tier: ' + tierName);
                ctx.add('Points Balance: ' + String.valueOf(balance.intValue()) + ' points');
                ctx.add('Lifetime Points Earned: ' + String.valueOf(accrued != null ? accrued.intValue() : 0));
                if (enrollDate != null)
                    ctx.add('Member Since: ' + String.valueOf(enrollDate));
                if (tierExpiry != null)
                    ctx.add('Tier Renewal Date: ' + String.valueOf(tierExpiry));

                // Query vouchers if available
                try {
                    List<SObject> vouchers = Database.query(
                        'SELECT Name, Description, Status, EffectiveDate, ExpiryDate, FaceValue, Type'
                        + ' FROM Voucher'
                        + ' WHERE LoyaltyProgramMemberId = \'' + String.escapeSingleQuotes(String.valueOf(m.get('Id'))) + '\''
                        + ' AND Status = \'Issued\''
                        + ' ORDER BY ExpiryDate ASC LIMIT 5'
                    );
                    if (!vouchers.isEmpty()) {
                        ctx.add('Available Vouchers/Offers:');
                        for (SObject v : vouchers) {
                            String vName = (String) v.get('Name');
                            String vDesc = (String) v.get('Description');
                            Date vExpiry = (Date) v.get('ExpiryDate');
                            Decimal faceVal = (Decimal) v.get('FaceValue');
                            String entry = '  - ' + (vName != null ? vName : 'Voucher');
                            if (vDesc != null) entry += ': ' + vDesc;
                            if (faceVal != null) entry += ' ($' + faceVal + ' value)';
                            if (vExpiry != null) entry += ' — expires ' + String.valueOf(vExpiry);
                            ctx.add(entry);
                        }
                    }
                } catch (Exception ve) { /* Voucher object may not exist */ }

                // Tier-based benefits (always available as reference for the agent)
                ctx.add('Tier Benefits:');
                String tierLower = tierName.toLowerCase();
                if (tierLower == 'gold' || tierLower == 'platinum') {
                    ctx.add('  - Free deluxe sample with purchases over $75');
                    ctx.add('  - 2x points on skincare purchases');
                    ctx.add('  - Early access to new product launches');
                    ctx.add('  - Complimentary gift wrapping');
                    if (tierLower == 'platinum') {
                        ctx.add('  - Free shipping on all orders');
                        ctx.add('  - Annual birthday gift set');
                        ctx.add('  - Priority booking for consultations');
                    }
                } else if (tierLower == 'silver') {
                    ctx.add('  - Free sample with purchases over $100');
                    ctx.add('  - 1.5x points on skincare purchases');
                    ctx.add('  - Birthday discount (15% off)');
                } else {
                    ctx.add('  - Earn 1 point per $1 spent');
                    ctx.add('  - Birthday discount (10% off)');
                    ctx.add('  - ' + String.valueOf(balance.intValue()) + ' points from next tier perks');
                }
            }
        } catch (Exception e) { /* Loyalty may not be available */ }

        // Consultation notes
        try {
            List<SObject> notes = Database.query(
                'SELECT Note_Type__c, Note_Text__c, CreatedDate FROM Consultation_Note__c'
                + ' WHERE Contact__c = \'' + String.escapeSingleQuotes(String.valueOf(contactId)) + '\''
                + ' ORDER BY CreatedDate DESC LIMIT 5'
            );
            if (!notes.isEmpty()) {
                ctx.add('--- PREVIOUS CONSULTATION NOTES ---');
                for (SObject n : notes) {
                    String nType = (String) n.get('Note_Type__c');
                    String nText = (String) n.get('Note_Text__c');
                    ctx.add('[' + (nType != null ? nType : 'Note') + '] ' + (nText != null ? nText : ''));
                }
            }
        } catch (Exception e) { /* Consultation notes may not exist */ }

        // For Merkury-appended customers: translated recommendations (never raw 3P data)
        if (c.Demo_Profile__c == 'Merkury' && String.isNotBlank(c.Merkury_Id__c)) {
            try {
                ClientellingProfileService.MerkuryArchetype arch = null;
                for (ClientellingProfileService.MerkuryArchetype a : ClientellingProfileService.getMerkuryArchetypes()) {
                    if (a.merkuryPid == c.Merkury_Id__c) { arch = a; break; }
                }
                if (arch != null) {
                    ctx.add('--- STAFF RECOMMENDATIONS (for this customer profile) ---');
                    // Translate price tier to brand suggestions
                    String tier = arch.priceTier != null ? arch.priceTier.toLowerCase() : '';
                    if (tier == 'luxury') ctx.add('Recommended brands: LUMIERE, MAISON (premium tier customer)');
                    else if (tier == 'premium') ctx.add('Recommended brands: LUMIERE, BOTANICA');
                    else if (tier == 'mid-range') ctx.add('Recommended brands: BOTANICA, MAISON');
                    else ctx.add('Recommended brands: SERENE, BOTANICA (value-focused)');
                    // Translate concerns to categories
                    if (String.isNotBlank(arch.concerns)) {
                        ctx.add('Focus categories: ' + arch.concerns.replaceAll(';', ', '));
                    }
                    if (arch.interests != null && !arch.interests.isEmpty()) {
                        ctx.add('Lifestyle: ' + String.join(arch.interests, ', '));
                    }
                }
            } catch (Exception e) { /* Merkury lookup failed */ }
        }

        return String.join(ctx, '\n');
    }

    private static void addVariable(List<Map<String, String>> variables, String name, String value) {
        if (String.isNotBlank(value)) {
            variables.add(new Map<String, String>{
                'name' => name,
                'type' => 'Text',
                'value' => value
            });
        }
    }
}
