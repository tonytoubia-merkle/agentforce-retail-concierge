import type { AdCreative, CampaignAttribution, UTMParams } from '@/types/campaign';

export const AD_CREATIVES: AdCreative[] = [
  {
    id: 'ad-summer-glow',
    platform: 'instagram',
    headline: 'Your Summer Glow Starts Here',
    description: 'Discover the serums and moisturizers that give you that lit-from-within radiance all season long.',
    creativeType: 'story',
    gradientFrom: 'from-amber-400',
    gradientTo: 'to-rose-500',
    productImage: '/assets/products/serum-glow.png',
    campaignName: 'Summer Glow Collection',
    campaignTheme: 'summer-glow',
    utmParams: {
      utm_source: 'instagram',
      utm_medium: 'paid_social',
      utm_campaign: 'summer-glow-2026',
      utm_content: 'story-glow-serum',
      utm_term: 'beauty_enthusiasts_25_40',
    },
    audienceSegment: {
      segmentName: 'Beauty Enthusiasts 25-40',
      segmentSize: '2.4M households',
      matchType: 'hid',
      dataSignals: ['beauty purchase intent', 'skincare browser', 'lifestyle: wellness'],
    },
    targetingStrategy: 'interest-based',
    inferredInterests: ['skincare', 'serums', 'radiance', 'summer beauty'],
    inferredIntentSignals: ['discovery', 'seasonal purchase', 'mid-funnel consideration'],
  },
  {
    id: 'ad-anti-aging',
    platform: 'youtube',
    headline: 'The Science of Ageless Skin',
    description: 'Clinically proven retinol and peptide formulas that turn back the clock. Watch the transformation.',
    creativeType: 'video',
    gradientFrom: 'from-violet-500',
    gradientTo: 'to-indigo-700',
    productImage: '/assets/products/serum-retinol.png',
    campaignName: 'Anti-Aging Science',
    campaignTheme: 'anti-aging',
    utmParams: {
      utm_source: 'youtube',
      utm_medium: 'video',
      utm_campaign: 'anti-aging-science-q1',
      utm_content: 'pre-roll-retinol-routine',
      utm_term: 'luxury_skincare_40_plus',
    },
    audienceSegment: {
      segmentName: 'Luxury Skincare Buyers',
      segmentSize: '1.8M households',
      matchType: 'modeled',
      dataSignals: ['premium beauty purchaser', 'anti-aging search intent', 'income: $100K+'],
    },
    targetingStrategy: 'lookalike',
    inferredInterests: ['anti-aging', 'retinol', 'luxury skincare', 'clinical beauty'],
    inferredIntentSignals: ['high purchase intent', 'brand switcher', 'research phase'],
  },
  {
    id: 'ad-retarget-cart',
    platform: 'google-display',
    headline: 'Still Thinking About It?',
    description: 'The items in your cart are selling fast. Complete your order before they\'re gone.',
    creativeType: 'static-image',
    gradientFrom: 'from-sky-400',
    gradientTo: 'to-blue-600',
    productImage: '/assets/products/moisturizer-rich.png',
    campaignName: 'Cart Abandonment Recovery',
    campaignTheme: 'retargeting',
    utmParams: {
      utm_source: 'google',
      utm_medium: 'display',
      utm_campaign: 'retarget-cart-abandon',
      utm_content: 'dynamic-product-carousel',
      utm_term: 'cart_abandon_7d',
    },
    audienceSegment: {
      segmentName: 'Site Visitors: Cart Abandon 7d',
      segmentSize: '45K individuals',
      matchType: 'pid',
      dataSignals: ['cart abandonment', 'product page views: 3+', 'session: 5+ min'],
    },
    targetingStrategy: 'retargeting',
    inferredInterests: ['moisturizers', 'skincare routine'],
    inferredIntentSignals: ['high purchase intent', 'price sensitivity', 'urgency responsive'],
  },
  {
    id: 'ad-glow-up',
    platform: 'tiktok',
    headline: '#GlowUpChallenge',
    description: 'Show us your before & after with BEAUTE products. 10K+ creators already have.',
    creativeType: 'video',
    gradientFrom: 'from-fuchsia-500',
    gradientTo: 'to-cyan-400',
    productImage: '/assets/products/foundation-dewy.png',
    campaignName: 'Glow Up Challenge',
    campaignTheme: 'glow-up',
    utmParams: {
      utm_source: 'tiktok',
      utm_medium: 'paid_social',
      utm_campaign: 'glow-up-challenge-2026',
      utm_content: 'ugc-before-after',
      utm_term: 'gen_z_beauty_18_25',
    },
    audienceSegment: {
      segmentName: 'Gen Z Beauty Curious',
      segmentSize: '5.2M households',
      matchType: 'hid',
      dataSignals: ['beauty content engagement', 'age: 18-25', 'social trend followers'],
    },
    targetingStrategy: 'demographic',
    inferredInterests: ['makeup', 'foundation', 'beauty trends', 'UGC content'],
    inferredIntentSignals: ['brand discovery', 'social proof driven', 'trend adoption'],
  },
  {
    id: 'ad-wedding',
    platform: 'pinterest',
    headline: 'Your Wedding Day Beauty Edit',
    description: 'Curated looks for the bride, bridesmaids, and everyone celebrating love.',
    creativeType: 'carousel',
    gradientFrom: 'from-rose-300',
    gradientTo: 'to-pink-500',
    productImage: '/assets/products/lipstick-velvet.png',
    campaignName: 'Wedding Season 2026',
    campaignTheme: 'bridal-beauty',
    utmParams: {
      utm_source: 'pinterest',
      utm_medium: 'paid_social',
      utm_campaign: 'wedding-season-2026',
      utm_content: 'carousel-bridal-looks',
      utm_term: 'wedding_planning_engaged',
    },
    audienceSegment: {
      segmentName: 'Engaged / Wedding Planning',
      segmentSize: '890K households',
      matchType: 'hid',
      dataSignals: ['wedding board activity', 'bridal search terms', 'registry behavior'],
    },
    targetingStrategy: 'interest-based',
    inferredInterests: ['bridal beauty', 'lipstick', 'event makeup', 'wedding prep'],
    inferredIntentSignals: ['event-driven purchase', 'high spend occasion', 'gifting potential'],
  },
  {
    id: 'ad-fragrance-film',
    platform: 'ctv',
    headline: 'Luxury, Bottled.',
    description: 'An immersive fragrance experience for those who demand the extraordinary.',
    creativeType: 'video',
    gradientFrom: 'from-amber-600',
    gradientTo: 'to-stone-900',
    productImage: '/assets/products/fragrance-oriental.png',
    campaignName: 'Luxury Fragrance Film',
    campaignTheme: 'luxury-fragrance',
    utmParams: {
      utm_source: 'hulu',
      utm_medium: 'ctv',
      utm_campaign: 'luxury-fragrance-film-q1',
      utm_content: 'cinematic-30s-spot',
      utm_term: 'affluent_beauty_hh',
    },
    audienceSegment: {
      segmentName: 'Affluent Beauty Buyers',
      segmentSize: '1.1M households',
      matchType: 'hid',
      dataSignals: ['luxury purchase history', 'income: $150K+', 'fragrance category affinity'],
    },
    targetingStrategy: 'household',
    inferredInterests: ['luxury fragrance', 'premium beauty', 'gifting'],
    inferredIntentSignals: ['brand affinity', 'aspirational purchase', 'top-of-funnel awareness'],
  },
  {
    id: 'ad-loyalty-double',
    platform: 'email',
    headline: 'Double Points Weekend',
    description: 'Earn 2x loyalty points on every purchase this weekend. Exclusive for Gold+ members.',
    creativeType: 'static-image',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-teal-600',
    productImage: '/assets/products/mask-hydrating.png',
    campaignName: 'Loyalty Double Points',
    campaignTheme: 'loyalty-engagement',
    utmParams: {
      utm_source: 'email',
      utm_medium: 'crm',
      utm_campaign: 'loyalty-double-points-feb',
      utm_content: 'hero-banner-gold-members',
      utm_term: 'gold_platinum_loyalty',
    },
    audienceSegment: {
      segmentName: 'Gold+ Loyalty Members',
      segmentSize: '28K individuals',
      matchType: 'pid',
      dataSignals: ['loyalty tier: Gold/Platinum', 'email engaged: 90d', 'avg order value: $65+'],
    },
    targetingStrategy: 'first-party',
    inferredInterests: ['loyalty rewards', 'skincare masks', 'value-driven purchase'],
    inferredIntentSignals: ['repeat purchase', 'loyalty-motivated', 'weekend shopper'],
  },
  {
    id: 'ad-mens-skincare',
    platform: 'instagram',
    headline: 'Skincare. No BS.',
    description: 'Simple, effective routines built for guys who want great skin without the fuss.',
    creativeType: 'static-image',
    gradientFrom: 'from-slate-600',
    gradientTo: 'to-zinc-800',
    productImage: '/assets/products/cleanser-foam.png',
    campaignName: "Men's Skincare Starter",
    campaignTheme: 'mens-skincare',
    utmParams: {
      utm_source: 'instagram',
      utm_medium: 'paid_social',
      utm_campaign: 'mens-skincare-starter-2026',
      utm_content: 'static-minimalist-routine',
      utm_term: 'mens_grooming_25_45',
    },
    audienceSegment: {
      segmentName: "Men's Grooming Interest",
      segmentSize: '3.1M households',
      matchType: 'hid',
      dataSignals: ['male grooming content', 'age: 25-45', 'first-time skincare signals'],
    },
    targetingStrategy: 'contextual',
    inferredInterests: ['mens skincare', 'cleansers', 'simple routines'],
    inferredIntentSignals: ['category entry', 'education-driven', 'low barrier trial'],
  },
  {
    id: 'ad-spf-season',
    platform: 'google-display',
    headline: 'SPF Season is Here',
    description: 'Lightweight, invisible sunscreens that actually feel good. Dermatologist recommended.',
    creativeType: 'static-image',
    gradientFrom: 'from-yellow-400',
    gradientTo: 'to-orange-500',
    productImage: '/assets/products/sunscreen-lightweight.png',
    campaignName: 'SPF Season',
    campaignTheme: 'spf-season',
    utmParams: {
      utm_source: 'google',
      utm_medium: 'display',
      utm_campaign: 'spf-season-2026',
      utm_content: 'display-dermatologist-rec',
      utm_term: 'outdoor_active_lifestyle',
    },
    audienceSegment: {
      segmentName: 'Outdoor / Active Lifestyle',
      segmentSize: '4.7M households',
      matchType: 'hid',
      dataSignals: ['outdoor activity signals', 'fitness app usage', 'travel intent'],
    },
    targetingStrategy: 'interest-based',
    inferredInterests: ['sunscreen', 'SPF protection', 'outdoor beauty', 'active lifestyle'],
    inferredIntentSignals: ['seasonal purchase', 'health-motivated', 'replenishment cycle'],
  },
  {
    id: 'ad-kbeauty',
    platform: 'tiktok',
    headline: '10-Step K-Beauty in 5 Minutes',
    description: 'The viral Korean skincare routine simplified. Glass skin is one click away.',
    creativeType: 'video',
    gradientFrom: 'from-pink-400',
    gradientTo: 'to-purple-500',
    productImage: '/assets/products/serum-hyaluronic.png',
    campaignName: 'K-Beauty Essentials',
    campaignTheme: 'k-beauty',
    utmParams: {
      utm_source: 'tiktok',
      utm_medium: 'paid_social',
      utm_campaign: 'kbeauty-essentials-2026',
      utm_content: 'tutorial-glass-skin',
      utm_term: 'kbeauty_enthusiasts_lookalike',
    },
    audienceSegment: {
      segmentName: 'K-Beauty Purchasers Lookalike',
      segmentSize: '2.9M households',
      matchType: 'modeled',
      dataSignals: ['K-beauty purchase history', 'skincare routine content', 'Asian beauty brand affinity'],
    },
    targetingStrategy: 'lookalike',
    inferredInterests: ['K-beauty', 'hyaluronic acid', 'glass skin', 'skincare routines'],
    inferredIntentSignals: ['trend adoption', 'routine builder', 'multi-product purchase'],
  },
];

