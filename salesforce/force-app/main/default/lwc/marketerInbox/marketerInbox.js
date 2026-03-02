import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAvailablePortfolios from '@salesforce/apex/PortfolioAssignmentService.getAvailablePortfolios';
import getApprovalsByPortfolio from '@salesforce/apex/PortfolioAssignmentService.getApprovalsByPortfolio';
import getStatsByPortfolio from '@salesforce/apex/PortfolioAssignmentService.getStatsByPortfolio';
import isManager from '@salesforce/apex/PortfolioAssignmentService.isManager';
import approveJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.approveJourneyFromLWC';
import declineJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.declineJourneyFromLWC';
import sendJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.sendJourneyFromLWC';
import regenerateImageFromLWC from '@salesforce/apex/JourneyApprovalService.regenerateImageFromLWC';
import regenerateVideoFromLWC from '@salesforce/apex/JourneyApprovalService.regenerateVideoFromLWC';
import checkVideoStatus from '@salesforce/apex/JourneyApprovalService.checkVideoStatus';
import updateProductsFromLWC from '@salesforce/apex/JourneyApprovalService.updateProductsFromLWC';
import approveAllJourneySteps from '@salesforce/apex/JourneyApprovalService.approveAllJourneySteps';
import declineAllJourneySteps from '@salesforce/apex/JourneyApprovalService.declineAllJourneySteps';
import sendJourneyToMarketingFlow from '@salesforce/apex/JourneyApprovalService.sendJourneyToMarketingFlow';
import processEventsNow from '@salesforce/apex/JourneyApprovalService.processEventsNow';
import sendMediaActivation from '@salesforce/apex/JourneyApprovalService.sendMediaActivation';
import Id from '@salesforce/user/Id';

/**
 * Marketer Inbox Component
 *
 * Personal inbox for marketers showing their portfolio's pending opportunities.
 * Features:
 * - Journey grouping (multi-step flows shown together)
 * - Tiered view (Auto-Send, Soft Review, Review Required, Escalate)
 * - Priority-based ordering
 * - Quick actions (approve, decline, edit, send)
 * - Bulk actions for multi-step journeys
 * - Deadline countdown for soft review items
 * - Stats dashboard
 */
export default class MarketerInbox extends LightningElement {
    @track approvals = [];
    @track stats = {};
    @track isLoading = true;
    @track selectedApproval = null;
    @track showDetailModal = false;
    @track activeFilter = 'all';
    @track showToast = false;
    @track toastMessage = '';
    @track toastVariant = 'success';
    @track expandedJourneys = new Set(); // Track which journey groups are expanded
    @track isProcessingEvents = false;

    // Portfolio filter state
    @track portfolioOptions = [];
    @track selectedPortfolio = 'my'; // Default to user's portfolios
    @track userIsManager = false;
    @track showPortfolioFilter = false;

    currentUserId = Id;
    wiredApprovalsResult;
    wiredStatsResult;
    wiredPortfoliosResult;

    // Check if user is a manager
    @wire(isManager)
    wiredIsManager({ error, data }) {
        if (data !== undefined) {
            this.userIsManager = data;
        }
    }

    // Get available portfolios for the dropdown
    @wire(getAvailablePortfolios)
    wiredPortfolios(result) {
        this.wiredPortfoliosResult = result;
        if (result.data) {
            this.portfolioOptions = result.data.map(p => ({
                label: p.label,
                value: p.value
            }));
            // Show filter if multiple options
            this.showPortfolioFilter = this.portfolioOptions.length > 1;
            // Set default selection
            if (this.portfolioOptions.length > 0) {
                this.selectedPortfolio = this.portfolioOptions[0].value;
            }
        }
    }

    // Get approvals filtered by selected portfolio
    @wire(getApprovalsByPortfolio, { portfolioId: '$selectedPortfolio' })
    wiredApprovals(result) {
        console.log('[MarketerInbox] wiredApprovals callback triggered');
        this.wiredApprovalsResult = result;
        this.isLoading = false;

        if (result.data) {
            console.log('[MarketerInbox] Received', result.data.length, 'approvals from wire');
            // Log first approval's image URL for debugging
            if (result.data.length > 0) {
                console.log('[MarketerInbox] First approval image URL:', result.data[0].Generated_Image_URL__c);
            }
            this.approvals = result.data.map(approval => this.enrichApproval(approval));
        } else if (result.error) {
            this.showToastMessage('Error loading inbox: ' + result.error.body?.message, 'error');
        }
    }

