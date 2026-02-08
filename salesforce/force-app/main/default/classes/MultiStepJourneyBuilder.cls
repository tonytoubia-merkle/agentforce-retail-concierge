/**
 * MultiStepJourneyBuilder
 *
 * Builds intelligent multi-step journeys based on:
 * - Time between event capture and event date
 * - Contact channel opt-in preferences
 * - Journey guardrails (max frequency, exit conditions)
 * - Event type patterns
 *
 * Example: A trip in 3 weeks could generate:
 * Step 1: Email immediately with travel essentials
 * Step 2: SMS 3 days before departure with quick reminder
 * Step 3: Push on departure day with on-the-go tips
 */
public with sharing class MultiStepJourneyBuilder {

    // ─── Configuration ─────────────────────────────────────────────────

    // Default guardrails (can be overridden per journey)
    private static final Integer DEFAULT_MAX_EMAILS_PER_WEEK = 1;
    private static final Integer DEFAULT_MIN_DAYS_BETWEEN_MESSAGES = 2;
    private static final Boolean DEFAULT_EXIT_ON_PURCHASE = true;

    // ─── Data Classes ──────────────────────────────────────────────────

    public class JourneyConfig {
        public Id contactId;
        public Id meaningfulEventId;
        public String eventType;
        public String eventDescription;
        public Date eventDate;
        public String urgency;
        public String suggestedProducts;
        public String agentNote;
        public String contactName;
    }

    public class JourneyStep {
        public Integer stepNumber;
        public Integer totalSteps;
        public String channel;          // Email, SMS, Push
        public Integer sendDelayDays;   // Days after previous step
        public String subject;
        public String body;
        public String smsBody;          // For SMS/Push channels
        public String fireflyPrompt;
        public String productsJson;
        public String guardrailsJson;
    }

    public class JourneyResult {
        public Boolean success;
        public String journeyId;
        public List<JourneyStep> steps;
        public String error;
    }

    public class ChannelPreferences {
        public Boolean emailOptIn = true;
        public Boolean smsOptIn = false;
        public Boolean pushOptIn = false;
    }

    // ─── Main Builder Method ───────────────────────────────────────────

    /**
     * Build a multi-step journey based on the event configuration.
     * Analyzes time available, channels, and event type to create optimal journey.
     *
     * @param config JourneyConfig with event details
     * @return JourneyResult with steps to create
     */
    public static JourneyResult buildJourney(JourneyConfig config) {
        JourneyResult result = new JourneyResult();
        result.steps = new List<JourneyStep>();

        try {
            // Get contact channel preferences
            ChannelPreferences channels = getChannelPreferences(config.contactId);

            // Calculate available time window
            Integer daysUntilEvent = calculateDaysUntilEvent(config.eventDate);

            // Determine journey pattern based on time and event type
            JourneyPattern pattern = selectPattern(daysUntilEvent, config.eventType, channels);

            // Generate journey ID
            result.journeyId = JourneyStepService.generateJourneyId(config.contactId, config.eventType);

            // Build guardrails JSON
            String guardrailsJson = buildGuardrailsJson(pattern);

            // Generate steps based on pattern
            result.steps = generateSteps(config, pattern, channels, guardrailsJson);

            result.success = true;
        } catch (Exception e) {
            result.success = false;
            result.error = e.getMessage();
        }

        return result;
    }

    // ─── Channel Preferences ───────────────────────────────────────────

    /**
     * Get channel opt-in preferences for a contact.
     */
    private static ChannelPreferences getChannelPreferences(Id contactId) {
        ChannelPreferences prefs = new ChannelPreferences();

        if (contactId == null) {
            return prefs;
        }

        try {
            Contact c = [
                SELECT Email_Opt_In__c, SMS_Opt_In__c, Push_Opt_In__c
                FROM Contact
                WHERE Id = :contactId
                LIMIT 1
            ];

            prefs.emailOptIn = c.Email_Opt_In__c == true;
            prefs.smsOptIn = c.SMS_Opt_In__c == true;
            prefs.pushOptIn = c.Push_Opt_In__c == true;
        } catch (Exception e) {
            // Default to email only if query fails
        }

        return prefs;
    }

    // ─── Pattern Selection ─────────────────────────────────────────────

    /**
     * Journey patterns based on available time.
     */
    public enum JourneyPattern {
        IMMEDIATE_SINGLE,      // < 3 days: Single immediate message
        SHORT_TWO_STEP,        // 3-7 days: 2 steps (email now, reminder near event)
        MEDIUM_THREE_STEP,     // 7-21 days: 3 steps with build-up
        LONG_MULTI_STEP        // 21+ days: 4-5 steps with nurture
    }

    /**
     * Select the appropriate journey pattern based on timing and preferences.
     */
    private static JourneyPattern selectPattern(Integer daysUntilEvent, String eventType, ChannelPreferences channels) {
        // If no event date, use immediate single
        if (daysUntilEvent == null || daysUntilEvent < 0) {
            return JourneyPattern.IMMEDIATE_SINGLE;
        }

        // Calculate available channels
        Integer availableChannels = 0;
        if (channels.emailOptIn) availableChannels++;
        if (channels.smsOptIn) availableChannels++;
        if (channels.pushOptIn) availableChannels++;

        // If only one channel, limit steps
        if (availableChannels <= 1) {
            if (daysUntilEvent < 7) return JourneyPattern.IMMEDIATE_SINGLE;
            if (daysUntilEvent < 21) return JourneyPattern.SHORT_TWO_STEP;
            return JourneyPattern.MEDIUM_THREE_STEP;
        }

        // Full multi-channel selection
        if (daysUntilEvent < 3) return JourneyPattern.IMMEDIATE_SINGLE;
        if (daysUntilEvent < 7) return JourneyPattern.SHORT_TWO_STEP;
        if (daysUntilEvent < 21) return JourneyPattern.MEDIUM_THREE_STEP;
        return JourneyPattern.LONG_MULTI_STEP;
    }

    // ─── Step Generation ───────────────────────────────────────────────

    /**
     * Generate journey steps based on the selected pattern.
     */
    private static List<JourneyStep> generateSteps(JourneyConfig config, JourneyPattern pattern, ChannelPreferences channels, String guardrailsJson) {
        List<JourneyStep> steps = new List<JourneyStep>();
        Integer daysUntilEvent = calculateDaysUntilEvent(config.eventDate);

        switch on pattern {
            when IMMEDIATE_SINGLE {
                steps = generateImmediateSingle(config, channels, guardrailsJson);
            }
            when SHORT_TWO_STEP {
                steps = generateShortTwoStep(config, channels, guardrailsJson, daysUntilEvent);
            }
            when MEDIUM_THREE_STEP {
                steps = generateMediumThreeStep(config, channels, guardrailsJson, daysUntilEvent);
            }
            when LONG_MULTI_STEP {
                steps = generateLongMultiStep(config, channels, guardrailsJson, daysUntilEvent);
            }
        }

        // Set total steps on each
        Integer total = steps.size();
        for (JourneyStep step : steps) {
            step.totalSteps = total;
        }

        return steps;
    }

    /**
     * Single immediate message (email preferred, fallback to SMS/Push).
     */
    private static List<JourneyStep> generateImmediateSingle(JourneyConfig config, ChannelPreferences channels, String guardrailsJson) {
        List<JourneyStep> steps = new List<JourneyStep>();

        JourneyStep step = new JourneyStep();
        step.stepNumber = 1;
        step.sendDelayDays = 0;
        step.guardrailsJson = guardrailsJson;

        if (channels.emailOptIn) {
            step.channel = 'Email';
            step.subject = buildSubjectLine(config, 1, 1);
            step.body = buildEmailBody(config, 1, 1);
            step.fireflyPrompt = buildFireflyPrompt(config, 1);
        } else if (channels.smsOptIn) {
            step.channel = 'SMS';
            step.smsBody = buildSmsBody(config, 1, 1);
        } else if (channels.pushOptIn) {
            step.channel = 'Push';
            step.subject = buildPushTitle(config, 1);
            step.smsBody = buildPushBody(config, 1);
        } else {
            // Default to email even if not opted in (will need consent)
            step.channel = 'Email';
            step.subject = buildSubjectLine(config, 1, 1);
            step.body = buildEmailBody(config, 1, 1);
        }

        steps.add(step);
        return steps;
    }

    /**
     * Two-step journey: Email now + SMS/Push reminder near event.
     */
    private static List<JourneyStep> generateShortTwoStep(JourneyConfig config, ChannelPreferences channels, String guardrailsJson, Integer daysUntilEvent) {
        List<JourneyStep> steps = new List<JourneyStep>();

        // Step 1: Email immediately
        JourneyStep step1 = new JourneyStep();
        step1.stepNumber = 1;
        step1.sendDelayDays = 0;
        step1.channel = 'Email';
        step1.subject = buildSubjectLine(config, 1, 2);
        step1.body = buildEmailBody(config, 1, 2);
        step1.fireflyPrompt = buildFireflyPrompt(config, 1);
        step1.guardrailsJson = guardrailsJson;
        steps.add(step1);

        // Step 2: Reminder 1 day before event
        JourneyStep step2 = new JourneyStep();
        step2.stepNumber = 2;
        step2.sendDelayDays = Math.max(1, daysUntilEvent - 1);
        step2.guardrailsJson = guardrailsJson;

        if (channels.smsOptIn) {
            step2.channel = 'SMS';
            step2.smsBody = buildSmsBody(config, 2, 2);
        } else if (channels.pushOptIn) {
            step2.channel = 'Push';
            step2.subject = buildPushTitle(config, 2);
            step2.smsBody = buildPushBody(config, 2);
        } else {
            step2.channel = 'Email';
            step2.subject = buildSubjectLine(config, 2, 2);
            step2.body = buildEmailBody(config, 2, 2);
        }

        steps.add(step2);
        return steps;
    }

    /**
     * Three-step journey: Email intro, mid-journey nudge, final reminder.
     */
    private static List<JourneyStep> generateMediumThreeStep(JourneyConfig config, ChannelPreferences channels, String guardrailsJson, Integer daysUntilEvent) {
        List<JourneyStep> steps = new List<JourneyStep>();

        // Calculate spacing
        Integer midPoint = daysUntilEvent / 2;
        Integer finalDays = daysUntilEvent - 2;

        // Step 1: Welcome email immediately
        JourneyStep step1 = new JourneyStep();
        step1.stepNumber = 1;
        step1.sendDelayDays = 0;
        step1.channel = 'Email';
        step1.subject = buildSubjectLine(config, 1, 3);
        step1.body = buildEmailBody(config, 1, 3);
        step1.fireflyPrompt = buildFireflyPrompt(config, 1);
        step1.guardrailsJson = guardrailsJson;
        steps.add(step1);

        // Step 2: Mid-journey nudge
        JourneyStep step2 = new JourneyStep();
        step2.stepNumber = 2;
        step2.sendDelayDays = Math.max(3, midPoint);
        step2.guardrailsJson = guardrailsJson;

        if (channels.smsOptIn) {
            step2.channel = 'SMS';
            step2.smsBody = buildSmsBody(config, 2, 3);
        } else {
            step2.channel = 'Email';
            step2.subject = buildSubjectLine(config, 2, 3);
            step2.body = buildEmailBody(config, 2, 3);
        }
        steps.add(step2);

        // Step 3: Final reminder
        JourneyStep step3 = new JourneyStep();
        step3.stepNumber = 3;
        step3.sendDelayDays = Math.max(2, finalDays - midPoint);
        step3.guardrailsJson = guardrailsJson;

        if (channels.pushOptIn) {
            step3.channel = 'Push';
            step3.subject = buildPushTitle(config, 3);
            step3.smsBody = buildPushBody(config, 3);
        } else if (channels.smsOptIn) {
            step3.channel = 'SMS';
            step3.smsBody = buildSmsBody(config, 3, 3);
        } else {
            step3.channel = 'Email';
            step3.subject = buildSubjectLine(config, 3, 3);
            step3.body = buildEmailBody(config, 3, 3);
        }
        steps.add(step3);

        return steps;
    }

    /**
     * Long multi-step journey: 4-5 steps with full nurture sequence.
     */
    private static List<JourneyStep> generateLongMultiStep(JourneyConfig config, ChannelPreferences channels, String guardrailsJson, Integer daysUntilEvent) {
        List<JourneyStep> steps = new List<JourneyStep>();

        // Calculate spacing (roughly 1 week apart, then closer to event)
        Integer step2Delay = 7;
        Integer step3Delay = 7;
        Integer step4Delay = Math.max(3, daysUntilEvent - 17);
        Integer step5Delay = 2;

        // Adjust if not enough time for 5 steps
        Boolean useFiveSteps = daysUntilEvent >= 25 && (channels.smsOptIn || channels.pushOptIn);

        // Step 1: Welcome email
        JourneyStep step1 = new JourneyStep();
        step1.stepNumber = 1;
        step1.sendDelayDays = 0;
        step1.channel = 'Email';
        step1.subject = buildSubjectLine(config, 1, useFiveSteps ? 5 : 4);
        step1.body = buildEmailBody(config, 1, useFiveSteps ? 5 : 4);
        step1.fireflyPrompt = buildFireflyPrompt(config, 1);
        step1.guardrailsJson = guardrailsJson;
        steps.add(step1);

        // Step 2: Education/tips email
        JourneyStep step2 = new JourneyStep();
        step2.stepNumber = 2;
        step2.sendDelayDays = step2Delay;
        step2.channel = 'Email';
        step2.subject = buildSubjectLine(config, 2, useFiveSteps ? 5 : 4);
        step2.body = buildEmailBody(config, 2, useFiveSteps ? 5 : 4);
        step2.guardrailsJson = guardrailsJson;
        steps.add(step2);

        // Step 3: SMS check-in (if opted in) or email
        JourneyStep step3 = new JourneyStep();
        step3.stepNumber = 3;
        step3.sendDelayDays = step3Delay;
        step3.guardrailsJson = guardrailsJson;

        if (channels.smsOptIn) {
            step3.channel = 'SMS';
            step3.smsBody = buildSmsBody(config, 3, useFiveSteps ? 5 : 4);
        } else {
            step3.channel = 'Email';
            step3.subject = buildSubjectLine(config, 3, useFiveSteps ? 5 : 4);
            step3.body = buildEmailBody(config, 3, useFiveSteps ? 5 : 4);
        }
        steps.add(step3);

        // Step 4: Pre-event reminder
        JourneyStep step4 = new JourneyStep();
        step4.stepNumber = 4;
        step4.sendDelayDays = step4Delay;
        step4.channel = 'Email';
        step4.subject = buildSubjectLine(config, 4, useFiveSteps ? 5 : 4);
        step4.body = buildEmailBody(config, 4, useFiveSteps ? 5 : 4);
        step4.fireflyPrompt = buildFireflyPrompt(config, 4);
        step4.guardrailsJson = guardrailsJson;
        steps.add(step4);

        // Step 5: Day-of push notification (if opted in)
        if (useFiveSteps && channels.pushOptIn) {
            JourneyStep step5 = new JourneyStep();
            step5.stepNumber = 5;
            step5.sendDelayDays = step5Delay;
            step5.channel = 'Push';
            step5.subject = buildPushTitle(config, 5);
            step5.smsBody = buildPushBody(config, 5);
            step5.guardrailsJson = guardrailsJson;
            steps.add(step5);
        }

        return steps;
    }

    // ─── Content Builders ──────────────────────────────────────────────

    private static String buildSubjectLine(JourneyConfig config, Integer stepNum, Integer totalSteps) {
        String eventDesc = config.eventDescription != null ? config.eventDescription.toLowerCase() : '';
        String contactName = String.isNotBlank(config.contactName) ? config.contactName + ', ' : '';

        if (stepNum == 1) {
            if (eventDesc.contains('wedding')) return contactName + 'Your bridal glow awaits';
            if (eventDesc.contains('birthday')) return contactName + 'A birthday gift just for you';
            if (eventDesc.contains('travel') || eventDesc.contains('trip')) return contactName + 'Get travel-ready with these essentials';
            if (eventDesc.contains('baby')) return contactName + 'Gentle care for your new journey';
            return contactName + 'Something special we think you\'ll love';
        } else if (stepNum == totalSteps) {
            if (eventDesc.contains('wedding')) return 'Last chance: Wedding day must-haves';
            if (eventDesc.contains('birthday')) return 'Don\'t forget your birthday treat!';
            if (eventDesc.contains('travel')) return 'Packing reminder: Travel essentials';
            return 'Your special moment is almost here';
        } else {
            if (eventDesc.contains('wedding')) return 'Wedding prep tips from our experts';
            if (eventDesc.contains('birthday')) return 'Make your celebration extra special';
            if (eventDesc.contains('travel')) return 'Travel beauty tips you\'ll love';
            return 'More inspiration for your special occasion';
        }
    }

    private static String buildEmailBody(JourneyConfig config, Integer stepNum, Integer totalSteps) {
        String name = String.isNotBlank(config.contactName) ? config.contactName : 'there';
        String html = '<div style="font-family: Georgia, serif; color: #333;">';

        if (stepNum == 1) {
            html += '<p>Hi ' + name + ',</p>';
            html += '<p>We heard you have something exciting coming up: <strong>' + config.eventDescription + '</strong>.</p>';
            html += '<p>We\'ve curated some products we think you\'ll love for this special occasion.</p>';
        } else if (stepNum == totalSteps) {
            html += '<p>Hi ' + name + ',</p>';
            html += '<p>Your special day is almost here! Don\'t forget to pack these essentials.</p>';
        } else {
            html += '<p>Hi ' + name + ',</p>';
            html += '<p>Just checking in with some tips and product recommendations for your upcoming ' + config.eventDescription + '.</p>';
        }

        html += '<p style="margin-top: 20px;"><a href="#" style="color: #B76E79; font-weight: bold;">Shop Now</a></p>';
        html += '<p style="margin-top: 30px;">Warm regards,<br/>The LUMIÈRE Team</p>';
        html += '</div>';

        return html;
    }

    private static String buildSmsBody(JourneyConfig config, Integer stepNum, Integer totalSteps) {
        String name = String.isNotBlank(config.contactName) ? config.contactName : '';
        String prefix = String.isNotBlank(name) ? 'Hi ' + name + '! ' : '';

        if (stepNum == totalSteps) {
            return prefix + 'Your ' + config.eventDescription + ' is almost here! Tap to shop last-minute essentials: lumiere.co/shop';
        } else {
            return prefix + 'Quick reminder about your beauty essentials for ' + config.eventDescription + '. Shop now: lumiere.co/shop';
        }
    }

    private static String buildPushTitle(JourneyConfig config, Integer stepNum) {
        String eventDesc = config.eventDescription != null ? config.eventDescription.toLowerCase() : 'event';
        if (eventDesc.contains('travel')) return 'Ready for your trip?';
        if (eventDesc.contains('wedding')) return 'Bridal beauty reminder';
        if (eventDesc.contains('birthday')) return 'Birthday glow time!';
        return 'Don\'t forget your essentials';
    }

    private static String buildPushBody(JourneyConfig config, Integer stepNum) {
        return 'Tap to shop your curated recommendations for ' + config.eventDescription;
    }

    private static String buildFireflyPrompt(JourneyConfig config, Integer stepNum) {
        String eventDesc = config.eventDescription != null ? config.eventDescription.toLowerCase() : '';

        String prompt = 'Elegant ';

        if (eventDesc.contains('wedding')) {
            prompt += 'bridal preparation scene, luxury beauty products on marble vanity, ';
            prompt += 'white roses and champagne, romantic soft lighting, ';
        } else if (eventDesc.contains('travel') || eventDesc.contains('trip')) {
            prompt += 'travel lifestyle scene, beauty products in designer travel case, ';
            prompt += 'passport and boarding pass visible, luxury hotel setting, ';
        } else if (eventDesc.contains('birthday')) {
            prompt += 'birthday celebration, beauty products wrapped with silk ribbon, ';
            prompt += 'elegant gift arrangement, festive but sophisticated atmosphere, ';
        } else {
            prompt += 'lifestyle beauty scene, products artfully arranged, ';
            prompt += 'natural lighting, sophisticated editorial photography, ';
        }

        prompt += 'rose gold accents, premium product photography, email banner composition';

        return prompt;
    }

    // ─── Guardrails ────────────────────────────────────────────────────

    private static String buildGuardrailsJson(JourneyPattern pattern) {
        Map<String, Object> guardrails = new Map<String, Object>();

        guardrails.put('maxEmailsPerWeek', DEFAULT_MAX_EMAILS_PER_WEEK);
        guardrails.put('minDaysBetweenMessages', DEFAULT_MIN_DAYS_BETWEEN_MESSAGES);
        guardrails.put('exitOnPurchase', DEFAULT_EXIT_ON_PURCHASE);
        guardrails.put('exitOnUnsubscribe', true);

        // Add pattern-specific rules
        switch on pattern {
            when LONG_MULTI_STEP {
                guardrails.put('suppressIfOpened', false);
                guardrails.put('suppressIfClicked', true);
            }
            when MEDIUM_THREE_STEP {
                guardrails.put('suppressIfClicked', true);
            }
            when else {
                // Default guardrails only
            }
        }

        return JSON.serialize(guardrails);
    }

    // ─── Helpers ───────────────────────────────────────────────────────

    private static Integer calculateDaysUntilEvent(Date eventDate) {
        if (eventDate == null) {
            return null;
        }
        return Date.today().daysBetween(eventDate);
    }
}
