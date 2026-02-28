import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPortfolios from '@salesforce/apex/PortfolioController.getPortfolios';
import getMarketingUsers from '@salesforce/apex/PortfolioController.getMarketingUsers';
import getAdminStats from '@salesforce/apex/PortfolioController.getAdminStats';
import createPortfolio from '@salesforce/apex/PortfolioController.createPortfolio';
import updatePortfolioMarketer from '@salesforce/apex/PortfolioController.updatePortfolioMarketer';
import updatePortfolioSettings from '@salesforce/apex/PortfolioController.updatePortfolioSettings';
import updatePortfolioDetails from '@salesforce/apex/PortfolioController.updatePortfolioDetails';
import deletePortfolio from '@salesforce/apex/PortfolioController.deletePortfolio';
import updatePortfolioPriority from '@salesforce/apex/PortfolioController.updatePortfolioPriority';
import getAvailableSegments from '@salesforce/apex/DataCloudSegmentService.getAvailableSegments';
import getSegmentDetails from '@salesforce/apex/DataCloudSegmentService.getSegmentDetails';
import syncFromDataCloud from '@salesforce/apex/DataCloudSegmentService.syncFromDataCloud';
import processEventsNow from '@salesforce/apex/JourneyApprovalService.processEventsNow';

export default class PortfolioManagement extends LightningElement {
    @track portfolios = [];
    @track marketingUsers = [];
    @track adminStats = {};
    @track isLoading = true;
    @track selectedPortfolio = null;
    @track showEditModal = false;
    @track showDeleteModal = false;
    @track isProcessingEvents = false;
    @track isCreateMode = false;

    // Edit form values
    @track editName = '';
    @track editPortfolioType = '';
    @track editRegion = '';
    @track editPrimaryMarketer = null;
    @track editSecondaryMarketer = null;
    @track editAutoApproval = false;
    @track editConfidenceThreshold = 80;
    @track editSegmentApiName = '';
    @track editWorkloadCapacity = 50;

    // Segments
    @track segments = [];
    @track selectedSegmentCriteria = null;

    // Delete target
    @track deleteTargetId = null;
    @track deleteTargetName = '';

    wiredPortfoliosResult;
    wiredStatsResult;

    get portfolioTypeOptions() {
        return [
            { label: '-- Select Type --', value: '' },
            { label: 'Regional', value: 'Regional' },
            { label: 'Segment', value: 'Segment' },
            { label: 'Lifecycle', value: 'Lifecycle' },
            { label: 'Event Specialist', value: 'Event Specialist' },
            { label: 'VIP', value: 'VIP' }
        ];
    }

    get segmentOptions() {
        const options = [{ label: '-- No Segment --', value: '' }];
        this.segments.forEach(s => {
            options.push({
                label: `${s.label} (${s.memberCount} members)`,
                value: s.apiName
            });
        });
        return options;
    }

    get selectedSegmentDescription() {
        if (!this.editSegmentApiName) return '';
        const seg = this.segments.find(s => s.apiName === this.editSegmentApiName);
        return seg ? seg.description : '';
    }

    get showRegionField() {
        return this.editPortfolioType === 'Regional';
    }

    get modalTitle() {
        return this.isCreateMode
            ? 'New Portfolio'
            : `Edit Portfolio: ${this.selectedPortfolio?.name || ''}`;
    }

    get saveButtonLabel() {
        return this.isCreateMode ? 'Create Portfolio' : 'Save';
    }