    // Get stats filtered by selected portfolio
    @wire(getStatsByPortfolio, { portfolioId: '$selectedPortfolio' })
    wiredStats(result) {
        this.wiredStatsResult = result;
        if (result.data) {
            this.stats = result.data;
        }
    }

    // Handle portfolio filter change
    handlePortfolioChange(event) {
        this.selectedPortfolio = event.detail.value;
        this.isLoading = true;
        // Wire will automatically refresh with new portfolioId
    }

    /**
     * Enrich approval with computed display properties.
     */
    enrichApproval(approval) {
        const isPastDue = this.checkIsPastDue(approval.Auto_Send_Deadline__c);
        return {
            ...approval,
            // Add timestamp to force LWC to detect changes after refresh
            _refreshTimestamp: Date.now(),
            contactName: approval.Contact__r?.Name || 'Unknown',
            contactEmail: approval.Contact__r?.Email || '',
            eventType: approval.Event_Type__c || approval.Meaningful_Event__r?.Event_Type__c || 'General',
            eventDate: approval.Event_Date__c || approval.Meaningful_Event__r?.Event_Date__c,
            portfolioName: approval.Assigned_Portfolio__r?.Name || 'Unassigned',
            daysDisplay: this.getDaysDisplay(approval.Days_Until_Event__c),
            itemClass: isPastDue ? 'inbox-item slds-box past-due-item' : 'inbox-item slds-box',
            tierClass: isPastDue ? 'tier-past-due' : this.getTierClass(approval.Approval_Tier__c),
            tierIcon: isPastDue ? 'utility:ban' : this.getTierIcon(approval.Approval_Tier__c),
            urgencyClass: this.getUrgencyClass(approval.Urgency__c),
            channelIcon: this.getChannelIcon(approval.Channel__c),
            isMediaChannel: approval.Channel__c === 'Media',
            merkuryLogoUrl: 'https://agentforce-retail-advisor.vercel.app/assets/merkury-logo.png',
            confidenceClass: this.getConfidenceClass(approval.Confidence_Score__c),
            deadlineDisplay: this.getDeadlineDisplay(approval.Auto_Send_Deadline__c),
            isApproachingDeadline: this.isApproachingDeadline(approval.Auto_Send_Deadline__c),
            isPastDue: isPastDue,
            priorityDisplay: this.getPriorityDisplay(approval.Priority_Score__c),
            isMultiStep: approval.Total_Steps__c > 1,
            stepDisplay: approval.Total_Steps__c > 1 ?
                `Step ${approval.Step_Number__c} of ${approval.Total_Steps__c}` : null,
            // Marketing Flow link (if exists)
            hasMarketingFlow: !!approval.Marketing_Flow__c,
            marketingFlowName: approval.Marketing_Flow__r?.Name,
            marketingFlowUrl: approval.Marketing_Flow__r?.Flow_URL__c
        };
    }

    /**
     * Parse raw Event_Summary__c into a clean, readable summary.
     * Raw format: "EVENT TYPE: X DESCRIPTION: Y EVENT DATE: Z DAYS UNTIL: N URGENCY: U AGENT INSIGHT: I CAPTURED: T"
     * Output: "Y — I" (description + agent insight)
     */
    formatEventSummary(raw) {
        if (!raw) return '';

        // Try to parse structured fields from the raw summary
        const descMatch = raw.match(/DESCRIPTION:\s*(.+?)(?=\s+EVENT DATE:|$)/i);
        const insightMatch = raw.match(/AGENT INSIGHT:\s*(.+?)(?=\s+CAPTURED:|$)/i);
        const dateMatch = raw.match(/EVENT DATE:\s*(\S+)/i);
        const daysMatch = raw.match(/DAYS UNTIL:\s*(\S+)/i);

        const parts = [];

        if (descMatch && descMatch[1].trim()) {
            parts.push(descMatch[1].trim());
        }

        if (dateMatch && dateMatch[1].trim() && dateMatch[1].trim() !== 'No') {
            const days = daysMatch ? daysMatch[1].trim() : null;
            if (days && days !== 'No') {
                parts.push(`in ${days} days (${dateMatch[1].trim()})`);
            }
        }

        if (insightMatch && insightMatch[1].trim()) {
            const insight = insightMatch[1].trim();
            // Capitalize first letter and add as a separate line
            parts.push(insight.charAt(0).toUpperCase() + insight.slice(1));
        }

        // If parsing failed, fall back to truncated raw text
        if (parts.length === 0) {
            return raw.length > 120 ? raw.substring(0, 120) + '…' : raw;
        }

        // Join description + timeline on one line, insight as context
        if (parts.length >= 3) {
            return `${parts[0]} ${parts[1]} — ${parts[2]}`;
        }
        return parts.join(' — ');
    }

