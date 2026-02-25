import { LightningElement, track, wire } from 'lwc';
import searchCustomers from '@salesforce/apex/ClientellingProfileService.searchCustomers';
import resolveWalkInCustomerWithProfile from '@salesforce/apex/ClientellingProfileService.resolveWalkInCustomerWithProfile';
import getMerkuryArchetypes from '@salesforce/apex/ClientellingProfileService.getMerkuryArchetypes';
import createWalkInAppointment from '@salesforce/apex/AppointmentService.createWalkInAppointment';

const STEP_FORM = 'form';
const STEP_RESULTS = 'results';
const STEP_MERKURY = 'merkury';

export default class WalkInCapture extends LightningElement {
    @track email = '';
    @track firstName = '';
    @track lastName = '';
    @track isResolving = false;
    @track isSearching = false;
    @track error = null;
    @track currentStep = STEP_FORM;
    @track selectedArchetypeId = null;
    @track merkuryArchetypes = [];
    @track crmResults = [];

    @wire(getMerkuryArchetypes)
    wiredArchetypes({ data, error }) {
        if (data) {
            this.merkuryArchetypes = data;
        } else if (error) {
            console.error('Failed to load Merkury archetypes:', error);
        }
    }

    handleEmailChange(event) { this.email = event.target.value; }
    handleFirstNameChange(event) { this.firstName = event.target.value; }
    handleLastNameChange(event) { this.lastName = event.target.value; }

    get isEmailEmpty() { return !this.email; }
    get isStepForm() { return this.currentStep === STEP_FORM && !this.isResolving; }
    get isStepResults() { return this.currentStep === STEP_RESULTS && !this.isResolving; }
    get isStepMerkury() { return this.currentStep === STEP_MERKURY && !this.isResolving; }
    get hasCrmResults() { return this.crmResults.length > 0; }
    get isResolveDisabled() { return this.isResolving || !this.selectedArchetypeId; }

    get archetypes() {
        return this.merkuryArchetypes.map(a => ({
            ...a,
            cardClass: 'profile-card' + (this.selectedArchetypeId === a.id ? ' selected' : '')
        }));
    }

    get noMatchCardClass() {
        return 'profile-card no-match-card' + (this.selectedArchetypeId === 'no-match' ? ' selected' : '');
    }

    // Step 1 → Step 2: Search CRM first
    async handleSearchCRM() {
        if (this.isEmailEmpty) return;
        this.isResolving = true;
        this.isSearching = true;
        this.error = null;

        try {
            const results = await searchCustomers({ searchTerm: this.email });
            this.crmResults = (results || []).map(r => ({
                ...r,
                badgeClass: 'id-badge id-' + (r.identityTier || 'anonymous')
            }));
            this.currentStep = STEP_RESULTS;
        } catch (err) {
            this.error = err.body?.message || err.message || 'Search failed';
        } finally {
            this.isResolving = false;
            this.isSearching = false;
        }
    }

    // Step 2: Select existing CRM customer → dispatch directly
    async handleSelectCrmResult(event) {
        const contactId = event.currentTarget.dataset.id;
        this.isResolving = true;
        this.error = null;

        try {
            await createWalkInAppointment({ contactId, storeLocation: null });

            this.dispatchEvent(new CustomEvent('walkinresolved', {
                detail: { contactId },
                bubbles: true,
                composed: true
            }));
            this.resetForm();
        } catch (err) {
            this.error = err.body?.message || err.message || 'Failed to start consultation';
            this.isResolving = false;
        }
    }

    // Step 2 → Step 3: No CRM match, create new with Merkury
    handleNewCustomer() {
        this.currentStep = STEP_MERKURY;
        this.selectedArchetypeId = null;
    }

    handleSelectArchetype(event) {
        this.selectedArchetypeId = event.currentTarget.dataset.id;
    }

    // Step 3: Apply Merkury profile + create contact
    async handleResolve() {
        if (this.isResolveDisabled) return;
        this.isResolving = true;
        this.error = null;

        try {
            const merkuryId = this.selectedArchetypeId === 'no-match'
                ? null
                : this.selectedArchetypeId;

            const profile = await resolveWalkInCustomerWithProfile({
                email: this.email,
                firstName: this.firstName,
                lastName: this.lastName,
                merkuryArchetypeId: merkuryId
            });

            await createWalkInAppointment({
                contactId: profile.contactId,
                storeLocation: null
            });

            this.dispatchEvent(new CustomEvent('walkinresolved', {
                detail: { contactId: profile.contactId, profile },
                bubbles: true,
                composed: true
            }));
            this.resetForm();
        } catch (err) {
            this.error = err.body?.message || err.message || 'Failed to resolve customer';
            this.isResolving = false;
        }
    }

    handleBackToForm() {
        this.currentStep = STEP_FORM;
        this.crmResults = [];
        this.error = null;
    }

    handleBackToResults() {
        this.currentStep = STEP_RESULTS;
        this.selectedArchetypeId = null;
    }

    resetForm() {
        this.email = '';
        this.firstName = '';
        this.lastName = '';
        this.currentStep = STEP_FORM;
        this.selectedArchetypeId = null;
        this.crmResults = [];
        this.isResolving = false;
        this.error = null;
    }
}