/**
 * Match URL search params to a known ad creative or build a generic attribution.
 * Used for deep-linking with ?utm_source=...&utm_campaign=... in the URL.
 */
export function resolveUTMToCampaign(params: URLSearchParams): CampaignAttribution | null {
  const utm_source = params.get('utm_source');
  const utm_campaign = params.get('utm_campaign');
  if (!utm_source) return null;

  const utmParams: UTMParams = {
    utm_source,
    utm_medium: params.get('utm_medium') || 'unknown',
    utm_campaign: utm_campaign || 'unknown',
    utm_content: params.get('utm_content') || undefined,
    utm_term: params.get('utm_term') || undefined,
  };

  // Try to match by campaign name
  const matched = AD_CREATIVES.find(
    (ad) => ad.utmParams.utm_campaign === utm_campaign
  );

  if (matched) {
    return {
      adCreative: matched,
      clickedAt: new Date().toISOString(),
      entrySource: 'utm-deeplink',
    };
  }

  // Build generic attribution for unknown UTMs
  const genericAd: AdCreative = {
    id: 'ad-generic-utm',
    platform: mapSourceToPlatform(utm_source),
    headline: formatCampaignName(utm_campaign || 'Direct Campaign'),
    description: `Traffic from ${utm_source} via ${utmParams.utm_medium}`,
    creativeType: 'static-image',
    gradientFrom: 'from-stone-500',
    gradientTo: 'to-stone-700',
    campaignName: formatCampaignName(utm_campaign || 'Direct Campaign'),
    campaignTheme: 'unknown',
    utmParams,
    audienceSegment: {
      segmentName: utmParams.utm_term ? formatCampaignName(utmParams.utm_term) : 'Unknown Segment',
      segmentSize: 'N/A',
      matchType: 'hid',
      dataSignals: ['UTM parameters detected'],
    },
    targetingStrategy: 'interest-based',
    inferredInterests: utmParams.utm_term ? utmParams.utm_term.split('_') : [],
    inferredIntentSignals: ['ad click-through'],
  };

  return {
    adCreative: genericAd,
    clickedAt: new Date().toISOString(),
    entrySource: 'utm-deeplink',
  };
}

function mapSourceToPlatform(source: string): AdCreative['platform'] {
  const map: Record<string, AdCreative['platform']> = {
    instagram: 'instagram',
    youtube: 'youtube',
    google: 'google-display',
    tiktok: 'tiktok',
    pinterest: 'pinterest',
    hulu: 'ctv',
    roku: 'ctv',
    email: 'email',
  };
  return map[source.toLowerCase()] || 'google-display';
}

function formatCampaignName(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