    getDaysDisplay(days) {
        if (days === null || days === undefined) return 'No date';
        if (days === 0) return 'Today!';
        if (days === 1) return 'Tomorrow';
        if (days < 0) return `${Math.abs(days)} days ago`;
        return `${days} days`;
    }

    // Filter getters
    get filteredApprovals() {
        // Past due filter shows only past due items
        if (this.activeFilter === 'past-due') {
            return this.approvals.filter(a => a.isPastDue);
        }

        // All other filters exclude past due items by default
        let filtered = this.approvals.filter(a => !a.isPastDue);

        if (this.activeFilter === 'all') {
            return filtered;
        }

        return filtered.filter(a => {
            switch (this.activeFilter) {
                case 'immediate':
                    return a.Urgency__c === 'Immediate';
                case 'soft-review':
                    return a.Approval_Tier__c === 'Soft Review';
                case 'review-required':
                    return a.Approval_Tier__c === 'Review Required';
                case 'escalate':
                    return a.Approval_Tier__c === 'Escalate';
                default:
                    return true;
            }
        });
    }

    /**
     * Group approvals by Journey_Id__c for multi-step flows.
     * Single-step items get their own "group" for consistent rendering.
     */
    get groupedApprovals() {
        const groups = new Map();

        for (const approval of this.filteredApprovals) {
            const journeyId = approval.Journey_Id__c || approval.Id; // Use record ID for single-step

            if (!groups.has(journeyId)) {
                groups.set(journeyId, {
                    journeyId: journeyId,
                    isMultiStep: !!approval.Journey_Id__c && approval.Total_Steps__c > 1,
                    contactName: approval.contactName,
                    contactEmail: approval.contactEmail,
                    eventType: approval.eventType,
                    eventDate: approval.eventDate,
                    eventSummary: this.formatEventSummary(approval.Event_Summary__c),
                    confidenceScore: approval.Confidence_Score__c || 0,
                    portfolioName: approval.portfolioName,
                    totalSteps: approval.Total_Steps__c || 1,
                    steps: [],
                    // Aggregate tier (worst tier in the group)
                    worstTier: null,
                    worstTierClass: null,
                    worstTierIcon: null,
                    // Priority (highest in group)
                    highestPriority: 0,
                    // Urgency (most urgent in group)
                    urgency: null,
                    urgencyClass: null,
                    // Deadline (earliest in group)
                    earliestDeadline: null,
                    isApproachingDeadline: false,
                    // Past due tracking
                    isPastDue: false,
                    hasAnyPastDue: false,
                    // Expansion state
                    isExpanded: this.expandedJourneys.has(journeyId),
                    expandIcon: this.expandedJourneys.has(journeyId) ? 'utility:chevrondown' : 'utility:chevronright'
                });
            }

            const group = groups.get(journeyId);
            group.steps.push(approval);

            // Update aggregate values
            group.highestPriority = Math.max(group.highestPriority, approval.Priority_Score__c || 0);

            // Track worst tier (Escalate > Review Required > Soft Review > Auto-Send)
            const tierRank = this.getTierRank(approval.Approval_Tier__c);
            const currentRank = this.getTierRank(group.worstTier);
            if (tierRank > currentRank) {
                group.worstTier = approval.Approval_Tier__c;
                group.worstTierClass = approval.tierClass;
                group.worstTierIcon = approval.tierIcon;
            }

            // Track most urgent
            const urgencyRank = this.getUrgencyRank(approval.Urgency__c);
            const currentUrgencyRank = this.getUrgencyRank(group.urgency);
            if (urgencyRank > currentUrgencyRank) {
                group.urgency = approval.Urgency__c;
                group.urgencyClass = approval.urgencyClass;
            }

            // Track earliest deadline
            if (approval.Auto_Send_Deadline__c) {
                if (!group.earliestDeadline || new Date(approval.Auto_Send_Deadline__c) < new Date(group.earliestDeadline)) {
                    group.earliestDeadline = approval.Auto_Send_Deadline__c;
                    group.deadlineDisplay = approval.deadlineDisplay;
                    group.isApproachingDeadline = approval.isApproachingDeadline;
                }
            }

            // Track past due status
            if (approval.isPastDue) {
                group.hasAnyPastDue = true;
            }
        }

        // Determine if entire group is past due (all steps are past due)
        for (const group of groups.values()) {
            group.isPastDue = group.steps.length > 0 && group.steps.every(s => s.isPastDue);
        }

        // Sort steps within each group by step number
        for (const group of groups.values()) {
            group.steps.sort((a, b) => (a.Step_Number__c || 0) - (b.Step_Number__c || 0));
            group.stepCount = group.steps.length;
            group.stepsLabel = group.isMultiStep ?
                `${group.stepCount} step${group.stepCount > 1 ? 's' : ''}` : null;
        }

        // Convert to array and sort by priority
        return Array.from(groups.values()).sort((a, b) => b.highestPriority - a.highestPriority);
    }

