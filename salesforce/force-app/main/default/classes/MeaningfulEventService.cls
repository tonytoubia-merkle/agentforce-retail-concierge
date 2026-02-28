/**
 * MeaningfulEventService - Invocable Apex action for extracting and storing
 * meaningful events from conversations. Called by Agentforce topics during
 * or after conversations.
 *
 * Meaningful events include: Travel, Wedding, Maternity, Birthday, Anniversary,
 * Relocation, Graduation, Career, Other, Intent, Concern, Preference, Milestone.
 * These are persisted to Data Cloud for future personalization.
 *
 * Enhanced with temporal parsing for journey orchestration:
 * - Extracts relative time expressions ("in two weeks", "next month")
 * - Calculates actual event dates
 * - Sets urgency levels for journey timing
 */
global with sharing class MeaningfulEventService {

    public class EventExtractionRequest {
        @InvocableVariable(required=true label='Customer ID')
        public String customerId;

        @InvocableVariable(required=true label='Session ID')
        public String sessionId;

        @InvocableVariable(required=false label='Conversation Transcript')
        public String conversationTranscript;

        @InvocableVariable(required=false label='Single User Message')
        public String userMessage;

        @InvocableVariable(required=false label='Event Type')
        public String eventType; // preference, milestone, life-event, concern, intent

        @InvocableVariable(required=false label='Event Description')
        public String eventDescription;

        @InvocableVariable(required=false label='Agent Note')
        public String agentNote;

        // New: Temporal context from agent
        @InvocableVariable(required=false label='Relative Time Expression')
        public String relativeTimeExpression; // "in two weeks", "next month", "this Saturday"

        @InvocableVariable(required=false label='Event Date (if known)')
        public Date eventDate; // Explicit date if agent captured it directly

        @InvocableVariable(required=false label='Event End Date')
        public Date eventEndDate; // Expected end date for time-bound events (trips, projects)
    }

    public class EventExtractionResult {
        @InvocableVariable
        public Boolean success;

        @InvocableVariable
        public String eventsJson;

        @InvocableVariable
        public Integer eventsExtracted;

        @InvocableVariable
        public String errorMessage;

        @InvocableVariable
        public Id eventRecordId; // The created Meaningful_Event__c Id

        @InvocableVariable
        public Date calculatedEventDate; // The parsed/calculated event date

        @InvocableVariable
        public String urgency; // Immediate, This Week, This Month, Future, No Date
    }

    /**
     * Temporal parsing result container
     */
    public class TemporalContext {
        public String relativeText;
        public Date eventDate;
        public String urgency;
        public Integer daysUntil;
    }

    @InvocableMethod(label='Extract Meaningful Events' description='Extracts and stores meaningful events from conversation content with temporal context')
    public static List<EventExtractionResult> extractMeaningfulEvents(List<EventExtractionRequest> requests) {
        List<EventExtractionResult> results = new List<EventExtractionResult>();

        for (EventExtractionRequest req : requests) {
            EventExtractionResult result = new EventExtractionResult();
            try {
                List<Map<String, Object>> events = new List<Map<String, Object>>();

                // If a specific event was provided directly, store it with temporal context
                if (String.isNotBlank(req.eventType) && String.isNotBlank(req.eventDescription)) {

                    // Parse temporal context
                    TemporalContext temporal = parseTemporalContext(
                        req.relativeTimeExpression,
                        req.eventDate,
                        req.eventDescription
                    );

                    // Use enhanced write method with temporal fields
                    Id recordId = DataCloudProfileService.writeMeaningfulEventEnhanced(
                        req.customerId, req.sessionId,
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

                    result.eventRecordId = recordId;
                    result.calculatedEventDate = temporal.eventDate;
                    result.urgency = temporal.urgency;
                }
                // Otherwise, extract events from transcript or message
                else {
                    String textToAnalyze = String.isNotBlank(req.userMessage)
                        ? req.userMessage : req.conversationTranscript;

                    if (String.isNotBlank(textToAnalyze)) {
                        List<Map<String, Object>> extractedEvents = extractEventsFromTextEnhanced(textToAnalyze);

                        for (Map<String, Object> event : extractedEvents) {
                            TemporalContext temporal = (TemporalContext) event.get('temporal');

                            DataCloudProfileService.writeMeaningfulEventEnhanced(
                                req.customerId, req.sessionId,
                                (String) event.get('eventType'),
                                (String) event.get('description'),
                                (String) event.get('agentNote'),
                                null,
                                temporal != null ? temporal.relativeText : null,
                                temporal != null ? temporal.eventDate : null,
                                temporal != null ? temporal.urgency : 'No Date'
                            );

                            events.add(event);
                        }
                    }
                }

                result.success = true;
                result.eventsExtracted = events.size();
                result.eventsJson = JSON.serialize(events);
            } catch (Exception e) {
                result.success = false;
                result.errorMessage = e.getMessage();
                result.eventsExtracted = 0;
            }
            results.add(result);
        }

        return results;
    }

    /**
     * Parse temporal context from relative time expressions.
     * Handles phrases like "in two weeks", "next month", "this Saturday", etc.
     */
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

        // Try to parse relative time expression
        String textToParse = String.isNotBlank(relativeTimeExpr) ? relativeTimeExpr : description;
        if (String.isBlank(textToParse)) {
            ctx.urgency = 'No Date';
            return ctx;
        }

        String lower = textToParse.toLowerCase();
        ctx.relativeText = extractRelativeTimePhrase(lower);

        // Parse relative time patterns
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

    /**
     * Extract the relative time phrase from text for storage
     */
    private static String extractRelativeTimePhrase(String text) {
        // Common patterns to extract
        List<String> patterns = new List<String>{
            'in (\\w+) (day|days|week|weeks|month|months)',
            'next (week|month|saturday|sunday|monday|tuesday|wednesday|thursday|friday)',
            'this (week|weekend|saturday|sunday|monday|tuesday|wednesday|thursday|friday)',
            'tomorrow',
            'in a (week|month|few days)',
            '(\\d+) (day|days|week|weeks|month|months) (from now|away)'
        };

        // Simple substring extraction for common phrases
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

        // Numeric patterns
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

    /**
     * Parse relative time expressions and return days from now
     */
    private static Integer parseRelativeTimeToDays(String text) {
        // Tomorrow
        if (text.contains('tomorrow')) return 1;

        // In a few days
        if (text.contains('in a few days') || text.contains('few days')) return 3;

        // This weekend (assume Saturday)
        if (text.contains('this weekend') || text.contains('this saturday')) {
            return daysUntilDayOfWeek(6); // Saturday = 6
        }
        if (text.contains('this sunday')) {
            return daysUntilDayOfWeek(0); // Sunday = 0
        }

        // Next week (7 days)
        if (text.contains('next week') || text.contains('in a week') || text.contains('in one week')) return 7;

        // Next weekend / next Saturday
        if (text.contains('next saturday') || text.contains('next weekend')) {
            return daysUntilDayOfWeek(6) + 7;
        }
        if (text.contains('next sunday')) {
            return daysUntilDayOfWeek(0) + 7;
        }

        // Two weeks
        if (text.contains('in two weeks') || text.contains('in 2 weeks')) return 14;

        // Three weeks
        if (text.contains('in three weeks') || text.contains('in 3 weeks')) return 21;

        // A month
        if (text.contains('next month') || text.contains('in a month') || text.contains('in one month')) return 30;

        // Two months
        if (text.contains('in two months') || text.contains('in 2 months')) return 60;

        // Parse numeric patterns: "in X days/weeks/months"
        for (Integer i = 1; i <= 12; i++) {
            String numWord = numberToWord(i);

            // Days
            if (text.contains('in ' + numWord + ' days') || text.contains('in ' + i + ' days')) {
                return i;
            }
            // Weeks
            if (text.contains('in ' + numWord + ' weeks') || text.contains('in ' + i + ' weeks')) {
                return i * 7;
            }
            // Months
            if (text.contains('in ' + numWord + ' months') || text.contains('in ' + i + ' months')) {
                return i * 30;
            }
        }

        return null;
    }

    /**
     * Calculate days until a specific day of week (0=Sunday, 6=Saturday)
     */
    private static Integer daysUntilDayOfWeek(Integer targetDay) {
        Date today = Date.today();
        // Apex Date.toStartOfWeek() returns the Monday of the week
        // We need to calculate the day of week differently
        Date startOfWeek = today.toStartOfWeek();
        Integer currentDayOfWeek = startOfWeek.daysBetween(today);
        // Adjust for Sunday = 0 convention (Apex uses Monday = 0)
        currentDayOfWeek = Math.mod(currentDayOfWeek + 1, 7);

        Integer daysUntil = targetDay - currentDayOfWeek;
        if (daysUntil <= 0) {
            daysUntil += 7;
        }
        return daysUntil;
    }

    /**
     * Convert number to word (1-12)
     */
    private static String numberToWord(Integer num) {
        Map<Integer, String> words = new Map<Integer, String>{
            1 => 'one', 2 => 'two', 3 => 'three', 4 => 'four', 5 => 'five',
            6 => 'six', 7 => 'seven', 8 => 'eight', 9 => 'nine', 10 => 'ten',
            11 => 'eleven', 12 => 'twelve'
        };
        return words.get(num);
    }

    /**
     * Calculate urgency level based on days until event
     */
    private static String calculateUrgency(Integer daysUntil) {
        if (daysUntil == null) return 'No Date';
        if (daysUntil <= 3) return 'Immediate';
        if (daysUntil <= 7) return 'This Week';
        if (daysUntil <= 30) return 'This Month';
        return 'Future';
    }

    /**
     * Extract meaningful events from text using keyword/pattern matching.
     * Enhanced version that also extracts temporal context.
     */
    private static List<Map<String, Object>> extractEventsFromTextEnhanced(String text) {
        List<Map<String, Object>> events = new List<Map<String, Object>>();
        String lower = text.toLowerCase();

        // Life events — specific types for segment targeting
        if (lower.contains('anniversary')) {
            events.add(createEventEnhanced('Anniversary', 'Mentioned an upcoming anniversary', 'May be looking for gifts', lower));
        }
        if (lower.contains('birthday')) {
            events.add(createEventEnhanced('Birthday', 'Mentioned a birthday', 'Potential gifting opportunity', lower));
        }
        if (lower.contains('wedding')) {
            events.add(createEventEnhanced('Wedding', 'Mentioned a wedding', 'May need special occasion products', lower));
        }
        if (lower.contains('pregnant') || lower.contains('baby') || lower.contains('expecting')) {
            events.add(createEventEnhanced('Maternity', 'Mentioned pregnancy or new baby', 'May need pregnancy-safe products', lower));
        }
        if (lower.contains('moving') || lower.contains('new home') || lower.contains('relocat')) {
            events.add(createEventEnhanced('Relocation', 'Mentioned moving or relocation', 'Climate change may affect skin', lower));
        }
        if (lower.contains('trip') || lower.contains('vacation') || lower.contains('flying') || lower.contains('travel')) {
            events.add(createEventEnhanced('Travel', 'Has upcoming travel plans', 'May need travel-size products or SPF', lower));
        }
        if (lower.contains('graduat') || lower.contains('commencement')) {
            events.add(createEventEnhanced('Graduation', 'Mentioned a graduation', 'Potential gifting or celebration opportunity', lower));
        }
        if (lower.contains('new job') || lower.contains('promotion') || lower.contains('career change')) {
            events.add(createEventEnhanced('Career', 'Mentioned a career change', 'Lifestyle shift may affect needs', lower));
        }

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
}
