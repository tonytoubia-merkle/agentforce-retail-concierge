import { LightningElement, api, track } from 'lwc';
import getCustomerProfileForRep from '@salesforce/apex/ClientellingProfileService.getCustomerProfileForRep';

export default class CustomerProfilePanel extends LightningElement {
    @api selectedContactId;
    @track profile = null;
    @track isLoading = false;
    @track error = null;

    @api
    loadCustomerProfile(contactId) {
        this.selectedContactId = contactId;
        this.fetchProfile();
    }

    @api
    clearProfile() {
        this.profile = null;
        this.selectedContactId = null;
    }

    async fetchProfile() {
        if (!this.selectedContactId) return;

        this.isLoading = true;
        this.error = null;

        try {
            this.profile = await getCustomerProfileForRep({ contactId: this.selectedContactId });
        } catch (err) {
            console.error('Error loading profile:', err);
            this.error = err.body?.message || err.message || 'Failed to load profile';
        } finally {
            this.isLoading = false;
        }
    }

    handleCustomerSelected(event) {
        const { contactId } = event.detail;
        this.loadCustomerProfile(contactId);

        // Bubble up to parent
        this.dispatchEvent(new CustomEvent('customerselected', {
            detail: { contactId },
            bubbles: true,
            composed: true
        }));
    }

    handleRefreshProfile() {
        this.fetchProfile();
    }

    handleCloseProfile() {
        this.profile = null;
        this.selectedContactId = null;
        this.dispatchEvent(new CustomEvent('profileclosed', {
            bubbles: true,
            composed: true
        }));
    }

    handleNoteAdded() {
        // Refresh profile to show new note
        this.fetchProfile();
    }

    // ─── Computed Properties ─────────────────────────────────────────

    get hasSelectedCustomer() {
        return !!this.profile;
    }

    get hasTodaysAppointment() {
        return !!this.profile?.todaysAppointment;
    }

    get currentAppointmentId() {
        return this.profile?.todaysAppointment?.appointmentId || null;
    }

    get identityBadgeClass() {
        const tier = this.profile?.identityTier;
        const classes = {
            known: 'identity-badge badge-known',
            appended: 'identity-badge badge-appended',
            anonymous: 'identity-badge badge-anonymous'
        };
        return classes[tier] || 'identity-badge';
    }

    get appointmentStatusClass() {
        const status = this.profile?.todaysAppointment?.status;
        const classes = {
            'Booked': 'appt-status status-booked',
            'Confirmed': 'appt-status status-confirmed',
            'Checked-In': 'appt-status status-checkedin',
            'In Progress': 'appt-status status-inprogress'
        };
        return classes[status] || 'appt-status';
    }
}
