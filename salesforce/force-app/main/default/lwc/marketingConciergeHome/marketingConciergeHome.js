import { LightningElement, track } from 'lwc';

/**
 * Marketing Concierge Home
 *
 * Tabbed container for the Marketing Concierge experience:
 * - My Inbox: Personal marketer inbox with portfolio-assigned approvals
 * - Operations: Org-wide view for managers with metrics and reassignment
 */
export default class MarketingConciergeHome extends LightningElement {
    @track activeTab = 'inbox';

    get isInboxActive() {
        return this.activeTab === 'inbox';
    }

    get isOperationsActive() {
        return this.activeTab === 'operations';
    }

    get inboxTabClass() {
        return this.activeTab === 'inbox'
            ? 'slds-tabs_default__item slds-is-active'
            : 'slds-tabs_default__item';
    }

    get operationsTabClass() {
        return this.activeTab === 'operations'
            ? 'slds-tabs_default__item slds-is-active'
            : 'slds-tabs_default__item';
    }

    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }
}
