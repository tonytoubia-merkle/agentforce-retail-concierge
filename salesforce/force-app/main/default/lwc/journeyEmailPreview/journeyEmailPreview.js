import { LightningElement, api } from 'lwc';

/**
 * Email Preview Component for Journey Approvals
 *
 * Renders a realistic email preview with:
 * - Subject line header
 * - Hero image (Firefly generated)
 * - Body content (HTML)
 * - BEAUTÉ brand styling
 */
export default class JourneyEmailPreview extends LightningElement {
    @api subject = '';
    @api body = '';
    @api heroImageUrl = '';
    @api contactName = '';
    @api contactEmail = '';
    @api products = [];
    @api channel = 'Email'; // Email, SMS, Push, Video
    @api videoUrl = '';

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

    get isVideoChannel() {
        return this.channel === 'Video';
    }

    get hasVideo() {
        return !!this.videoUrl;
    }

    get hasHeroImage() {
        return !!this.heroImageUrl;
    }

    /**
     * Hero headline for the image overlay.
     * Uses the subject line, cleaned up for display.
     */
    get heroHeadline() {
        if (!this.subject) return 'Discover Your Radiance';

        // Remove any contact name prefix (e.g., "Sarah, Your bridal glow awaits")
        let headline = this.subject;
        if (headline.includes(',')) {
            const parts = headline.split(',');
            if (parts.length > 1 && parts[0].length < 20) {
                headline = parts.slice(1).join(',').trim();
            }
        }

        // Capitalize first letter if needed
        return headline.charAt(0).toUpperCase() + headline.slice(1);
    }

    /**
     * Subheadline for the image overlay.
     * Generated based on event context or uses a default.
     */
    get heroSubheadline() {
        const subjectLower = (this.subject || '').toLowerCase();

        if (subjectLower.includes('travel') || subjectLower.includes('trip')) {
            return 'Curated essentials for your journey';
        }
        if (subjectLower.includes('wedding') || subjectLower.includes('bridal')) {
            return 'For your most beautiful day';
        }
        if (subjectLower.includes('birthday')) {
            return 'Celebrate with something special';
        }
        if (subjectLower.includes('last chance') || subjectLower.includes('reminder')) {
            return "Don't miss out on these must-haves";
        }

        return 'Curated just for you';
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
        return this.subject || 'BEAUTÉ Beauty';
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
            case 'Video':
                return `${baseClass} slds-theme_alt-inverse`;
            default:
                return baseClass;
        }
    }

    /**
     * Strip trailing sign-off from body HTML since the preview template
     * adds its own signature after the product section.
     * Matches patterns like "With love,<br/>The BEAUTÉ Team" in various HTML forms.
     */
    get cleanedBody() {
        if (!this.body) return '';
        let html = this.body;

        // Remove trailing sign-off block: "With love," + "The BEAUTÉ Team" (or BEAUTE)
        // Handles: <p>With love,<br/>The BEAUTÉ Team</p> or separate <p> tags
        html = html.replace(/<p[^>]*>\s*With love,?\s*<br\s*\/?>\s*The BEAUT[ÉE] Team\s*<\/p>\s*$/i, '');
        html = html.replace(/<p[^>]*>\s*With love,?\s*<\/p>\s*<p[^>]*>\s*The BEAUT[ÉE] Team\s*<\/p>\s*$/i, '');

        // Also handle: "Bon voyage!...</p><p>With love,<br/>The BEAUTÉ Team</p>" at end
        html = html.replace(/<p[^>]*>\s*With love,?\s*<br\s*\/?>\s*The BEAUT[ÉE] Team\s*<\/p>\s*/gi, '');
        // Handle split paragraphs anywhere (not just at end)
        html = html.replace(/<p[^>]*>\s*With love,?\s*<\/p>\s*<p[^>]*>\s*The BEAUT[ÉE] Team\s*<\/p>\s*/gi, '');

        return html.trim();
    }

    // Render HTML body content after component renders
    renderedCallback() {
        if (this.isEmailChannel) {
            const contentDiv = this.template.querySelector('.email-content');
            if (contentDiv && this.body) {
                contentDiv.innerHTML = this.cleanedBody;
            }
        }
    }
}
