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
        // If event date is in the past, use immediate single
        if (daysUntilEvent != null && daysUntilEvent < 0) {
            return JourneyPattern.IMMEDIATE_SINGLE;
        }

        // If no event date available, default to 14 days to enable multi-step journeys
        // rather than always falling back to single-step
        if (daysUntilEvent == null) {
            daysUntilEvent = 14;
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
        String eventDesc = config.eventDescription != null ? config.eventDescription.toLowerCase() : 'special occasion';
        String html = '<div style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto;">';

        // Event-type specific opening and content
        String eventType = getEventCategory(eventDesc);
        String greeting = '<p style="font-size: 18px; margin-bottom: 20px;">Dear ' + name + ',</p>';

        if (stepNum == 1) {
            html += greeting;
            html += buildFirstEmailContent(eventType, eventDesc, name);
        } else if (stepNum == totalSteps) {
            html += greeting;
            html += buildFinalEmailContent(eventType, eventDesc);
        } else {
            html += greeting;
            html += buildMiddleEmailContent(eventType, eventDesc, stepNum, totalSteps);
        }

        // Elegant CTA button
        html += '<p style="margin: 30px 0; text-align: center;">';
        html += '<a href="#" style="display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500; font-size: 14px; letter-spacing: 0.5px;">Discover Your Selection</a>';
        html += '</p>';

        html += '</div>';

        return html;
    }

    private static String getEventCategory(String eventDesc) {
        if (eventDesc.contains('wedding')) return 'wedding';
        if (eventDesc.contains('anniversary')) return 'anniversary';
        if (eventDesc.contains('birthday')) return 'birthday';
        if (eventDesc.contains('travel') || eventDesc.contains('trip') || eventDesc.contains('vacation')) return 'travel';
        if (eventDesc.contains('baby') || eventDesc.contains('pregnant')) return 'baby';
        if (eventDesc.contains('graduation')) return 'graduation';
        return 'celebration';
    }

    private static String buildFirstEmailContent(String eventType, String eventDesc, String name) {
        String content = '';

        if (eventType == 'wedding') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Every love story deserves its own glow. We hear there\'s a beautiful celebration on the horizon, and we couldn\'t be more delighted for you.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Whether you\'re walking down the aisle or celebrating someone you love, we\'ve thoughtfully selected pieces designed to make you radiant — from the rehearsal dinner to the last dance.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;"><em>Your skin tells your story. Let it glow.</em></p>';
        } else if (eventType == 'anniversary') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Another year of beautiful moments deserves to be celebrated. We\'ve curated something special for this milestone.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">From luxurious fragrances to skin that tells a story of happiness — here\'s to looking and feeling your most radiant.</p>';
        } else if (eventType == 'travel') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Adventure awaits! Before you embark on your journey, we\'ve assembled the perfect travel companions for your beauty ritual.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">From protective SPF to hydrating essentials that survive any climate — arrive at every destination looking refreshed and radiant.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;"><em>Because the best souvenirs are the memories in your glow.</em></p>';
        } else if (eventType == 'birthday') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">A birthday means celebrating the most important person — you. This year, why not gift yourself the glow you deserve?</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">We\'ve selected pieces that will make you feel as radiant as the day itself. Because every year more beautiful deserves to be seen.</p>';
        } else if (eventType == 'baby') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">What an incredible journey you\'re on! Your body is doing something miraculous, and you deserve to feel nurtured every step of the way.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">We\'ve carefully selected gentle, pregnancy-safe formulas to keep you glowing through this beautiful chapter.</p>';
        } else {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Something wonderful is on the horizon, and we wanted to help you prepare in the most beautiful way possible.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">We\'ve selected a collection designed to make you feel confident, radiant, and ready for your special moment.</p>';
        }

        return content;
    }

    private static String buildMiddleEmailContent(String eventType, String eventDesc, Integer stepNum, Integer totalSteps) {
        String content = '';
        Integer daysContext = stepNum == 2 ? 7 : 3; // Approximate days before event

        if (eventType == 'wedding') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">The countdown continues! With the big day approaching, now is the perfect time to finalize your beauty essentials.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Pro tip: Start your skin prep regimen now — hydrated, glowing skin photographs beautifully and holds makeup flawlessly.</p>';
        } else if (eventType == 'travel') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Getting excited? Us too! Here\'s a friendly reminder to stock up on travel-sized essentials.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Don\'t forget: in-flight hydration is key. Your skin will thank you upon landing!</p>';
        } else {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Your moment is getting closer! We wanted to check in and make sure you have everything you need.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">There\'s still time to add those finishing touches to your beauty collection.</p>';
        }

        return content;
    }

    private static String buildFinalEmailContent(String eventType, String eventDesc) {
        String content = '';

        if (eventType == 'wedding') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">The moment is almost here! 💕</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">One last thing: don\'t forget to do a final mask treatment tonight, and keep a blotting paper and lipstick in your clutch for touch-ups.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Wishing you a day as beautiful as your love story. Go shine!</p>';
        } else if (eventType == 'travel') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Safe travels! 🌟</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Last-minute checklist: SPF, lip balm, travel cleanser, and your favorite serum. Trust us — your future self will be grateful.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Have the most amazing trip. We\'ll be here when you return!</p>';
        } else if (eventType == 'birthday') {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Happy almost-birthday! 🎂</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Tomorrow is all about you. Prep your skin tonight with a luxurious mask, and wake up ready to glow.</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">Here\'s to another year of beautiful you!</p>';
        } else {
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">The big day is here! ✨</p>';
            content += '<p style="font-size: 16px; line-height: 1.7; color: #444;">You\'ve prepared beautifully. Now go out there and shine — you\'ve got this!</p>';
        }

        return content;
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
        // Delegate to JourneyPromptBuilder's pre-built step templates
        // This ensures consistent, optimized prompts per event type + step position
        return JourneyPromptBuilder.getStepPrompt(
            config.eventType,
            config.eventDescription,
            stepNum,
            null, // totalSteps set later in generateSteps
            null  // product names injected later during batch processing
        );
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
