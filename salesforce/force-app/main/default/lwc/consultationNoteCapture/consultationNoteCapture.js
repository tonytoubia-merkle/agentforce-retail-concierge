import { LightningElement, api, track } from 'lwc';
import captureConsultationNote from '@salesforce/apex/AppointmentService.captureConsultationNote';

export default class ConsultationNoteCapture extends LightningElement {
    @api contactId;
    @api appointmentId;

    @track noteType = 'Observation';
    @track noteText = '';
    @track isSaving = false;

    get noteTypeOptions() {
        return [
            { label: 'Observation', value: 'Observation' },
            { label: 'Preference', value: 'Preference' },
            { label: 'Concern', value: 'Concern' },
            { label: 'Recommendation', value: 'Recommendation' },
            { label: 'Follow-up', value: 'Follow-up' }
        ];
    }

    get isAddDisabled() {
        return !this.noteText || !this.contactId || this.isSaving;
    }

    handleTypeChange(event) {
        this.noteType = event.detail.value;
    }

    handleTextChange(event) {
        this.noteText = event.detail.value;
    }

    async handleAddNote() {
        if (this.isAddDisabled) return;

        this.isSaving = true;
        try {
            await captureConsultationNote({
                contactId: this.contactId,
                appointmentId: this.appointmentId,
                noteType: this.noteType,
                noteText: this.noteText,
                productsReferenced: null
            });

            // Save text before clearing for event dispatch
            const savedNoteText = this.noteText;

            // Clear form
            this.noteText = '';

            // Notify parent with note details for co-pilot context
            this.dispatchEvent(new CustomEvent('noteadded', {
                detail: { noteType: this.noteType, noteText: savedNoteText },
                bubbles: true,
                composed: true
            }));
        } catch (error) {
            console.error('Error saving note:', error);
        } finally {
            this.isSaving = false;
        }
    }
}
