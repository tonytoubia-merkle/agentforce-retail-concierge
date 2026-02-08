import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getMyPendingApprovals from '@salesforce/apex/PortfolioAssignmentService.getMyPendingApprovals';
import getMyInboxStats from '@salesforce/apex/PortfolioAssignmentService.getMyInboxStats';
import approveJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.approveJourneyFromLWC';
import declineJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.declineJourneyFromLWC';
import sendJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.sendJourneyFromLWC';
import Id from '@salesforce/user/Id';

/**
 * Marketer Inbox Component
 *
 * Personal inbox for marketers showing their portfolio's pending opportunities.
 * Features:
 * - Tiered view (Auto-Send, Soft Review, Review Required, Escalate)
 * - Priority-based ordering
 * - Quick actions (approve, decline, edit, send)
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

    // For demo: allow viewing as different users
    @track viewAsUserId = null;
    @track showUserPicker = false;

    currentUserId = Id;
    wiredApprovalsResult;
    wiredStatsResult;

    @wire(getMyPendingApprovals)
    wiredApprovals(result) {
        this.wiredApprovalsResult = result;
        this.isLoading = false;

        if (result.data) {
            this.approvals = result.data.map(approval => this.enrichApproval(approval));
        } else if (result.error) {
            this.showToastMessage('Error loading inbox: ' + result.error.body?.message, 'error');
        }
    }

    @wire(getMyInboxStats)
    wiredStats(result) {
        this.wiredStatsResult = result;
        if (result.data) {
            this.stats = result.data;
        }
    }

    /**
     * Enrich approval with computed display properties.
     */
    enrichApproval(approval) {
        return {
            ...approval,
            contactName: approval.Contact__r?.Name || 'Unknown',
            contactEmail: approval.Contact__r?.Email || '',
            eventType: approval.Meaningful_Event__r?.Event_Type__c || 'General',
            eventDate: approval.Meaningful_Event__r?.Event_Date__c,
            portfolioName: approval.Assigned_Portfolio__r?.Name || 'Unassigned',
            tierClass: this.getTierClass(approval.Approval_Tier__c),
            tierIcon: this.getTierIcon(approval.Approval_Tier__c),
            urgencyClass: this.getUrgencyClass(approval.Urgency__c),
            channelIcon: this.getChannelIcon(approval.Channel__c),
            confidenceClass: this.getConfidenceClass(approval.Confidence_Score__c),
            deadlineDisplay: this.getDeadlineDisplay(approval.Auto_Send_Deadline__c),
            isApproachingDeadline: this.isApproachingDeadline(approval.Auto_Send_Deadline__c),
            priorityDisplay: this.getPriorityDisplay(approval.Priority_Score__c),
            isMultiStep: approval.Total_Steps__c > 1,
            stepDisplay: approval.Total_Steps__c > 1 ?
                `Step ${approval.Step_Number__c} of ${approval.Total_Steps__c}` : null
        };
    }

    // Filter getters
    get filteredApprovals() {
        if (this.activeFilter === 'all') {
            return this.approvals;
        }
        return this.approvals.filter(a => {
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

    get hasApprovals() {
        return this.filteredApprovals && this.filteredApprovals.length > 0;
    }

    get filterOptions() {
        return [
            { label: `All (${this.stats.totalPending || 0})`, value: 'all' },
            { label: `Immediate (${this.stats.immediateCount || 0})`, value: 'immediate' },
            { label: `Soft Review (${this.stats.softReviewCount || 0})`, value: 'soft-review' },
            { label: `Review Required (${this.stats.reviewRequiredCount || 0})`, value: 'review-required' },
            { label: `Escalate (${this.stats.escalateCount || 0})`, value: 'escalate' }
        ];
    }

    // Stats getters
    get hasStats() {
        return this.stats && this.stats.totalPending !== undefined;
    }

    get hasDeadlineWarning() {
        return this.stats.approachingDeadlineCount > 0;
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
            'Push': 'utility:notification'
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

        if (diffMs <= 0) return 'Sending now...';
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

    getPriorityDisplay(score) {
        if (score >= 70) return 'High Priority';
        if (score >= 40) return 'Medium Priority';
        return 'Normal';
    }

    // Event handlers
    handleFilterChange(event) {
        this.activeFilter = event.detail.value;
    }

    handleRefresh() {
        this.isLoading = true;
        Promise.all([
            refreshApex(this.wiredApprovalsResult),
            refreshApex(this.wiredStatsResult)
        ]).then(() => {
            this.isLoading = false;
            this.showToastMessage('Inbox refreshed', 'success');
        });
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

    // Forward action from detail card
    handleCardAction(event) {
        const { action, approvalId, data } = event.detail;
        // Re-dispatch to parent or handle here
        this.dispatchEvent(new CustomEvent('action', {
            detail: { action, approvalId, data }
        }));
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
