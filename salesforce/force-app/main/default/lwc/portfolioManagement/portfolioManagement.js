import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPortfolios from '@salesforce/apex/PortfolioController.getPortfolios';
import getMarketingUsers from '@salesforce/apex/PortfolioController.getMarketingUsers';
import getAdminStats from '@salesforce/apex/PortfolioController.getAdminStats';
import updatePortfolioMarketer from '@salesforce/apex/PortfolioController.updatePortfolioMarketer';
import updatePortfolioSettings from '@salesforce/apex/PortfolioController.updatePortfolioSettings';

export default class PortfolioManagement extends LightningElement {
    @track portfolios = [];
    @track marketingUsers = [];
    @track adminStats = {};
    @track isLoading = true;
    @track selectedPortfolio = null;
    @track showEditModal = false;

    // Edit form values
    @track editPrimaryMarketer = null;
    @track editSecondaryMarketer = null;
    @track editAutoApproval = false;
    @track editConfidenceThreshold = 80;

    wiredPortfoliosResult;
    wiredStatsResult;

    @wire(getPortfolios)
    wiredPortfolios(result) {
        this.wiredPortfoliosResult = result;
        this.isLoading = false;

        if (result.data) {
            this.portfolios = result.data.map(p => ({
                ...p,
                workloadPercent: p.workloadCapacity > 0
                    ? Math.round((p.currentWorkload / p.workloadCapacity) * 100)
                    : 0,
                workloadClass: this.getWorkloadClass(p.currentWorkload, p.workloadCapacity)
            }));
        } else if (result.error) {
            this.showToast('Error', 'Failed to load portfolios', 'error');
            console.error('Error loading portfolios:', result.error);
        }
    }

    @wire(getMarketingUsers)
    wiredUsers({ data, error }) {
        if (data) {
            this.marketingUsers = [
                { label: '-- None --', value: '' },
                ...data.map(u => ({ label: u.label, value: u.value }))
            ];
        } else if (error) {
            console.error('Error loading users:', error);
        }
    }

    @wire(getAdminStats)
    wiredStats(result) {
        this.wiredStatsResult = result;
        if (result.data) {
            this.adminStats = result.data;
        }
    }

    getWorkloadClass(current, capacity) {
        if (!capacity || capacity === 0) return 'slds-progress-bar__value slds-progress-bar__value_success';
        const percent = (current / capacity) * 100;
        if (percent >= 90) return 'slds-progress-bar__value_error';
        if (percent >= 70) return 'slds-progress-bar__value_warning';
        return 'slds-progress-bar__value_success';
    }

    handleEditPortfolio(event) {
        const portfolioId = event.currentTarget.dataset.id;
        this.selectedPortfolio = this.portfolios.find(p => p.id === portfolioId);

        if (this.selectedPortfolio) {
            this.editPrimaryMarketer = this.selectedPortfolio.primaryMarketerId || '';
            this.editSecondaryMarketer = this.selectedPortfolio.secondaryMarketerId || '';
            this.editAutoApproval = this.selectedPortfolio.autoApprovalEnabled || false;
            this.editConfidenceThreshold = this.selectedPortfolio.autoApprovalThreshold || 80;
            this.showEditModal = true;
        }
    }

    handleCloseModal() {
        this.showEditModal = false;
        this.selectedPortfolio = null;
    }

    handlePrimaryMarketerChange(event) {
        this.editPrimaryMarketer = event.detail.value;
    }

    handleSecondaryMarketerChange(event) {
        this.editSecondaryMarketer = event.detail.value;
    }

    handleAutoApprovalChange(event) {
        this.editAutoApproval = event.target.checked;
    }

    handleThresholdChange(event) {
        this.editConfidenceThreshold = event.detail.value;
    }

    async handleSavePortfolio() {
        try {
            // Update marketer assignment
            await updatePortfolioMarketer({
                portfolioId: this.selectedPortfolio.id,
                primaryMarketerId: this.editPrimaryMarketer || null,
                secondaryMarketerId: this.editSecondaryMarketer || null
            });

            // Update settings
            await updatePortfolioSettings({
                portfolioId: this.selectedPortfolio.id,
                autoApprovalEnabled: this.editAutoApproval,
                confidenceThreshold: this.editConfidenceThreshold
            });

            this.showToast('Success', 'Portfolio updated successfully', 'success');
            this.handleCloseModal();
            await refreshApex(this.wiredPortfoliosResult);
        } catch (error) {
            this.showToast('Error', 'Failed to update portfolio', 'error');
            console.error('Error updating portfolio:', error);
        }
    }

    handleRefresh() {
        this.isLoading = true;
        Promise.all([
            refreshApex(this.wiredPortfoliosResult),
            refreshApex(this.wiredStatsResult)
        ]).finally(() => {
            this.isLoading = false;
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant
        }));
    }

    get hasPortfolios() {
        return this.portfolios && this.portfolios.length > 0;
    }
}