    @wire(getPortfolios)
    wiredPortfolios(result) {
        this.wiredPortfoliosResult = result;
        this.isLoading = false;

        if (result.data) {
            this.portfolios = result.data.map((p, index, arr) => ({
                ...p,
                displayPriority: index + 1,
                isFirst: index === 0,
                isLast: index === arr.length - 1,
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

    wiredSegmentsResult;

    @wire(getAvailableSegments)
    wiredSegments(result) {
        this.wiredSegmentsResult = result;
        if (result.data) {
            this.segments = result.data;
        } else if (result.error) {
            console.error('Error loading segments:', result.error);
        }
    }

    getWorkloadClass(current, capacity) {
        if (!capacity || capacity === 0) return 'slds-progress-bar__value slds-progress-bar__value_success';
        const percent = (current / capacity) * 100;
        if (percent >= 90) return 'slds-progress-bar__value_error';
        if (percent >= 70) return 'slds-progress-bar__value_warning';
        return 'slds-progress-bar__value_success';
    }

    // ============ Create ============

    async handleNewPortfolio() {
        this.isCreateMode = true;
        this.selectedPortfolio = null;
        this.editName = '';
        this.editPortfolioType = '';
        this.editRegion = '';
        this.editSegmentApiName = '';
        this.editWorkloadCapacity = 50;
        this.editPrimaryMarketer = '';
        this.editSecondaryMarketer = '';
        this.editAutoApproval = false;
        this.editConfidenceThreshold = 80;
        this.showEditModal = true;

        // Sync Data Cloud segments in the background
        try {
            await syncFromDataCloud();
            await refreshApex(this.wiredSegmentsResult);
        } catch (e) {
            console.error('DC segment sync:', e);
        }
    }

    // ============ Edit ============

    async handleEditPortfolio(event) {
        const portfolioId = event.currentTarget.dataset.id;
        this.selectedPortfolio = this.portfolios.find(p => p.id === portfolioId);

        if (this.selectedPortfolio) {
            this.isCreateMode = false;
            this.editName = this.selectedPortfolio.name || '';
            this.editPortfolioType = this.selectedPortfolio.portfolioType || '';
            this.editRegion = this.selectedPortfolio.region || '';
            this.editSegmentApiName = this.selectedPortfolio.segmentApiName || '';
            this.editWorkloadCapacity = this.selectedPortfolio.workloadCapacity || 50;
            this.editPrimaryMarketer = this.selectedPortfolio.primaryMarketerId || '';
            this.editSecondaryMarketer = this.selectedPortfolio.secondaryMarketerId || '';
            this.editAutoApproval = this.selectedPortfolio.autoApprovalEnabled || false;
            this.editConfidenceThreshold = this.selectedPortfolio.autoApprovalThreshold || 80;
            this.showEditModal = true;

            // Sync Data Cloud segments in the background
            try {
                await syncFromDataCloud();
                await refreshApex(this.wiredSegmentsResult);
            } catch (e) {
                console.error('DC segment sync:', e);
            }
        }
    }

    handleCloseModal() {
        this.showEditModal = false;
        this.selectedPortfolio = null;
        this.isCreateMode = false;
        this.selectedSegmentCriteria = null;
    }

    get hasCriteriaRules() {
        return this.selectedSegmentCriteria &&
            this.selectedSegmentCriteria.criteriaRules &&
            this.selectedSegmentCriteria.criteriaRules.length > 0;
    }

    // ============ Form Handlers ============

    handleNameChange(event) { this.editName = event.detail.value; }
    handlePortfolioTypeChange(event) { this.editPortfolioType = event.detail.value; }
    handleRegionChange(event) { this.editRegion = event.detail.value; }
    handleWorkloadCapacityChange(event) { this.editWorkloadCapacity = event.detail.value; }
    handlePrimaryMarketerChange(event) { this.editPrimaryMarketer = event.detail.value; }
    handleSecondaryMarketerChange(event) { this.editSecondaryMarketer = event.detail.value; }
    handleAutoApprovalChange(event) { this.editAutoApproval = event.target.checked; }
    handleThresholdChange(event) { this.editConfidenceThreshold = event.detail.value; }

    async handleSegmentChange(event) {
        this.editSegmentApiName = event.detail.value;
        if (this.editSegmentApiName) {
            try {
                this.selectedSegmentCriteria = await getSegmentDetails({ apiName: this.editSegmentApiName });
            } catch (error) {
                this.selectedSegmentCriteria = null;
            }
        } else {
            this.selectedSegmentCriteria = null;
        }
    }

    // ============ Save ============

    async handleSavePortfolio() {
        if (!this.editName) {
            this.showToast('Error', 'Portfolio name is required', 'error');
            return;
        }

        // Resolve segment label
        const segLabel = this.editSegmentApiName
            ? (this.segments.find(s => s.apiName === this.editSegmentApiName)?.label || '')
            : '';

        try {
            if (this.isCreateMode) {
                // Assign next priority (end of list)
                const nextPriority = this.portfolios.length > 0
                    ? Math.max(...this.portfolios.map(p => p.priorityOrder || 0)) + 10
                    : 10;

                await createPortfolio({
                    name: this.editName,
                    portfolioType: this.editPortfolioType || null,
                    region: this.editRegion || null,
                    primaryMarketerId: this.editPrimaryMarketer || null,
                    secondaryMarketerId: this.editSecondaryMarketer || null,
                    segmentApiName: this.editSegmentApiName || null,
                    segmentLabel: segLabel || null,
                    priorityOrder: nextPriority,
                    workloadCapacity: this.editWorkloadCapacity || 50,
                    autoApprovalEnabled: this.editAutoApproval,
                    confidenceThreshold: this.editConfidenceThreshold,
                    specialtyEvents: null,
                    loyaltyTiers: null
                });

                this.showToast('Success', `Portfolio "${this.editName}" created`, 'success');
            } else {
                // Update existing — call all three update methods
                await updatePortfolioMarketer({
                    portfolioId: this.selectedPortfolio.id,
                    primaryMarketerId: this.editPrimaryMarketer || null,
                    secondaryMarketerId: this.editSecondaryMarketer || null
                });

                await updatePortfolioSettings({
                    portfolioId: this.selectedPortfolio.id,
                    autoApprovalEnabled: this.editAutoApproval,
                    confidenceThreshold: this.editConfidenceThreshold
                });

                await updatePortfolioDetails({
                    portfolioId: this.selectedPortfolio.id,
                    portfolioType: this.editPortfolioType || null,
                    region: this.editRegion || null,
                    segmentApiName: this.editSegmentApiName || null,
                    segmentLabel: segLabel || null,
                    workloadCapacity: this.editWorkloadCapacity || 50,
                    specialtyEvents: null,
                    loyaltyTiers: null
                });

                this.showToast('Success', 'Portfolio updated successfully', 'success');
            }

            this.handleCloseModal();
            await Promise.all([
                refreshApex(this.wiredPortfoliosResult),
                refreshApex(this.wiredStatsResult)
            ]);
        } catch (error) {
            this.showToast('Error', 'Failed to save portfolio: ' + (error.body?.message || error.message), 'error');
            console.error('Error saving portfolio:', error);
        }
    }

    // ============ Delete ============

    handleDeletePortfolio(event) {
        const portfolioId = event.currentTarget.dataset.id;
        const portfolio = this.portfolios.find(p => p.id === portfolioId);
        if (portfolio) {
            this.deleteTargetId = portfolioId;
            this.deleteTargetName = portfolio.name;
            this.showDeleteModal = true;
        }
    }

    handleCloseDeleteModal() {
        this.showDeleteModal = false;
        this.deleteTargetId = null;
        this.deleteTargetName = '';
    }

    async handleConfirmDelete() {
        try {
            await deletePortfolio({ portfolioId: this.deleteTargetId });
            this.showToast('Success', `Portfolio "${this.deleteTargetName}" deactivated`, 'success');
            this.handleCloseDeleteModal();
            await Promise.all([
                refreshApex(this.wiredPortfoliosResult),
                refreshApex(this.wiredStatsResult)
            ]);
        } catch (error) {
            this.showToast('Error', 'Failed to deactivate portfolio', 'error');
            console.error('Error deleting portfolio:', error);
        }
    }

    // ============ Priority Reordering ============

    async handleMovePriority(event) {
        const portfolioId = event.currentTarget.dataset.id;
        const direction = event.currentTarget.dataset.direction;

        const currentIndex = this.portfolios.findIndex(p => p.id === portfolioId);
        if (currentIndex === -1) return;

        const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (swapIndex < 0 || swapIndex >= this.portfolios.length) return;

        const current = this.portfolios[currentIndex];
        const swap = this.portfolios[swapIndex];

        // Swap their priority values
        const updates = [
            { id: current.id, priorityOrder: swap.priorityOrder || (swapIndex + 1) * 10 },
            { id: swap.id, priorityOrder: current.priorityOrder || (currentIndex + 1) * 10 }
        ];

        try {
            await updatePortfolioPriority({ updatesJson: JSON.stringify(updates) });

            // Optimistically swap in the UI
            const newPortfolios = [...this.portfolios];
            newPortfolios[currentIndex] = { ...swap, displayPriority: currentIndex + 1, isFirst: currentIndex === 0, isLast: currentIndex === newPortfolios.length - 1 };
            newPortfolios[swapIndex] = { ...current, displayPriority: swapIndex + 1, isFirst: swapIndex === 0, isLast: swapIndex === newPortfolios.length - 1 };
            this.portfolios = newPortfolios;

            await refreshApex(this.wiredPortfoliosResult);
        } catch (error) {
            this.showToast('Error', 'Failed to update priority', 'error');
            console.error('Error updating priority:', error);
        }
    }

    // ============ Process Events ============

    async handleProcessEvents() {
        this.isProcessingEvents = true;
        try {
            const result = await processEventsNow();
            if (result.success) {
                this.showToast('Success', result.message || 'Events processed successfully', 'success');
                await Promise.all([
                    refreshApex(this.wiredPortfoliosResult),
                    refreshApex(this.wiredStatsResult)
                ]);
            } else {
                this.showToast('Error', result.errorMessage || 'Failed to process events', 'error');
            }
        } catch (error) {
            this.showToast('Error', 'Failed to process events: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isProcessingEvents = false;
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
