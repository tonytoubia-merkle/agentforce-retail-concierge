import type { CustomerProfile } from '@/types/customer';

export interface PersonaMeta {
  id: string;
  label: string;
  subtitle: string;
  traits: string[];
  profile: CustomerProfile;
}

// ─── Sarah Chen: Known Customer, Loyalty Gold ───────────────────
// Sensitive skin, fragrance-free preference, loyal repeat buyer
const sarahChen: CustomerProfile = {
  id: 'persona-sarah',
  name: 'Sarah',
  email: 'sarah.chen@example.com',

  beautyProfile: {
    skinType: 'sensitive',
    concerns: ['hydration'],
    allergies: ['fragrance'],
    fragrancePreference: 'fragrance-free',
    communicationPrefs: { email: true, sms: true, push: false },
    preferredBrands: ['SERENE'],
    ageRange: '30-40',
  },

  orders: [
    {
      orderId: 'ORD-2025-0847',
      orderDate: '2025-06-12',
      channel: 'online',
      status: 'completed',
      totalAmount: 94.00,
      lineItems: [
        { productId: 'cleanser-gentle', productName: 'Cloud Cream Cleanser', quantity: 1, unitPrice: 36.00 },
        { productId: 'moisturizer-sensitive', productName: 'Hydra-Calm Sensitive Moisturizer', quantity: 1, unitPrice: 58.00 },
      ],
    },
    {
      orderId: 'ORD-2025-1456',
      orderDate: '2025-11-15',
      channel: 'online',
      status: 'completed',
      totalAmount: 94.00,
      lineItems: [
        { productId: 'cleanser-gentle', productName: 'Cloud Cream Cleanser', quantity: 1, unitPrice: 36.00 },
        { productId: 'moisturizer-sensitive', productName: 'Hydra-Calm Sensitive Moisturizer', quantity: 1, unitPrice: 58.00 },
      ],
    },
  ],

  chatSummaries: [],
  meaningfulEvents: [],
  agentCapturedProfile: {},

  browseSessions: [
    {
      sessionDate: '2026-01-22',
      categoriesBrowsed: ['serum'],
      productsViewed: ['serum-retinol', 'serum-anti-aging'],
      durationMinutes: 8,
      device: 'mobile',
    },
  ],

  loyalty: {
    tier: 'gold',
    pointsBalance: 2450,
    lifetimePoints: 4800,
    memberSince: '2024-11-01',
    rewardsAvailable: [
      { name: '$10 off next purchase', pointsCost: 1000 },
    ],
    nextTierThreshold: 6000,
    tierExpiryDate: '2026-11-01',
  },

  merkuryIdentity: {
    merkuryId: 'MRK-SC-90210',
    identityTier: 'known',
    confidence: 0.97,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [
    { productId: 'cleanser-gentle', productName: 'Cloud Cream Cleanser', purchaseDate: '2025-11-15', quantity: 1, rating: 5 },
    { productId: 'moisturizer-sensitive', productName: 'Hydra-Calm Sensitive Moisturizer', purchaseDate: '2025-11-15', quantity: 1, rating: 5 },
  ],
  savedPaymentMethods: [
    { id: 'pm-1', type: 'card', last4: '4242', brand: 'visa', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-1', name: 'Sarah Chen', line1: '123 Main St', city: 'San Francisco', state: 'CA', postalCode: '94102', country: 'US', isDefault: true },
  ],
  travelPreferences: { upcomingTrips: [], prefersTravelSize: true },
  recentActivity: [],
  loyaltyTier: 'gold',
  lifetimeValue: 188,
};

// ─── James Rodriguez: Known Customer, NO Loyalty ────────────────
// Oily skin, 1 order, anniversary gift search — not yet a loyalty member
const jamesRodriguez: CustomerProfile = {
  id: 'persona-james',
  name: 'James',
  email: 'james.rodriguez@example.com',

  beautyProfile: {
    skinType: 'oily',
    concerns: ['oil control'],
    allergies: [],
    communicationPrefs: { email: true, sms: false, push: false },
    preferredBrands: [],
    ageRange: '25-35',
  },

  orders: [
    {
      orderId: 'ORD-2025-0612',
      orderDate: '2025-07-10',
      channel: 'online',
      status: 'completed',
      totalAmount: 32.00,
      lineItems: [
        { productId: 'cleanser-acne', productName: 'Clear Start Salicylic Cleanser', quantity: 1, unitPrice: 32.00 },
      ],
    },
  ],

  chatSummaries: [],
  meaningfulEvents: [],
  agentCapturedProfile: {},

  browseSessions: [
    {
      sessionDate: '2026-01-25',
      categoriesBrowsed: ['fragrance'],
      productsViewed: ['fragrance-floral', 'fragrance-woody'],
      durationMinutes: 12,
      device: 'mobile',
    },
  ],

  loyalty: null,

  merkuryIdentity: {
    merkuryId: 'MRK-JR-78701',
    identityTier: 'known',
    confidence: 0.92,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [
    { productId: 'cleanser-acne', productName: 'Clear Start Salicylic Cleanser', purchaseDate: '2025-07-10', quantity: 1, rating: 4 },
  ],
  savedPaymentMethods: [
    { id: 'pm-2', type: 'card', last4: '8888', brand: 'mastercard', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-2', name: 'James Rodriguez', line1: '456 Oak Ave', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US', isDefault: true },
  ],
  recentActivity: [],
  loyaltyTier: undefined,
  lifetimeValue: 32,
};

// ─── Aisha Patel: Appended Only (Unknown to Brand) ─────────────
// Zero brand data. Only Merkury appended 3P data.
const aishaPatel: CustomerProfile = {
  id: 'persona-aisha',
  name: 'Aisha',
  email: '',

  beautyProfile: {
    skinType: 'combination',
    concerns: [],
    allergies: [],
    preferredBrands: [],
  },

  orders: [],
  chatSummaries: [],
  meaningfulEvents: [],
  browseSessions: [],
  loyalty: null,
  purchaseHistory: [],
  savedPaymentMethods: [],
  shippingAddresses: [],
  recentActivity: [],

  merkuryIdentity: {
    merkuryId: 'MRK-AP-10001',
    identityTier: 'appended',
    confidence: 0.74,
    resolvedAt: new Date().toISOString(),
  },

  appendedProfile: {
    ageRange: '28-35',
    gender: 'female',
    householdIncome: '$100k-$150k',
    hasChildren: false,
    homeOwnership: 'rent',
    educationLevel: "bachelor's",
    interests: ['luxury beauty', 'clean beauty', 'yoga', 'wellness'],
    lifestyleSignals: ['wellness-focused', 'urban professional', 'fitness enthusiast'],
    geoRegion: 'New York Metro',
  },
};

// ─── Anonymous Visitor ──────────────────────────────────────────
// Merkury fired but found no match at all.
const anonymousVisitor: CustomerProfile = {
  id: 'persona-anonymous',
  name: 'Guest',
  email: '',

  beautyProfile: {
    skinType: 'normal',
    concerns: [],
    allergies: [],
    preferredBrands: [],
  },

  orders: [],
  chatSummaries: [],
  meaningfulEvents: [],
  browseSessions: [],
  loyalty: null,
  purchaseHistory: [],
  savedPaymentMethods: [],
  shippingAddresses: [],
  recentActivity: [],

  merkuryIdentity: {
    merkuryId: '',
    identityTier: 'anonymous',
    confidence: 0,
    resolvedAt: new Date().toISOString(),
  },
};

// ─── Maya Thompson: Known, Loyalty Platinum, Makeup Enthusiast ──
// Frequent buyer, loves makeup and fragrance
const mayaThompson: CustomerProfile = {
  id: 'persona-maya',
  name: 'Maya',
  email: 'maya.thompson@example.com',

  beautyProfile: {
    skinType: 'normal',
    concerns: ['brightening'],
    allergies: [],
    fragrancePreference: 'love',
    communicationPrefs: { email: true, sms: true, push: true },
    preferredBrands: ['LUMIERE'],
    ageRange: '25-30',
  },

  orders: [
    {
      orderId: 'ORD-2025-0301',
      orderDate: '2025-03-14',
      channel: 'online',
      status: 'completed',
      totalAmount: 118.00,
      lineItems: [
        { productId: 'foundation-dewy', productName: 'Skin Glow Serum Foundation', quantity: 1, unitPrice: 52.00 },
        { productId: 'blush-silk', productName: 'Silk Petal Blush', quantity: 1, unitPrice: 38.00 },
        { productId: 'mascara-volume', productName: 'Lash Drama Volume Mascara', quantity: 1, unitPrice: 28.00 },
      ],
    },
    {
      orderId: 'ORD-2025-0589',
      orderDate: '2025-06-02',
      channel: 'in-store',
      status: 'completed',
      totalAmount: 159.00,
      lineItems: [
        { productId: 'lipstick-velvet', productName: 'Velvet Matte Lip Color', quantity: 1, unitPrice: 34.00 },
        { productId: 'fragrance-floral', productName: 'Jardin de Nuit Eau de Parfum', quantity: 1, unitPrice: 125.00 },
      ],
    },
    {
      orderId: 'ORD-2025-0940',
      orderDate: '2025-09-18',
      channel: 'online',
      status: 'completed',
      totalAmount: 124.00,
      lineItems: [
        { productId: 'serum-vitamin-c', productName: 'Glow Boost Vitamin C Serum', quantity: 1, unitPrice: 72.00 },
        { productId: 'foundation-dewy', productName: 'Skin Glow Serum Foundation', quantity: 1, unitPrice: 52.00 },
      ],
    },
  ],

  chatSummaries: [],
  meaningfulEvents: [],
  agentCapturedProfile: {},

  browseSessions: [
    {
      sessionDate: '2026-01-20',
      categoriesBrowsed: ['foundation', 'blush'],
      productsViewed: ['foundation-dewy', 'blush-silk'],
      durationMinutes: 6,
      device: 'mobile',
    },
  ],

  loyalty: {
    tier: 'platinum',
    pointsBalance: 5200,
    lifetimePoints: 12400,
    memberSince: '2024-03-01',
    rewardsAvailable: [
      { name: '$25 off next purchase', pointsCost: 2000 },
    ],
    tierExpiryDate: '2027-03-01',
  },

  merkuryIdentity: {
    merkuryId: 'MRK-MT-30302',
    identityTier: 'known',
    confidence: 0.99,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [
    { id: 'pm-3', type: 'applepay', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-3', name: 'Maya Thompson', line1: '789 Elm St', city: 'Los Angeles', state: 'CA', postalCode: '90028', country: 'US', isDefault: true },
  ],
  recentActivity: [],
  lifetimeValue: 401,
};

// ─── David Kim: Known, Loyalty Silver, Routine Builder ──────────
// Combination skin, methodical, building out his routine
const davidKim: CustomerProfile = {
  id: 'persona-david',
  name: 'David',
  email: 'david.kim@example.com',

  beautyProfile: {
    skinType: 'combination',
    concerns: ['pores'],
    allergies: [],
    communicationPrefs: { email: true, sms: false, push: true },
    preferredBrands: ['DERMAFIX'],
    ageRange: '30-40',
  },

  orders: [
    {
      orderId: 'ORD-2025-0720',
      orderDate: '2025-08-15',
      channel: 'online',
      status: 'completed',
      totalAmount: 70.00,
      lineItems: [
        { productId: 'cleanser-acne', productName: 'Clear Start Salicylic Cleanser', quantity: 1, unitPrice: 32.00 },
        { productId: 'serum-niacinamide', productName: 'Pore Refine Niacinamide Serum', quantity: 1, unitPrice: 38.00 },
      ],
    },
    {
      orderId: 'ORD-2025-1320',
      orderDate: '2025-11-22',
      channel: 'online',
      status: 'completed',
      totalAmount: 76.00,
      lineItems: [
        { productId: 'toner-aha', productName: 'Glow Tonic AHA Toner', quantity: 1, unitPrice: 34.00 },
        { productId: 'sunscreen-lightweight', productName: 'Invisible Shield SPF 50', quantity: 1, unitPrice: 42.00 },
      ],
    },
  ],

  chatSummaries: [],
  meaningfulEvents: [],
  agentCapturedProfile: {},

  browseSessions: [
    {
      sessionDate: '2026-01-15',
      categoriesBrowsed: ['serum', 'moisturizer'],
      productsViewed: ['serum-retinol', 'moisturizer-sensitive'],
      durationMinutes: 11,
      device: 'desktop',
    },
  ],

  loyalty: {
    tier: 'silver',
    pointsBalance: 980,
    lifetimePoints: 1460,
    memberSince: '2025-08-15',
    rewardsAvailable: [
      { name: '$5 off next purchase', pointsCost: 500 },
    ],
    nextTierThreshold: 3000,
    tierExpiryDate: '2026-08-15',
  },

  merkuryIdentity: {
    merkuryId: 'MRK-DK-60614',
    identityTier: 'known',
    confidence: 0.94,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [
    { id: 'pm-4', type: 'card', last4: '1234', brand: 'amex', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-4', name: 'David Kim', line1: '321 Lake Shore Dr', city: 'Chicago', state: 'IL', postalCode: '60614', country: 'US', isDefault: true },
  ],
  recentActivity: [],
  lifetimeValue: 146,
};

// ─── Priya Sharma: Appended, Different Interests ────────────────
// Merkury appended only, but different profile from Aisha — older, has children, luxury/anti-aging focus
const priyaSharma: CustomerProfile = {
  id: 'persona-priya',
  name: 'Priya',
  email: '',

  beautyProfile: {
    skinType: 'combination',
    concerns: [],
    allergies: [],
    preferredBrands: [],
  },

  orders: [],
  chatSummaries: [],
  meaningfulEvents: [],
  browseSessions: [],
  loyalty: null,
  purchaseHistory: [],
  savedPaymentMethods: [],
  shippingAddresses: [],
  recentActivity: [],

  merkuryIdentity: {
    merkuryId: 'MRK-PS-75201',
    identityTier: 'appended',
    confidence: 0.68,
    resolvedAt: new Date().toISOString(),
  },

  appendedProfile: {
    ageRange: '40-50',
    gender: 'female',
    householdIncome: '$150k-$250k',
    hasChildren: true,
    homeOwnership: 'own',
    educationLevel: "master's",
    interests: ['luxury beauty', 'anti-aging', 'spa treatments', 'fine dining'],
    lifestyleSignals: ['affluent suburban', 'self-care focused', 'frequent spa-goer'],
    geoRegion: 'Dallas-Fort Worth',
  },
};

// ─── Marcus Williams: Known, Brand New ──────────────────────────
// Just getting started — 1 order, no loyalty yet
const marcusWilliams: CustomerProfile = {
  id: 'persona-marcus',
  name: 'Marcus',
  email: 'marcus.w@example.com',

  beautyProfile: {
    skinType: 'dry',
    concerns: ['hydration'],
    allergies: [],
    communicationPrefs: { email: false, sms: true, push: true },
    preferredBrands: [],
    ageRange: '20-25',
  },

  orders: [
    {
      orderId: 'ORD-2026-0102',
      orderDate: '2026-01-24',
      channel: 'online',
      status: 'completed',
      totalAmount: 36.00,
      lineItems: [
        { productId: 'cleanser-gentle', productName: 'Cloud Cream Cleanser', quantity: 1, unitPrice: 36.00 },
      ],
    },
  ],

  chatSummaries: [],
  meaningfulEvents: [],
  agentCapturedProfile: {},
  browseSessions: [],
  loyalty: null,

  merkuryIdentity: {
    merkuryId: 'MRK-MW-11201',
    identityTier: 'known',
    confidence: 0.88,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [
    { id: 'pm-6', type: 'card', last4: '5555', brand: 'visa', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-6', name: 'Marcus Williams', line1: '55 W 46th St', city: 'New York', state: 'NY', postalCode: '10036', country: 'US', isDefault: true },
  ],
  recentActivity: [],
  lifetimeValue: 36,
};

export const PERSONAS: PersonaMeta[] = [
  {
    id: 'sarah',
    label: 'Sarah Chen',
    subtitle: 'Known · Loyalty Gold',
    traits: ['Sensitive skin', 'Fragrance-free', '2 orders', '2,450 pts'],
    profile: sarahChen,
  },
  {
    id: 'james',
    label: 'James Rodriguez',
    subtitle: 'Known · No Loyalty',
    traits: ['Oily skin', '1 order', 'Anniversary gift search'],
    profile: jamesRodriguez,
  },
  {
    id: 'maya',
    label: 'Maya Thompson',
    subtitle: 'Known · Loyalty Platinum',
    traits: ['Makeup enthusiast', '3 orders', '5,200 pts'],
    profile: mayaThompson,
  },
  {
    id: 'david',
    label: 'David Kim',
    subtitle: 'Known · Loyalty Silver',
    traits: ['Combination skin', '2 orders', 'Routine builder'],
    profile: davidKim,
  },
  {
    id: 'marcus',
    label: 'Marcus Williams',
    subtitle: 'Known · Brand New',
    traits: ['Dry skin', '1 order', 'No loyalty yet'],
    profile: marcusWilliams,
  },
  {
    id: 'aisha',
    label: 'Aisha Patel',
    subtitle: 'Merkury Appended Only',
    traits: ['Clean beauty interest', 'NYC', 'No purchase history'],
    profile: aishaPatel,
  },
  {
    id: 'priya',
    label: 'Priya Sharma',
    subtitle: 'Merkury Appended Only',
    traits: ['Anti-aging interest', 'Dallas', 'Has children'],
    profile: priyaSharma,
  },
  {
    id: 'anonymous',
    label: 'Anonymous Visitor',
    subtitle: 'Merkury: No Match',
    traits: ['No identity resolved', 'No history'],
    profile: anonymousVisitor,
  },
];

export function getPersonaById(id: string): PersonaMeta | undefined {
  return PERSONAS.find((p) => p.id === id);
}

/** Minimal stubs for persona selector — enough to render cards before profile loads. */
export interface PersonaStub {
  id: string;
  merkuryId: string;
  identityTier: 'known' | 'appended' | 'anonymous';
  defaultLabel: string;
  defaultSubtitle: string;
}

export const PERSONA_STUBS: PersonaStub[] = [
  { id: 'sarah', merkuryId: 'MRK-SC-90210', identityTier: 'known', defaultLabel: 'Sarah Chen', defaultSubtitle: 'Merkury: Matched' },
  { id: 'james', merkuryId: 'MRK-JR-78701', identityTier: 'known', defaultLabel: 'James Rodriguez', defaultSubtitle: 'Merkury: Matched' },
  { id: 'maya', merkuryId: 'MRK-MT-30302', identityTier: 'known', defaultLabel: 'Maya Thompson', defaultSubtitle: 'Merkury: Matched' },
  { id: 'david', merkuryId: 'MRK-DK-60614', identityTier: 'known', defaultLabel: 'David Kim', defaultSubtitle: 'Merkury: Matched' },
  { id: 'marcus', merkuryId: 'MRK-MW-11201', identityTier: 'known', defaultLabel: 'Marcus Williams', defaultSubtitle: 'Merkury: Matched' },
  { id: 'aisha', merkuryId: 'MRK-AP-10001', identityTier: 'appended', defaultLabel: 'Aisha Patel', defaultSubtitle: 'Merkury: Matched · Appended Only' },
  { id: 'priya', merkuryId: 'MRK-PS-75201', identityTier: 'appended', defaultLabel: 'Priya Sharma', defaultSubtitle: 'Merkury: Matched · Appended Only' },
  { id: 'anonymous', merkuryId: '', identityTier: 'anonymous', defaultLabel: 'Anonymous Visitor', defaultSubtitle: 'Merkury: No Match' },
];
