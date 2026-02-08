import { LightningElement, api, track, wire } from 'lwc';
import getProductsByCategory from '@salesforce/apex/ProductPickerService.getProductsByCategory';

export default class JourneyApprovalCard extends LightningElement {
    @api approval;

    @track editedSubject;
    @track editedBody;
    @track showDeclineModal = false;
    @track showRegenerateModal = false;
    @track showProductPicker = false;
    @track declineReason = '';
    @track newPrompt = '';
    @track localProducts = [];
    @track productsModified = false;

    // ─── Inline Picker State ──────────────────────────────────────────
    @track pickerCategories = [];
    @track pickerAllProducts = [];
    @track pickerFilteredProducts = [];
    @track pickerSearchTerm = '';
    @track pickerActiveCategory = 'all';
    @track pickerSelectedProducts = [];
    @track pickerLoading = true;

    connectedCallback() {
        // Initialize editable fields with suggested content
        this.editedSubject = this.approval?.Suggested_Subject__c || '';
        this.editedBody = this.approval?.Suggested_Body__c || '';
        this.newPrompt = this.approval?.Firefly_Prompt__c || '';
        // Initialize local products from approval
        this.localProducts = this.recommendedProducts;
    }

    @wire(getProductsByCategory)
    wiredCategories({ error, data }) {
        this.pickerLoading = false;
        if (data) {
            this.pickerCategories = data;
            // Flatten all products
            this.pickerAllProducts = [];
            data.forEach(cat => {
                cat.products.forEach(p => {
                    this.pickerAllProducts.push({ ...p, categoryName: cat.label });
                });
            });
            this.applyPickerFilters();
        } else if (error) {
            console.error('Error loading products:', error);
        }
    }

