import { LightningElement, api, track } from 'lwc';

export default class JourneyApprovalCard extends LightningElement {
    @api approval;

    @track editedSubject;
    @track editedBody;
    @track showDeclineModal = false;
    @track showRegenerateModal = false;
    @track declineReason = '';
    @track newPrompt = '';

    connectedCallback() {
        // Initialize editable fields with suggested content
        this.editedSubject = this.approval?.Suggested_Subject__c || '';
        this.editedBody = this.approval?.Suggested_Body__c || '';
        this.newPrompt = this.approval?.Firefly_Prompt__c || '';
    }

    get formattedEventDate() {
        if (!this.approval?.Event_Date__c) return '';
        const date = new Date(this.approval.Event_Date__c);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    handleSubjectChange(event) {
        this.editedSubject = event.target.value;
    }

    handleBodyChange(event) {
        this.editedBody = event.target.value;
    }

    handleApprove() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'approve',
                approvalId: this.approval.Id,
                data: {
                    subject: this.editedSubject,
                    body: this.editedBody
                }
            }
        }));
    }

    handleApproveAndSend() {
        // First approve, then send
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'approve',
                approvalId: this.approval.Id,
                data: {
                    subject: this.editedSubject,
                    body: this.editedBody
                }
            }
        }));

        // The parent will handle the send after approval completes
        // Or we can dispatch a combined action
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('action', {
                detail: {
                    action: 'send',
                    approvalId: this.approval.Id,
                    data: {}
                }
            }));
        }, 1000);
    }

    handleDecline() {
        this.showDeclineModal = true;
    }

    closeDeclineModal() {
        this.showDeclineModal = false;
        this.declineReason = '';
    }

    handleDeclineReasonChange(event) {
        this.declineReason = event.target.value;
    }

    confirmDecline() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'decline',
                approvalId: this.approval.Id,
                data: {
                    reason: this.declineReason
                }
            }
        }));
        this.closeDeclineModal();
    }

    handleRegenerateClick() {
        this.showRegenerateModal = true;
    }

    closeRegenerateModal() {
        this.showRegenerateModal = false;
    }

    handlePromptChange(event) {
        this.newPrompt = event.target.value;
    }

    confirmRegenerate() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'regenerate',
                approvalId: this.approval.Id,
                data: {
                    prompt: this.newPrompt
                }
            }
        }));
        this.closeRegenerateModal();
    }
}
