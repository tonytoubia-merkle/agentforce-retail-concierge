/**
 * Salesforce Personalization (Data Cloud) Web SDK — Sitemap Integration
 *
 * Uses the recommended initSitemap() pattern to centralize all page-type
 * definitions and interaction tracking in a single configuration.
 *
 * For our React SPA (state-based navigation, no URL routing), we expose a
 * notifyNavigation() function that StoreContext calls on every view change.
 * This updates an internal nav-state object and triggers the SDK to
 * re-evaluate the sitemap's isMatch() functions.
 *
 * Architecture:
 *   initSitemap()       → defines page types, catalog objects, global hooks
 *   notifyNavigation()  → called by StoreContext on view change
 *   trackAddToCart()    → explicit sendEvent for cart actions (user-initiated)
 *   syncIdentity()      → sendEvent for identity resolution (profile changes)
 *   getHeroCampaignDecision() → fetch personalization decision (hero banner)
 *
 * All tracked events flow into Data Cloud for:
 * - Real-time personalization decisions (hero banner, product recs)
 * - Abandonment detection via Data Cloud Triggered Actions (no client timers)
 * - Segment membership updates for MC Advanced journey entry (Flows on Core)
 *
 * MC Advanced journeys (welcome, post-purchase, ship confirm, abandoned cart)
 * are all Record-Triggered Flows or Data Cloud Triggered Actions — they fire
 * automatically when records change on Core. No REST API calls needed.
 *
 * Setup:
 * 1. In Data Cloud Setup → Websites & Mobile Apps, create a web connector
 * 2. Upload the recommended schema (salesforce/data-cloud/web-connector-schema.json)
 * 3. Copy the beacon URL from the connector's Integration Guide
 * 4. Set VITE_SFP_BEACON_URL and VITE_SFP_DATASET in .env.local
 * 5. The SDK script is loaded dynamically by initPersonalization()
 */

export interface PersonalizationDecision {
  badge: string;
  headlineTop: string;
  headlineBottom: string;
  subtitle: string;
  campaignId?: string;
  experienceId?: string;
}

/** Navigation state shared between StoreContext and the sitemap's isMatch fns. */
interface NavState {
  view: string;
  categoryId?: string;
  productId?: string;
  /** Salesforce Product2 ID for Data Cloud integration */
  productSalesforceId?: string;
  productName?: string;
  productCategory?: string;
}

// ── Config from env ──────────────────────────────────────────────────────────
const SFP_BEACON_URL = (import.meta.env.VITE_SFP_BEACON_URL || '').trim();
const SFP_DATASET = (import.meta.env.VITE_SFP_DATASET || '').trim();

let initialized = false;
let sdkReady: Promise<boolean> | null = null;
let navState: NavState = { view: '' };

// ── Public helpers ───────────────────────────────────────────────────────────

/** Check if SF Personalization is configured (env vars present). */
export function isPersonalizationConfigured(): boolean {
  return !!(SFP_BEACON_URL && SFP_DATASET);
}

// ── SDK helpers ──────────────────────────────────────────────────────────────

function getSdk(): any {
  const w = window as any;
  // Check for different SDK global names (varies by SDK version/configuration)
  return w.SalesforceInteractions || w.Evergage || w.SalesforceCloudData || null;
}

