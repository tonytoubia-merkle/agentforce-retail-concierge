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
  heroImage?: string;   // Optional hero image path from campaign
  imageAlt?: string;    // Optional alt text for hero image
  campaignId?: string;
  experienceId?: string;
}

export interface ExitIntentDecision {
  headline: string;
  bodyText: string;
  discountCode: string;
  discountPercent: number;
  imageUrl?: string;
  ctaText: string;
  backgroundColor?: string;
  personalizationId?: string;
  personalizationContentId?: string;
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

/**
 * Personalization context — Merkury appended data + UTM params.
 * Sent as dynamic context variables with every Personalization.fetch() call,
 * enabling first-page personalization without waiting for Data Cloud ingestion.
 */
interface PersonalizationContext {
  // UTM campaign attribution (from URL params)
  utmCampaign: string;
  utmSource: string;
  utmMedium: string;
  // Merkury appended profile (3P enrichment)
  interests: string;          // comma-separated
  ageRange: string;
  gender: string;
  householdIncome: string;
  lifestyle: string;          // comma-separated lifestyle signals
  geoRegion: string;
  // Beauty profile (Merkury hints or Contact fields)
  skinType: string;
  skinConcerns: string;       // comma-separated
  preferredBrands: string;    // comma-separated
  // Identity
  identityTier: string;       // 'known' | 'appended' | 'anonymous'
}

// ── Config from env ──────────────────────────────────────────────────────────
const SFP_BEACON_URL = (import.meta.env.VITE_SFP_BEACON_URL || '').trim();
const SFP_DATASET = (import.meta.env.VITE_SFP_DATASET || '').trim();

// Debug: Log env vars at module load time
console.log('[sfp] Module loaded — env check:', {
  beaconUrl: SFP_BEACON_URL || '(empty)',
  beaconUrlLength: SFP_BEACON_URL.length,
  dataset: SFP_DATASET || '(empty)',
  datasetLength: SFP_DATASET.length,
  configured: !!(SFP_BEACON_URL && SFP_DATASET),
});

let initialized = false;
let sdkReady: Promise<boolean> | null = null;
let navState: NavState = { view: '' };
let sdkType: 'c360a' | 'interactions' | 'unknown' = 'unknown';

const EMPTY_CONTEXT: PersonalizationContext = {
  utmCampaign: '', utmSource: '', utmMedium: '',
  interests: '', ageRange: '', gender: '', householdIncome: '',
  lifestyle: '', geoRegion: '',
  skinType: '', skinConcerns: '', preferredBrands: '',
  identityTier: 'anonymous',
};
let personalizationContext: PersonalizationContext = { ...EMPTY_CONTEXT };

/**
 * Resolve a personalization context value.
 * Priority: module-level state (set by React contexts) → window.dataLayer (set by Merkury tag).
 * This ensures first-page personalization works even before React mounts, because
 * the Merkury tag pushes to dataLayer before the app hydrates.
 */
function resolveCtx(field: keyof PersonalizationContext): string {
  // Module-level state (set by setPersonalizationProfile / setPersonalizationCampaign)
  const fromState = personalizationContext[field];
  if (fromState) return fromState;

  // Fall back to window.dataLayer (set by Merkury tag before React)
  const dl = (window as any).dataLayer;
  if (!dl) return '';

  // Map PersonalizationContext fields to dataLayer structure
  const merkury = dl.merkury;
  const utm = dl.utm;
  switch (field) {
    case 'utmCampaign':     return utm?.campaign || '';
    case 'utmSource':       return utm?.source || '';
    case 'utmMedium':       return utm?.medium || '';
    case 'interests':       return merkury?.interests?.join(',') || '';
    case 'ageRange':        return merkury?.ageRange || '';
    case 'gender':          return merkury?.gender || '';
    case 'householdIncome': return merkury?.householdIncome || '';
    case 'lifestyle':       return merkury?.lifestyleSignals?.join(',') || '';
    case 'geoRegion':       return merkury?.geoRegion || '';
    case 'skinType':        return merkury?.skinType || '';
    case 'skinConcerns':    return merkury?.skinConcerns?.join(',') || '';
    case 'preferredBrands': return merkury?.preferredBrands?.join(',') || '';
    case 'identityTier':    return merkury?.identityTier || 'anonymous';
    default:                return '';
  }
}

// ── Public helpers ───────────────────────────────────────────────────────────

/** Check if SF Personalization is configured (env vars present). */
export function isPersonalizationConfigured(): boolean {
  const configured = !!(SFP_BEACON_URL && SFP_DATASET);
  console.log('[sfp] isPersonalizationConfigured() called:', configured);
  return configured;
}

/**
 * Set Merkury appended profile + identity tier as personalization context.
 * Called by CustomerContext when Merkury resolves or persona changes.
 * These values become dynamic context variables sent with every
 * Personalization.fetch() call — enabling first-page personalization.
 */
export function setPersonalizationProfile(profile: {
  interests?: string[];
  ageRange?: string;
  gender?: string;
  householdIncome?: string;
  lifestyleSignals?: string[];
  geoRegion?: string;
  skinType?: string;
  skinConcerns?: string[];
  preferredBrands?: string[];
  identityTier?: string;
}): void {
  personalizationContext.interests = (profile.interests || []).join(',');
  personalizationContext.ageRange = profile.ageRange || '';
  personalizationContext.gender = profile.gender || '';
  personalizationContext.householdIncome = profile.householdIncome || '';
  personalizationContext.lifestyle = (profile.lifestyleSignals || []).join(',');
  personalizationContext.geoRegion = profile.geoRegion || '';
  personalizationContext.skinType = profile.skinType || '';
  personalizationContext.skinConcerns = (profile.skinConcerns || []).join(',');
  personalizationContext.preferredBrands = (profile.preferredBrands || []).join(',');
  personalizationContext.identityTier = profile.identityTier || 'anonymous';
  console.log('[sfp] Personalization profile context updated:', personalizationContext);
}

/**
 * Set UTM campaign attribution as personalization context.
 * Called by useBrowseTracking or CampaignContext when campaign is detected.
 * These values become dynamic context variables sent with every
 * Personalization.fetch() call — enabling same-session campaign targeting.
 */
export function setPersonalizationCampaign(
  utmCampaign: string | null,
  utmSource: string | null,
  utmMedium: string | null,
): void {
  personalizationContext.utmCampaign = utmCampaign || '';
  personalizationContext.utmSource = utmSource || '';
  personalizationContext.utmMedium = utmMedium || '';
  console.log('[sfp] Personalization campaign context updated:', {
    utmCampaign: personalizationContext.utmCampaign,
    utmSource: personalizationContext.utmSource,
    utmMedium: personalizationContext.utmMedium,
  });
}

/**
 * Clear all personalization context (on sign-out / persona switch).
 */
export function clearPersonalizationContext(): void {
  personalizationContext = { ...EMPTY_CONTEXT };
  console.log('[sfp] Personalization context cleared');
}

// ── SDK helpers ──────────────────────────────────────────────────────────────

function getSdk(): any {
  const w = window as any;
  // Check for different SDK global names (varies by SDK version/configuration):
  // - DataCloudInteractions: Data Cloud Web SDK (c360a.min.js beacon) — CURRENT
  // - SalesforceDataCloud / c360a: Older Data Cloud SDK naming
  // - SalesforceInteractions / Evergage: Interaction Studio / MC Personalization SDK

  // Data Cloud Web SDK (c360a beacon) — primary detection
  if (w.DataCloudInteractions) {
    sdkType = 'c360a';
    return w.DataCloudInteractions;
  }
  // Legacy Data Cloud naming
  if (w.SalesforceDataCloud) {
    sdkType = 'c360a';
    return w.SalesforceDataCloud;
  }
  if (w.c360a) {
    sdkType = 'c360a';
    return w.c360a;
  }
  if (w.SalesforceCloudData) {
    sdkType = 'c360a';
    return w.SalesforceCloudData;
  }
  // Interaction Studio / MC Personalization SDK
  if (w.SalesforceInteractions) {
    sdkType = 'interactions';
    return w.SalesforceInteractions;
  }
  // Factory function pattern: getSalesforceInteractions() returns the SDK instance
  if (typeof w.getSalesforceInteractions === 'function') {
    sdkType = 'interactions';
    const sdk = w.getSalesforceInteractions();
    console.log('[sfp] SDK obtained via getSalesforceInteractions():', sdk);
    return sdk;
  }
  if (w.Evergage) {
    sdkType = 'interactions';
    return w.Evergage;
  }
  return null;
}

/**
 * Diagnostic function to check SDK status. Call from browser console:
 * import('/src/services/personalization/index.ts').then(m => m.diagnoseSdk())
 */
export function diagnoseSdk(): void {
  const w = window as any;
  console.group('[sfp] SDK Diagnostics');
  console.log('Configuration:', {
    beaconUrl: SFP_BEACON_URL,
    dataset: SFP_DATASET,
    configured: isPersonalizationConfigured(),
    initialized,
    sdkType,
  });
  console.log('SDK Globals:', {
    DataCloudInteractions: !!w.DataCloudInteractions,
    SalesforceDataCloud: !!w.SalesforceDataCloud,
    c360a: !!w.c360a,
    SalesforceInteractions: !!w.SalesforceInteractions,
    Evergage: !!w.Evergage,
    SalesforceCloudData: !!w.SalesforceCloudData,
  });

  const sdk = getSdk();
  if (sdk) {
    console.log('SDK Methods:', Object.keys(sdk).filter(k => typeof sdk[k] === 'function'));
    console.log('SDK Type:', sdkType);
  } else {
    console.warn('No SDK found!');
    // List all window properties that might be SDKs
    const possibleSdks = Object.keys(w).filter(k =>
      k.toLowerCase().includes('salesforce') ||
      k.toLowerCase().includes('c360') ||
      k.toLowerCase().includes('evergage') ||
      k.toLowerCase().includes('personalization')
    );
    console.log('Possible SDK globals:', possibleSdks);
  }
  console.groupEnd();
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
          console.warn('[sfp] SDK not found after', maxAttempts, 'attempts. Checking globals:', {
            DataCloudInteractions: !!w.DataCloudInteractions,
            SalesforceDataCloud: !!w.SalesforceDataCloud,
            c360a: !!w.c360a,
            SalesforceInteractions: !!w.SalesforceInteractions,
            Evergage: !!w.Evergage,
          });
          // Also list all window properties that look like Salesforce SDKs
          const sfGlobals = Object.keys(w).filter(k =>
            k.toLowerCase().includes('salesforce') ||
            k.toLowerCase().includes('datacloud') ||
            k.toLowerCase().includes('c360') ||
            k.toLowerCase().includes('evergage')
          );
          if (sfGlobals.length > 0) {
            console.warn('[sfp] Possible SDK globals found:', sfGlobals);
          }
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
      // ── Dynamic context variables ──────────────────────────────────
      // Sent with every Personalization.fetch() call as request-time context.
      // SF Personalization targeting rules can reference these directly,
      // enabling first-page personalization without Data Cloud ingestion delay.
      // Dynamic context variables — resolved from dataLayer (Merkury tag) first,
      // then module state (React contexts). Uses resolveCtx() for priority:
      //   window.dataLayer.merkury (pre-React) → personalizationContext (React state)
      contextVariables: [
        // UTM campaign attribution (from current URL / ad click)
        { name: 'utm_campaign', value: () => resolveCtx('utmCampaign') },
        { name: 'utm_source',   value: () => resolveCtx('utmSource') },
        { name: 'utm_medium',   value: () => resolveCtx('utmMedium') },
        // Merkury appended profile (3P enrichment — available on page load)
        { name: 'interests',        value: () => resolveCtx('interests') },
        { name: 'age_range',        value: () => resolveCtx('ageRange') },
        { name: 'gender',           value: () => resolveCtx('gender') },
        { name: 'household_income', value: () => resolveCtx('householdIncome') },
        { name: 'lifestyle',        value: () => resolveCtx('lifestyle') },
        { name: 'geo_region',       value: () => resolveCtx('geoRegion') },
        // Beauty profile (Merkury hints or CRM contact fields)
        { name: 'skin_type',        value: () => resolveCtx('skinType') },
        { name: 'skin_concerns',    value: () => resolveCtx('skinConcerns') },
        { name: 'preferred_brands', value: () => resolveCtx('preferredBrands') },
        // Identity resolution tier
        { name: 'identity_tier',    value: () => resolveCtx('identityTier') },
      ],
      onActionEvent: (event: any) => {
        // Enrich all events with source channel metadata
        event.source = event.source || {};
        event.source.channel = 'beaute-web';
        // Enrich with Merkury appended data (from dataLayer or React state)
        // so it flows to Product Browse Engagement as Related Attributes
        const interests = resolveCtx('interests');
        const ageRange = resolveCtx('ageRange');
        const gender = resolveCtx('gender');
        const lifestyle = resolveCtx('lifestyle');
        const skinType = resolveCtx('skinType');
        const idTier = resolveCtx('identityTier');
        if (interests) event.merkuryInterests = interests;
        if (ageRange) event.merkuryAgeRange = ageRange;
        if (gender) event.merkuryGender = gender;
        if (lifestyle) event.merkuryLifestyle = lifestyle;
        if (skinType) event.merkurySkinType = skinType;
        if (idTier) event.identityTier = idTier;
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

// ── SDK-agnostic event sending ───────────────────────────────────────────────

/**
 * Send an event using the SDK's sendEvent() method.
 * Both Data Cloud SDK (DataCloudInteractions) and Interactions SDK use the same API.
 */
function sendSdkEvent(sfp: any, payload: any): void {
  if (!sfp) return;

  try {
    if (sfp.sendEvent) {
      sfp.sendEvent(payload);
      console.log('[sfp] sendEvent():', payload);
    } else {
      console.warn('[sfp] No sendEvent() method found on SDK. Available methods:',
        Object.keys(sfp).filter(k => typeof sfp[k] === 'function'));
    }
  } catch (err) {
    console.error('[sfp] Event send error:', err);
  }
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
    console.log('[sfp] SDK detected:', {
      type: sdkType,
      methods: Object.keys(sfp).filter(k => typeof sfp[k] === 'function').slice(0, 20),
    });

    try {
      // Both Data Cloud SDK (c360a/DataCloudInteractions) and Interactions SDK
      // use the same API pattern: init(), sendEvent(), initSitemap()

      // Initialize with consent (required for both SDK types)
      if (sfp.init) {
        sfp.init({
          consents: [{ provider: 'BeauteDemo', purpose: 'Tracking', status: 'Opt In' }],
        });
        console.log('[sfp] SDK init() called with consent');
      }

      // Register sitemap for centralized page-type tracking
      const config = buildSitemapConfig();
      if (sfp.initSitemap) {
        sfp.initSitemap(config);
        console.log('[sfp] Sitemap registered with', config.pageTypes.length, 'page types');
      } else {
        console.warn('[sfp] initSitemap not available — using sendEvent fallback');
      }

      // Send initial identity if available
      if (userId) {
        sendSdkEvent(sfp, {
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
    // Both SDKs support reinit() to re-evaluate sitemap after nav state changes
    if (sfp.reinit) {
      sfp.reinit();
      console.log('[sfp] reinit() called for view:', view);
      return;
    }

    // Fallback: manually match page type and send its interaction as an event
    const config = buildSitemapConfig();
    const match = config.pageTypes.find((pt: any) => pt.isMatch());
    if (match?.interaction) {
      sendSdkEvent(sfp, { interaction: resolveInteraction(match.interaction) });
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
    // Send primary identity event with all identifiers + Merkury appended data.
    // Including appended profile on the identity event ensures it flows to the
    // Individual DMO and is available as Direct Attributes in targeting rules.
    const ctx = personalizationContext;
    sendSdkEvent(sfp, {
      interaction: { name: 'IdentitySync', eventType: 'identity' },
      user: {
        identities: {
          ...(email && { emailAddress: email }),
          ...(customerId && { customerId }),
          ...(merkuryIds.pid && { merkuryPid: merkuryIds.pid }),
          ...(merkuryIds.hid && { merkuryHid: merkuryIds.hid }),
        },
      },
      // Merkury appended profile — flows to Identity DLO → Individual DMO
      ...(ctx.interests && { merkuryInterests: ctx.interests }),
      ...(ctx.ageRange && { merkuryAgeRange: ctx.ageRange }),
      ...(ctx.gender && { merkuryGender: ctx.gender }),
      ...(ctx.householdIncome && { merkuryHouseholdIncome: ctx.householdIncome }),
      ...(ctx.lifestyle && { merkuryLifestyle: ctx.lifestyle }),
      ...(ctx.geoRegion && { merkuryGeoRegion: ctx.geoRegion }),
      ...(ctx.skinType && { merkurySkinType: ctx.skinType }),
      ...(ctx.skinConcerns && { merkurySkinConcerns: ctx.skinConcerns }),
      ...(ctx.preferredBrands && { merkuryPreferredBrands: ctx.preferredBrands }),
      ...(ctx.identityTier && { identityTier: ctx.identityTier }),
    });

    // Send Party Identification event for Merkury PID (Personal ID)
    // This flows into the Party Identification DMO with IDType='MerkuryPID'
    if (merkuryIds.pid) {
      sendSdkEvent(sfp, {
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
      sendSdkEvent(sfp, {
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
    sendSdkEvent(sfp, {
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

/**
 * Track a purchase/order event.
 * Sends an explicit sendEvent with order details and line items so
 * Data Cloud can build engagement signals for recommenders.
 */
export function trackPurchase(
  orderId: string,
  orderTotal: number,
  lineItems: Array<{ product2Id: string; productName: string; quantity: number; unitPrice: number }>,
  currency = 'USD',
): void {
  if (!isPersonalizationConfigured() || !initialized) return;

  const sfp = getSdk();
  if (!sfp) return;

  try {
    sendSdkEvent(sfp, {
      interaction: {
        name: 'Purchase',
        order: {
          id: orderId,
          totalValue: orderTotal,
          currency,
          lineItems: lineItems.map((item) => ({
            catalogObjectType: 'Product',
            catalogObjectId: item.product2Id,
            quantity: item.quantity,
            price: item.unitPrice,
          })),
        },
      },
    });
  } catch (err) {
    console.error('[sfp] Purchase tracking error:', err);
  }
}

// ── Personalization decisions ────────────────────────────────────────────────

/**
 * Fetch a personalization decision from SF Personalization.
 * Tries native Personalization.fetch() first (SF Personalization),
 * falls back to mcis.getDecision() (legacy MCP/Interaction Studio).
 */
async function fetchPersonalizationPoint(pointName: string): Promise<any | null> {
  const sfp = await waitForSdk();
  if (!sfp) return null;

  // Native SF Personalization API (Data Cloud Web SDK)
  if (sfp.Personalization?.fetch) {
    try {
      const response = await sfp.Personalization.fetch([pointName]);
      console.log('[sfp] Personalization.fetch() response:', response);
      const personalization = response?.personalizations?.[0];
      return personalization || null;
    } catch (err) {
      console.warn('[sfp] Personalization.fetch() failed:', err);
    }
  }

  // Also check SalesforceInteractions global (may be separate from c360a SDK)
  const w = window as any;
  if (w.SalesforceInteractions?.Personalization?.fetch) {
    try {
      const response = await w.SalesforceInteractions.Personalization.fetch([pointName]);
      console.log('[sfp] SalesforceInteractions.Personalization.fetch() response:', response);
      const personalization = response?.personalizations?.[0];
      return personalization || null;
    } catch (err) {
      console.warn('[sfp] SalesforceInteractions.Personalization.fetch() failed:', err);
    }
  }

  // Legacy MCP / Interaction Studio fallback
  if (sfp.mcis?.getDecision) {
    try {
      const decision = await sfp.mcis.getDecision({ campaignName: pointName });
      console.log('[sfp] mcis.getDecision() response:', decision);
      return decision || null;
    } catch (err) {
      console.warn('[sfp] mcis.getDecision() failed:', err);
    }
  }

  console.warn('[sfp] No decision API available on SDK. Methods:',
    Object.keys(sfp).filter(k => typeof sfp[k] === 'function' || typeof sfp[k] === 'object'));
  return null;
}

/**
 * Fetch hero campaign decision from SF Personalization.
 * Waits for SDK to be ready before fetching.
 * Returns null if not configured or if the campaign decision fails.
 */
export async function getHeroCampaignDecision(): Promise<PersonalizationDecision | null> {
  if (!isPersonalizationConfigured() || !initialized) return null;

  try {
    const result = await fetchPersonalizationPoint('Hero_Banner');
    if (!result) return null;

    // Map from SF response template API names (snake_case) to our interface
    const attrs = result.attributes || result.payload || {};
    // header_text may contain both lines separated by \n, or we split on comma
    const headerText = attrs.header_text || '';
    const [topLine, ...rest] = headerText.split('\n');
    return {
      badge: attrs.badge || attrs.cta || '',
      headlineTop: topLine || attrs.headlineTop || '',
      headlineBottom: rest.join('\n') || attrs.headlineBottom || '',
      subtitle: attrs.body_text || attrs.subtitle || '',
      heroImage: attrs.background_image || '',
      imageAlt: attrs.imageAlt || '',
      campaignId: result.personalizationId || result.campaignId,
      experienceId: result.personalizationContentId || result.experienceId,
    };
  } catch (err) {
    console.warn('[sfp] Hero campaign decision failed, using fallback:', err);
    return null;
  }
}

/**
 * Fetch exit intent decision from SF Personalization.
 * Called when exit intent is detected (mouse leaves viewport from top).
 * Returns null if not configured, not initialized, or no decision matches.
 */
export async function getExitIntentDecision(): Promise<ExitIntentDecision | null> {
  if (!isPersonalizationConfigured() || !initialized) return null;

  try {
    const result = await fetchPersonalizationPoint('Exit_Intent_Capture');
    if (!result) return null;

    const attrs = result.attributes || result.payload || {};
    return {
      // Map from SF response template API names (snake_case) to our interface
      headline: attrs.header_text || attrs.headline || '',
      bodyText: attrs.body_text || attrs.bodyText || '',
      discountCode: attrs.discount_code || attrs.discountCode || '',
      discountPercent: Number(attrs.discount_value || attrs.discount_percent) || 0,
      imageUrl: attrs.background_image || attrs.imageUrl || '',
      ctaText: attrs.cta || attrs.ctaText || 'Claim Offer',
      backgroundColor: attrs.background_color || '',
      personalizationId: result.personalizationId,
      personalizationContentId: result.personalizationContentId,
    };
  } catch (err) {
    console.warn('[sfp] Exit intent decision failed:', err);
    return null;
  }
}

/**
 * Track engagement with a personalization decision.
 * Call after rendering personalized content to close the attribution loop.
 */
export function trackPersonalizationEngagement(
  personalizationId?: string,
  personalizationContentId?: string,
): void {
  if (!personalizationId || !isPersonalizationConfigured() || !initialized) return;

  const sfp = getSdk();
  if (!sfp) return;

  try {
    sendSdkEvent(sfp, {
      personalizationId,
      personalizationContentId,
    });
  } catch (err) {
    console.warn('[sfp] Personalization engagement tracking failed:', err);
  }
}
