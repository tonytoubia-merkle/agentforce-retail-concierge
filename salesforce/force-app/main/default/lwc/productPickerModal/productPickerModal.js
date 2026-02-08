import { LightningElement, api, track, wire } from 'lwc';
import getProductsByCategory from '@salesforce/apex/ProductPickerService.getProductsByCategory';
import searchProducts from '@salesforce/apex/ProductPickerService.searchProducts';
import getAvailableTags from '@salesforce/apex/ProductPickerService.getAvailableTags';

export default class ProductPickerModal extends LightningElement {
    @api isOpen = false;
    @api selectedProducts = []; // Products already selected
    @api maxProducts = 5;

    @track categories = [];
    @track filteredProducts = [];
    @track availableTags = [];
    @track selectedTags = [];
    @track searchTerm = '';
    @track isLoading = true;
    @track activeCategory = 'all';
    @track localSelectedProducts = [];

    allProducts = [];

    connectedCallback() {
        console.log('[ProductPickerModal] connectedCallback, isOpen:', this.isOpen);
        // Initialize local selection from parent
        this.localSelectedProducts = [...(this.selectedProducts || [])];
    }

    renderedCallback() {
        console.log('[ProductPickerModal] renderedCallback, isOpen:', this.isOpen);
    }

    @wire(getProductsByCategory)
    wiredCategories({ error, data }) {
        this.isLoading = false;
        if (data) {
            this.categories = data;
            // Flatten all products
            this.allProducts = [];
            data.forEach(cat => {
                cat.products.forEach(p => {
                    this.allProducts.push({ ...p, categoryName: cat.label });
                });
            });
            this.applyFilters();
        } else if (error) {
            console.error('Error loading products:', error);
        }
    }

    @wire(getAvailableTags)
    wiredTags({ data }) {
        if (data) {
            this.availableTags = data.map(tag => ({
                label: tag.charAt(0).toUpperCase() + tag.slice(1).replace('-', ' '),
                value: tag,
                isSelected: false
            }));
        }
    }

    // ─── Computed Properties ───────────────────────────────────────────

    get modalClass() {
        return this.isOpen ? 'slds-modal slds-fade-in-open' : 'slds-modal';
    }

    get backdropClass() {
        return this.isOpen ? 'slds-backdrop slds-backdrop_open' : 'slds-backdrop';
    }

    get categoryOptions() {
        const options = [{ label: 'All Products', value: 'all' }];
        this.categories.forEach(cat => {
            options.push({ label: cat.label, value: cat.name });
        });
        return options;
    }

    get selectedCount() {
        return this.localSelectedProducts.length;
    }

    get canAddMore() {
        return this.localSelectedProducts.length < this.maxProducts;
    }

    get selectionSummary() {
        if (this.selectedCount === 0) {
            return 'No products selected';
        }
        return `${this.selectedCount} of ${this.maxProducts} products selected`;
    }

    get isClearDisabled() {
        return this.selectedCount === 0;
    }

    get productsWithSelection() {
        return this.filteredProducts.map(product => ({
            ...product,
            isSelected: this.localSelectedProducts.some(p => p.productCode === product.productCode),
            selectClass: this.localSelectedProducts.some(p => p.productCode === product.productCode)
                ? 'product-card selected'
                : 'product-card'
        }));
    }

    // ─── Event Handlers ────────────────────────────────────────────────

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        this.applyFilters();
    }

    handleCategoryChange(event) {
        this.activeCategory = event.detail.value;
        this.applyFilters();
    }

    handleTagClick(event) {
        const tagValue = event.currentTarget.dataset.tag;
        const tagIndex = this.selectedTags.indexOf(tagValue);

        if (tagIndex === -1) {
            this.selectedTags = [...this.selectedTags, tagValue];
        } else {
            this.selectedTags = this.selectedTags.filter(t => t !== tagValue);
        }

        // Update tag visual state
        this.availableTags = this.availableTags.map(tag => ({
            ...tag,
            isSelected: this.selectedTags.includes(tag.value)
        }));

        this.applyFilters();
    }

    handleProductClick(event) {
        const productCode = event.currentTarget.dataset.code;
        const product = this.allProducts.find(p => p.productCode === productCode);

        if (!product) return;

        const isCurrentlySelected = this.localSelectedProducts.some(p => p.productCode === productCode);

        if (isCurrentlySelected) {
            // Remove from selection
            this.localSelectedProducts = this.localSelectedProducts.filter(p => p.productCode !== productCode);
        } else if (this.canAddMore) {
            // Add to selection
            this.localSelectedProducts = [...this.localSelectedProducts, product];
        }
    }

    handleClearAll() {
        this.localSelectedProducts = [];
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleConfirm() {
        this.dispatchEvent(new CustomEvent('select', {
            detail: {
                products: this.localSelectedProducts
            }
        }));
    }

    // ─── Filter Logic ──────────────────────────────────────────────────

    applyFilters() {
        let results = [...this.allProducts];

        // Filter by category
        if (this.activeCategory !== 'all') {
            const categoryLabel = this.categories.find(c => c.name === this.activeCategory)?.label;
            if (categoryLabel) {
                results = results.filter(p => p.category === categoryLabel);
            }
        }

        // Filter by search term
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.brand.toLowerCase().includes(term) ||
                p.shortDescription.toLowerCase().includes(term)
            );
        }

        // Filter by tags
        if (this.selectedTags.length > 0) {
            results = results.filter(p => {
                if (!p.tags) return false;
                return this.selectedTags.some(tag =>
                    p.tags.includes(tag) || (tag === 'travel' && p.isTravel)
                );
            });
        }

        this.filteredProducts = results;
    }

    getTagClass(tag) {
        return tag.isSelected
            ? 'slds-badge slds-badge_brand tag-badge selected'
            : 'slds-badge tag-badge';
    }
}
