import { LightningElement, wire, track } from 'lwc';
import getPendingApprovals from '@salesforce/apex/JourneyApprovalService.getPendingApprovals';
import approveJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.approveJourneyFromLWC';
import declineJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.declineJourneyFromLWC';
import regenerateImageFromLWC from '@salesforce/apex/JourneyApprovalService.regenerateImageFromLWC';
import sendJourneyFromLWC from '@salesforce/apex/JourneyApprovalService.sendJourneyFromLWC';
import updateProductsFromLWC from '@salesforce/apex/JourneyApprovalService.updateProductsFromLWC';
import approveAllJourneySteps from '@salesforce/apex/JourneyApprovalService.approveAllJourneySteps';
import declineAllJourneySteps from '@salesforce/apex/JourneyStepService.declineAllSteps';
import sendJourneyToMarketingFlow from '@salesforce/apex/JourneyApprovalService.sendJourneyToMarketingFlow';
import { refreshApex } from '@salesforce/apex';

export default class JourneyApprovalDashboard extends LightningElement {
    @track approvals = [];
    @track journeyGroups = []; // Grouped by Journey_Id__c
    @track isLoading = true;
    @track showToast = false;
    @track toastMessage = '';
    @track toastVariant = 'success';
    @track showEditModal = false;
    @track selectedStep = null;

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