    get formattedEventDate() {
        if (!this.approval?.Event_Date__c) return '';
        const date = new Date(this.approval.Event_Date__c);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Parse and return recommended products from JSON field
     */
    get recommendedProducts() {
        if (!this.approval?.Recommended_Products__c) return [];
        try {
            return JSON.parse(this.approval.Recommended_Products__c);
        } catch (e) {
            console.error('Failed to parse recommended products:', e);
            return [];
        }
    }

    get hasRecommendedProducts() {
        return this.displayProducts.length > 0;
    }

    get displayProducts() {
        // Use local products if modified, otherwise use from approval
        return this.productsModified ? this.localProducts : this.recommendedProducts;
    }

    get canAddMoreProducts() {
        return this.displayProducts.length < 5;
    }

    get addProductsLabel() {
        return this.hasRecommendedProducts ? '+ Add/Edit' : '+ Add Products';
    }

    // ─── Product Management ────────────────────────────────────────────

    handleRemoveProduct(event) {
        event.stopPropagation();
        const productCode = event.currentTarget.dataset.code;
        this.localProducts = this.localProducts.filter(p => p.productCode !== productCode);
        this.productsModified = true;
        // Dispatch event to update products on approval record
        this.dispatchProductUpdate();
    }

    handleAddProducts() {
        // Initialize picker selection with current products
        this.pickerSelectedProducts = [...this.displayProducts];
        this.showProductPicker = true;
    }

    dispatchProductUpdate() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'updateProducts',
                approvalId: this.approval.Id,
                data: {
                    products: JSON.stringify(this.localProducts)
                }
            }
        }));
    }

    // ─── Inline Picker Logic ──────────────────────────────────────────

    get pickerCategoryOptions() {
        const options = [{ label: 'All Products', value: 'all' }];
        this.pickerCategories.forEach(cat => {
            options.push({ label: cat.label, value: cat.name });
        });
        return options;
    }

    get pickerSelectedCount() {
        return this.pickerSelectedProducts.length;
    }

    get pickerCanAddMore() {
        return this.pickerSelectedProducts.length < 5;
    }

    get pickerSelectionSummary() {
        if (this.pickerSelectedCount === 0) {
            return 'No products selected';
        }
        return `${this.pickerSelectedCount} of 5 products selected`;
    }

    get isPickerClearDisabled() {
        return this.pickerSelectedCount === 0;
    }

    get hasPickerProducts() {
        return this.pickerFilteredProducts.length > 0;
    }

    get pickerProductsWithSelection() {
        return this.pickerFilteredProducts.map(product => ({
            ...product,
            isSelected: this.pickerSelectedProducts.some(p => p.productCode === product.productCode),
            selectClass: this.pickerSelectedProducts.some(p => p.productCode === product.productCode)
                ? 'picker-product-card picker-selected'
                : 'picker-product-card'
        }));
    }

    handlePickerSearchChange(event) {
        this.pickerSearchTerm = event.target.value;
        this.applyPickerFilters();
    }

    handlePickerCategoryChange(event) {
        this.pickerActiveCategory = event.detail.value;
        this.applyPickerFilters();
    }

    handlePickerProductClick(event) {
        const productCode = event.currentTarget.dataset.code;
        const product = this.pickerAllProducts.find(p => p.productCode === productCode);

        if (!product) return;

        const isCurrentlySelected = this.pickerSelectedProducts.some(p => p.productCode === productCode);

        if (isCurrentlySelected) {
            // Remove from selection
            this.pickerSelectedProducts = this.pickerSelectedProducts.filter(p => p.productCode !== productCode);
        } else if (this.pickerCanAddMore) {
            // Add to selection
            this.pickerSelectedProducts = [...this.pickerSelectedProducts, product];
        }
    }

    handlePickerClearAll() {
        this.pickerSelectedProducts = [];
    }

    handlePickerCancel() {
        this.showProductPicker = false;
        // Reset picker state
        this.pickerSearchTerm = '';
        this.pickerActiveCategory = 'all';
        this.applyPickerFilters();
    }

    handlePickerConfirm() {
        this.localProducts = [...this.pickerSelectedProducts];
        this.productsModified = true;
        this.showProductPicker = false;
        // Dispatch event to update products on approval record
        this.dispatchProductUpdate();
        // Reset picker state
        this.pickerSearchTerm = '';
        this.pickerActiveCategory = 'all';
        this.applyPickerFilters();
    }

    applyPickerFilters() {
        let results = [...this.pickerAllProducts];

        // Filter by category
        if (this.pickerActiveCategory !== 'all') {
            const categoryLabel = this.pickerCategories.find(c => c.name === this.pickerActiveCategory)?.label;
            if (categoryLabel) {
                results = results.filter(p => p.category === categoryLabel);
            }
        }

        // Filter by search term
        if (this.pickerSearchTerm) {
            const term = this.pickerSearchTerm.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.brand.toLowerCase().includes(term) ||
                (p.shortDescription && p.shortDescription.toLowerCase().includes(term))
            );
        }

        this.pickerFilteredProducts = results;
    }

    // ─── Other Event Handlers ─────────────────────────────────────────

    handleSubjectChange(event) {
        this.editedSubject = event.target.value;
    }

    handleBodyChange(event) {
        this.editedBody = event.target.value;
    }

    handleApprove() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'approve',
                approvalId: this.approval.Id,
                data: {
                    subject: this.editedSubject,
                    body: this.editedBody
                }
            }
        }));
    }

    handleApproveAndSend() {
        // First approve, then send
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'approve',
                approvalId: this.approval.Id,
                data: {
                    subject: this.editedSubject,
                    body: this.editedBody
                }
            }
        }));

        // The parent will handle the send after approval completes
        // Or we can dispatch a combined action
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('action', {
                detail: {
                    action: 'send',
                    approvalId: this.approval.Id,
                    data: {}
                }
            }));
        }, 1000);
    }

    handleDecline() {
        this.showDeclineModal = true;
    }

    closeDeclineModal() {
        this.showDeclineModal = false;
        this.declineReason = '';
    }

    handleDeclineReasonChange(event) {
        this.declineReason = event.target.value;
    }

    confirmDecline() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'decline',
                approvalId: this.approval.Id,
                data: {
                    reason: this.declineReason
                }
            }
        }));
        this.closeDeclineModal();
    }

    handleRegenerateClick() {
        this.showRegenerateModal = true;
    }

    handleEditPrompt() {
        // Open the regenerate modal to edit the prompt
        this.showRegenerateModal = true;
    }

    closeRegenerateModal() {
        this.showRegenerateModal = false;
    }

    handlePromptChange(event) {
        this.newPrompt = event.target.value;
    }

    confirmRegenerate() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'regenerate',
                approvalId: this.approval.Id,
                data: {
                    prompt: this.newPrompt
                }
            }
        }));
        this.closeRegenerateModal();
    }
}