/** Dynamically load the Salesforce Personalization Web SDK script. */
function loadSdk(): Promise<boolean> {
  if (getSdk()) return Promise.resolve(true);

  return new Promise((resolve) => {
    const scriptUrl = SFP_BEACON_URL.endsWith('.js')
      ? SFP_BEACON_URL
      : `${SFP_BEACON_URL.replace(/\/$/, '')}/${SFP_DATASET}/web-sdk.min.js`;

    console.log('[sfp] Loading Personalization SDK from:', scriptUrl);

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      console.log('[sfp] SDK script loaded');
      // Wait for SDK to initialize with retry logic
      let attempts = 0;
      const maxAttempts = 10;
      const checkSdk = () => {
        attempts++;
        const sdk = getSdk();
        if (sdk) {
          console.log('[sfp] SDK global found after', attempts, 'attempts');
          resolve(true);
        } else if (attempts < maxAttempts) {
          setTimeout(checkSdk, 200);
        } else {
          // Log available globals for debugging
          const w = window as any;
          console.warn('[sfp] SDK not found. Available globals:', {
            SalesforceInteractions: !!w.SalesforceInteractions,
            Evergage: !!w.Evergage,
            SalesforceCloudData: !!w.SalesforceCloudData,
          });
          resolve(false);
        }
      };
      checkSdk();
    };
    script.onerror = () => {
      console.warn('[sfp] Failed to load SDK script from:', scriptUrl);
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/** Wait for SDK to be ready. Returns the SDK instance or null. */
async function waitForSdk(): Promise<any> {
  if (!sdkReady) return null;
  const ready = await sdkReady;
  return ready ? getSdk() : null;
}

// ── Sitemap configuration ────────────────────────────────────────────────────

/**
 * Build the sitemap configuration for the SDK.
 * Page types map to our SPA views; isMatch checks the internal navState
 * which is updated by notifyNavigation() before the SDK re-evaluates.
 */
function buildSitemapConfig() {
  return {
    global: {
      onActionEvent: (event: any) => {
        // Enrich all events with source channel metadata
        event.source = event.source || {};
        event.source.channel = 'beaute-web';
        return event;
      },
    },
    pageTypeDefault: {
      name: 'default',
      interaction: { name: 'Default Page' },
    },
    pageTypes: [
      {
        name: 'home',
        isMatch: () => navState.view === 'home',
        interaction: { name: 'Home Page' },
      },
      {
        name: 'category',
        isMatch: () => navState.view === 'category',
        interaction: {
          name: 'View Category',
          catalogObject: {
            type: 'Category',
            id: () => navState.categoryId || '',
          },
        },
      },
      {
        name: 'product_detail',
        isMatch: () => navState.view === 'product',
        interaction: {
          name: 'View Product',
          catalogObject: {
            type: 'Product',
            // Prefer salesforceId for Data Cloud product joins, fall back to app slug id
            id: () => navState.productSalesforceId || navState.productId || '',
            attributes: {
              name: { raw: () => navState.productName || '' },
              category: { raw: () => navState.productCategory || '' },
            },
          },
        },
      },
      {
        name: 'cart',
        isMatch: () => navState.view === 'cart',
        interaction: { name: 'View Cart' },
      },
      {
        name: 'checkout',
        isMatch: () => navState.view === 'checkout',
        interaction: { name: 'Checkout' },
      },
      {
        name: 'order_confirmation',
        isMatch: () => navState.view === 'order-confirmation',
        interaction: { name: 'Order Confirmation' },
      },
      {
        name: 'account',
        isMatch: () => navState.view === 'account',
        interaction: { name: 'View Account' },
      },
    ],
  };
}

/**
 * Resolve dynamic functions in a sitemap interaction to concrete values.
 * Used by the sendEvent fallback when reinit() isn't available.
 */
function resolveInteraction(interaction: any): any {
  const resolved = { ...interaction };
  if (resolved.catalogObject) {
    const co = resolved.catalogObject;
    resolved.catalogObject = {
      type: co.type,
      id: typeof co.id === 'function' ? co.id() : co.id,
      ...(co.attributes && {
        attributes: Object.fromEntries(
          Object.entries(co.attributes).map(([k, v]: [string, any]) => [
            k,
            typeof v?.raw === 'function' ? v.raw() : v,
          ])
        ),
      }),
    };
  }
  return resolved;
}

// ── Initialization ───────────────────────────────────────────────────────────

/**
 * Initialize the SF Personalization SDK with sitemap.
 * Loads the script dynamically, configures consent, and registers the sitemap.
 * Call once on app startup (from CustomerContext).
 */
export function initPersonalization(userId?: string): void {
  if (!isPersonalizationConfigured() || initialized) return;
  initialized = true;

  console.log('[sfp] Initializing SF Personalization', { dataset: SFP_DATASET });

  sdkReady = loadSdk().then((loaded) => {
    if (!loaded) {
      console.warn('[sfp] SDK not available after loading.');
      return false;
    }

    const sfp = getSdk();
    try {
      // 1. Initialize SDK with consent
      sfp.init({
        consents: [{ provider: 'BeauteDemo', purpose: 'Personalization', status: 'OptIn' }],
      });

      // 2. Register sitemap for centralized page-type tracking
      const config = buildSitemapConfig();
      if (sfp.initSitemap) {
        sfp.initSitemap(config);
        console.log('[sfp] Sitemap registered with', config.pageTypes.length, 'page types');
      } else {
        console.warn('[sfp] initSitemap not available — using sendEvent fallback');
      }

      // 3. Send initial identity if available
      if (userId) {
        sfp.sendEvent({
          interaction: { name: 'Identity', eventType: 'identity' },
          user: { identities: { emailAddress: userId } },
        });
      }

      console.log('[sfp] SDK initialized');
      return true;
    } catch (err) {
      console.error('[sfp] Init error:', err);
      return false;
    }
  });
}

// ── Navigation tracking (replaces manual trackPageView / trackProductView) ──

/**
 * Notify the SDK of a SPA navigation change.
 * Updates internal state and triggers the SDK to re-evaluate the sitemap.
 *
 * Call from StoreContext whenever view, selectedProduct, or selectedCategory changes.
 * This single hook replaces all the individual tracking useEffects that were
 * previously scattered across StorefrontPage, CategoryPage, and ProductDetailPage.
 */
export function notifyNavigation(view: string, data?: {
  categoryId?: string;
  productId?: string;
  /** Salesforce Product2 ID for Data Cloud integration */
  productSalesforceId?: string;
  productName?: string;
  productCategory?: string;
}): void {
  if (!isPersonalizationConfigured() || !initialized) return;

  navState = { view, ...data };

  const sfp = getSdk();
  if (!sfp) return;

  try {
    // Preferred: reinit() re-evaluates the sitemap for SPAs
    if (sfp.reinit) {
      sfp.reinit();
      return;
    }

    // Fallback: manually match page type and send its interaction as an event
    const config = buildSitemapConfig();
    const match = config.pageTypes.find((pt: any) => pt.isMatch());
    if (match?.interaction) {
      sfp.sendEvent({ interaction: resolveInteraction(match.interaction) });
    }
  } catch (err) {
    console.error('[sfp] Navigation notification error:', err);
  }
}

// ── Identity sync ────────────────────────────────────────────────────────────

export interface MerkuryIdentifiers {
  /** Merkury Personal ID — individual-level identifier */
  pid?: string;
  /** Merkury Household ID — household-level identifier (shared across household members) */
  hid?: string;
}

/**
 * Sync user identity with SF Personalization.
 * Call when customer profile changes (login, persona switch).
 *
 * When Merkury identifiers are provided, they're sent as Party Identification events:
 * - PID (Personal ID): Individual-level identity for cross-device matching
 * - HID (Household ID): Household-level identity for household targeting/attribution
 *
 * This enables:
 * - Cross-device identity matching (via PID)
 * - Household-level targeting and attribution (via HID)
 * - Enrichment workflows (query Merkury for demographics)
 * - Paid media activation (export segments with Merkury IDs)
 */
export function syncIdentity(
  email?: string,
  customerId?: string,
  merkury?: MerkuryIdentifiers | string  // string for backward compat (legacy merkuryId)
): void {
  if (!isPersonalizationConfigured() || !initialized) return;

  const sfp = getSdk();
  if (!sfp) return;

  // Normalize input: support legacy string (merkuryId) or new object (pid/hid)
  const merkuryIds: MerkuryIdentifiers = typeof merkury === 'string'
    ? { pid: merkury }
    : merkury || {};

  try {
    // Send primary identity event with all identifiers
    sfp.sendEvent({
      interaction: { name: 'IdentitySync', eventType: 'identity' },
      user: {
        identities: {
          ...(email && { emailAddress: email }),
          ...(customerId && { customerId }),
          ...(merkuryIds.pid && { merkuryPid: merkuryIds.pid }),
          ...(merkuryIds.hid && { merkuryHid: merkuryIds.hid }),
        },
      },
    });

    // Send Party Identification event for Merkury PID (Personal ID)
    // This flows into the Party Identification DMO with IDType='MerkuryPID'
    if (merkuryIds.pid) {
      sfp.sendEvent({
        interaction: {
          name: 'PartyIdentification',
          eventType: 'profile',
        },
        partyIdentification: {
          IDName: merkuryIds.pid,
          IDType: 'MerkuryPID',
          userId: customerId || merkuryIds.pid,
        },
      });
    }

    // Send Party Identification event for Merkury HID (Household ID)
    // This enables household-level identity resolution and targeting
    if (merkuryIds.hid) {
      sfp.sendEvent({
        interaction: {
          name: 'PartyIdentification',
          eventType: 'profile',
        },
        partyIdentification: {
          IDName: merkuryIds.hid,
          IDType: 'MerkuryHID',
          userId: customerId || merkuryIds.pid || merkuryIds.hid,
        },
      });
    }

    console.log('[sfp] Identity synced:', {
      email,
      customerId,
      hasPid: !!merkuryIds.pid,
      hasHid: !!merkuryIds.hid,
    });
  } catch (err) {
    console.error('[sfp] Identity sync error:', err);
  }
}

// ── Explicit user-action events ──────────────────────────────────────────────

/**
 * Track an add-to-cart event.
 * This is an explicit user action (not a page navigation), so it uses
 * sendEvent directly rather than going through the sitemap.
 *
 * @param productId - App's slug ID (for fallback)
 * @param productName - Product name for display
 * @param price - Product price
 * @param salesforceId - Optional Salesforce Product2 ID for Data Cloud integration
 */
export function trackAddToCart(productId: string, productName: string, price: number, salesforceId?: string): void {
  if (!isPersonalizationConfigured() || !initialized) return;

  const sfp = getSdk();
  if (!sfp) return;

  try {
    sfp.sendEvent({
      interaction: {
        name: 'Add To Cart',
        lineItem: {
          catalogObjectType: 'Product',
          // Prefer salesforceId for Data Cloud product joins, fall back to app slug id
          catalogObjectId: salesforceId || productId,
          price,
          quantity: 1,
        },
      },
    });
  } catch (err) {
    console.error('[sfp] Add to cart tracking error:', err);
  }
}

// ── Campaign decisions ───────────────────────────────────────────────────────

/**
 * Fetch hero campaign decision from SF Personalization.
 * Waits for SDK to be ready before fetching.
 * Returns null if not configured or if the campaign decision fails.
 */
export async function getHeroCampaignDecision(): Promise<PersonalizationDecision | null> {
  if (!isPersonalizationConfigured() || !initialized) return null;

  const sfp = await waitForSdk();
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
