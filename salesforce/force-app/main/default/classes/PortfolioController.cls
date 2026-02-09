/**
 * PortfolioController
 *
 * Admin-only controller for Portfolio Management.
 * Allows viewing all marketer portfolios, stats, and reassigning marketers.
 */
public with sharing class PortfolioController {

    /**
     * Get all marketer portfolios with stats.
     */
    @AuraEnabled(cacheable=true)
    public static List<PortfolioWrapper> getPortfolios() {
        List<PortfolioWrapper> portfolios = new List<PortfolioWrapper>();

        List<Marketer_Portfolio__c> marketerPortfolios = [
            SELECT Id, Name, Portfolio_Type__c, Region__c,
                   Primary_Marketer__c, Primary_Marketer__r.Name,
                   Secondary_Marketer__c, Secondary_Marketer__r.Name,
                   Workload_Capacity__c,
                   Auto_Approval_Enabled__c, Auto_Approval_Confidence_Threshold__c,
                   Specialty_Events__c, Loyalty_Tiers__c, Is_Active__c
            FROM Marketer_Portfolio__c
            WHERE Is_Active__c = true
            ORDER BY Name
        ];

        // Get pending counts per portfolio
        Map<Id, Integer> pendingCounts = new Map<Id, Integer>();
        Map<Id, Integer> approvedCounts = new Map<Id, Integer>();
        Map<Id, Integer> sentCounts = new Map<Id, Integer>();

        for (AggregateResult ar : [
            SELECT Assigned_Portfolio__c portfolioId, Status__c status, COUNT(Id) cnt
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c != null
            GROUP BY Assigned_Portfolio__c, Status__c
        ]) {
            Id portfolioId = (Id)ar.get('portfolioId');
            String status = (String)ar.get('status');
            Integer cnt = (Integer)ar.get('cnt');

            if (status == 'Pending') {
                pendingCounts.put(portfolioId, cnt);
            } else if (status == 'Approved') {
                approvedCounts.put(portfolioId, cnt);
            } else if (status == 'Sent') {
                sentCounts.put(portfolioId, cnt);
            }
        }

        for (Marketer_Portfolio__c mp : marketerPortfolios) {
            PortfolioWrapper pw = new PortfolioWrapper(mp);
            pw.pendingApprovals = pendingCounts.get(mp.Id) != null ? pendingCounts.get(mp.Id) : 0;
            pw.approvedNotSent = approvedCounts.get(mp.Id) != null ? approvedCounts.get(mp.Id) : 0;
            pw.sentJourneys = sentCounts.get(mp.Id) != null ? sentCounts.get(mp.Id) : 0;
            // Calculate workload as pending + approved (active items)
            pw.currentWorkload = pw.pendingApprovals + pw.approvedNotSent;
            portfolios.add(pw);
        }

        return portfolios;
    }

    /**
     * Get marketing users for assignment dropdown.
     */
    @AuraEnabled(cacheable=true)
    public static List<UserOption> getMarketingUsers() {
        List<UserOption> users = new List<UserOption>();

        // Get active users - in production, filter by Profile or Permission Set
        for (User u : [
            SELECT Id, Name, Email
            FROM User
            WHERE IsActive = true
            ORDER BY Name
            LIMIT 100
        ]) {
            users.add(new UserOption(u.Id, u.Name, u.Email));
        }

        return users;
    }

    /**
     * Update portfolio marketer assignment.
     */
    @AuraEnabled
    public static void updatePortfolioMarketer(Id portfolioId, Id primaryMarketerId, Id secondaryMarketerId) {
        Marketer_Portfolio__c mp = [
            SELECT Id, Primary_Marketer__c, Secondary_Marketer__c
            FROM Marketer_Portfolio__c
            WHERE Id = :portfolioId
            LIMIT 1
        ];

        mp.Primary_Marketer__c = primaryMarketerId;
        mp.Secondary_Marketer__c = secondaryMarketerId;
        update mp;
    }

    /**
     * Update portfolio settings.
     */
    @AuraEnabled
    public static void updatePortfolioSettings(Id portfolioId, Boolean autoApprovalEnabled, Decimal confidenceThreshold) {
        Marketer_Portfolio__c mp = [
            SELECT Id, Auto_Approval_Enabled__c, Auto_Approval_Confidence_Threshold__c
            FROM Marketer_Portfolio__c
            WHERE Id = :portfolioId
            LIMIT 1
        ];

        mp.Auto_Approval_Enabled__c = autoApprovalEnabled;
        mp.Auto_Approval_Confidence_Threshold__c = confidenceThreshold;
        update mp;
    }

    /**
     * Get aggregate stats across all portfolios.
     */
    @AuraEnabled(cacheable=true)
    public static AdminStats getAdminStats() {
        AdminStats stats = new AdminStats();

        // Total portfolios
        stats.totalPortfolios = [SELECT COUNT() FROM Marketer_Portfolio__c WHERE Is_Active__c = true];

        // Pending approvals
        stats.totalPending = [SELECT COUNT() FROM Journey_Approval__c WHERE Status__c = 'Pending'];

        // Approved today
        Date today = Date.today();
        stats.approvedToday = [
            SELECT COUNT()
            FROM Journey_Approval__c
            WHERE Status__c IN ('Approved', 'Sent')
            AND Reviewed_At__c >= :today
        ];

        // Sent today
        stats.sentToday = [
            SELECT COUNT()
            FROM Journey_Approval__c
            WHERE Status__c = 'Sent'
            AND Sent_At__c >= :today
        ];

        // Events this week
        Date weekStart = today.toStartOfWeek();
        Date weekEnd = weekStart.addDays(7);
        stats.eventsThisWeek = [
            SELECT COUNT()
            FROM Meaningful_Event__c
            WHERE Event_Date__c >= :weekStart
            AND Event_Date__c < :weekEnd
        ];

        return stats;
    }

    // ============ Wrapper Classes ============

    public class PortfolioWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String portfolioType;
        @AuraEnabled public String region;
        @AuraEnabled public Id primaryMarketerId;
        @AuraEnabled public String primaryMarketerName;
        @AuraEnabled public Id secondaryMarketerId;
        @AuraEnabled public String secondaryMarketerName;
        @AuraEnabled public Decimal workloadCapacity;
        @AuraEnabled public Decimal currentWorkload;
        @AuraEnabled public Boolean autoApprovalEnabled;
        @AuraEnabled public Decimal autoApprovalThreshold;
        @AuraEnabled public String specialtyEvents;
        @AuraEnabled public String loyaltyTiers;
        @AuraEnabled public Integer pendingApprovals;
        @AuraEnabled public Integer approvedNotSent;
        @AuraEnabled public Integer sentJourneys;

        public PortfolioWrapper(Marketer_Portfolio__c mp) {
            this.id = mp.Id;
            this.name = mp.Name;
            this.portfolioType = mp.Portfolio_Type__c;
            this.region = mp.Region__c;
            this.primaryMarketerId = mp.Primary_Marketer__c;
            this.primaryMarketerName = mp.Primary_Marketer__r?.Name;
            this.secondaryMarketerId = mp.Secondary_Marketer__c;
            this.secondaryMarketerName = mp.Secondary_Marketer__r?.Name;
            this.workloadCapacity = mp.Workload_Capacity__c;
            this.currentWorkload = 0; // Calculated from pending + approved counts
            this.autoApprovalEnabled = mp.Auto_Approval_Enabled__c;
            this.autoApprovalThreshold = mp.Auto_Approval_Confidence_Threshold__c;
            this.specialtyEvents = mp.Specialty_Events__c;
            this.loyaltyTiers = mp.Loyalty_Tiers__c;
        }
    }

    public class UserOption {
        @AuraEnabled public Id value;
        @AuraEnabled public String label;
        @AuraEnabled public String email;

        public UserOption(Id userId, String name, String email) {
            this.value = userId;
            this.label = name;
            this.email = email;
        }
    }

    public class AdminStats {
        @AuraEnabled public Integer totalPortfolios = 0;
        @AuraEnabled public Integer totalPending = 0;
        @AuraEnabled public Integer approvedToday = 0;
        @AuraEnabled public Integer sentToday = 0;
        @AuraEnabled public Integer eventsThisWeek = 0;
    }
}
