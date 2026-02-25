import { LightningElement, api } from 'lwc';

/**
 * ProvenanceBadge - Reusable data provenance indicator.
 * Displays the source/quality of customer data with color-coded badges.
 *
 * CRITICAL: 'appended' provenance data is NEVER shown to reps.
 * This component returns nothing for appended provenance.
 */

const PROVENANCE_CONFIG = {
    stated: {
        label: 'Customer stated',
        cssClass: 'badge badge-stated',
        icon: 'utility:chat',
        tooltip: 'Directly stated by the customer during conversation'
    },
    declared: {
        label: 'Profile preference',
        cssClass: 'badge badge-declared',
        icon: 'utility:user',
        tooltip: 'Declared in customer profile or preference center'
    },
    observed: {
        label: 'Purchase history',
        cssClass: 'badge badge-observed',
        icon: 'utility:cart',
        tooltip: 'Observed from transaction and purchase data'
    },
    inferred: {
        label: 'Browsing behavior',
        cssClass: 'badge badge-inferred',
        icon: 'utility:search',
        tooltip: 'Inferred from browsing and engagement patterns'
    },
    agent_inferred: {
        label: 'Agent noted',
        cssClass: 'badge badge-agent',
        icon: 'utility:einstein',
        tooltip: 'Captured by the AI concierge during conversation'
    }
    // NOTE: 'appended' is intentionally omitted — NEVER shown to reps
};

export default class ProvenanceBadge extends LightningElement {
    @api provenance; // stated | declared | observed | inferred | agent_inferred | appended

    get config() {
        return PROVENANCE_CONFIG[this.provenance];
    }

    get isVisible() {
        // NEVER render badge for appended (3P) data
        return this.provenance && this.provenance !== 'appended' && !!this.config;
    }

    get label() {
        return this.config ? this.config.label : '';
    }

    get badgeClass() {
        return this.config ? this.config.cssClass : 'badge';
    }

    get iconName() {
        return this.config ? this.config.icon : null;
    }

    get tooltip() {
        return this.config ? this.config.tooltip : '';
    }
}
