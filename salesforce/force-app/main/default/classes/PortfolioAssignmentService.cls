/**
 * PortfolioAssignmentService
 *
 * Handles assignment of Journey Approvals to Marketer Portfolios using
 * configurable routing rules. Supports:
 * - Regional assignment based on contact location
 * - Segment assignment based on loyalty tier
 * - Event specialty assignment based on meaningful event type
 * - VIP assignment for high-value customers
 * - Workload balancing across portfolios
 * - Confidence-based tiering for auto-approval
 */
public with sharing class PortfolioAssignmentService {

    // Confidence thresholds for approval tiers
    private static final Integer AUTO_SEND_THRESHOLD = 90;
    private static final Integer SOFT_REVIEW_THRESHOLD = 70;
    private static final Integer REVIEW_REQUIRED_THRESHOLD = 40;
    // Below REVIEW_REQUIRED_THRESHOLD = Escalate

    // Hours until soft review auto-sends
    private static final Integer SOFT_REVIEW_HOURS = 4;

    /**
     * Assign a Journey Approval to the appropriate portfolio based on routing rules.
     * Called during journey creation in JourneyBatchProcessor.
     */
    @AuraEnabled
    public static AssignmentResult assignToPortfolio(Id approvalId) {
        AssignmentResult result = new AssignmentResult();

        try {
            // Get the approval with contact details
            Journey_Approval__c approval = [
                SELECT Id, Contact__c, Contact__r.MailingState, Contact__r.MailingCountry,
                       Meaningful_Event__c, Meaningful_Event__r.Event_Type__c,
                       Confidence_Score__c, Customer_Value_Score__c
                FROM Journey_Approval__c
                WHERE Id = :approvalId
                LIMIT 1
            ];

            if (approval.Contact__c == null) {
                result.success = false;
                result.errorMessage = 'No contact associated with this approval';
                return result;
            }

            // Find the best matching portfolio
            Marketer_Portfolio__c portfolio = findBestPortfolio(approval);

            if (portfolio != null) {
                // Assign to portfolio
                approval.Assigned_Portfolio__c = portfolio.Id;
                approval.Reviewed_By__c = portfolio.Primary_Marketer__c;

                // Calculate approval tier
                approval.Approval_Tier__c = calculateApprovalTier(approval, portfolio);

                // Set auto-send deadline for soft review
                if (approval.Approval_Tier__c == 'Soft Review') {
                    approval.Auto_Send_Deadline__c = DateTime.now().addHours(SOFT_REVIEW_HOURS);
                }

                // Calculate priority score
                approval.Priority_Score__c = calculatePriorityScore(approval);

                update approval;

                // Update portfolio workload
                updatePortfolioWorkload(portfolio.Id);

                result.success = true;
                result.portfolioId = portfolio.Id;
                result.portfolioName = portfolio.Name;
                result.assignedMarketerId = portfolio.Primary_Marketer__c;
                result.approvalTier = approval.Approval_Tier__c;
                result.message = 'Assigned to ' + portfolio.Name;
            } else {
                // No matching portfolio - leave unassigned for manual routing
                result.success = true;
                result.message = 'No matching portfolio found - awaiting manual assignment';
            }

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = e.getMessage();
        }

        return result;
    }

    /**
     * Bulk assign multiple approvals to portfolios.
     * Used by batch processor for efficient assignment.
     */
    public static List<AssignmentResult> assignBulk(List<Id> approvalIds) {
        List<AssignmentResult> results = new List<AssignmentResult>();

        // Get all approvals with contact details
        Map<Id, Journey_Approval__c> approvals = new Map<Id, Journey_Approval__c>([
            SELECT Id, Contact__c, Contact__r.MailingState, Contact__r.MailingCountry,
                   Meaningful_Event__c, Meaningful_Event__r.Event_Type__c,
                   Confidence_Score__c, Customer_Value_Score__c
            FROM Journey_Approval__c
            WHERE Id IN :approvalIds
        ]);

        // Get all active portfolios
        List<Marketer_Portfolio__c> portfolios = getActivePortfolios();

        // Get portfolio members for contact-based routing
        Map<Id, Set<Id>> contactToPortfolios = getContactPortfolioMap(
            new List<Id>(new Map<Id, Journey_Approval__c>(approvals).keySet())
        );

        List<Journey_Approval__c> toUpdate = new List<Journey_Approval__c>();
        Set<Id> affectedPortfolios = new Set<Id>();

        for (Id approvalId : approvalIds) {
            Journey_Approval__c approval = approvals.get(approvalId);
            AssignmentResult result = new AssignmentResult();

            if (approval == null || approval.Contact__c == null) {
                result.success = false;
                result.errorMessage = 'Invalid approval or no contact';
                results.add(result);
                continue;
            }

            // Check if contact has explicit portfolio assignment
            Marketer_Portfolio__c portfolio = null;
            if (contactToPortfolios.containsKey(approval.Contact__c)) {
                Set<Id> portfolioIds = contactToPortfolios.get(approval.Contact__c);
                for (Marketer_Portfolio__c p : portfolios) {
                    if (portfolioIds.contains(p.Id)) {
                        portfolio = p;
                        break;
                    }
                }
            }

            // Fallback to rule-based assignment
            if (portfolio == null) {
                portfolio = findBestPortfolioFromList(approval, portfolios);
            }

            if (portfolio != null) {
                approval.Assigned_Portfolio__c = portfolio.Id;
                approval.Reviewed_By__c = portfolio.Primary_Marketer__c;
                approval.Approval_Tier__c = calculateApprovalTier(approval, portfolio);

                if (approval.Approval_Tier__c == 'Soft Review') {
                    approval.Auto_Send_Deadline__c = DateTime.now().addHours(SOFT_REVIEW_HOURS);
                }

                approval.Priority_Score__c = calculatePriorityScore(approval);

                toUpdate.add(approval);
                affectedPortfolios.add(portfolio.Id);

                result.success = true;
                result.portfolioId = portfolio.Id;
                result.portfolioName = portfolio.Name;
                result.approvalTier = approval.Approval_Tier__c;
            } else {
                result.success = true;
                result.message = 'No matching portfolio';
            }

            results.add(result);
        }

        if (!toUpdate.isEmpty()) {
            update toUpdate;
        }

        // Update workloads for affected portfolios
        for (Id portfolioId : affectedPortfolios) {
            updatePortfolioWorkload(portfolioId);
        }

        return results;
    }

    /**
     * Get pending approvals for the current user's portfolios.
     * Powers the Marketer Inbox component.
     */
    @AuraEnabled(cacheable=true)
    public static List<Journey_Approval__c> getMyPendingApprovals() {
        Id currentUserId = UserInfo.getUserId();

        // Get portfolios where user is primary or secondary marketer
        List<Marketer_Portfolio__c> myPortfolios = [
            SELECT Id FROM Marketer_Portfolio__c
            WHERE (Primary_Marketer__c = :currentUserId OR Secondary_Marketer__c = :currentUserId)
            AND Is_Active__c = true
        ];

        Set<Id> portfolioIds = new Set<Id>();
        for (Marketer_Portfolio__c p : myPortfolios) {
            portfolioIds.add(p.Id);
        }

        if (portfolioIds.isEmpty()) {
            return new List<Journey_Approval__c>();
        }

        return [
            SELECT Id, Name, Status__c, Contact__c, Contact__r.Name, Contact__r.Email,
                   Meaningful_Event__r.Event_Type__c, Meaningful_Event__r.Event_Date__c,
                   Suggested_Subject__c, Suggested_Body__c, Channel__c,
                   Generated_Image_URL__c, Recommended_Products__c,
                   Confidence_Score__c, Approval_Tier__c, Priority_Score__c,
                   Customer_Value_Score__c, Auto_Send_Deadline__c,
                   Assigned_Portfolio__c, Assigned_Portfolio__r.Name,
                   Journey_Id__c, Step_Number__c, Total_Steps__c,
                   Urgency__c, Days_Until_Event__c, CreatedDate
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c IN :portfolioIds
            AND Status__c = 'Pending'
            ORDER BY Priority_Score__c DESC NULLS LAST, CreatedDate ASC
            LIMIT 200
        ];
    }

    /**
     * Get inbox statistics for the current user.
     */
    @AuraEnabled(cacheable=true)
    public static InboxStats getMyInboxStats() {
        Id currentUserId = UserInfo.getUserId();
        InboxStats stats = new InboxStats();

        // Get user's portfolios
        List<Marketer_Portfolio__c> myPortfolios = [
            SELECT Id, Name, Current_Workload__c, Workload_Capacity__c
            FROM Marketer_Portfolio__c
            WHERE (Primary_Marketer__c = :currentUserId OR Secondary_Marketer__c = :currentUserId)
            AND Is_Active__c = true
        ];

        Set<Id> portfolioIds = new Set<Id>();
        for (Marketer_Portfolio__c p : myPortfolios) {
            portfolioIds.add(p.Id);
        }

        if (portfolioIds.isEmpty()) {
            return stats;
        }

        // Count by tier
        List<AggregateResult> tierCounts = [
            SELECT Approval_Tier__c tier, COUNT(Id) cnt
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c IN :portfolioIds
            AND Status__c = 'Pending'
            GROUP BY Approval_Tier__c
        ];

        for (AggregateResult ar : tierCounts) {
            String tier = (String)ar.get('tier');
            Integer cnt = (Integer)ar.get('cnt');
            stats.totalPending += cnt;

            if (tier == 'Auto-Send') stats.autoSendCount = cnt;
            else if (tier == 'Soft Review') stats.softReviewCount = cnt;
            else if (tier == 'Review Required') stats.reviewRequiredCount = cnt;
            else if (tier == 'Escalate') stats.escalateCount = cnt;
        }

        // Count by urgency
        List<AggregateResult> urgencyCounts = [
            SELECT Urgency__c urg, COUNT(Id) cnt
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c IN :portfolioIds
            AND Status__c = 'Pending'
            GROUP BY Urgency__c
        ];

        for (AggregateResult ar : urgencyCounts) {
            String urg = (String)ar.get('urg');
            Integer cnt = (Integer)ar.get('cnt');

            if (urg == 'Immediate') stats.immediateCount = cnt;
            else if (urg == 'This Week') stats.thisWeekCount = cnt;
            else if (urg == 'This Month') stats.thisMonthCount = cnt;
        }

        // Count approaching auto-send deadlines
        stats.approachingDeadlineCount = [
            SELECT COUNT()
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c IN :portfolioIds
            AND Status__c = 'Pending'
            AND Approval_Tier__c = 'Soft Review'
            AND Auto_Send_Deadline__c <= :DateTime.now().addHours(1)
        ];

        stats.portfolioCount = myPortfolios.size();

        return stats;
    }

    /**
     * Find the best matching portfolio for an approval based on routing rules.
     */
    private static Marketer_Portfolio__c findBestPortfolio(Journey_Approval__c approval) {
        List<Marketer_Portfolio__c> portfolios = getActivePortfolios();
        return findBestPortfolioFromList(approval, portfolios);
    }

    private static Marketer_Portfolio__c findBestPortfolioFromList(
        Journey_Approval__c approval,
        List<Marketer_Portfolio__c> portfolios
    ) {
        Marketer_Portfolio__c bestMatch = null;
        Integer bestScore = 0;

        String eventType = approval.Meaningful_Event__r?.Event_Type__c;
        String state = approval.Contact__r?.MailingState;

        for (Marketer_Portfolio__c portfolio : portfolios) {
            // Skip if at capacity
            if (portfolio.Current_Workload__c >= portfolio.Workload_Capacity__c) {
                continue;
            }

            Integer score = 0;

            // Event specialty match (highest priority)
            if (portfolio.Portfolio_Type__c == 'Event Specialist' &&
                portfolio.Specialty_Events__c != null &&
                eventType != null &&
                portfolio.Specialty_Events__c.contains(eventType)) {
                score += 100;
            }

            // VIP portfolio (high priority)
            if (portfolio.Portfolio_Type__c == 'VIP' &&
                approval.Customer_Value_Score__c != null &&
                approval.Customer_Value_Score__c >= 80) {
                score += 90;
            }

            // Regional match
            if (portfolio.Portfolio_Type__c == 'Regional' &&
                portfolio.Region__c != null &&
                state != null) {
                String region = getRegionForState(state);
                if (portfolio.Region__c == region) {
                    score += 50;
                }
            }

            // Segment match based on loyalty tier
            // (Would need to join to LoyaltyMember__c for full implementation)
            if (portfolio.Portfolio_Type__c == 'Segment') {
                score += 30; // Base score for segment portfolios
            }

            // Prefer portfolios with lower workload (load balancing)
            if (portfolio.Current_Workload__c < portfolio.Workload_Capacity__c * 0.5) {
                score += 10;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = portfolio;
            }
        }

        // If no specific match, find any portfolio with capacity
        if (bestMatch == null) {
            for (Marketer_Portfolio__c portfolio : portfolios) {
                if (portfolio.Current_Workload__c < portfolio.Workload_Capacity__c) {
                    bestMatch = portfolio;
                    break;
                }
            }
        }

        return bestMatch;
    }

    /**
     * Calculate approval tier based on confidence, value, and risk.
     */
    private static String calculateApprovalTier(Journey_Approval__c approval, Marketer_Portfolio__c portfolio) {
        Integer confidence = approval.Confidence_Score__c != null ?
            approval.Confidence_Score__c.intValue() : 50;
        Integer customerValue = approval.Customer_Value_Score__c != null ?
            approval.Customer_Value_Score__c.intValue() : 50;

        // High-value customers always need review
        if (customerValue >= 90) {
            return 'Review Required';
        }

        // Check if portfolio allows auto-approval
        if (!portfolio.Auto_Approval_Enabled__c) {
            return 'Review Required';
        }

        // Check confidence against portfolio threshold
        Integer threshold = portfolio.Auto_Approval_Confidence_Threshold__c != null ?
            portfolio.Auto_Approval_Confidence_Threshold__c.intValue() : 85;

        if (confidence >= AUTO_SEND_THRESHOLD && confidence >= threshold) {
            return 'Auto-Send';
        } else if (confidence >= SOFT_REVIEW_THRESHOLD) {
            return 'Soft Review';
        } else if (confidence >= REVIEW_REQUIRED_THRESHOLD) {
            return 'Review Required';
        } else {
            return 'Escalate';
        }
    }

    /**
     * Calculate priority score for inbox ordering.
     * Higher score = higher priority.
     */
    private static Decimal calculatePriorityScore(Journey_Approval__c approval) {
        Decimal score = 0;

        // Urgency component (0-40 points)
        if (approval.Days_Until_Event__c != null) {
            if (approval.Days_Until_Event__c <= 1) score += 40;
            else if (approval.Days_Until_Event__c <= 3) score += 30;
            else if (approval.Days_Until_Event__c <= 7) score += 20;
            else if (approval.Days_Until_Event__c <= 14) score += 10;
        }

        // Customer value component (0-30 points)
        if (approval.Customer_Value_Score__c != null) {
            score += (approval.Customer_Value_Score__c / 100) * 30;
        }

        // Confidence component (0-20 points) - lower confidence = needs attention
        if (approval.Confidence_Score__c != null) {
            // Inverse: low confidence needs more attention
            score += ((100 - approval.Confidence_Score__c) / 100) * 20;
        }

        // Tier component (0-10 points)
        if (approval.Approval_Tier__c == 'Escalate') score += 10;
        else if (approval.Approval_Tier__c == 'Review Required') score += 5;

        return score.setScale(2);
    }

    /**
     * Update portfolio workload count.
     */
    private static void updatePortfolioWorkload(Id portfolioId) {
        Integer workload = [
            SELECT COUNT()
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c = :portfolioId
            AND Status__c = 'Pending'
        ];

        Marketer_Portfolio__c portfolio = new Marketer_Portfolio__c(
            Id = portfolioId,
            Current_Workload__c = workload
        );
        update portfolio;
    }

    /**
     * Get all active portfolios with workload info.
     */
    private static List<Marketer_Portfolio__c> getActivePortfolios() {
        return [
            SELECT Id, Name, Primary_Marketer__c, Secondary_Marketer__c,
                   Portfolio_Type__c, Region__c, Specialty_Events__c, Loyalty_Tiers__c,
                   Workload_Capacity__c, Current_Workload__c,
                   Auto_Approval_Enabled__c, Auto_Approval_Confidence_Threshold__c
            FROM Marketer_Portfolio__c
            WHERE Is_Active__c = true
            ORDER BY Portfolio_Type__c, Name
        ];
    }

    /**
     * Get contact-to-portfolio mapping for explicit assignments.
     */
    private static Map<Id, Set<Id>> getContactPortfolioMap(List<Id> approvalIds) {
        Map<Id, Set<Id>> result = new Map<Id, Set<Id>>();

        // Get contacts from approvals
        Set<Id> contactIds = new Set<Id>();
        for (Journey_Approval__c ja : [SELECT Contact__c FROM Journey_Approval__c WHERE Id IN :approvalIds]) {
            if (ja.Contact__c != null) {
                contactIds.add(ja.Contact__c);
            }
        }

        if (contactIds.isEmpty()) {
            return result;
        }

        // Get portfolio memberships
        for (Portfolio_Member__c pm : [
            SELECT Contact__c, Portfolio__c
            FROM Portfolio_Member__c
            WHERE Contact__c IN :contactIds
        ]) {
            if (!result.containsKey(pm.Contact__c)) {
                result.put(pm.Contact__c, new Set<Id>());
            }
            result.get(pm.Contact__c).add(pm.Portfolio__c);
        }

        return result;
    }

    /**
     * Map US state to region.
     */
    private static String getRegionForState(String state) {
        if (state == null) return null;

        Set<String> northeast = new Set<String>{'CT', 'DE', 'MA', 'MD', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'};
        Set<String> southeast = new Set<String>{'AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'};
        Set<String> midwest = new Set<String>{'IA', 'IL', 'IN', 'KS', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'SD', 'WI'};
        Set<String> southwest = new Set<String>{'AZ', 'NM', 'OK', 'TX'};
        Set<String> west = new Set<String>{'AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'};

        String stateUpper = state.toUpperCase();
        if (northeast.contains(stateUpper)) return 'Northeast';
        if (southeast.contains(stateUpper)) return 'Southeast';
        if (midwest.contains(stateUpper)) return 'Midwest';
        if (southwest.contains(stateUpper)) return 'Southwest';
        if (west.contains(stateUpper)) return 'West';
        return 'International';
    }

    // Result wrapper classes
    public class AssignmentResult {
        @AuraEnabled public Boolean success = false;
        @AuraEnabled public String message;
        @AuraEnabled public String errorMessage;
        @AuraEnabled public Id portfolioId;
        @AuraEnabled public String portfolioName;
        @AuraEnabled public Id assignedMarketerId;
        @AuraEnabled public String approvalTier;
    }

    public class InboxStats {
        @AuraEnabled public Integer totalPending = 0;
        @AuraEnabled public Integer autoSendCount = 0;
        @AuraEnabled public Integer softReviewCount = 0;
        @AuraEnabled public Integer reviewRequiredCount = 0;
        @AuraEnabled public Integer escalateCount = 0;
        @AuraEnabled public Integer immediateCount = 0;
        @AuraEnabled public Integer thisWeekCount = 0;
        @AuraEnabled public Integer thisMonthCount = 0;
        @AuraEnabled public Integer approachingDeadlineCount = 0;
        @AuraEnabled public Integer portfolioCount = 0;
    }

    /**
     * Check if current user is a manager (can see all portfolios).
     * Managers are identified by:
     * - System Admin profile
     * - Custom permission 'Marketing_Concierge_Manager'
     * - Being a primary marketer on 3+ portfolios
     */
    @AuraEnabled(cacheable=true)
    public static Boolean isManager() {
        Id currentUserId = UserInfo.getUserId();

        // Check profile
        User currentUser = [SELECT Profile.Name FROM User WHERE Id = :currentUserId LIMIT 1];
        if (currentUser.Profile.Name == 'System Administrator') {
            return true;
        }

        // Check custom permission (if exists)
        // Note: FeatureManagement.checkPermission() would be used if custom permission exists
        // For now, we'll use a simpler approach

        // Check if user manages multiple portfolios
        Integer portfolioCount = [
            SELECT COUNT()
            FROM Marketer_Portfolio__c
            WHERE Primary_Marketer__c = :currentUserId
            AND Is_Active__c = true
        ];

        return portfolioCount >= 3;
    }

    /**
     * Get list of portfolios available to the current user.
     * Managers see all portfolios, marketers see only their assigned ones.
     */
    @AuraEnabled(cacheable=true)
    public static List<PortfolioOption> getAvailablePortfolios() {
        List<PortfolioOption> options = new List<PortfolioOption>();
        Id currentUserId = UserInfo.getUserId();
        Boolean userIsManager = isManager();

        if (userIsManager) {
            // Add "All Portfolios" option for managers
            options.add(new PortfolioOption('all', 'All Portfolios', true));

            // Add all active portfolios
            for (Marketer_Portfolio__c p : [
                SELECT Id, Name, Primary_Marketer__r.Name, Current_Workload__c
                FROM Marketer_Portfolio__c
                WHERE Is_Active__c = true
                ORDER BY Name
            ]) {
                String label = p.Name;
                if (p.Primary_Marketer__r != null) {
                    label += ' (' + p.Primary_Marketer__r.Name + ')';
                }
                options.add(new PortfolioOption(p.Id, label, false));
            }
        } else {
            // Marketers only see their portfolios
            List<Marketer_Portfolio__c> myPortfolios = [
                SELECT Id, Name, Current_Workload__c
                FROM Marketer_Portfolio__c
                WHERE (Primary_Marketer__c = :currentUserId OR Secondary_Marketer__c = :currentUserId)
                AND Is_Active__c = true
                ORDER BY Name
            ];

            if (myPortfolios.size() == 1) {
                // Single portfolio - no need for "All" option
                options.add(new PortfolioOption(myPortfolios[0].Id, myPortfolios[0].Name, false));
            } else if (myPortfolios.size() > 1) {
                // Multiple portfolios - add "My Portfolios" option
                options.add(new PortfolioOption('my', 'My Portfolios', true));
                for (Marketer_Portfolio__c p : myPortfolios) {
                    options.add(new PortfolioOption(p.Id, p.Name, false));
                }
            }
        }

        return options;
    }

    /**
     * Get approvals filtered by portfolio.
     * portfolioId can be:
     * - 'all' for all portfolios (managers only)
     * - 'my' for current user's portfolios
     * - A specific portfolio Id
     */
    @AuraEnabled(cacheable=true)
    public static List<Journey_Approval__c> getApprovalsByPortfolio(String portfolioId) {
        Id currentUserId = UserInfo.getUserId();
        Set<Id> portfolioIds = new Set<Id>();

        if (portfolioId == 'all') {
            // Manager view - all portfolios
            if (!isManager()) {
                // Non-manager trying to see all - fall back to their portfolios
                portfolioId = 'my';
            } else {
                for (Marketer_Portfolio__c p : [
                    SELECT Id FROM Marketer_Portfolio__c WHERE Is_Active__c = true
                ]) {
                    portfolioIds.add(p.Id);
                }
            }
        }

        if (portfolioId == 'my' || portfolioIds.isEmpty()) {
            // Get user's portfolios
            for (Marketer_Portfolio__c p : [
                SELECT Id FROM Marketer_Portfolio__c
                WHERE (Primary_Marketer__c = :currentUserId OR Secondary_Marketer__c = :currentUserId)
                AND Is_Active__c = true
            ]) {
                portfolioIds.add(p.Id);
            }
        } else if (portfolioId != 'all') {
            // Specific portfolio - verify access
            try {
                Id specificId = Id.valueOf(portfolioId);
                Boolean userIsManager = isManager();

                // Check if user has access to this portfolio
                List<Marketer_Portfolio__c> portfolioList;
                if (userIsManager) {
                    // Managers can access any portfolio
                    portfolioList = [
                        SELECT Id FROM Marketer_Portfolio__c
                        WHERE Id = :specificId
                        LIMIT 1
                    ];
                } else {
                    // Non-managers can only access their assigned portfolios
                    portfolioList = [
                        SELECT Id FROM Marketer_Portfolio__c
                        WHERE Id = :specificId
                        AND (Primary_Marketer__c = :currentUserId
                             OR Secondary_Marketer__c = :currentUserId)
                        LIMIT 1
                    ];
                }

                if (!portfolioList.isEmpty()) {
                    portfolioIds.add(portfolioList[0].Id);
                }
            } catch (Exception e) {
                // Invalid portfolio ID - fall back to user's portfolios
                return getMyPendingApprovals();
            }
        }

        if (portfolioIds.isEmpty()) {
            return new List<Journey_Approval__c>();
        }

        return [
            SELECT Id, Name, Status__c, Contact__c, Contact__r.Name, Contact__r.Email,
                   Meaningful_Event__r.Event_Type__c, Meaningful_Event__r.Event_Date__c,
                   Suggested_Subject__c, Suggested_Body__c, Channel__c,
                   Generated_Image_URL__c, Recommended_Products__c, Firefly_Prompt__c,
                   Confidence_Score__c, Approval_Tier__c, Priority_Score__c,
                   Customer_Value_Score__c, Auto_Send_Deadline__c,
                   Assigned_Portfolio__c, Assigned_Portfolio__r.Name,
                   Journey_Id__c, Step_Number__c, Total_Steps__c, Send_Delay_Days__c,
                   Journey_Guardrails__c, SMS_Body__c,
                   Urgency__c, Days_Until_Event__c, CreatedDate,
                   Marketing_Flow__c, Marketing_Flow__r.Name, Marketing_Flow__r.Flow_URL__c,
                   Marketing_Flow__r.Status__c
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c IN :portfolioIds
            AND Status__c = 'Pending'
            ORDER BY Priority_Score__c DESC NULLS LAST, CreatedDate ASC
            LIMIT 200
        ];
    }

    /**
     * Get inbox stats filtered by portfolio.
     */
    @AuraEnabled(cacheable=true)
    public static InboxStats getStatsByPortfolio(String portfolioId) {
        Id currentUserId = UserInfo.getUserId();
        InboxStats stats = new InboxStats();
        Set<Id> portfolioIds = new Set<Id>();

        if (portfolioId == 'all' && isManager()) {
            for (Marketer_Portfolio__c p : [
                SELECT Id FROM Marketer_Portfolio__c WHERE Is_Active__c = true
            ]) {
                portfolioIds.add(p.Id);
            }
        } else if (portfolioId == 'my' || portfolioId == 'all') {
            for (Marketer_Portfolio__c p : [
                SELECT Id FROM Marketer_Portfolio__c
                WHERE (Primary_Marketer__c = :currentUserId OR Secondary_Marketer__c = :currentUserId)
                AND Is_Active__c = true
            ]) {
                portfolioIds.add(p.Id);
            }
        } else {
            try {
                portfolioIds.add(Id.valueOf(portfolioId));
            } catch (Exception e) {
                return stats;
            }
        }

        if (portfolioIds.isEmpty()) {
            return stats;
        }

        // Count by tier
        List<AggregateResult> tierCounts = [
            SELECT Approval_Tier__c tier, COUNT(Id) cnt
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c IN :portfolioIds
            AND Status__c = 'Pending'
            GROUP BY Approval_Tier__c
        ];

        for (AggregateResult ar : tierCounts) {
            String tier = (String)ar.get('tier');
            Integer cnt = (Integer)ar.get('cnt');
            stats.totalPending += cnt;

            if (tier == 'Auto-Send') stats.autoSendCount = cnt;
            else if (tier == 'Soft Review') stats.softReviewCount = cnt;
            else if (tier == 'Review Required') stats.reviewRequiredCount = cnt;
            else if (tier == 'Escalate') stats.escalateCount = cnt;
        }

        // Count by urgency
        List<AggregateResult> urgencyCounts = [
            SELECT Urgency__c urg, COUNT(Id) cnt
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c IN :portfolioIds
            AND Status__c = 'Pending'
            GROUP BY Urgency__c
        ];

        for (AggregateResult ar : urgencyCounts) {
            String urg = (String)ar.get('urg');
            Integer cnt = (Integer)ar.get('cnt');

            if (urg == 'Immediate') stats.immediateCount = cnt;
            else if (urg == 'This Week') stats.thisWeekCount = cnt;
            else if (urg == 'This Month') stats.thisMonthCount = cnt;
        }

        // Count approaching deadlines
        stats.approachingDeadlineCount = [
            SELECT COUNT()
            FROM Journey_Approval__c
            WHERE Assigned_Portfolio__c IN :portfolioIds
            AND Status__c = 'Pending'
            AND Approval_Tier__c = 'Soft Review'
            AND Auto_Send_Deadline__c <= :DateTime.now().addHours(1)
        ];

        stats.portfolioCount = portfolioIds.size();

        return stats;
    }

    /**
     * Portfolio option for the dropdown.
     */
    public class PortfolioOption {
        @AuraEnabled public String value;
        @AuraEnabled public String label;
        @AuraEnabled public Boolean isAggregate; // true for 'all' or 'my'

        public PortfolioOption(String value, String label, Boolean isAggregate) {
            this.value = value;
            this.label = label;
            this.isAggregate = isAggregate;
        }
    }
}
