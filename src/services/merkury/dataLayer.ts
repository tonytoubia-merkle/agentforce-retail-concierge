/**
 * Merkury Data Layer — global data bridge between Merkury tag and SF Personalization.
 *
 * In production, Merkury's JS snippet fires on page load (before React mounts)
 * and pushes resolved identity + appended profile data to `window.dataLayer`.
 * The SF Personalization web beacon reads from this immediately, enabling
 * first-page personalization without waiting for Data Cloud ingestion.
 *
 * Flow:
 *   1. Merkury tag fires → pushes to window.dataLayer
 *   2. SF Personalization SDK init reads window.dataLayer.merkury
 *   3. Sitemap contextVariables + onActionEvent read from dataLayer
 *   4. Personalization.fetch() carries Merkury data as request context
 *   5. Targeting rules evaluate Merkury attributes in real-time
 *
 * In our demo, the mock Merkury tag simulates this by pushing to the
 * same window.dataLayer after a short delay (simulating network resolution).
 */

export interface MerkuryDataLayer {
  /** Merkury Personal ID — individual-level identifier */
  pid?: string;
  /** Merkury Household ID — shared across household members */
  hid?: string;
  /** Identity resolution tier */
  identityTier: 'known' | 'appended' | 'anonymous';
  /** Resolution confidence 0-1 */
  confidence: number;
  /** Merkury appended profile attributes */
  interests?: string[];
  ageRange?: string;
  gender?: string;
  householdIncome?: string;
  lifestyleSignals?: string[];
  geoRegion?: string;
  /** Beauty profile hints */
  skinType?: string;
  skinConcerns?: string[];
  preferredBrands?: string[];
}

export interface BeauteDataLayer {
  merkury?: MerkuryDataLayer;
  /** UTM params from the current URL (captured by the page before React) */
  utm?: {
    campaign?: string;
    source?: string;
    medium?: string;
  };
}

declare global {
  interface Window {
    dataLayer: BeauteDataLayer;
  }
}

/** Initialize the global dataLayer if not already present. */
export function initDataLayer(): void {
  if (!window.dataLayer) {
    window.dataLayer = {};
  }
}

/** Push Merkury resolution data to the global dataLayer. */
export function pushMerkuryToDataLayer(data: MerkuryDataLayer): void {
  initDataLayer();
  window.dataLayer.merkury = data;
  console.log('[dataLayer] Merkury data pushed:', {
    pid: data.pid,
    identityTier: data.identityTier,
    interests: data.interests?.join(',') || '(none)',
    ageRange: data.ageRange || '(none)',
  });
}

/** Push UTM params to the global dataLayer. */
export function pushUtmToDataLayer(campaign?: string, source?: string, medium?: string): void {
  initDataLayer();
  window.dataLayer.utm = { campaign, source, medium };
}

/** Read Merkury data from the global dataLayer (returns undefined if not yet resolved). */
export function getMerkuryFromDataLayer(): MerkuryDataLayer | undefined {
  return window.dataLayer?.merkury;
}

/** Read UTM data from the global dataLayer. */
export function getUtmFromDataLayer(): BeauteDataLayer['utm'] | undefined {
  return window.dataLayer?.utm;
}
