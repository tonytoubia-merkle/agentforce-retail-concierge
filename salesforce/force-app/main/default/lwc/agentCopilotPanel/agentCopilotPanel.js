import { LightningElement, api, track } from 'lwc';
import initSession from '@salesforce/apex/AgentCopilotService.initSession';
import sendMessage from '@salesforce/apex/AgentCopilotService.sendMessage';
import endSession from '@salesforce/apex/AgentCopilotService.endSession';

export default class AgentCopilotPanel extends LightningElement {
    @api contactId;
    @api agentType = 'clientelling'; // 'clientelling' (rep copilot) or 'concierge' (consumer-facing)

    @track messages = [];
    @track inputText = '';
    @track isSessionActive = false;
    @track isInitializing = false;
    @track isWaitingForResponse = false;
    @track error = null;

    sessionId = null;
    sequenceId = 1;
    _messageCounter = 0;

    get quickActions() {
        return [
            { label: 'Recommend routine', message: 'What skincare routine would you recommend for this customer?' },
            { label: 'Gift ideas', message: 'What gift ideas would work for this customer?' },
            { label: 'Travel essentials', message: 'What travel-size products should I suggest?' },
            { label: 'Complementary products', message: 'What complementary products go with their recent purchases?' }
        ];
    }

    get hasContactId() {
        return !!this.contactId;
    }

    get isSendDisabled() {
        return !this.inputText || this.isWaitingForResponse;
    }

    // ─── Session Lifecycle ───────────────────────────────────────────

    @api
    async startSessionForCustomer(newContactId) {
        // End existing session if switching customers
        if (this.sessionId && this.contactId !== newContactId) {
            await this.endCurrentSession();
        }
        this.contactId = newContactId;
        await this.handleStartSession();
    }

    async handleStartSession() {
        if (!this.contactId) return;

        this.isInitializing = true;
        this.error = null;
        this.messages = [];
        this.sequenceId = 2; // Sequence 1 is used by the automatic context injection in initSession

        try {
            const result = await initSession({ contactId: this.contactId, agentType: this.agentType });

            if (result.success) {
                this.sessionId = result.sessionId;
                this.isSessionActive = true;

                if (result.welcomeMessage) {
                    this.addMessage('agent', result.welcomeMessage);
                }
            } else {
                this.error = result.errorMessage || 'Failed to start session';
            }
        } catch (err) {
            console.error('Session init error:', err);
            this.error = err.body?.message || err.message || 'Failed to start session';
        } finally {
            this.isInitializing = false;
        }
    }

    async endCurrentSession() {
        if (this.sessionId) {
            try {
                await endSession({ sessionId: this.sessionId });
            } catch (err) {
                console.warn('Session end error:', err);
            }
            this.sessionId = null;
            this.isSessionActive = false;
        }
    }

    disconnectedCallback() {
        this.endCurrentSession();
    }

    // ─── Messaging ───────────────────────────────────────────────────

    async handleSend() {
        if (this.isSendDisabled || !this.sessionId) return;

        const text = this.inputText;
        this.inputText = '';
        this.addMessage('user', text);
        this.isWaitingForResponse = true;
        this.error = null;

        try {
            const result = await sendMessage({
                sessionId: this.sessionId,
                message: text,
                sequenceId: this.sequenceId++
            });

            if (result.success) {
                this.addMessage('agent', result.message, {
                    products: result.products,
                    captures: result.captures,
                    suggestedActions: result.suggestedActions,
                    action: result.action
                });
            } else {
                this.error = result.errorMessage || 'Failed to get response';
            }
        } catch (err) {
            console.error('Send message error:', err);
            this.error = err.body?.message || err.message || 'Failed to send message';
        } finally {
            this.isWaitingForResponse = false;
            this.scrollToBottom();
        }
    }

    addMessage(role, text, extras = {}) {
        const id = `msg-${++this._messageCounter}`;
        const isAgent = role === 'agent';

        this.messages = [...this.messages, {
            id,
            role,
            text: text || '',
            containerClass: `msg-container msg-${role}`,
            bubbleClass: `msg-bubble bubble-${role}`,
            products: extras.products || [],
            hasProducts: extras.products?.length > 0,
            captures: extras.captures || [],
            hasCaptures: extras.captures?.length > 0,
            suggestedActions: extras.suggestedActions || [],
            hasSuggestions: extras.suggestedActions?.length > 0
        }];

        this.scrollToBottom();
    }

    // ─── Context Updates (called by parent when profile/notes change) ─

    @api
    async sendContextUpdate(updateText) {
        if (!this.sessionId || !this.isSessionActive) return;
        this.isWaitingForResponse = true;
        try {
            const result = await sendMessage({
                sessionId: this.sessionId,
                message: '[Context update from the rep console] ' + updateText
                    + ' — Please acknowledge briefly.',
                sequenceId: this.sequenceId++
            });
            if (result.success && result.message) {
                this.addMessage('agent', result.message);
            }
        } catch (err) {
            console.warn('Context update failed:', err);
        } finally {
            this.isWaitingForResponse = false;
            this.scrollToBottom();
        }
    }

    // ─── Event Handlers ──────────────────────────────────────────────

    handleInputChange(event) {
        this.inputText = event.target.value;
    }

    handleKeyUp(event) {
        if (event.key === 'Enter') {
            this.handleSend();
        }
    }

    handleQuickAction(event) {
        const message = event.currentTarget.dataset.message;
        this.inputText = message;
        this.handleSend();
    }

    handleSuggestionClick(event) {
        const message = event.currentTarget.dataset.message;
        this.inputText = message;
        this.handleSend();
    }

    handleAddToConsult(event) {
        const productId = event.currentTarget.dataset.productId;
        const productName = event.currentTarget.dataset.productName;

        this.dispatchEvent(new CustomEvent('addtoconsult', {
            detail: { productId, productName },
            bubbles: true,
            composed: true
        }));
    }

    dismissError() {
        this.error = null;
    }

    scrollToBottom() {
        // Use setTimeout to wait for DOM update
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const thread = this.template.querySelector('.message-thread');
            if (thread) {
                thread.scrollTop = thread.scrollHeight;
            }
        }, 50);
    }
}