    getTierRank(tier) {
        const ranks = { 'Auto-Send': 1, 'Soft Review': 2, 'Review Required': 3, 'Escalate': 4 };
        return ranks[tier] || 0;
    }

    getUrgencyRank(urgency) {
        const ranks = { 'Immediate': 4, 'This Week': 3, 'This Month': 2, 'Future': 1 };
        return ranks[urgency] || 0;
    }

    get hasApprovals() {
        return this.filteredApprovals && this.filteredApprovals.length > 0;
    }

    get hasGroupedApprovals() {
        return this.groupedApprovals && this.groupedApprovals.length > 0;
    }

    get filterOptions() {
        const activePending = (this.stats.totalPending || 0) - (this.stats.pastDueCount || 0);
        const options = [
            { label: `All (${activePending})`, value: 'all' },
            { label: `Immediate (${this.stats.immediateCount || 0})`, value: 'immediate' },
            { label: `Soft Review (${this.stats.softReviewCount || 0})`, value: 'soft-review' },
            { label: `Review Required (${this.stats.reviewRequiredCount || 0})`, value: 'review-required' },
            { label: `Escalate (${this.stats.escalateCount || 0})`, value: 'escalate' }
        ];

        // Add Past Due option if there are any
        if (this.stats.pastDueCount > 0) {
            options.push({ label: `Past Due (${this.stats.pastDueCount})`, value: 'past-due' });
        }

        return options;
    }

    // Dynamic title based on selected portfolio
    get inboxTitle() {
        if (this.selectedPortfolio === 'all') {
            return 'All Portfolios';
        } else if (this.selectedPortfolio === 'my') {
            return 'My Marketing Inbox';
        } else {
            // Find the portfolio name from options
            const option = this.portfolioOptions.find(p => p.value === this.selectedPortfolio);
            return option ? option.label : 'Marketing Inbox';
        }
    }

    // Stats getters
    get hasStats() {
        return this.stats && this.stats.totalPending !== undefined;
    }

    get hasDeadlineWarning() {
        return this.stats.approachingDeadlineCount > 0;
    }

    get hasPastDue() {
        return this.stats.pastDueCount > 0;
    }

    get activePendingCount() {
        return (this.stats.totalPending || 0) - (this.stats.pastDueCount || 0);
    }

    get isPastDueFilter() {
        return this.activeFilter === 'past-due';
    }

    // Tier styling
    getTierClass(tier) {
        const classes = {
            'Auto-Send': 'tier-auto-send',
            'Soft Review': 'tier-soft-review',
            'Review Required': 'tier-review-required',
            'Escalate': 'tier-escalate'
        };
        return classes[tier] || 'tier-default';
    }

