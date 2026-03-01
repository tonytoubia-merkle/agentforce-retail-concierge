import { LightningElement, api, track, wire } from 'lwc';
import getProductsByCategory from '@salesforce/apex/ProductPickerService.getProductsByCategory';

export default class JourneyApprovalCard extends LightningElement {
    _approval;
    @api journeySteps = []; // All steps in this journey (passed from parent)

    // Use a setter to detect when approval changes and refresh local state
    @api
    get approval() {
        return this._approval;
    }
    set approval(value) {
        this._approval = value;

        // Always refresh local state from server data
        // This ensures server-regenerated content (body, prompt, products) is displayed immediately
        if (value) {
            console.log('[JourneyApprovalCard] Setter called, syncing local state from server');
            console.log('[JourneyApprovalCard] Image URL:', value.Generated_Image_URL__c);
            this.editedSubject = value.Suggested_Subject__c || '';
            this.editedBody = value.Suggested_Body__c || '';
            this.editedSmsBody = value.SMS_Body__c || '';
            this.newPrompt = value.Firefly_Prompt__c || '';
            // Sync local products with server state
            this.localProducts = this.parseProducts(value.Recommended_Products__c);
            this.productsModified = false; // Reset flag - server now has latest
            // Sync video state
            this.editedVideoPrompt = value.Video_Prompt__c || '';
            // Reset image/video error state when approval changes
            this.imageLoadError = false;
            // Reset generating states - data has been refreshed
            this.isGeneratingImage = false;
            this.isGeneratingVideo = false;
        }
    }

    @track editedSubject = '';
    @track editedBody = '';
    @track editedSmsBody = '';
    @track showDeclineModal = false;
    @track showRegenerateModal = false;
    @track showImageModal = false; // Full-size image preview modal
    @track showSendConfirmModal = false; // Confirmation before sending
    @track showProductPicker = false;
    @track showPreview = false; // Toggle between edit and preview mode
    @track declineReason = '';
    @track newPrompt = '';
    @track localProducts = [];
    @track productsModified = false;
    @track currentStepIndex = 0; // For multi-step navigation
    @track isEditingTiming = false;
    @track editedDelayDays = 0;

    // ─── Inline Picker State ──────────────────────────────────────────
    @track pickerCategories = [];
    @track pickerAllProducts = [];
    @track pickerFilteredProducts = [];
    @track pickerSearchTerm = '';
    @track pickerActiveCategory = 'all';
    @track pickerSelectedProducts = [];
    @track pickerLoading = true;
    @track imageLoadError = false; // Track if generated image failed to load
    @track isGeneratingImage = false; // Track if image generation is in progress
    @track isGeneratingVideo = false; // Track if video generation is in progress
    @track editedVideoPrompt = ''; // Editable video prompt
    @track showRegenerateVideoModal = false; // Modal for editing video prompt

    // Helper to parse products JSON
    parseProducts(productsJson) {
        if (!productsJson) return [];
        try {
            return JSON.parse(productsJson);
        } catch (e) {
            console.error('Failed to parse products:', e);
            return [];
        }
    }

