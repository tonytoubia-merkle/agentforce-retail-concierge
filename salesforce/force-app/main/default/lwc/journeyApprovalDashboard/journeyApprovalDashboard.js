import { LightningElement, wire, track } from 'lwc';
import getPendingApprovals from '@salesforce/apex/JourneyApprovalService.getPendingApprovals';
import approveJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.approveJourneyFromLWC';
import declineJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.declineJourneyFromLWC';
import regenerateImageFromLWC from '@salesforce/apex/JourneyApprovalService.regenerateImageFromLWC';
import sendJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.sendJourneyFromLWC';
import updateProductsFromLWC from '@salesforce/apex/JourneyApprovalService.updateProductsFromLWC';
import { refreshApex } from '@salesforce/apex';

export default class JourneyApprovalDashboard extends LightningElement {
    @track approvals = [];
    @track isLoading = true;
    @track showToast = false;
    @track toastMessage = '';
    @track toastVariant = 'success';

    wiredApprovalsResult;

    @wire(getPendingApprovals)
    wiredApprovals(result) {
        this.wiredApprovalsResult = result;
        this.isLoading = false;

        if (result.data) {
            this.approvals = result.data.map(approval => ({
                ...approval,
                contactName: approval.Contact__r?.Name || 'Unknown',
                contactEmail: approval.Contact__r?.Email || '',
                urgencyClass: this.getUrgencyClass(approval.Urgency__c),
                daysDisplay: this.getDaysDisplay(approval.Days_Until_Event__c)
            }));
        } else if (result.error) {
            this.showToastMessage('Error loading approvals: ' + result.error.body?.message, 'error');
        }
    }

    get hasApprovals() {
        return this.approvals && this.approvals.length > 0;
    }

    get pendingCount() {
        return this.approvals?.length || 0;
    }

    get immediateCount() {
        return this.approvals?.filter(a => a.Urgency__c === 'Immediate').length || 0;
    }

    get thisWeekCount() {
        return this.approvals?.filter(a => a.Urgency__c === 'This Week').length || 0;
    }

    get thisMonthCount() {
        return this.approvals?.filter(a => a.Urgency__c === 'This Month').length || 0;
    }

    get toastClass() {
        const baseClass = 'slds-notify slds-notify_toast';
        return `${baseClass} slds-theme_${this.toastVariant}`;
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

    getUrgencyClass(urgency) {
        const classes = {
            'Immediate': 'slds-badge slds-theme_error',
            'This Week': 'slds-badge slds-theme_warning',
            'This Month': 'slds-badge slds-theme_success',
            'Future': 'slds-badge'
        };
        return classes[urgency] || 'slds-badge';
    }

    getDaysDisplay(days) {
        if (days === null || days === undefined) return 'No date';
        if (days === 0) return 'Today!';
        if (days === 1) return 'Tomorrow';
        if (days < 0) return `${Math.abs(days)} days ago`;
        return `${days} days`;
    }

    handleRefresh() {
        this.isLoading = true;
        refreshApex(this.wiredApprovalsResult).then(() => {
            this.isLoading = false;
            this.showToastMessage('Approvals refreshed', 'success');
        });
    }

    async handleCardAction(event) {
        const { action, approvalId, data } = event.detail;
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

                default:
                    throw new Error('Unknown action: ' + action);
            }

            if (result.success) {
                this.showToastMessage(result.message, 'success');
                await refreshApex(this.wiredApprovalsResult);
            } else {
                this.showToastMessage(result.errorMessage || 'Action failed', 'error');
            }

        } catch (error) {
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    showToastMessage(message, variant) {
        this.toastMessage = message;
        this.toastVariant = variant;
        this.showToast = true;

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.showToast = false;
        }, 5000);
    }

    closeToast() {
        this.showToast = false;
    }
}