    getTierIcon(tier) {
        const icons = {
            'Auto-Send': 'utility:check',
            'Soft Review': 'utility:clock',
            'Review Required': 'utility:edit',
            'Escalate': 'utility:warning'
        };
        return icons[tier] || 'utility:question';
    }

    getUrgencyClass(urgency) {
        const classes = {
            'Immediate': 'slds-badge slds-theme_error',
            'This Week': 'slds-badge slds-theme_warning',
            'This Month': 'slds-badge slds-theme_success',
            'Future': 'slds-badge'
        };
        return classes[urgency] || 'slds-badge';
    }

    getChannelIcon(channel) {
        const icons = {
            'Email': 'utility:email',
            'SMS': 'utility:chat',
            'Push': 'utility:notification',
            'Video': 'utility:video',
            'Media': 'utility:broadcast'
        };
        return icons[channel] || 'utility:email';
    }

    getConfidenceClass(score) {
        if (score >= 80) return 'confidence-high';
        if (score >= 50) return 'confidence-medium';
        return 'confidence-low';
    }

    getDeadlineDisplay(deadline) {
        if (!deadline) return null;
        const deadlineDate = new Date(deadline);
        const now = new Date();
        const diffMs = deadlineDate - now;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffMs <= 0) return 'Past Due';
        if (diffHours < 1) return `${diffMins}m until auto-send`;
        return `${diffHours}h ${diffMins}m until auto-send`;
    }

    isApproachingDeadline(deadline) {
        if (!deadline) return false;
        const deadlineDate = new Date(deadline);
        const now = new Date();
        const diffMs = deadlineDate - now;
        return diffMs > 0 && diffMs < (60 * 60 * 1000); // Less than 1 hour
    }

    checkIsPastDue(deadline) {
        if (!deadline) return false;
        const deadlineDate = new Date(deadline);
        const now = new Date();
        return deadlineDate < now;
    }

    getPriorityDisplay(score) {
        if (score >= 70) return 'High Priority';
        if (score >= 40) return 'Medium Priority';
        return 'Normal';
    }

    // Event handlers
    handleFilterChange(event) {
        this.activeFilter = event.detail.value;
    }

    handleStatClick(event) {
        const filter = event.currentTarget.dataset.filter;
        if (filter) {
            this.activeFilter = filter;
        }
    }

    async handleProcessEvents() {
        this.isProcessingEvents = true;
        try {
            const result = await processEventsNow();
            if (result.success) {
                this.showToastMessage(result.message || 'Events processed successfully', 'success');
                // Refresh inbox after processing
                await Promise.all([
                    refreshApex(this.wiredApprovalsResult),
                    refreshApex(this.wiredStatsResult)
                ]);
            } else {
                this.showToastMessage(result.errorMessage || 'Failed to process events', 'error');
            }
        } catch (error) {
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isProcessingEvents = false;
        }
    }

    handleRefresh() {
        this.isLoading = true;
        Promise.all([
            refreshApex(this.wiredApprovalsResult),
            refreshApex(this.wiredStatsResult),
            refreshApex(this.wiredPortfoliosResult)
        ]).then(() => {
            this.isLoading = false;
            this.showToastMessage('Inbox refreshed', 'success');
        });
    }

    /**
     * Toggle journey group expansion.
     */
    handleToggleJourney(event) {
        event.stopPropagation();
        const journeyId = event.currentTarget.dataset.journeyId;

        if (this.expandedJourneys.has(journeyId)) {
            this.expandedJourneys.delete(journeyId);
        } else {
            this.expandedJourneys.add(journeyId);
        }

        // Force re-render by creating new Set
        this.expandedJourneys = new Set(this.expandedJourneys);
    }

    /**
     * Approve all steps in a multi-step journey.
     */
    async handleApproveAllSteps(event) {
        event.stopPropagation();
        const journeyId = event.currentTarget.dataset.journeyId;
        const group = this.groupedApprovals.find(g => g.journeyId === journeyId);

        if (!group) return;

        this.isLoading = true;
        try {
            const result = await approveAllJourneySteps({ journeyId: journeyId });

            if (result.success) {
                this.showToastMessage(`Approved all ${group.stepCount} steps for ${group.contactName}`, 'success');
                await refreshApex(this.wiredApprovalsResult);
                await refreshApex(this.wiredStatsResult);
            } else {
                this.showToastMessage(result.errorMessage || 'Bulk approval failed', 'error');
            }
        } catch (error) {
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Decline all steps in a multi-step journey.
     */
    async handleDeclineAllSteps(event) {
        event.stopPropagation();
        const journeyId = event.currentTarget.dataset.journeyId;
        const group = this.groupedApprovals.find(g => g.journeyId === journeyId);

        if (!group) return;

        this.isLoading = true;
        try {
            const result = await declineAllJourneySteps({ journeyId: journeyId, reason: 'Bulk declined from inbox' });

            if (result.success) {
                this.showToastMessage(`Declined all ${group.stepCount} steps for ${group.contactName}`, 'success');
                await refreshApex(this.wiredApprovalsResult);
                await refreshApex(this.wiredStatsResult);
            } else {
                this.showToastMessage(result.errorMessage || 'Bulk decline failed', 'error');
            }
        } catch (error) {
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Send entire journey flow to Marketing Cloud.
     */
    async handleSendFlow(event) {
        event.stopPropagation();
        const journeyId = event.currentTarget.dataset.journeyId;
        const group = this.groupedApprovals.find(g => g.journeyId === journeyId);

        if (!group) return;

        this.isLoading = true;
        try {
            // First approve all if not already approved
            let approveResult = await approveAllJourneySteps({ journeyId: journeyId });

            if (!approveResult.success) {
                this.showToastMessage(approveResult.errorMessage || 'Approval failed', 'error');
                return;
            }

            // Then send to MC
            const sendResult = await sendJourneyToMarketingFlow({ journeyId: journeyId });

            if (sendResult.success) {
                this.showToastMessage(`Sent ${group.stepCount}-step journey for ${group.contactName} to Marketing Flow`, 'success');
                await refreshApex(this.wiredApprovalsResult);
                await refreshApex(this.wiredStatsResult);
            } else {
                this.showToastMessage(sendResult.errorMessage || 'Send failed', 'error');
            }
        } catch (error) {
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleViewDetails(event) {
        const approvalId = event.currentTarget.dataset.id;
        this.selectedApproval = this.approvals.find(a => a.Id === approvalId);
        this.showDetailModal = true;
    }

    handleCloseModal() {
        this.showDetailModal = false;
        this.selectedApproval = null;
    }

    async handleQuickApprove(event) {
        event.stopPropagation();
        const approvalId = event.currentTarget.dataset.id;
        const approval = this.approvals.find(a => a.Id === approvalId);

        if (!approval) return;

        this.isLoading = true;
        try {
            const result = await approveJourneyFromLWC({
                approvalId: approvalId,
                subject: approval.Suggested_Subject__c,
                body: approval.Suggested_Body__c
            });

            if (result.success) {
                this.showToastMessage(`Approved: ${approval.contactName}`, 'success');
                await refreshApex(this.wiredApprovalsResult);
                await refreshApex(this.wiredStatsResult);
            } else {
                this.showToastMessage(result.errorMessage || 'Approval failed', 'error');
            }
        } catch (error) {
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleQuickSend(event) {
        event.stopPropagation();
        const approvalId = event.currentTarget.dataset.id;
        const approval = this.approvals.find(a => a.Id === approvalId);

        if (!approval) return;

        this.isLoading = true;
        try {
            // First approve, then send
            let result = await approveJourneyFromLWC({
                approvalId: approvalId,
                subject: approval.Suggested_Subject__c,
                body: approval.Suggested_Body__c
            });

            if (result.success) {
                result = await sendJourneyFromLWC({ approvalId: approvalId });

                if (result.success) {
                    this.showToastMessage(`Sent to ${approval.contactName}`, 'success');
                    await refreshApex(this.wiredApprovalsResult);
                    await refreshApex(this.wiredStatsResult);
                } else {
                    this.showToastMessage(result.errorMessage || 'Send failed', 'error');
                }
            } else {
                this.showToastMessage(result.errorMessage || 'Approval failed', 'error');
            }
        } catch (error) {
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleQuickDecline(event) {
        event.stopPropagation();
        const approvalId = event.currentTarget.dataset.id;
        const approval = this.approvals.find(a => a.Id === approvalId);

        if (!approval) return;

        this.isLoading = true;
        try {
            const result = await declineJourneyFromLWC({
                approvalId: approvalId,
                reason: 'Quick decline from inbox'
            });

            if (result.success) {
                this.showToastMessage(`Declined: ${approval.contactName}`, 'info');
                await refreshApex(this.wiredApprovalsResult);
                await refreshApex(this.wiredStatsResult);
            } else {
                this.showToastMessage(result.errorMessage || 'Decline failed', 'error');
            }
        } catch (error) {
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // Handle action from detail card
    async handleCardAction(event) {
        const { action, approvalId, data } = event.detail;
        console.log('[MarketerInbox] handleCardAction v2:', action, approvalId);

        // Handle step navigation and timing locally (no Apex call)
        switch (action) {
            case 'navigateStep':
                console.log('[MarketerInbox] navigateStep direction:', data.direction);
                this.handleNavigateStep(approvalId, data.direction);
                return;

            case 'updateTiming':
                console.log('[MarketerInbox] updateTiming not yet implemented');
                return;

            default:
                break;
        }

        this.isLoading = true;

        try {
            let result;

            switch (action) {
                case 'approve':
                    result = await approveJourneyFromLWC({
                        approvalId: approvalId,
                        subject: data.subject,
                        body: data.body
                    });
                    break;

                case 'decline':
                    result = await declineJourneyFromLWC({
                        approvalId: approvalId,
                        reason: data.reason
                    });
                    break;

                case 'regenerate':
                    result = await regenerateImageFromLWC({
                        approvalId: approvalId,
                        newPrompt: data.prompt,
                        productsJson: data.products
                    });
                    break;

                case 'regenerate_video':
                    result = await regenerateVideoFromLWC({
                        approvalId: approvalId,
                        newPrompt: data.prompt
                    });
                    break;

                case 'send':
                    result = await sendJourneyFromLWC({
                        approvalId: approvalId
                    });
                    break;

                case 'updateProducts':
                    result = await updateProductsFromLWC({
                        approvalId: approvalId,
                        productsJson: data.products
                    });
                    break;

                case 'approveJourney':
                    result = await approveAllJourneySteps({
                        journeyId: data.journeyId
                    });
                    break;

                case 'sendJourney':
                    result = await sendJourneyToMarketingFlow({
                        journeyId: data.journeyId
                    });
                    break;

                case 'sendMedia':
                    result = await sendMediaActivation({
                        approvalId: approvalId
                    });
                    break;

                default:
                    console.warn('[MarketerInbox] Unknown action:', action);
                    this.isLoading = false;
                    return;
            }

            console.log('[MarketerInbox] Action result:', result);

            // Video generation: intercept successful submit and start client-side polling
            if (action === 'regenerate_video' && result && result.success && result.newImageUrl) {
                const jobId = result.newImageUrl; // jobId stored in newImageUrl field from Apex
                console.log('[MarketerInbox] Video job submitted, starting polling for jobId:', jobId);
                this.showToastMessage('Your personalized video is being created — this typically takes 1-2 minutes.', 'info');
                this._pollVideoJob(approvalId, jobId);
                this.isLoading = false;
                return;
            }

            if (result.success) {
                this.showToastMessage(result.message || 'Action completed', 'success');
                console.log('[MarketerInbox] Refreshing approvals data...');
                await refreshApex(this.wiredApprovalsResult);
                console.log('[MarketerInbox] Refresh complete. Approvals count:', this.approvals?.length);

                // CRITICAL: Update selectedApproval with refreshed data so the card sees changes
                if (this.selectedApproval && this.approvals?.length > 0) {
                    const refreshedApproval = this.approvals.find(a => a.Id === approvalId);
                    if (refreshedApproval) {
                        console.log('[MarketerInbox] Updating selectedApproval with refreshed data');
                        console.log('[MarketerInbox] New image URL:', refreshedApproval.Generated_Image_URL__c);
                        console.log('[MarketerInbox] New body preview:', refreshedApproval.Suggested_Body__c?.substring(0, 100));
                        this.selectedApproval = refreshedApproval;
                    }
                }
                await refreshApex(this.wiredStatsResult);
            } else {
                this.showToastMessage(result.errorMessage || 'Action failed', 'error');
            }

        } catch (error) {
            console.error('[MarketerInbox] Action error:', error);
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
            // Refresh data on error to reset card states (like isGeneratingImage)
            await refreshApex(this.wiredApprovalsResult);
            // Also update selectedApproval on error to reset card state
            if (this.selectedApproval && this.approvals?.length > 0) {
                const refreshedApproval = this.approvals.find(a => a.Id === this.selectedApproval.Id);
                if (refreshedApproval) {
                    this.selectedApproval = refreshedApproval;
                }
            }
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Poll for video generation completion from the client side.
     * Calls checkVideoStatus every 5 seconds until the job succeeds or fails.
     */
    _pollVideoJob(approvalId, jobId) {
        const MAX_POLLS = 60; // 5 minutes max (60 × 5s)
        let pollCount = 0;

        const pollInterval = setInterval(async () => {
            pollCount++;
            console.log(`[MarketerInbox] Polling video job ${jobId} (attempt ${pollCount}/${MAX_POLLS})`);

            try {
                const statusResult = await checkVideoStatus({
                    approvalId: approvalId,
                    jobId: jobId
                });

                console.log('[MarketerInbox] Video poll result:', statusResult);

                if (statusResult.message === 'running') {
                    // Still generating — continue polling
                    if (pollCount >= MAX_POLLS) {
                        clearInterval(pollInterval);
                        this.showToastMessage('Video generation timed out after 5 minutes. Please try again.', 'error');
                    }
                    return;
                }

                // Job is done (succeeded or failed) — stop polling
                clearInterval(pollInterval);

                if (statusResult.success && statusResult.message === 'succeeded') {
                    this.showToastMessage('Video generated successfully!', 'success');
                    // Refresh data to pick up the new video URL
                    await refreshApex(this.wiredApprovalsResult);
                    if (this.selectedApproval && this.approvals?.length > 0) {
                        const refreshed = this.approvals.find(a => a.Id === approvalId);
                        if (refreshed) {
                            this.selectedApproval = { ...refreshed };
                        }
                    }
                } else {
                    this.showToastMessage(statusResult.errorMessage || 'Video generation failed', 'error');
                }
            } catch (error) {
                console.error('[MarketerInbox] Video poll error:', error);
                // Don't stop polling on transient errors — just log and continue
                if (pollCount >= MAX_POLLS) {
                    clearInterval(pollInterval);
                    this.showToastMessage('Video generation polling failed: ' + (error.body?.message || error.message), 'error');
                }
            }
        }, 5000); // Poll every 5 seconds
    }

    /**
     * Navigate to a sibling step within the same journey.
     * Updates selectedApproval so the detail modal card re-renders with the new step.
     */
    handleNavigateStep(approvalId, direction) {
        // Find the current approval
        const current = this.approvals.find(a => a.Id === approvalId);
        if (!current || !current.Journey_Id__c) {
            console.warn('[MarketerInbox] Approval or Journey_Id not found for:', approvalId);
            return;
        }

        // Get ALL sibling steps (unfiltered) sorted by step number
        const siblings = this.approvals
            .filter(a => a.Journey_Id__c === current.Journey_Id__c)
            .sort((a, b) => (a.Step_Number__c || 0) - (b.Step_Number__c || 0));

        const currentIndex = siblings.findIndex(s => s.Id === approvalId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex < 0 || newIndex >= siblings.length) return;

        const newStep = siblings[newIndex];
        console.log('[MarketerInbox] Navigating to step', newStep.Step_Number__c, 'of', current.Total_Steps__c);
        // Spread to force LWC reactivity
        this.selectedApproval = { ...newStep };
    }

    showToastMessage(message, variant) {
        this.toastMessage = message;
        this.toastVariant = variant;
        this.showToast = true;

        setTimeout(() => {
            this.showToast = false;
        }, 4000);
    }

    closeToast() {
        this.showToast = false;
    }

    get toastClass() {
        return `slds-notify slds-notify_toast slds-theme_${this.toastVariant}`;
    }

    get toastIcon() {
        const icons = {
            success: 'utility:success',
            error: 'utility:error',
            warning: 'utility:warning',
            info: 'utility:info'
        };
        return icons[this.toastVariant] || icons.info;
    }
}
