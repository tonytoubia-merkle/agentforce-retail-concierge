/**
 * CaptureKeyEventsService - Simplified invocable action for Agentforce.
 * Matches the ProductCatalogService pattern (List<String> return, optional inputs)
 * to ensure compatibility with the Agentforce planner.
 *
 * Enhanced with temporal context parsing for journey orchestration:
 * - Accepts relative time expressions ("in two weeks", "next month")
 * - Calculates actual event dates
 * - Sets urgency levels for journey timing
 */
global with sharing class CaptureKeyEventsService {

    public class EventExtractionRequest {
        @InvocableVariable(required=false label='Customer ID')
        public String customerId;

        @InvocableVariable(required=false label='Session ID')
        public String sessionId;

        @InvocableVariable(required=false label='Conversation Transcript')
        public String conversationTranscript;

        @InvocableVariable(required=false label='Event Type')
        public String eventType;

        @InvocableVariable(required=false label='Event Description')
        public String eventDescription;

        // Temporal context for journey timing
        @InvocableVariable(required=false label='When (relative time)')
        public String relativeTimeExpression; // "in two weeks", "next month", "this Saturday"

        @InvocableVariable(required=false label='Event Date')
        public Date eventDate; // Explicit date if agent captured it

        @InvocableVariable(required=false label='Agent Note')
        public String agentNote;

        @InvocableVariable(required=false label='Event End Date')
        public Date eventEndDate; // Expected end date for time-bound events (trips, projects)
    }

    @InvocableMethod(label='Capture Key Events' description='Extracts and stores meaningful events from conversation content with temporal context')
    public static List<String> captureKeyEvents(List<EventExtractionRequest> requests) {
        List<String> results = new List<String>();

        for (EventExtractionRequest req : requests) {
            Map<String, Object> result = new Map<String, Object>();
            try {
                List<Map<String, Object>> events = new List<Map<String, Object>>();

                if (String.isNotBlank(req.eventType) && String.isNotBlank(req.eventDescription)) {
                    // Parse temporal context from relative expression, explicit date, or description
                    TemporalContext temporal = parseTemporalContext(
                        req.relativeTimeExpression,
                        req.eventDate,
                        req.eventDescription
                    );

                    // Always persist the event — use customerId/sessionId if available,
                    // fall back to defaults so the event is never silently dropped.
                    String custId = String.isNotBlank(req.customerId) ? req.customerId : 'unknown';
                    String sessId = String.isNotBlank(req.sessionId) ? req.sessionId : 'agent-session';
                    DataCloudProfileService.writeMeaningfulEventEnhanced(
                        custId, sessId,
                        req.eventType, req.eventDescription,
                        req.agentNote, null,
                        temporal.relativeText,
                        temporal.eventDate,
                        temporal.urgency,
                        req.eventEndDate
                    );

                    Map<String, Object> event = new Map<String, Object>();
                    event.put('eventType', req.eventType);
                    event.put('description', req.eventDescription);
                    event.put('eventDate', temporal.eventDate);
                    event.put('relativeTime', temporal.relativeText);
                    event.put('urgency', temporal.urgency);
                    event.put('daysUntil', temporal.daysUntil);
                    events.add(event);
                } else if (String.isNotBlank(req.conversationTranscript)) {
                    events = extractEventsFromTextEnhanced(req.conversationTranscript);
                    // Always persist extracted events — use customerId/sessionId if available
                    String custId = String.isNotBlank(req.customerId) ? req.customerId : 'unknown';
                    String sessId = String.isNotBlank(req.sessionId) ? req.sessionId : 'agent-session';
                    for (Map<String, Object> event : events) {
                        TemporalContext temporal = (TemporalContext) event.get('temporal');
                        DataCloudProfileService.writeMeaningfulEventEnhanced(
                            custId, sessId,
                            (String) event.get('eventType'),
                            (String) event.get('description'),
                            (String) event.get('agentNote'),
                            null,
                            temporal != null ? temporal.relativeText : null,
                            temporal != null ? temporal.eventDate : null,
                            temporal != null ? temporal.urgency : 'No Date'
                        );
                    }
                }

                result.put('success', true);
                result.put('eventsExtracted', events.size());
                result.put('events', events);
            } catch (Exception e) {
                result.put('success', false);
                result.put('error', e.getMessage());
            }
            results.add(JSON.serialize(result));
        }

        return results;
    }

    // ─── Temporal Context Parsing ────────────────────────────────────────

    public class TemporalContext {
        public String relativeText;
        public Date eventDate;
        public String urgency;
        public Integer daysUntil;
    }

    public static TemporalContext parseTemporalContext(String relativeTimeExpr, Date explicitDate, String description) {
        TemporalContext ctx = new TemporalContext();
        Date today = Date.today();

        // If explicit date provided, use it directly
        if (explicitDate != null) {
            ctx.eventDate = explicitDate;
            ctx.daysUntil = today.daysBetween(explicitDate);
            ctx.urgency = calculateUrgency(ctx.daysUntil);
            ctx.relativeText = relativeTimeExpr;
            return ctx;
        }

        // Try to parse relative time expression first, then description
        String textToParse = String.isNotBlank(relativeTimeExpr) ? relativeTimeExpr : description;
        if (String.isBlank(textToParse)) {
            ctx.urgency = 'No Date';
            return ctx;
        }

        String lower = textToParse.toLowerCase();
        ctx.relativeText = extractRelativeTimePhrase(lower);

        Integer daysToAdd = parseRelativeTimeToDays(lower);
        if (daysToAdd != null) {
            ctx.eventDate = today.addDays(daysToAdd);
            ctx.daysUntil = daysToAdd;
            ctx.urgency = calculateUrgency(daysToAdd);
        } else {
            ctx.urgency = 'No Date';
        }

        return ctx;
    }

    private static String extractRelativeTimePhrase(String text) {
        if (text.contains('in two weeks')) return 'in two weeks';
        if (text.contains('in 2 weeks')) return 'in 2 weeks';
        if (text.contains('in a week')) return 'in a week';
        if (text.contains('in one week')) return 'in one week';
        if (text.contains('in a month')) return 'in a month';
        if (text.contains('in one month')) return 'in one month';
        if (text.contains('next week')) return 'next week';
        if (text.contains('next month')) return 'next month';
        if (text.contains('this weekend')) return 'this weekend';
        if (text.contains('tomorrow')) return 'tomorrow';
        if (text.contains('in a few days')) return 'in a few days';
        if (text.contains('next saturday')) return 'next Saturday';
        if (text.contains('next sunday')) return 'next Sunday';

        for (Integer i = 1; i <= 12; i++) {
            String numWord = numberToWord(i);
            if (text.contains('in ' + numWord + ' days')) return 'in ' + numWord + ' days';
            if (text.contains('in ' + numWord + ' weeks')) return 'in ' + numWord + ' weeks';
            if (text.contains('in ' + numWord + ' months')) return 'in ' + numWord + ' months';
            if (text.contains('in ' + i + ' days')) return 'in ' + i + ' days';
            if (text.contains('in ' + i + ' weeks')) return 'in ' + i + ' weeks';
            if (text.contains('in ' + i + ' months')) return 'in ' + i + ' months';
        }

        return null;
    }

    private static Integer parseRelativeTimeToDays(String text) {
        if (text.contains('tomorrow')) return 1;
        if (text.contains('in a few days') || text.contains('few days')) return 3;
        if (text.contains('this weekend') || text.contains('this saturday')) return daysUntilDayOfWeek(6);
        if (text.contains('this sunday')) return daysUntilDayOfWeek(0);
        if (text.contains('next week') || text.contains('in a week') || text.contains('in one week')) return 7;
        if (text.contains('next saturday') || text.contains('next weekend')) return daysUntilDayOfWeek(6) + 7;
        if (text.contains('next sunday')) return daysUntilDayOfWeek(0) + 7;
        if (text.contains('in two weeks') || text.contains('in 2 weeks')) return 14;
        if (text.contains('in three weeks') || text.contains('in 3 weeks')) return 21;
        if (text.contains('next month') || text.contains('in a month') || text.contains('in one month')) return 30;
        if (text.contains('in two months') || text.contains('in 2 months')) return 60;

        for (Integer i = 1; i <= 12; i++) {
            String numWord = numberToWord(i);
            if (text.contains('in ' + numWord + ' days') || text.contains('in ' + i + ' days')) return i;
            if (text.contains('in ' + numWord + ' weeks') || text.contains('in ' + i + ' weeks')) return i * 7;
            if (text.contains('in ' + numWord + ' months') || text.contains('in ' + i + ' months')) return i * 30;
        }

        return null;
    }

    private static Integer daysUntilDayOfWeek(Integer targetDay) {
        Date today = Date.today();
        Date startOfWeek = today.toStartOfWeek();
        Integer currentDayOfWeek = Math.mod(startOfWeek.daysBetween(today) + 1, 7);
        Integer daysUntil = targetDay - currentDayOfWeek;
        if (daysUntil <= 0) daysUntil += 7;
        return daysUntil;
    }

    private static String numberToWord(Integer num) {
        Map<Integer, String> words = new Map<Integer, String>{
            1 => 'one', 2 => 'two', 3 => 'three', 4 => 'four', 5 => 'five',
            6 => 'six', 7 => 'seven', 8 => 'eight', 9 => 'nine', 10 => 'ten',
            11 => 'eleven', 12 => 'twelve'
        };
        return words.get(num);
    }

    private static String calculateUrgency(Integer daysUntil) {
        if (daysUntil == null) return 'No Date';
        if (daysUntil <= 3) return 'Immediate';
        if (daysUntil <= 7) return 'This Week';
        if (daysUntil <= 30) return 'This Month';
        return 'Future';
    }

    // ─── Enhanced Event Extraction ───────────────────────────────────────

    private static List<Map<String, Object>> extractEventsFromTextEnhanced(String text) {
        List<Map<String, Object>> events = new List<Map<String, Object>>();
        String lower = text.toLowerCase();

        // Life events — specific types for segment targeting
        if (lower.contains('anniversary')) events.add(createEventEnhanced('Anniversary', 'Mentioned an upcoming anniversary', 'May be looking for gifts', lower));
        if (lower.contains('birthday')) events.add(createEventEnhanced('Birthday', 'Mentioned a birthday', 'Potential gifting opportunity', lower));
        if (lower.contains('wedding')) events.add(createEventEnhanced('Wedding', 'Mentioned a wedding', 'May need special occasion products', lower));
        if (lower.contains('pregnant') || lower.contains('baby') || lower.contains('expecting')) events.add(createEventEnhanced('Maternity', 'Mentioned pregnancy or new baby', 'May need pregnancy-safe products', lower));
        if (lower.contains('moving') || lower.contains('new home') || lower.contains('relocat')) events.add(createEventEnhanced('Relocation', 'Mentioned moving or relocation', 'Climate change may affect skin', lower));
        if (lower.contains('trip') || lower.contains('vacation') || lower.contains('flying') || lower.contains('travel')) events.add(createEventEnhanced('Travel', 'Has upcoming travel plans', 'May need travel-size products or SPF', lower));
        if (lower.contains('graduat') || lower.contains('commencement')) events.add(createEventEnhanced('Graduation', 'Mentioned a graduation', 'Potential gifting or celebration opportunity', lower));
        if (lower.contains('new job') || lower.contains('promotion') || lower.contains('career change')) events.add(createEventEnhanced('Career', 'Mentioned a career change', 'Lifestyle shift may affect needs', lower));

        // Note: Preferences, concerns, intents, and milestones are captured
        // separately by the Profile Enrichment system, not as meaningful events.

        return events;
    }

    private static Map<String, Object> createEventEnhanced(String eventType, String description, String agentNote, String textForTemporal) {
        Map<String, Object> event = new Map<String, Object>();
        event.put('eventType', eventType);
        event.put('description', description);
        event.put('agentNote', agentNote);

        if (String.isNotBlank(textForTemporal)) {
            TemporalContext temporal = parseTemporalContext(null, null, textForTemporal);
            event.put('temporal', temporal);
            event.put('eventDate', temporal.eventDate);
            event.put('relativeTime', temporal.relativeText);
            event.put('urgency', temporal.urgency);
        }

        return event;
    }

    // Legacy method for backward compatibility
    private static Map<String, String> createEvent(String eventType, String description, String agentNote) {
        Map<String, String> event = new Map<String, String>();
        event.put('eventType', eventType);
        event.put('description', description);
        event.put('agentNote', agentNote);
        return event;
    }

    // ─── Skincare Concern Video Capture ──────────────────────────────────
    // Creates a Meaningful_Event__c with type 'skincare-video'.
    // This event type is NOT in the JourneyBatchProcessor exclusion filter,
    // so it will be picked up and routed through the video journey pipeline.
    // Portfolio assignment handles VIP routing (Customer_Value_Score__c >= 80).

    @AuraEnabled
    public static Map<String, Object> captureSkinConcernForVideo(
        String contactId,
        String skinConcern,
        String agentNote
    ) {
        Map<String, Object> result = new Map<String, Object>();

        try {
            if (String.isBlank(contactId) || String.isBlank(skinConcern)) {
                result.put('success', false);
                result.put('error', 'Contact ID and skin concern are required');
                return result;
            }

            // Look up tier for informational purposes (no gate)
            String tierName = getLoyaltyTierName(contactId);

            // Create Meaningful_Event__c with skincare-video type
            DataCloudProfileService.writeMeaningfulEventEnhanced(
                contactId,
                'skincare-video-capture',
                'skincare-video',
                skinConcern,
                String.isNotBlank(agentNote) ? agentNote : 'Skincare concern captured — personalized video journey triggered',
                null,
                null,
                Date.today(),
                'Immediate',
                null
            );

            result.put('success', true);
            result.put('tier', tierName);
            result.put('message', 'Skincare concern captured. Video journey will be generated.');
        } catch (Exception e) {
            result.put('success', false);
            result.put('error', e.getMessage());
        }

        return result;
    }

    private static String getLoyaltyTierName(String contactId) {
        try {
            // Get the LoyaltyProgramMember for this contact first
            List<LoyaltyProgramMember> members = [
                SELECT Id FROM LoyaltyProgramMember
                WHERE ContactId = :contactId
                LIMIT 1
            ];
            if (members.isEmpty()) return null;

            List<LoyaltyMemberTier> tiers = [
                SELECT LoyaltyTier.Name
                FROM LoyaltyMemberTier
                WHERE LoyaltyMemberId = :members[0].Id
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];
            return tiers.isEmpty() ? null : tiers[0].LoyaltyTier.Name;
        } catch (Exception e) {
            return null;
        }
    }
}
