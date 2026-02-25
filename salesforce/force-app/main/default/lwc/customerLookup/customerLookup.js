import { LightningElement, track } from 'lwc';
import searchCustomers from '@salesforce/apex/ClientellingProfileService.searchCustomers';

export default class CustomerLookup extends LightningElement {
    @track searchTerm = '';
    @track searchResults = [];
    @track isSearching = false;
    @track hasSearched = false;

    _debounceTimer;

    handleSearchChange(event) {
        this.searchTerm = event.target.value;

        clearTimeout(this._debounceTimer);

        if (this.searchTerm.length < 2) {
            this.searchResults = [];
            this.hasSearched = false;
            return;
        }

        this._debounceTimer = setTimeout(() => {
            this.performSearch();
        }, 300);
    }

    async performSearch() {
        this.isSearching = true;
        try {
            const results = await searchCustomers({ searchTerm: this.searchTerm });
            this.searchResults = results.map(r => ({
                ...r,
                identityBadgeClass: this.getIdentityBadgeClass(r.identityTier)
            }));
            this.hasSearched = true;
        } catch (error) {
            console.error('Customer search error:', error);
            this.searchResults = [];
        } finally {
            this.isSearching = false;
        }
    }

    handleSelectCustomer(event) {
        const contactId = event.currentTarget.dataset.id;
        const customer = this.searchResults.find(r => r.contactId === contactId);

        this.dispatchEvent(new CustomEvent('customerselected', {
            detail: { contactId, customer },
            bubbles: true,
            composed: true
        }));

        // Clear search
        this.searchTerm = '';
        this.searchResults = [];
        this.hasSearched = false;
    }

    get hasResults() {
        return this.searchResults.length > 0;
    }

    get noResults() {
        return this.hasSearched && this.searchResults.length === 0 && !this.isSearching;
    }

    getIdentityBadgeClass(tier) {
        const classes = {
            known: 'identity-badge badge-known',
            appended: 'identity-badge badge-appended',
            anonymous: 'identity-badge badge-anonymous'
        };
        return classes[tier] || 'identity-badge';
    }
}
