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
    @api channel = 'Email'; // Email, SMS, Push, Video, Media
    @api mediaPlatform = '';
    @api mediaAdFormat = '';
    @api mediaEstimatedReach = '';
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

    get isMediaChannel() {
        return this.channel === 'Media';
    }

    get merkuryLogoUrl() {
        return 'https://agentforce-retail-advisor.vercel.app/assets/merkury-logo.png';
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
            case 'Media':
                return `${baseClass} channel-badge-media`;
            default:
                return baseClass;
        }
    }

    /**
     * Strip trailing sign-off from body HTML since the preview template
     * adds its own signature after the product section.
     * Also replaces any remaining {{VIDEO_LINK}} placeholders.
     */
    get cleanedBody() {
        if (!this.body) return '';
        let html = this.body;

        // Replace {{VIDEO_LINK}} placeholder with styled CTA if video URL exists, otherwise remove it
        if (this.videoUrl) {
            const videoCta = '<p style="margin: 20px 0; text-align: center;">'
                + '<a href="' + this.videoUrl + '" style="display: inline-block; background: linear-gradient(135deg, #B76E79, #D4A574); color: white; text-decoration: none; padding: 14px 32px; border-radius: 25px; font-weight: 500; font-size: 14px; letter-spacing: 0.5px;">Watch Your Personalized Video</a>'
                + '</p>';
            html = html.replace(/<p[^>]*>\s*\{\{VIDEO_LINK\}\}\s*<\/p>/gi, videoCta);
            html = html.replace(/\{\{VIDEO_LINK\}\}/gi, videoCta);
        } else {
            // Remove the placeholder entirely if no video yet
            html = html.replace(/<p[^>]*>\s*\{\{VIDEO_LINK\}\}\s*<\/p>/gi, '');
            html = html.replace(/\{\{VIDEO_LINK\}\}/gi, '');
        }

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

    handleProductImageError(event) {
        const img = event.target;
        const productCode = img.dataset.code;
        if (productCode) {
            const expectedUrl = `https://agentforce-retail-advisor.vercel.app/assets/products/${productCode}.png`;
            if (img.src !== expectedUrl) {
                img.src = expectedUrl;
            } else {
                // Replace broken image with a styled placeholder
                img.style.display = 'none';
                img.insertAdjacentHTML('afterend',
                    '<div style="width:80px;height:80px;background:#f5f4f3;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#b0adab;">&#128142;</div>'
                );
            }
        }
    }

    // Render HTML body content after component renders
    renderedCallback() {
        if (this.isEmailChannel) {
            const contentDiv = this.template.querySelector('.email-content');
            if (contentDiv && this.body) {
                contentDiv.innerHTML = this.cleanedBody;
            }
        }
        if (this.isVideoChannel) {
            const companionDiv = this.template.querySelector('.video-companion-body');
            if (companionDiv && this.body) {
                companionDiv.innerHTML = this.cleanedBody;
            }
        }
    }
}