            // Group approvals by Journey_Id__c
            this.journeyGroups = this.groupByJourney(this.approvals);
        } else if (result.error) {
            this.showToastMessage('Error loading approvals: ' + result.error.body?.message, 'error');
        }
    }

    /**
     * Group approvals by Journey_Id__c.
     * Single-step journeys or approvals without Journey_Id get their own group.
     */
    groupByJourney(approvals) {
        const groups = new Map();

        for (const approval of approvals) {
            const journeyId = approval.Journey_Id__c || approval.Id; // Use record Id if no journey

            if (!groups.has(journeyId)) {
                groups.set(journeyId, {
                    journeyId: journeyId,
                    isMultiStep: !!approval.Journey_Id__c && approval.Total_Steps__c > 1,
                    steps: [],
                    contactName: approval.contactName,
                    contactEmail: approval.contactEmail,
                    eventType: approval.Event_Type__c,
                    eventDate: approval.Event_Date__c,
                    daysUntilEvent: approval.Days_Until_Event__c,
                    urgency: approval.Urgency__c,
                    urgencyClass: approval.urgencyClass,
                    daysDisplay: approval.daysDisplay,
                    totalSteps: approval.Total_Steps__c || 1
                });
            }

            groups.get(journeyId).steps.push(approval);
        }

        // Convert to array and add computed properties
        return Array.from(groups.values()).map(group => {
            // Sort steps by step number
            const sortedSteps = group.steps.sort((a, b) => (a.Step_Number__c || 1) - (b.Step_Number__c || 1));

            // Add isFirstStep and isLastStep to each step
            const stepsWithFlags = sortedSteps.map((step, idx) => ({
                ...step,
                isFirstStep: idx === 0,
                isLastStep: idx === sortedSteps.length - 1,
                channelIcon: this.getChannelIcon(step.Channel__c)
            }));

            return {
                ...group,
                key: group.journeyId,
                stepCount: stepsWithFlags.length,
                steps: stepsWithFlags,
                firstStep: stepsWithFlags[0],
                channels: [...new Set(stepsWithFlags.map(s => s.Channel__c || 'Email'))],
                channelSummary: this.getChannelSummary(stepsWithFlags),
                journeyTitle: this.getJourneyTitle(group)
            };
        });
    }

    getChannelIcon(channel) {
        switch (channel) {
            case 'Email': return 'utility:email';
            case 'SMS': return 'utility:chat';
            case 'Push': return 'utility:notification';
            default: return 'utility:email';
        }
    }

    getChannelSummary(steps) {
        const channels = steps.map(s => s.Channel__c || 'Email');
        const counts = {};
        channels.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
        return Object.entries(counts)
            .map(([channel, count]) => `${count} ${channel}`)
            .join(', ');
    }

    getJourneyTitle(group) {
        if (!group.isMultiStep) {
            return group.steps[0]?.Suggested_Subject__c || 'Single Message';
        }
        const eventType = group.eventType || 'Journey';
        return `${group.totalSteps}-Step ${eventType.charAt(0).toUpperCase() + eventType.slice(1)} Journey`;
    }

    get hasApprovals() {
        return this.journeyGroups && this.journeyGroups.length > 0;
    }

    get pendingCount() {
        return this.approvals?.length || 0;
    }

    get journeyCount() {
        return this.journeyGroups?.length || 0;
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

    handleToggleStep(event) {
        const stepId = event.currentTarget.dataset.stepId;
        const stepRow = this.template.querySelector(`.step-row[data-step-id="${stepId}"]`);

        if (stepRow) {
            // Toggle the expanded state
            stepRow.classList.toggle('is-expanded');
        }
    }

    async handleApproveAllSteps(event) {
        const journeyId = event.currentTarget.dataset.journeyId;
        if (!journeyId) {
            this.showToastMessage('Journey ID not found', 'error');
            return;
        }

        this.isLoading = true;
        try {
            const result = await approveAllJourneySteps({ journeyId });
            if (result.success) {
                this.showToastMessage(result.message, 'success');
                await refreshApex(this.wiredApprovalsResult);
            } else {
                this.showToastMessage(result.errorMessage || 'Failed to approve journey', 'error');
            }
        } catch (error) {
            this.showToastMessage('Error: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleCardAction(event) {
        console.log('[Dashboard] handleCardAction triggered:', event.detail);
        const { action, approvalId, data } = event.detail;
        console.log('[Dashboard] Action:', action, 'ApprovalId:', approvalId);
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

                case 'approveJourney':
                    result = await approveAllJourneySteps({
                        journeyId: data.journeyId
                    });
                    break;

                case 'declineJourney':
                    result = await declineAllJourneySteps({
                        journeyId: data.journeyId,
                        reason: data.reason || 'Declined by marketer'
                    });
                    break;

                case 'sendJourney':
                    result = await sendJourneyToMarketingFlow({
                        journeyId: data.journeyId
                    });
                    break;

                default:
                    throw new Error('Unknown action: ' + action);
            }

            console.log('[Dashboard] Action result:', JSON.stringify(result));
            if (result.success) {
                this.showToastMessage(result.message, 'success');
                await refreshApex(this.wiredApprovalsResult);
            } else {
                console.error('[Dashboard] Action failed:', result);
                this.showToastMessage(result.errorMessage || 'Action failed', 'error');
            }

        } catch (error) {
            console.error('[Dashboard] Caught error:', error);
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

    /**
     * Handle edit step event from journey flow overview.
     * Opens the step in a modal with the journey approval card for editing.
     */
    handleEditStep(event) {
        const { journeyId, stepIndex, step } = event.detail;
        console.log('[Dashboard] Edit step requested:', journeyId, stepIndex, step?.Id);

        if (!step) {
            this.showToastMessage('Step not found', 'error');
            return;
        }

        // Enrich step with display properties for the modal
        this.selectedStep = {
            ...step,
            contactName: step.Contact__r?.Name || step.contactName || 'Unknown',
            contactEmail: step.Contact__r?.Email || step.contactEmail || '',
            eventType: step.Event_Type__c || 'Journey'
        };
        this.showEditModal = true;
    }

    handleCloseEditModal() {
        this.showEditModal = false;
        this.selectedStep = null;
    }

    /**
     * Handle actions from the edit modal's journey approval card.
     */
    async handleEditModalAction(event) {
        // Forward to the main card action handler
        await this.handleCardAction(event);

        // Close modal after successful action
        if (!this.isLoading) {
            this.handleCloseEditModal();
        }
    }
}
