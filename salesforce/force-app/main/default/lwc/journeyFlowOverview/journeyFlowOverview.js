import { LightningElement, api, track } from 'lwc';

/**
 * Journey Flow Overview Component
 *
 * Displays a visual overview of a multi-step journey with:
 * - Timeline visualization showing all steps
 * - Channel icons (Email, SMS, Push)
 * - Timing between steps
 * - Journey-level actions (Approve All, Send to Marketing Flow)
 * - Guardrails display
 *
 * Designed for Marketing Cloud Advanced (Marketing Flows) integration.
 */
export default class JourneyFlowOverview extends LightningElement {
    @api journeyGroup = {};
    @track selectedStepIndex = 0;
    @track showApproveConfirm = false;
    @track showSendConfirm = false;
    @track showDeclineConfirm = false;
    @track isProcessing = false;

    // ─── Journey Data Getters ─────────────────────────────────────────

    get journeyId() {
        return this.journeyGroup?.journeyId || '';
    }

    get steps() {
        return this.journeyGroup?.steps || [];
    }

    get totalSteps() {
        return this.steps.length;
    }

    get isMultiStep() {
        return this.totalSteps > 1;
    }

    get contactName() {
        return this.journeyGroup?.contactName || 'Unknown Contact';
    }

    get contactInitials() {
        const name = this.contactName;
        if (!name || name === 'Unknown Contact') return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    get contactEmail() {
        return this.journeyGroup?.contactEmail || '';
    }

    get eventType() {
        const type = this.journeyGroup?.eventType || 'Journey';
        return type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');
    }

    get eventDate() {
        if (!this.journeyGroup?.eventDate) return null;
        return new Date(this.journeyGroup.eventDate).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    get daysUntilEvent() {
        const days = this.journeyGroup?.daysUntilEvent;
        if (days === null || days === undefined) return '';
        if (days === 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        if (days < 0) return `${Math.abs(days)} days ago`;
        return `in ${days} days`;
    }

    get urgency() {
        return this.journeyGroup?.urgency || 'Future';
    }

    get urgencyClass() {
        const urgency = this.urgency;
        if (urgency === 'Immediate') return 'urgency-badge urgency-immediate';
        if (urgency === 'This Week') return 'urgency-badge urgency-week';
        if (urgency === 'This Month') return 'urgency-badge urgency-month';
        return 'urgency-badge urgency-future';
    }

    // ─── Step Status Calculations ─────────────────────────────────────

    get pendingSteps() {
        return this.steps.filter(s => s.Status__c === 'Pending').length;
    }

    get approvedSteps() {
        return this.steps.filter(s => s.Status__c === 'Approved').length;
    }

    get sentSteps() {
        return this.steps.filter(s => s.Status__c === 'Sent').length;
    }

    get allStepsApproved() {
        return this.pendingSteps === 0 && this.approvedSteps > 0;
    }

    get allStepsSent() {
        return this.sentSteps === this.totalSteps;
    }

    get journeyStatus() {
        if (this.allStepsSent) return 'Sent';
        if (this.allStepsApproved) return 'Ready to Send';
        if (this.approvedSteps > 0) return 'Partially Approved';
        return 'Pending Review';
    }

    get journeyStatusClass() {
        if (this.allStepsSent) return 'status-badge status-sent';
        if (this.allStepsApproved) return 'status-badge status-ready';
        if (this.approvedSteps > 0) return 'status-badge status-partial';
        return 'status-badge status-pending';
    }

    // ─── Timeline Steps ───────────────────────────────────────────────

    get timelineSteps() {
        return this.steps.map((step, index) => {
            const isFirst = index === 0;
            const isLast = index === this.steps.length - 1;
            const isSelected = index === this.selectedStepIndex;
            const delayDays = step.Send_Delay_Days__c || 0;

            return {
                ...step,
                index,
                isFirst,
                isLast,
                isSelected,
                delayDays,
                channelIcon: this.getChannelIcon(step.Channel__c),
                channelClass: this.getChannelClass(step.Channel__c),
                stepClass: `timeline-step ${isSelected ? 'is-selected' : ''} ${this.getStatusClass(step.Status__c)}`,
                timingLabel: isFirst ? 'Immediately' : `+${delayDays} day${delayDays !== 1 ? 's' : ''}`,
                statusIcon: this.getStatusIcon(step.Status__c),
                previewText: this.getPreviewText(step)
            };
        });
    }

    getChannelIcon(channel) {
        const icons = {
            'Email': 'utility:email',
            'SMS': 'utility:chat',
            'Push': 'utility:notification'
        };
        return icons[channel] || 'utility:email';
    }

    getChannelClass(channel) {
        const classes = {
            'Email': 'channel-email',
            'SMS': 'channel-sms',
            'Push': 'channel-push'
        };
        return classes[channel] || 'channel-email';
    }

    getStatusClass(status) {
        const classes = {
            'Pending': 'status-pending',
            'Approved': 'status-approved',
            'Sent': 'status-sent',
            'Declined': 'status-declined'
        };
        return classes[status] || '';
    }

    getStatusIcon(status) {
        const icons = {
            'Pending': 'utility:clock',
            'Approved': 'utility:check',
            'Sent': 'utility:success',
            'Declined': 'utility:close'
        };
        return icons[status] || 'utility:clock';
    }

    getPreviewText(step) {
        const body = step.Channel__c === 'Email' ? step.Suggested_Body__c : step.SMS_Body__c;
        if (!body) return '';
        // Strip HTML and truncate
        const text = body.replace(/<[^>]*>/g, '');
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
    }

    // ─── Selected Step ────────────────────────────────────────────────

    get selectedStep() {
        return this.steps[this.selectedStepIndex] || null;
    }

    get hasSelectedStep() {
        return this.selectedStep !== null;
    }

    get canGoBack() {
        return this.selectedStepIndex > 0;
    }

    get canGoForward() {
        return this.selectedStepIndex < this.totalSteps - 1;
    }

    // Inverted getters for disabled state (LWC templates can't use !)
    get isBackDisabled() {
        return !this.canGoBack;
    }

    get isForwardDisabled() {
        return !this.canGoForward;
    }

    // ─── Guardrails ───────────────────────────────────────────────────

    get guardrails() {
        const firstStep = this.steps[0];
        if (!firstStep?.Journey_Guardrails__c) return [];

        try {
            const parsed = JSON.parse(firstStep.Journey_Guardrails__c);
            const guardrailList = [];

            if (parsed.maxEmailsPerWeek) {
                guardrailList.push({
                    key: 'maxEmails',
                    icon: 'utility:email',
                    label: `Max ${parsed.maxEmailsPerWeek} emails/week`
                });
            }
            if (parsed.exitOnPurchase) {
                guardrailList.push({
                    key: 'exitPurchase',
                    icon: 'utility:cart',
                    label: 'Exit on purchase'
                });
            }
            if (parsed.exitOnUnsubscribe) {
                guardrailList.push({
                    key: 'exitUnsub',
                    icon: 'utility:ban',
                    label: 'Exit on unsubscribe'
                });
            }
            if (parsed.respectQuietHours) {
                guardrailList.push({
                    key: 'quietHours',
                    icon: 'utility:clock',
                    label: 'Respect quiet hours'
                });
            }

            return guardrailList;
        } catch (e) {
            return [];
        }
    }

    get hasGuardrails() {
        return this.guardrails.length > 0;
    }

    // ─── Event Handlers ───────────────────────────────────────────────

    handleStepClick(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        if (!isNaN(index)) {
            this.selectedStepIndex = index;
        }
    }

    handlePrevStep() {
        if (this.canGoBack) {
            this.selectedStepIndex--;
        }
    }

    handleNextStep() {
        if (this.canGoForward) {
            this.selectedStepIndex++;
        }
    }

    // ─── Journey Actions ──────────────────────────────────────────────

    handleApproveJourney() {
        this.showApproveConfirm = true;
    }

    handleDeclineJourney() {
        this.showDeclineConfirm = true;
    }

    handleSendJourney() {
        this.showSendConfirm = true;
    }

    closeApproveConfirm() {
        this.showApproveConfirm = false;
    }

    closeDeclineConfirm() {
        this.showDeclineConfirm = false;
    }

    closeSendConfirm() {
        this.showSendConfirm = false;
    }

    confirmApproveJourney() {
        this.showApproveConfirm = false;
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'approveJourney',
                journeyId: this.journeyId,
                data: { journeyId: this.journeyId }
            }
        }));
    }

    confirmDeclineJourney() {
        this.showDeclineConfirm = false;
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'declineJourney',
                journeyId: this.journeyId,
                data: { journeyId: this.journeyId }
            }
        }));
    }

    confirmSendJourney() {
        this.showSendConfirm = false;
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'sendJourney',
                journeyId: this.journeyId,
                data: { journeyId: this.journeyId }
            }
        }));
    }

    handleEditStep() {
        this.dispatchEvent(new CustomEvent('editstep', {
            detail: {
                journeyId: this.journeyId,
                stepIndex: this.selectedStepIndex,
                step: this.selectedStep
            }
        }));
    }

    // ─── Marketing Flow Info ──────────────────────────────────────────

    get marketingFlowDescription() {
        const channels = [...new Set(this.steps.map(s => s.Channel__c))];
        const channelText = channels.join(' → ');
        return `This will create a ${this.totalSteps}-step Marketing Flow in MC Advanced: ${channelText}`;
    }
}
