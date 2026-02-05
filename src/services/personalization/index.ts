/**
 * Salesforce Personalization (Interaction Studio) Web SDK Wrapper
 *
 * Provides an abstraction layer over the SalesforceInteractions SDK.
 * When configured (VITE_SFP_BEACON_URL + VITE_SFP_DATASET), it initializes
 * the SDK and provides methods for identity sync, page/product tracking,
 * and campaign decision fetching.
 *
 * When not configured, all methods are no-ops and return nulls.
 */

export interface PersonalizationDecision {
  badge: string;
  headlineTop: string;
  headlineBottom: string;
  subtitle: string;
  campaignId?: string;
  experienceId?: string;
}

// Config from env
const SFP_BEACON_URL = import.meta.env.VITE_SFP_BEACON_URL || '';
const SFP_DATASET = import.meta.env.VITE_SFP_DATASET || '';

let initialized = false;

/**
 * Check if SF Personalization is configured.
 */
export function isPersonalizationConfigured(): boolean {
  return !!(SFP_BEACON_URL && SFP_DATASET);
}

/**
 * Initialize the SF Personalization SDK.
 * Call once on app startup.
 */
export function initPersonalization(userId?: string): void {
  if (!isPersonalizationConfigured() || initialized) return;
  initialized = true;

  console.log('[sfp] Initializing SF Personalization', { dataset: SFP_DATASET });

  // The SalesforceInteractions SDK is loaded via script tag in index.html
  // and becomes available on window.SalesforceInteractions
  const sfp = (window as any).SalesforceInteractions;
  if (!sfp) {
    console.warn('[sfp] SalesforceInteractions SDK not found on window. Add the script tag to index.html.');
    return;
  }

  try {
    sfp.init({
      consents: [{ provider: 'BeauteDemo', purpose: 'Personalization', status: 'OptIn' }],
    });

    if (userId) {
      sfp.sendEvent({
        interaction: {
          name: 'Identity',
          eventType: 'identity',
        },
        user: {
          identities: {
            emailAddress: userId,
          },
        },
      });
    }

    console.log('[sfp] SDK initialized');
  } catch (err) {
    console.error('[sfp] Init error:', err);
  }
}

/**
 * Sync user identity with SF Personalization.
 * Call when customer profile changes (login, persona switch).
 */
export function syncIdentity(email?: string, customerId?: string): void {
  if (!isPersonalizationConfigured() || !initialized) return;

  const sfp = (window as any).SalesforceInteractions;
  if (!sfp) return;

  try {
    sfp.sendEvent({
      interaction: {
        name: 'IdentitySync',
        eventType: 'identity',
      },
      user: {
        identities: {
          ...(email && { emailAddress: email }),
          ...(customerId && { customerId }),
        },
      },
    });
    console.log('[sfp] Identity synced:', email || customerId);
  } catch (err) {
    console.error('[sfp] Identity sync error:', err);
  }
}

/**
 * Track a page view.
 */
export function trackPageView(pageName: string, category?: string): void {
  if (!isPersonalizationConfigured() || !initialized) return;

  const sfp = (window as any).SalesforceInteractions;
  if (!sfp) return;

  try {
    sfp.sendEvent({
      interaction: {
        name: pageName,
        eventType: 'pageView',
        ...(category && {
          catalogObject: {
            type: 'Category',
            id: category,
          },
        }),
      },
    });
  } catch (err) {
    console.error('[sfp] Page view tracking error:', err);
  }
}

/**
 * Track a product view.
 */
export function trackProductView(productId: string, productName: string, category: string): void {
  if (!isPersonalizationConfigured() || !initialized) return;

  const sfp = (window as any).SalesforceInteractions;
  if (!sfp) return;

  try {
    sfp.sendEvent({
      interaction: {
        name: 'ViewProduct',
        eventType: 'productView',
        catalogObject: {
          type: 'Product',
          id: productId,
          attributes: {
            name: productName,
            category,
          },
        },
      },
    });
  } catch (err) {
    console.error('[sfp] Product view tracking error:', err);
  }
}

/**
 * Track an add-to-cart event.
 */
export function trackAddToCart(productId: string, productName: string, price: number): void {
  if (!isPersonalizationConfigured() || !initialized) return;

  const sfp = (window as any).SalesforceInteractions;
  if (!sfp) return;

  try {
    sfp.sendEvent({
      interaction: {
        name: 'AddToCart',
        eventType: 'addToCart',
        lineItem: {
          catalogObjectType: 'Product',
          catalogObjectId: productId,
          price,
          quantity: 1,
        },
      },
    });
  } catch (err) {
    console.error('[sfp] Add to cart tracking error:', err);
  }
}

/**
 * Fetch hero campaign decision from SF Personalization.
 * Returns null if not configured or if the campaign decision fails.
 */
export async function getHeroCampaignDecision(): Promise<PersonalizationDecision | null> {
  if (!isPersonalizationConfigured() || !initialized) return null;

  const sfp = (window as any).SalesforceInteractions;
  if (!sfp?.mcis?.getDecision) return null;

  try {
    const decision = await sfp.mcis.getDecision({
      campaignName: 'hero-banner',
    });

    if (!decision?.payload) return null;

    return {
      badge: decision.payload.badge || '',
      headlineTop: decision.payload.headlineTop || '',
      headlineBottom: decision.payload.headlineBottom || '',
      subtitle: decision.payload.subtitle || '',
      campaignId: decision.campaignId,
      experienceId: decision.experienceId,
    };
  } catch (err) {
    console.warn('[sfp] Hero campaign decision failed, using fallback:', err);
    return null;
  }
}
