import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import createWalkInAppointment from '@salesforce/apex/AppointmentService.createWalkInAppointment';

export default class ClientellingConsole extends NavigationMixin(LightningElement) {
    @track selectedContactId = null;
    @track selectedCustomerName = null;
    @track selectedAppointmentId = null;
    @track productsInConsult = [];
    @track pendingCustomer = null;
    @track isBeginningConsult = false;

    // ─── Customer Selection Handlers ─────────────────────────────────

    handleAppointmentSelected(event) {
        const { contactId, appointmentId } = event.detail;
        this.pendingCustomer = null;
        this.selectedContactId = contactId;
        this.selectedAppointmentId = appointmentId;
        this.loadCustomer(contactId);
    }

    handleCustomerFromSidebar(event) {
        const { contactId } = event.detail;
        this.pendingCustomer = null;
        this.selectedContactId = contactId;
        this.loadCustomer(contactId);
    }

    handleCustomerFromProfile(event) {
        const { contactId } = event.detail;
        this.selectedContactId = contactId;
        this.loadCustomer(contactId);
    }

    handleGlobalCustomerSearch(event) {
        const { contactId, customer } = event.detail;
        this.pendingCustomer = {
            contactId,
            name: customer ? customer.name : 'Customer'
        };
    }

    async handleBeginConsult() {
        if (!this.pendingCustomer) return;
        this.isBeginningConsult = true;

        try {
            await createWalkInAppointment({
                contactId: this.pendingCustomer.contactId,
                storeLocation: null
            });

            const contactId = this.pendingCustomer.contactId;
            this.selectedContactId = contactId;
            this.selectedCustomerName = this.pendingCustomer.name;
            this.pendingCustomer = null;
            this.loadCustomer(contactId);

            // Refresh appointment sidebar
            const sidebar = this.template.querySelector('c-appointment-sidebar');
            if (sidebar && typeof sidebar.refreshAppointments === 'function') {
                sidebar.refreshAppointments();
            }
        } catch (error) {
            console.error('Failed to begin consult:', error);
        } finally {
            this.isBeginningConsult = false;
        }
    }

    handleCancelPending() {
        this.pendingCustomer = null;
    }

    handleProfileClosed() {
        this.selectedContactId = null;
        this.selectedCustomerName = null;
        this.selectedAppointmentId = null;
        this.productsInConsult = [];
    }

    async loadCustomer(contactId) {
        // Load profile in center panel
        const profilePanel = this.template.querySelector('c-customer-profile-panel');
        if (profilePanel && typeof profilePanel.loadCustomerProfile === 'function') {
            profilePanel.loadCustomerProfile(contactId);
        }

        // Start co-pilot session
        const copilotPanel = this.template.querySelector('c-agent-copilot-panel');
        if (copilotPanel && typeof copilotPanel.startSessionForCustomer === 'function') {
            copilotPanel.startSessionForCustomer(contactId);
        }
    }

    // ─── Action Bar Handlers ─────────────────────────────────────────

    handleLookupOrder() {
        // Navigate to Order list filtered by contact
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Order',
                actionName: 'list'
            }
        });
    }

    handleCreateCase() {
        // Open case creation with pre-filled contact
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Case',
                actionName: 'new'
            },
            state: {
                defaultFieldValues: `ContactId=${this.selectedContactId},Origin=In-Store`
            }
        });
    }

    handleCheckStock() {
        // Could open a modal or navigate to inventory check
        // For POC, we dispatch an event that the console can handle
        this.dispatchEvent(new CustomEvent('checkstock', {
            detail: { contactId: this.selectedContactId }
        }));
    }

    handleCompleteConsult() {
        // Could open a completion modal
        this.dispatchEvent(new CustomEvent('completeconsult', {
            detail: {
                contactId: this.selectedContactId,
                appointmentId: this.selectedAppointmentId,
                productsDiscussed: this.productsInConsult
            }
        }));
    }

    handleAddToConsult(event) {
        const { productId, productName } = event.detail;
        if (!this.productsInConsult.find(p => p.productId === productId)) {
            this.productsInConsult = [...this.productsInConsult, { productId, productName }];
        }
    }

    // ─── Context Updates to Co-pilot ──────────────────────────────────

    handleProfileUpdated(event) {
        const { changes } = event.detail;
        this.notifyCopilot('The rep just updated this customer\'s beauty profile: ' + changes);
        // Refresh the profile panel to show updated data
        const profilePanel = this.template.querySelector('c-customer-profile-panel');
        if (profilePanel && typeof profilePanel.loadCustomerProfile === 'function') {
            profilePanel.loadCustomerProfile(this.selectedContactId);
        }
    }

    handleNoteAdded(event) {
        const { noteType, noteText } = event.detail || {};
        const summary = noteType && noteText
            ? `[${noteType}] ${noteText}`
            : 'A new consultation note was added';
        this.notifyCopilot('The rep just captured a note about this customer: ' + summary);
    }

    notifyCopilot(message) {
        const copilotPanel = this.template.querySelector('c-agent-copilot-panel');
        if (copilotPanel && typeof copilotPanel.sendContextUpdate === 'function') {
            copilotPanel.sendContextUpdate(message);
        }
    }

    // ─── Computed ────────────────────────────────────────────────────

    get hasSelectedCustomer() {
        return !!this.selectedContactId;
    }

    get hasPendingCustomer() {
        return !!this.pendingCustomer;
    }

    get pendingCustomerName() {
        return this.pendingCustomer ? this.pendingCustomer.name : '';
    }

    get showActiveCustomer() {
        return !!this.selectedCustomerName && !this.pendingCustomer;
    }
}
