import { LightningElement, api, track } from 'lwc';
import getTodaysAppointments from '@salesforce/apex/AppointmentService.getTodaysAppointments';
import checkInCustomer from '@salesforce/apex/AppointmentService.checkInCustomer';
import generatePrepNotes from '@salesforce/apex/AppointmentService.generatePrepNotes';

export default class AppointmentSidebar extends LightningElement {
    @track appointments = [];
    @track isLoading = true;
    @track storeLocation = 'Flagship Store';
    @track selectedAppointmentId = null;

    get storeOptions() {
        return [
            { label: 'Flagship Store', value: 'Flagship Store' },
            { label: 'Mall Location', value: 'Mall Location' },
            { label: 'Downtown Boutique', value: 'Downtown Boutique' }
        ];
    }

    connectedCallback() {
        this.loadAppointments();
    }

    async loadAppointments() {
        this.isLoading = true;
        try {
            const results = await getTodaysAppointments({ storeLocation: this.storeLocation });
            this.appointments = results.map(appt => this.enrichAppointment(appt));
        } catch (error) {
            console.error('Error loading appointments:', error);
        } finally {
            this.isLoading = false;
        }
    }

    enrichAppointment(appt) {
        // Format time
        let timeDisplay = '';
        if (appt.appointmentDateTime) {
            const dt = new Date(appt.appointmentDateTime);
            timeDisplay = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }

        return {
            ...appt,
            timeDisplay,
            itemClass: `appt-item${this.selectedAppointmentId === appt.appointmentId ? ' appt-selected' : ''}`,
            statusClass: this.getStatusClass(appt.status),
            identityClass: this.getIdentityClass(appt.identityTier),
            isBookedOrConfirmed: appt.status === 'Booked' || appt.status === 'Confirmed'
        };
    }

    getStatusClass(status) {
        const map = {
            'Booked': 'status-badge status-booked',
            'Confirmed': 'status-badge status-confirmed',
            'Checked-In': 'status-badge status-checkedin',
            'In Progress': 'status-badge status-inprogress',
            'Completed': 'status-badge status-completed',
            'No-Show': 'status-badge status-noshow',
            'Cancelled': 'status-badge status-cancelled'
        };
        return map[status] || 'status-badge';
    }

    getIdentityClass(tier) {
        const map = {
            'Known': 'id-badge id-known',
            'Appended': 'id-badge id-appended',
            'Anonymous': 'id-badge id-anonymous'
        };
        return map[tier] || 'id-badge';
    }

    handleStoreChange(event) {
        this.storeLocation = event.detail.value;
        this.loadAppointments();
    }

    handleRefresh() {
        this.loadAppointments();
    }

    @api
    refreshAppointments() {
        this.loadAppointments();
    }

    handleSelectAppointment(event) {
        const contactId = event.currentTarget.dataset.contact;
        const appointmentId = event.currentTarget.dataset.id;

        this.selectedAppointmentId = appointmentId;
        this.appointments = this.appointments.map(a => this.enrichAppointment(a));

        this.dispatchEvent(new CustomEvent('appointmentselected', {
            detail: { contactId, appointmentId },
            bubbles: true,
            composed: true
        }));

        // Auto-generate prep notes if not already done
        const appt = this.appointments.find(a => a.appointmentId === appointmentId);
        if (appt && !appt.repPrepNotes) {
            this.generatePrepNotesForAppointment(appointmentId);
        }
    }

    async generatePrepNotesForAppointment(appointmentId) {
        try {
            await generatePrepNotes({ appointmentId });
        } catch (error) {
            console.error('Error generating prep notes:', error);
        }
    }

    async handleCheckIn(event) {
        event.stopPropagation();
        const appointmentId = event.currentTarget.dataset.id;

        try {
            await checkInCustomer({ appointmentId });
            this.loadAppointments();
        } catch (error) {
            console.error('Error checking in customer:', error);
        }
    }

    handleWalkInResolved(event) {
        const { contactId } = event.detail;

        // Refresh appointments to show the new walk-in
        this.loadAppointments();

        // Bubble up to parent
        this.dispatchEvent(new CustomEvent('customerselected', {
            detail: { contactId },
            bubbles: true,
            composed: true
        }));
    }

    get hasAppointments() {
        return this.appointments.length > 0;
    }
}
