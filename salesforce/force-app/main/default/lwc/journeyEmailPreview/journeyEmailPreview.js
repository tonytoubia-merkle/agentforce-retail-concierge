import { LightningElement, api } from 'lwc';

/**
 * Email Preview Component for Journey Approvals
 *
 * Renders a realistic email preview with:
 * - Subject line header
 * - Hero image (Firefly generated)
 * - Body content (HTML)
 * - LUMIÈRE brand styling
 */
export default class JourneyEmailPreview extends LightningElement {
    @api subject = '';
    @api body = '';
    @api heroImageUrl = '';
    @api contactName = '';
    @api contactEmail = '';
    @api products = [];
    @api channel = 'Email'; // Email, SMS, Push

    // Toggle between preview and edit mode
    @api mode = 'preview'; // 'preview' or 'edit'

    get isEmailChannel() {
        return this.channel === 'Email';
    }

    get isSmsChannel() {
        return this.channel === 'SMS';
    }

    get isPushChannel() {
        return this.channel === 'Push';
    }

    get hasHeroImage() {
        return !!this.heroImageUrl;
    }

    get hasProducts() {
        return this.products && this.products.length > 0;
    }

    get displayProducts() {
        // Limit to 3 products for email preview
        return (this.products || []).slice(0, 3);
    }

    get previewDate() {
        const now = new Date();
        return now.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    get smsCharCount() {
        const bodyLength = (this.body || '').length;
        const smsCount = Math.ceil(bodyLength / 160);
        return `${bodyLength} characters (${smsCount} SMS${smsCount > 1 ? 's' : ''})`;
    }

    get smsPreviewBody() {
        // Strip HTML for SMS preview
        const temp = document.createElement('div');
        temp.innerHTML = this.body || '';
        return temp.textContent || temp.innerText || '';
    }

    get pushTitle() {
        // Use subject as push notification title
        return this.subject || 'LUMIÈRE Beauty';
    }

    get pushBody() {
        // Truncate body for push preview
        const text = this.smsPreviewBody;
        if (text.length > 100) {
            return text.substring(0, 97) + '...';
        }
        return text;
    }

    get channelBadgeClass() {
        const baseClass = 'slds-badge';
        switch (this.channel) {
            case 'Email':
                return `${baseClass} slds-theme_info`;
            case 'SMS':
                return `${baseClass} slds-theme_success`;
            case 'Push':
                return `${baseClass} slds-theme_warning`;
            default:
                return baseClass;
        }
    }

    // Render HTML body content after component renders
    renderedCallback() {
        if (this.isEmailChannel) {
            const contentDiv = this.template.querySelector('.email-content');
            if (contentDiv && this.body) {
                // Sanitize HTML (basic - in production use a proper sanitizer)
                contentDiv.innerHTML = this.body;
            }
        }
    }
}
