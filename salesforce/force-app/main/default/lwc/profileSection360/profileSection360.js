import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import updateCustomerProfile from '@salesforce/apex/ClientellingProfileService.updateCustomerProfile';

export default class ProfileSection360 extends LightningElement {
    @api profile; // ClientellingProfileWrapper from Apex

    @track expandedSections = new Set(['beauty']);
    @track isEditingBeauty = false;
    @track editFields = {};

    // ─── Section expansion ───────────────────────────────────────────

    toggleSection(event) {
        const section = event.currentTarget.dataset.section;
        if (this.expandedSections.has(section)) {
            this.expandedSections.delete(section);
        } else {
            this.expandedSections.add(section);
        }
        this.expandedSections = new Set(this.expandedSections);
    }

    get beautyExpanded() { return this.expandedSections.has('beauty'); }
    get ordersExpanded() { return this.expandedSections.has('orders'); }
    get loyaltyExpanded() { return this.expandedSections.has('loyalty'); }
    get eventsExpanded() { return this.expandedSections.has('events'); }
    get chatsExpanded() { return this.expandedSections.has('chats'); }
    get browseExpanded() { return this.expandedSections.has('browse'); }
    get capturedExpanded() { return this.expandedSections.has('captured'); }
    get notesExpanded() { return this.expandedSections.has('notes'); }

    get beautyExpandIcon() { return this.beautyExpanded ? 'utility:chevrondown' : 'utility:chevronright'; }
    get ordersExpandIcon() { return this.ordersExpanded ? 'utility:chevrondown' : 'utility:chevronright'; }
    get loyaltyExpandIcon() { return this.loyaltyExpanded ? 'utility:chevrondown' : 'utility:chevronright'; }
    get eventsExpandIcon() { return this.eventsExpanded ? 'utility:chevrondown' : 'utility:chevronright'; }
    get chatsExpandIcon() { return this.chatsExpanded ? 'utility:chevrondown' : 'utility:chevronright'; }
    get browseExpandIcon() { return this.browseExpanded ? 'utility:chevrondown' : 'utility:chevronright'; }
    get capturedExpandIcon() { return this.capturedExpanded ? 'utility:chevrondown' : 'utility:chevronright'; }
    get notesExpandIcon() { return this.notesExpanded ? 'utility:chevrondown' : 'utility:chevronright'; }

    // ─── Data presence checks ────────────────────────────────────────

    get hasProfile() { return !!this.profile; }
    get hasOrders() { return this.profile?.recentOrders?.length > 0; }
    get hasEvents() { return this.profile?.meaningfulEvents?.length > 0; }
    get hasChats() { return this.profile?.chatHistory?.length > 0; }
    get hasBrowse() { return this.profile?.browseActivity?.length > 0; }
    get hasCaptured() { return this.profile?.capturedProfile?.length > 0; }
    get hasConsultationNotes() { return this.profile?.consultationNotes?.length > 0; }

    get hasRecommendations() {
        return (this.profile?.recommendedBrandTiers?.length > 0) ||
               (this.profile?.recommendedCategories?.length > 0) ||
               !!this.profile?.lifestyleContext;
    }

    // ─── Counts ──────────────────────────────────────────────────────

    get orderCount() { return this.profile?.recentOrders?.length || 0; }
    get eventCount() { return this.profile?.meaningfulEvents?.length || 0; }
    get chatCount() { return this.profile?.chatHistory?.length || 0; }
    get noteCount() { return this.profile?.consultationNotes?.length || 0; }

    // ─── Beauty Profile Editing ───────────────────────────────────────

    get skinTypeOptions() {
        return [
            { label: 'Normal', value: 'Normal' },
            { label: 'Dry', value: 'Dry' },
            { label: 'Oily', value: 'Oily' },
            { label: 'Combination', value: 'Combination' },
            { label: 'Sensitive', value: 'Sensitive' },
            { label: 'Mature', value: 'Mature' }
        ];
    }

    handleEditBeauty() {
        const bp = this.profile?.beautyProfile || {};
        this.editFields = {
            skinType: bp.skinType || '',
            skinConcerns: bp.skinConcerns || '',
            allergies: bp.allergies || '',
            beautyPriority: bp.beautyPriority || '',
            preferredBrands: bp.preferredBrands || '',
            priceRange: bp.priceRange || '',
            sustainabilityPreference: bp.sustainabilityPreference || ''
        };
        this.isEditingBeauty = true;
    }

    handleCancelEdit() {
        this.isEditingBeauty = false;
    }

    handleEditFieldChange(event) {
        const field = event.target.dataset.field;
        this.editFields = { ...this.editFields, [field]: event.target.value };
    }

    async handleSaveBeauty() {
        try {
            await updateCustomerProfile({
                contactId: this.profile.contactId,
                fields: this.editFields
            });
            this.isEditingBeauty = false;

            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Beauty profile updated',
                variant: 'success'
            }));

            // Build a summary of what changed for the co-pilot
            const changes = [];
            const bp = this.profile?.beautyProfile || {};
            if (this.editFields.skinType !== (bp.skinType || '')) changes.push('Skin Type: ' + this.editFields.skinType);
            if (this.editFields.skinConcerns !== (bp.skinConcerns || '')) changes.push('Concerns: ' + this.editFields.skinConcerns);
            if (this.editFields.allergies !== (bp.allergies || '')) changes.push('Allergies: ' + this.editFields.allergies);
            if (this.editFields.preferredBrands !== (bp.preferredBrands || '')) changes.push('Preferred Brands: ' + this.editFields.preferredBrands);

            this.dispatchEvent(new CustomEvent('profileupdated', {
                detail: {
                    contactId: this.profile.contactId,
                    changes: changes.length > 0 ? changes.join('; ') : 'Beauty profile updated'
                },
                bubbles: true,
                composed: true
            }));
        } catch (err) {
            console.error('Save profile error:', err);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: 'Failed to save: ' + (err.body?.message || err.message || 'Unknown error'),
                variant: 'error'
            }));
        }
    }
}