    connectedCallback() {
        // Initial setup - approval setter will handle state initialization
        if (this.approval?.Step_Number__c) {
            this.currentStepIndex = this.approval.Step_Number__c - 1;
        }
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

    // ─── Marketing Flow Getters ───────────────────────────────────────

    get hasMarketingFlow() {
        return !!this.approval?.Marketing_Flow__c || !!this.approval?.hasMarketingFlow;
    }

    get marketingFlowName() {
        return this.approval?.Marketing_Flow__r?.Name || this.approval?.marketingFlowName || 'Marketing Flow';
    }

    get marketingFlowRecordUrl() {
        // Navigate to the Marketing Flow record in Salesforce
        if (this.approval?.Marketing_Flow__c) {
            return `/${this.approval.Marketing_Flow__c}`;
        }
        return null;
    }

    // ─── Email Content (MC Workspace) Getters ─────────────────────────

    get hasEmailContent() {
        return !!this.approval?.Email_Content_Version_Id__c || !!this.approval?.hasEmailContent;
    }

    get emailContentRecordUrl() {
        // Navigate to the ContentVersion record in Salesforce
        if (this.approval?.Email_Content_Version_Id__c) {
            // Link to the Content file preview
            return `/sfc/servlet.shepherd/version/renditionDownload?rendition=ORIGINAL_Html&versionId=${this.approval.Email_Content_Version_Id__c}`;
        }
        return null;
    }

    get emailContentDocumentUrl() {
        // Navigate to the ContentDocument (Files view)
        if (this.approval?.Email_Content_Version_Id__c) {
            // Use the version ID with rendition download for preview
            return `/lightning/r/ContentVersion/${this.approval.Email_Content_Version_Id__c}/view`;
        }
        return null;
    }

    // ─── Multi-Step Journey Getters ────────────────────────────────────

    get isMultiStepJourney() {
        return (this.approval?.Total_Steps__c || 1) > 1;
    }

    get stepNumber() {
        return this.approval?.Step_Number__c || 1;
    }

    get totalSteps() {
        return this.approval?.Total_Steps__c || 1;
    }

    get stepLabel() {
        return `Step ${this.stepNumber} of ${this.totalSteps}`;
    }

    get hasPreviousStep() {
        return this.stepNumber > 1;
    }

    get hasNextStep() {
        return this.stepNumber < this.totalSteps;
    }

    // Inverted getters for disabled state (LWC templates can't use !)
    get isPreviousDisabled() {
        return !this.hasPreviousStep;
    }

    get isNextDisabled() {
        return !this.hasNextStep;
    }

    get stepProgressPercent() {
        return Math.round((this.stepNumber / this.totalSteps) * 100);
    }

    get stepProgressStyle() {
        return `width: ${this.stepProgressPercent}%`;
    }

    // ─── Channel Getters ───────────────────────────────────────────────

    get channel() {
        return this.approval?.Channel__c || 'Email';
    }

    get isEmailChannel() {
        return this.channel === 'Email';
    }

    get isSmsChannel() {
        return this.channel === 'SMS';
    }

    get isPushChannel() {
        return this.channel === 'Push';
    }

    get isVideoChannel() {
        return this.channel === 'Video';
    }

    get channelIcon() {
        switch (this.channel) {
            case 'Email': return 'utility:email';
            case 'SMS': return 'utility:chat';
            case 'Push': return 'utility:notification';
            case 'Video': return 'utility:video';
            default: return 'utility:email';
        }
    }

    get channelBadgeClass() {
        const base = 'slds-badge channel-badge';
        switch (this.channel) {
            case 'Email': return `${base} channel-email`;
            case 'SMS': return `${base} channel-sms`;
            case 'Push': return `${base} channel-push`;
            case 'Video': return `${base} channel-video`;
            default: return base;
        }
    }

    // ─── Timing/Scheduling Getters ─────────────────────────────────────

    get sendDelayDays() {
        return this.approval?.Send_Delay_Days__c || 0;
    }

    get scheduledSendDate() {
        if (!this.approval?.Scheduled_Send_Date__c) return null;
        const date = new Date(this.approval.Scheduled_Send_Date__c);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    get sendTimingLabel() {
        if (this.stepNumber === 1) {
            return 'Sends immediately after approval';
        }
        if (this.sendDelayDays === 1) {
            return `Sends 1 day after Step ${this.stepNumber - 1}`;
        }
        return `Sends ${this.sendDelayDays} days after Step ${this.stepNumber - 1}`;
    }

    get canEditTiming() {
        return this.stepNumber > 1;
    }

    get previousStepNumber() {
        return this.stepNumber - 1;
    }

    get timingLabelClass() {
        return this.canEditTiming ? 'timing-editable' : '';
    }

    get timingEditTitle() {
        return this.canEditTiming ? 'Click to edit send timing' : '';
    }

    // ─── Guardrails Getters ────────────────────────────────────────────

    get hasGuardrails() {
        return !!this.approval?.Journey_Guardrails__c;
    }

    get guardrails() {
        if (!this.approval?.Journey_Guardrails__c) return null;
        try {
            return JSON.parse(this.approval.Journey_Guardrails__c);
        } catch (e) {
            console.error('Failed to parse guardrails:', e);
            return null;
        }
    }

    get guardrailsList() {
        const g = this.guardrails;
        if (!g) return [];
        const rules = [];
        if (g.maxEmailsPerWeek) {
            rules.push({ icon: 'utility:ban', text: `Max ${g.maxEmailsPerWeek} email(s) per week` });
        }
        if (g.exitOnPurchase) {
            rules.push({ icon: 'utility:logout', text: 'Exit journey on purchase' });
        }
        if (g.exitOnUnsubscribe) {
            rules.push({ icon: 'utility:logout', text: 'Exit on unsubscribe' });
        }
        if (g.minDaysBetweenMessages) {
            rules.push({ icon: 'utility:clock', text: `Min ${g.minDaysBetweenMessages} day(s) between messages` });
        }
        if (g.suppressIfOpened) {
            rules.push({ icon: 'utility:check', text: 'Suppress if previous email opened' });
        }
        if (g.suppressIfClicked) {
            rules.push({ icon: 'utility:check', text: 'Suppress if previous email clicked' });
        }
        return rules;
    }

    // ─── Preview Mode Toggle ───────────────────────────────────────────

    get previewButtonLabel() {
        return this.showPreview ? 'Edit Content' : 'Preview';
    }

    get previewButtonIcon() {
        return this.showPreview ? 'utility:edit' : 'utility:preview';
    }

    handleTogglePreview() {
        this.showPreview = !this.showPreview;
    }

    // ─── Body Content (channel-aware) ──────────────────────────────────

    get bodyContent() {
        if (this.isSmsChannel || this.isPushChannel) {
            return this.editedSmsBody;
        }
        return this.editedBody;
    }

    get bodyLabel() {
        if (this.isSmsChannel) return 'SMS Message';
        if (this.isPushChannel) return 'Push Notification Text';
        if (this.isVideoChannel) return 'Video Companion Text';
        return 'Email Body';
    }

    get bodyMaxLength() {
        if (this.isSmsChannel) return 320;
        if (this.isPushChannel) return 200;
        return 32000;
    }

    // ─── Send Confirmation ─────────────────────────────────────────────

    get sendConfirmMessage() {
        const channelText = this.channel.toLowerCase();
        if (this.isMultiStepJourney) {
            return `This will immediately send this ${channelText} (Step ${this.stepNumber} of ${this.totalSteps}) to ${this.approval?.contactName || 'the contact'}. The remaining steps in this journey will NOT be sent yet.`;
        }
        return `This will immediately send this ${channelText} to ${this.approval?.contactName || 'the contact'}.`;
    }

    // ─── Generated Image ──────────────────────────────────────────────

    get hasGeneratedImage() {
        // Check if we have a valid URL and the image hasn't failed to load
        const url = this.approval?.Generated_Image_URL__c;
        return url && url.trim() !== '' && !this.imageLoadError;
    }

    handleImageError() {
        console.warn('[JourneyApprovalCard] Generated image failed to load');
        this.imageLoadError = true;
    }

    handleProductImageError(event) {
        const img = event.target;
        const productCode = img.dataset.code;
        const currentSrc = img.src;
        console.warn('[JourneyApprovalCard] Product image failed to load:', productCode, currentSrc);

        // Try reconstructing the URL from productCode if the stored URL is broken
        const expectedUrl = `https://agentforce-retail-advisor.vercel.app/assets/products/${productCode}.png`;
        if (currentSrc !== expectedUrl && productCode) {
            console.log('[JourneyApprovalCard] Retrying with reconstructed URL:', expectedUrl);
            img.src = expectedUrl;
        } else {
            // Hide broken image, show placeholder
            img.style.display = 'none';
            img.insertAdjacentHTML('afterend',
                '<div class="product-image-placeholder"><span style="font-size:1.5rem;color:#b0adab;">&#128247;</span></div>'
            );
        }
    }

    // Reset error state when approval changes (in case new image is generated)
    resetImageError() {
        this.imageLoadError = false;
    }

    // ─── Existing Getters ──────────────────────────────────────────────

    get formattedEventType() {
        // Try direct field first, then enriched property from parent
        const type = this.approval?.Event_Type__c || this.approval?.eventType || 'Event';
        // Format "life-event" → "Life Event"
        return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    get eventDescription() {
        // Extract the DESCRIPTION line from Event_Summary__c for a concise display
        const summary = this.approval?.Event_Summary__c;
        if (summary) {
            const match = summary.match(/DESCRIPTION:\s*(.+)/);
            if (match) {
                return match[1].trim();
            }
        }
        // Fallback to event type (but only if it's meaningful, not the generic fallback)
        const type = this.approval?.Event_Type__c || this.approval?.eventType;
        if (type && type !== 'Event') {
            return this.formattedEventType;
        }
        return 'Meaningful event captured';
    }

    get formattedEventDate() {
        const dateVal = this.approval?.Event_Date__c || this.approval?.eventDate;
        if (!dateVal) return '';
        const date = new Date(dateVal);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    get hasEventDate() {
        return !!(this.approval?.Event_Date__c || this.approval?.eventDate);
    }

    get agentInsight() {
        const summary = this.approval?.Event_Summary__c;
        if (!summary) return null;
        const match = summary.match(/AGENT INSIGHT:\s*(.+)/);
        return match ? match[1].trim() : null;
    }

    get hasAgentInsight() {
        return !!this.agentInsight;
    }

    get showUrgencyBadge() {
        const urgency = this.approval?.Urgency__c;
        return urgency && urgency !== 'No Date';
    }

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
        return this.productsModified ? this.localProducts : this.recommendedProducts;
    }

    get canAddMoreProducts() {
        return this.displayProducts.length < 5;
    }

    get addProductsLabel() {
        return this.hasRecommendedProducts ? 'Add/Edit' : 'Add Products';
    }

    // ─── Step Navigation ───────────────────────────────────────────────

    handlePreviousStep() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'navigateStep',
                approvalId: this.approval.Id,
                data: { direction: 'previous' }
            }
        }));
    }

    handleNextStep() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'navigateStep',
                approvalId: this.approval.Id,
                data: { direction: 'next' }
            }
        }));
    }

    // ─── Timing Edit ────────────────────────────────────────────────────

    handleEditTiming() {
        if (!this.canEditTiming) return;
        this.editedDelayDays = this.sendDelayDays;
        this.isEditingTiming = true;
    }

    handleDelayDaysChange(event) {
        this.editedDelayDays = parseInt(event.target.value, 10) || 0;
    }

    handleTimingSave() {
        this.isEditingTiming = false;
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'updateTiming',
                approvalId: this.approval.Id,
                data: { delayDays: this.editedDelayDays }
            }
        }));
    }

    handleTimingCancel() {
        this.isEditingTiming = false;
    }

    // ─── Product Management ────────────────────────────────────────────

    handleRemoveProduct(event) {
        event.stopPropagation();
        const productCode = event.currentTarget.dataset.code;
        this.localProducts = this.localProducts.filter(p => p.productCode !== productCode);
        this.productsModified = true;
        this.dispatchProductUpdate();
    }

    handleAddProducts() {
        this.pickerSelectedProducts = [...this.displayProducts];
        this.showProductPicker = true;
    }

    dispatchProductUpdate() {
        console.log('[Card] Dispatching updateProducts action:', this.approval.Id);
        console.log('[Card] Products:', JSON.stringify(this.localProducts));
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
            this.pickerSelectedProducts = this.pickerSelectedProducts.filter(p => p.productCode !== productCode);
        } else if (this.pickerCanAddMore) {
            this.pickerSelectedProducts = [...this.pickerSelectedProducts, product];
        }
    }

    handlePickerClearAll() {
        this.pickerSelectedProducts = [];
    }

    handlePickerCancel() {
        this.showProductPicker = false;
        this.pickerSearchTerm = '';
        this.pickerActiveCategory = 'all';
        this.applyPickerFilters();
    }

    handlePickerConfirm() {
        this.localProducts = [...this.pickerSelectedProducts];
        this.productsModified = true;
        this.showProductPicker = false;
        this.dispatchProductUpdate();
        this.pickerSearchTerm = '';
        this.pickerActiveCategory = 'all';
        this.applyPickerFilters();
    }

    applyPickerFilters() {
        let results = [...this.pickerAllProducts];

        if (this.pickerActiveCategory !== 'all') {
            const categoryLabel = this.pickerCategories.find(c => c.name === this.pickerActiveCategory)?.label;
            if (categoryLabel) {
                results = results.filter(p => p.category === categoryLabel);
            }
        }

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

    // ─── Content Editing Event Handlers ────────────────────────────────

    handleSubjectChange(event) {
        this.editedSubject = event.target.value;
    }

    handleBodyChange(event) {
        if (this.isSmsChannel || this.isPushChannel) {
            this.editedSmsBody = event.target.value;
        } else {
            this.editedBody = event.target.value;
        }
    }

    // ─── Approval Actions ──────────────────────────────────────────────

    handleApprove() {
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'approve',
                approvalId: this.approval.Id,
                data: {
                    subject: this.editedSubject,
                    body: this.isEmailChannel ? this.editedBody : this.editedSmsBody
                }
            }
        }));
    }

    handleApproveAndSend() {
        // Show confirmation modal before sending
        this.showSendConfirmModal = true;
    }

    closeSendConfirmModal() {
        this.showSendConfirmModal = false;
    }

    confirmApproveAndSend() {
        this.showSendConfirmModal = false;

        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'approve',
                approvalId: this.approval.Id,
                data: {
                    subject: this.editedSubject,
                    body: this.isEmailChannel ? this.editedBody : this.editedSmsBody
                }
            }
        }));

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

    handleApproveAllSteps() {
        // Approve all steps in the journey at once
        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'approveJourney',
                approvalId: this.approval.Id,
                data: {
                    journeyId: this.approval.Journey_Id__c
                }
            }
        }));
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
        this.showRegenerateModal = true;
    }

    // ─── Image Preview Modal ──────────────────────────────────────────

    handleImageClick() {
        this.showImageModal = true;
    }

    closeImageModal() {
        this.showImageModal = false;
    }

    closeRegenerateModal() {
        this.showRegenerateModal = false;
    }

    handlePromptChange(event) {
        this.newPrompt = event.target.value;
    }

    confirmRegenerate() {
        // Set loading state before dispatching action
        this.isGeneratingImage = true;
        this.imageLoadError = false; // Reset error state

        const productsPayload = JSON.stringify(this.displayProducts);
        console.log('[JourneyApprovalCard] Regenerating with', this.displayProducts.length, 'products:', this.displayProducts.map(p => p.name));
        console.log('[JourneyApprovalCard] productsModified:', this.productsModified);

        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'regenerate',
                approvalId: this.approval.Id,
                data: {
                    prompt: this.newPrompt,
                    products: productsPayload
                }
            }
        }));
        this.closeRegenerateModal();
    }

    // ─── Video Channel Methods ──────────────────────────────────────────

    get videoUrl() {
        return this.approval?.Generated_Video_URL__c;
    }

    get hasGeneratedVideo() {
        return !!this.videoUrl && this.videoUrl.trim() !== '';
    }

    get videoPrompt() {
        return this.approval?.Video_Prompt__c || '';
    }

    get generateVideoLabel() {
        return this.hasGeneratedVideo ? 'Regenerate Video' : 'Generate Video';
    }

    handleVideoPromptChange(event) {
        this.editedVideoPrompt = event.target.value;
    }

    handleGenerateVideoClick() {
        this.showRegenerateVideoModal = true;
    }

    handleEditVideoPrompt() {
        this.showRegenerateVideoModal = true;
    }

    closeRegenerateVideoModal() {
        this.showRegenerateVideoModal = false;
    }

    confirmRegenerateVideo() {
        this.isGeneratingVideo = true;
        this.showRegenerateVideoModal = false;

        this.dispatchEvent(new CustomEvent('action', {
            detail: {
                action: 'regenerate_video',
                approvalId: this.approval.Id,
                data: {
                    prompt: this.editedVideoPrompt
                }
            }
        }));
    }
}
