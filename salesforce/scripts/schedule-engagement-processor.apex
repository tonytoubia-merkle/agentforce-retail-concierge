// Schedule the Daily Engagement Processor to run nightly at 3 AM UTC
// (one hour after JourneyBatchProcessor at 2 AM)
DailyEngagementProcessor.scheduleNightly();
System.debug('Scheduled Daily Engagement Processor at 3 AM UTC');
