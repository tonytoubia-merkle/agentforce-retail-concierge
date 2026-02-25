// Schedule the Journey Batch Processor to run nightly at 2:00 AM
// Run: sf apex run -f salesforce/scripts/schedule-nightly-journey-processor.apex -o my-org
//
// This script:
// 1. Checks if the nightly job is already scheduled
// 2. If not, schedules JourneyBatchProcessor to run at 2:00 AM daily
// 3. Optionally runs the batch immediately to process any pending events now
//
// The batch job processes Meaningful_Event__c records (status = "Pending Review"),
// generates AI content via Campaign Agent, builds multi-step journeys, creates
// Firefly images, and produces Journey_Approval__c records for marketer review.

String JOB_NAME = 'Nightly Journey Processor';

// ─── 1. Check for existing schedule ─────────────────────────────────

List<CronTrigger> existingJobs = [
    SELECT Id, CronJobDetail.Name, NextFireTime, State
    FROM CronTrigger
    WHERE CronJobDetail.Name = :JOB_NAME
];

if (!existingJobs.isEmpty()) {
    CronTrigger existing = existingJobs[0];
    System.debug('Job already scheduled:');
    System.debug('  Name:      ' + existing.CronJobDetail.Name);
    System.debug('  Next Fire: ' + existing.NextFireTime);
    System.debug('  State:     ' + existing.State);

    if (existing.State == 'DELETED' || existing.State == 'ERROR') {
        System.abortJob(existing.Id);
        System.debug('Removed stale job (state: ' + existing.State + '). Rescheduling...');
    } else {
        System.debug('Job is active — no action needed.');
        System.debug('To run immediately: Database.executeBatch(new JourneyBatchProcessor(), 10);');
        return;
    }
}

// ─── 2. Schedule nightly at 2:00 AM ─────────────────────────────────

String cronExpression = '0 0 2 * * ?';
Id jobId = System.schedule(JOB_NAME, cronExpression, new JourneyBatchProcessor());

System.debug('=== Nightly Journey Processor Scheduled ===');
System.debug('  Job ID:    ' + jobId);
System.debug('  Schedule:  Every day at 2:00 AM');
System.debug('  Cron:      ' + cronExpression);

CronTrigger ct = [SELECT NextFireTime FROM CronTrigger WHERE Id = :jobId];
System.debug('  Next run:  ' + ct.NextFireTime);

// ─── 3. Run immediately to catch up on any pending events ────────────

Integer pendingCount = [
    SELECT COUNT()
    FROM Meaningful_Event__c
    WHERE Approval_Status__c = 'Pending Review'
      AND Event_Type__c = 'life-event'
];

if (pendingCount > 0) {
    Database.executeBatch(new JourneyBatchProcessor(), 10);
    System.debug('Also started immediate batch run for ' + pendingCount + ' pending events.');
} else {
    System.debug('No pending events — next batch will run at 2:00 AM.');
}
