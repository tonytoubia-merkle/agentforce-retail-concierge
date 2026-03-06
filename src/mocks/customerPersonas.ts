import type { CustomerProfile } from '@/types/customer';

export interface PersonaMeta {
  id: string;
  label: string;
  subtitle: string;
  traits: string[];
  profile: CustomerProfile;
}

// ─── Alex Rivera: Known Customer, Primo Perks Elite ─────────────
// Triathlete, high daily intake goal, Sparkling + delivery subscriber
const alexRivera: CustomerProfile = {
  id: 'persona-alex',
  name: 'Alex',
  email: 'alex.rivera@example.com',

  hydrationProfile: {
    primaryUse: 'fitness',
    dailyIntakeGoalOz: 120,
    waterPreferences: ['still', 'sparkling'],
    deliveryFrequency: 'weekly',
    householdSize: 2,
    hasDispenser: true,
    communicationPrefs: { email: true, sms: true, push: true },
    preferredBrands: ['Primo Water', 'Primo Sparkling'],
    ageRange: '30-40',
  },

  orders: [
    {
      orderId: 'ORD-2025-0991',
      orderDate: '2025-10-08',
      channel: 'online',
      status: 'completed',
      totalAmount: 59.97,
      lineItems: [
        { productId: 'sparkling-lemon', productName: 'Primo Sparkling — Lemon (12-Pack)', quantity: 2, unitPrice: 12.99 },
        { productId: 'bottle-stainless-32oz', productName: 'Primo Stainless Steel Bottle 32oz', quantity: 1, unitPrice: 34.99 },
      ],
    },
    {
      orderId: 'ORD-2026-0114',
      orderDate: '2026-01-14',
      channel: 'mobile-app',
      status: 'completed',
      totalAmount: 38.97,
      lineItems: [
        { productId: 'sparkling-original', productName: 'Primo Sparkling — Original (12-Pack)', quantity: 3, unitPrice: 12.99 },
      ],
    },
  ],

  chatSummaries: [
    {
      sessionDate: '2026-01-14',
      summary: 'Alex discussed hydration strategies for marathon training. Interested in electrolyte pairing with Primo sparkling. Asked about bulk delivery options.',
      sentiment: 'positive',
      topicsDiscussed: ['marathon training', 'sparkling water', 'bulk delivery'],
    },
  ],
  meaningfulEvents: [
    {
      eventType: 'hydration-goal',
      description: 'Training for Chicago Marathon — targeting 120oz/day hydration',
      capturedAt: '2026-01-14',
      agentNote: 'High-priority engagement window. Marathon is April 2026.',
      urgency: 'This Month',
    },
  ],
  agentCapturedProfile: {
    activityLevel: { value: 'Triathlete — runs 40+ miles/week, swims 3x/week', capturedAt: '2026-01-14', capturedFrom: 'chat session 2026-01-14', confidence: 'stated' },
    dailyIntakeGoal: { value: '120oz per day during training, 80oz on rest days', capturedAt: '2026-01-14', capturedFrom: 'chat session 2026-01-14', confidence: 'stated' },
    flavorsPreferred: { value: 'Citrus and original — nothing sweet', capturedAt: '2026-01-14', capturedFrom: 'chat session 2026-01-14', confidence: 'stated' },
    sparklingPreference: { value: 'Loves sparkling post-workout for the carbonation', capturedAt: '2026-01-14', capturedFrom: 'chat session 2026-01-14', confidence: 'stated' },
  },

  browseSessions: [
    {
      sessionDate: '2026-02-10',
      categoriesBrowsed: ['sparkling', 'bottle'],
      productsViewed: ['sparkling-lime', 'sparkling-berry', 'bottle-stainless-32oz'],
      durationMinutes: 11,
      device: 'mobile',
    },
  ],

  loyalty: {
    tier: 'elite',
    pointsBalance: 3420,
    lifetimePoints: 6800,
    memberSince: '2024-09-01',
    rewardsAvailable: [
      { name: 'Free monthly delivery', pointsCost: 1500 },
      { name: '$10 off accessories', pointsCost: 1000 },
    ],
    nextTierThreshold: 10000,
    tierExpiryDate: '2026-09-01',
  },

  merkuryIdentity: {
    merkuryId: 'MRK-AR-10001',
    merkuryPid: 'PID-AR-10001',
    merkuryHid: 'HID-H001',
    identityTier: 'known',
    confidence: 0.97,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [
    { id: 'pm-1', type: 'card', last4: '4242', brand: 'visa', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-1', name: 'Alex Rivera', line1: '220 Lake Shore Dr', city: 'Chicago', state: 'IL', postalCode: '60601', country: 'US', isDefault: true },
  ],
  recentActivity: [],
  loyaltyTier: 'elite',
  lifetimeValue: 412,
};

// ─── Maria Santos: Known Customer, Primo Perks Active ───────────
// Family of 5, weekly delivery, home dispenser, kids hydration focus
const mariaSantos: CustomerProfile = {
  id: 'persona-maria',
  name: 'Maria',
  email: 'maria.santos@example.com',

  hydrationProfile: {
    primaryUse: 'home',
    dailyIntakeGoalOz: 80,
    waterPreferences: ['still', 'flavored'],
    deliveryFrequency: 'weekly',
    householdSize: 5,
    hasDispenser: true,
    communicationPrefs: { email: true, sms: true, push: false },
    preferredBrands: ['Primo Water', 'Pure Life'],
    ageRange: '35-45',
  },

  orders: [
    {
      orderId: 'ORD-2025-0734',
      orderDate: '2025-08-22',
      channel: 'online',
      status: 'completed',
      totalAmount: 63.94,
      lineItems: [
        { productId: 'primo-5gal-delivery-weekly', productName: 'Primo 5-Gallon Weekly Delivery', quantity: 4, unitPrice: 12.99 },
        { productId: 'primo-sanitizer-kit', productName: 'Primo Dispenser Sanitizer Kit', quantity: 1, unitPrice: 14.99 },
      ],
    },
    {
      orderId: 'ORD-2026-0208',
      orderDate: '2026-02-08',
      channel: 'online',
      status: 'shipped',
      totalAmount: 59.96,
      lineItems: [
        { productId: 'primo-5gal-delivery-weekly', productName: 'Primo 5-Gallon Weekly Delivery', quantity: 4, unitPrice: 12.99 },
        { productId: 'bottle-kids-16oz', productName: 'Primo Kids Bottle 16oz', quantity: 2, unitPrice: 19.99 },
      ],
      trackingNumber: 'PW2026020800123',
      carrier: 'Primo Direct',
      estimatedDelivery: '2026-02-12',
    },
  ],

  chatSummaries: [],
  meaningfulEvents: [
    {
      eventType: 'life-event',
      description: 'Moving to new home — asked about dispenser setup for new kitchen',
      capturedAt: '2026-01-05',
      agentNote: 'Potential upsell to bottom-loading dispenser. New house, likely wants upgraded setup.',
      urgency: 'This Month',
    },
  ],
  agentCapturedProfile: {
    householdContext: { value: 'Family of 5 — husband, 3 kids (ages 4, 8, 12)', capturedAt: '2026-01-05', capturedFrom: 'chat session 2026-01-05', confidence: 'stated' },
    hydrationChallenges: { value: 'Kids forget to drink water — trying flavored options to help', capturedAt: '2026-01-05', capturedFrom: 'chat session 2026-01-05', confidence: 'stated' },
    sustainabilityGoals: { value: 'Wants to cut down on single-use plastic bottles', capturedAt: '2026-01-05', capturedFrom: 'chat session 2026-01-05', confidence: 'stated' },
  },

  browseSessions: [
    {
      sessionDate: '2026-02-15',
      categoriesBrowsed: ['flavored', 'bottle', 'dispenser'],
      productsViewed: ['flavored-watermelon', 'bottle-kids-16oz', 'primo-dispenser-bottom'],
      durationMinutes: 18,
      device: 'mobile',
    },
  ],

  loyalty: {
    tier: 'active',
    pointsBalance: 1340,
    lifetimePoints: 2800,
    memberSince: '2024-06-01',
    rewardsAvailable: [
      { name: '$5 off next order', pointsCost: 500 },
    ],
    nextTierThreshold: 5000,
    tierExpiryDate: '2026-06-01',
  },

  merkuryIdentity: {
    merkuryId: 'MRK-MS-10002',
    merkuryPid: 'PID-MS-10002',
    merkuryHid: 'HID-H002',
    identityTier: 'known',
    confidence: 0.93,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [
    { id: 'pm-2', type: 'card', last4: '8811', brand: 'mastercard', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-2', name: 'Maria Santos', line1: '412 Maplewood Dr', city: 'Austin', state: 'TX', postalCode: '78759', country: 'US', isDefault: true },
  ],
  recentActivity: [],
  loyaltyTier: 'active',
  lifetimeValue: 248,
};

// ─── David Park: Known Customer, NO Loyalty ─────────────────────
// Office manager, evaluating bulk delivery + dispenser for 25-person team
const davidPark: CustomerProfile = {
  id: 'persona-david',
  name: 'David',
  email: 'david.park@example.com',

  hydrationProfile: {
    primaryUse: 'office',
    waterPreferences: ['still', 'sparkling'],
    deliveryFrequency: 'weekly',
    householdSize: 25,
    hasDispenser: false,
    communicationPrefs: { email: true, sms: false, push: false },
    preferredBrands: [],
    ageRange: '35-45',
  },

  orders: [
    {
      orderId: 'ORD-2025-1121',
      orderDate: '2025-11-21',
      channel: 'online',
      status: 'completed',
      totalAmount: 199.99,
      lineItems: [
        { productId: 'primo-dispenser-bottom', productName: 'Primo Bottom-Loading Dispenser', quantity: 1, unitPrice: 199.99 },
      ],
    },
  ],

  chatSummaries: [],
  meaningfulEvents: [],
  agentCapturedProfile: {
    officeContext: { value: 'Office of 25 people, replacing existing bottled water service', capturedAt: '2026-01-18', capturedFrom: 'chat session 2026-01-18', confidence: 'stated' },
    budgetContext: { value: 'Currently spending ~$400/month on bottled water for the office', capturedAt: '2026-01-18', capturedFrom: 'chat session 2026-01-18', confidence: 'stated' },
    hydrationChallenges: { value: 'People forget to stay hydrated during long meetings', capturedAt: '2026-01-18', capturedFrom: 'chat session 2026-01-18', confidence: 'stated' },
  },

  browseSessions: [
    {
      sessionDate: '2026-01-18',
      categoriesBrowsed: ['dispenser', 'delivery', 'subscription'],
      productsViewed: ['primo-dispenser-bottom', 'primo-5gal-delivery-weekly', 'subscription-primo-perks-elite'],
      durationMinutes: 22,
      device: 'desktop',
    },
  ],

  loyalty: null,

  merkuryIdentity: {
    merkuryId: 'MRK-DP-10003',
    merkuryPid: 'PID-DP-10003',
    merkuryHid: 'HID-H003',
    identityTier: 'known',
    confidence: 0.89,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [
    { id: 'pm-3', type: 'card', last4: '3311', brand: 'amex', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-3', name: 'David Park', line1: '1500 Tech Blvd Ste 400', city: 'San Jose', state: 'CA', postalCode: '95128', country: 'US', isDefault: true },
  ],
  recentActivity: [],
  loyaltyTier: undefined,
  lifetimeValue: 200,
};

// ─── Emma Thompson: Appended Only (Merkury-Recognized, No CRM) ──
// Wellness enthusiast — Merkury has hydration/sustainability signals
const emmaThompson: CustomerProfile = {
  id: 'persona-emma',
  name: 'Emma',
  email: '',

  hydrationProfile: {
    preferredBrands: [],
  },

  appendedProfile: {
    ageRange: '28-38',
    gender: 'female',
    householdIncome: '$70k-$110k',
    hasChildren: false,
    homeOwnership: 'rent',
    educationLevel: "master's",
    interests: ['wellness', 'clean hydration', 'sustainability', 'yoga', 'organic living'],
    lifestyleSignals: ['wellness-focused', 'eco-conscious', 'health-driven'],
    geoRegion: 'Portland, OR',
  },

  orders: [],
  chatSummaries: [],
  meaningfulEvents: [],
  agentCapturedProfile: {},
  browseSessions: [],
  loyalty: null,

  merkuryIdentity: {
    merkuryId: 'MRK-ET-10004',
    merkuryPid: 'PID-ET-10004',
    merkuryHid: 'HID-H004',
    identityTier: 'appended',
    confidence: 0.81,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [],
  shippingAddresses: [],
  recentActivity: [],
};

// ─── Carlos Mendez: Known Customer, Primo Perks Hydrated ────────
// Eco-conscious homeowner in Phoenix — filter user, zero-waste goal
const carlosMendez: CustomerProfile = {
  id: 'persona-carlos',
  name: 'Carlos',
  email: 'carlos.mendez@example.com',

  hydrationProfile: {
    primaryUse: 'home',
    waterPreferences: ['still'],
    deliveryFrequency: 'biweekly',
    householdSize: 3,
    hasDispenser: false,
    communicationPrefs: { email: true, sms: false, push: false },
    preferredBrands: ['Primo Water'],
    ageRange: '30-40',
  },

  orders: [
    {
      orderId: 'ORD-2025-0502',
      orderDate: '2025-05-02',
      channel: 'online',
      status: 'completed',
      totalAmount: 64.97,
      lineItems: [
        { productId: 'filter-pitcher-10cup', productName: 'Primo Filter Pitcher 10-Cup', quantity: 1, unitPrice: 39.99 },
        { productId: 'filter-replacement-3pack', productName: 'Primo Filter Replacement 3-Pack', quantity: 1, unitPrice: 24.99 },
      ],
    },
  ],

  chatSummaries: [],
  meaningfulEvents: [],
  agentCapturedProfile: {
    sustainabilityGoals: { value: 'Eliminated single-use plastic bottles — trying to go fully zero-waste', capturedAt: '2025-12-10', capturedFrom: 'chat session 2025-12-10', confidence: 'stated' },
    tapWaterQuality: { value: 'Phoenix tap water is hard and tastes bad', capturedAt: '2025-12-10', capturedFrom: 'chat session 2025-12-10', confidence: 'stated' },
    climateContext: { value: 'Phoenix, AZ — very hot and dry, high daily intake needed', capturedAt: '2025-12-10', capturedFrom: 'chat session 2025-12-10', confidence: 'stated' },
  },

  browseSessions: [
    {
      sessionDate: '2026-01-30',
      categoriesBrowsed: ['filter', 'delivery'],
      productsViewed: ['filter-replacement-3pack', 'water-quality-test-kit', 'primo-5gal-delivery-biweekly'],
      durationMinutes: 9,
      device: 'desktop',
    },
  ],

  loyalty: {
    tier: 'hydrated',
    pointsBalance: 320,
    lifetimePoints: 680,
    memberSince: '2025-05-01',
    rewardsAvailable: [],
    nextTierThreshold: 1000,
    tierExpiryDate: '2026-05-01',
  },

  merkuryIdentity: {
    merkuryId: 'MRK-CM-10005',
    merkuryPid: 'PID-CM-10005',
    merkuryHid: 'HID-H005',
    identityTier: 'known',
    confidence: 0.91,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [
    { id: 'pm-5', type: 'card', last4: '7744', brand: 'visa', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-5', name: 'Carlos Mendez', line1: '3301 Desert Rose Blvd', city: 'Phoenix', state: 'AZ', postalCode: '85008', country: 'US', isDefault: true },
  ],
  recentActivity: [],
  loyaltyTier: 'hydrated',
  lifetimeValue: 65,
};

// ─── Jennifer Walsh: Known Customer, Primo Perks Champion ───────
// High-LTV customer in Miami — premium sparkling devotee
const jenniferWalsh: CustomerProfile = {
  id: 'persona-jennifer',
  name: 'Jennifer',
  email: 'jennifer.walsh@example.com',

  hydrationProfile: {
    primaryUse: 'home',
    dailyIntakeGoalOz: 96,
    waterPreferences: ['sparkling', 'flavored'],
    deliveryFrequency: 'weekly',
    householdSize: 2,
    hasDispenser: true,
    communicationPrefs: { email: true, sms: true, push: true },
    preferredBrands: ['Primo Sparkling', 'Primo Water'],
    ageRange: '40-55',
  },

  orders: [
    {
      orderId: 'ORD-2025-0841',
      orderDate: '2025-08-01',
      channel: 'online',
      status: 'completed',
      totalAmount: 128.93,
      lineItems: [
        { productId: 'sparkling-lemon', productName: 'Primo Sparkling Lemon (12-Pack)', quantity: 3, unitPrice: 12.99 },
        { productId: 'sparkling-original', productName: 'Primo Sparkling Original (12-Pack)', quantity: 3, unitPrice: 12.99 },
        { productId: 'flavored-cucumber-mint', productName: 'Primo Flavored Cucumber Mint (12-Pack)', quantity: 3, unitPrice: 13.99 },
      ],
    },
    {
      orderId: 'ORD-2026-0122',
      orderDate: '2026-01-22',
      channel: 'online',
      status: 'completed',
      totalAmount: 159.90,
      lineItems: [
        { productId: 'sparkling-lemon', productName: 'Primo Sparkling Lemon (12-Pack)', quantity: 4, unitPrice: 12.99 },
        { productId: 'sparkling-lime', productName: 'Primo Sparkling Lime (12-Pack)', quantity: 4, unitPrice: 12.99 },
        { productId: 'bottle-stainless-32oz', productName: 'Primo Stainless Steel Bottle 32oz', quantity: 1, unitPrice: 34.99 },
      ],
    },
  ],

  chatSummaries: [
    {
      sessionDate: '2026-01-22',
      summary: 'Jennifer explored new sparkling flavors and asked about cucumber mint. Expressed interest in brand ambassador program. Mentioned planning a wellness retreat.',
      sentiment: 'positive',
      topicsDiscussed: ['new flavors', 'brand ambassador', 'wellness retreat'],
    },
  ],
  meaningfulEvents: [
    {
      eventType: 'milestone',
      description: 'Reached 10,000 lifetime points — Champion tier unlocked',
      capturedAt: '2026-01-22',
      agentNote: 'Reward with exclusive Champion welcome kit offer.',
      urgency: 'Immediate',
    },
  ],
  agentCapturedProfile: {
    climateContext: { value: 'Miami, FL — hot and humid year-round', capturedAt: '2026-01-22', capturedFrom: 'chat session 2026-01-22', confidence: 'stated' },
    sparklingPreference: { value: 'Exclusively sparkling — bubbly water is non-negotiable', capturedAt: '2026-01-22', capturedFrom: 'chat session 2026-01-22', confidence: 'stated' },
    priceRange: { value: 'Premium is fine — quality and taste matter more than price', capturedAt: '2026-01-22', capturedFrom: 'chat session 2026-01-22', confidence: 'stated' },
  },

  browseSessions: [
    {
      sessionDate: '2026-02-18',
      categoriesBrowsed: ['sparkling', 'flavored', 'subscription'],
      productsViewed: ['sparkling-berry', 'flavored-peach-ginger', 'subscription-primo-perks-elite'],
      durationMinutes: 16,
      device: 'tablet',
    },
  ],

  loyalty: {
    tier: 'champion',
    pointsBalance: 1890,
    lifetimePoints: 11200,
    memberSince: '2023-12-01',
    rewardsAvailable: [
      { name: 'Free monthly sparkling case', pointsCost: 1500 },
      { name: 'Exclusive wellness event access', pointsCost: 2000 },
      { name: '$25 off next order', pointsCost: 2500 },
    ],
    tierExpiryDate: '2026-12-01',
  },

  merkuryIdentity: {
    merkuryId: 'MRK-JW-10006',
    merkuryPid: 'PID-JW-10006',
    merkuryHid: 'HID-H006',
    identityTier: 'known',
    confidence: 0.98,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [
    { id: 'pm-6', type: 'card', last4: '9900', brand: 'amex', isDefault: true },
  ],
  shippingAddresses: [
    { id: 'addr-6', name: 'Jennifer Walsh', line1: '8800 Brickell Ave Apt 1201', city: 'Miami', state: 'FL', postalCode: '33131', country: 'US', isDefault: true },
  ],
  recentActivity: [],
  loyaltyTier: 'champion',
  lifetimeValue: 1640,
};

// ─── Anonymous Visitor ───────────────────────────────────────────
const anonymousVisitor: CustomerProfile = {
  id: 'persona-anonymous',
  name: '',
  email: '',

  hydrationProfile: {
    preferredBrands: [],
  },

  orders: [],
  chatSummaries: [],
  meaningfulEvents: [],
  agentCapturedProfile: {},
  browseSessions: [],
  loyalty: null,

  merkuryIdentity: {
    merkuryId: '',
    identityTier: 'anonymous',
    confidence: 0,
    resolvedAt: new Date().toISOString(),
  },

  purchaseHistory: [],
  savedPaymentMethods: [],
  shippingAddresses: [],
  recentActivity: [],
};

// ─── Persona Exports ─────────────────────────────────────────────

export const CUSTOMER_PERSONAS: PersonaMeta[] = [
  {
    id: 'alex-rivera',
    label: 'Alex Rivera',
    subtitle: 'Fitness Enthusiast • Elite Member',
    traits: ['Triathlete', 'High volume', 'Sparkling fan', 'Weekly delivery'],
    profile: alexRivera,
  },
  {
    id: 'maria-santos',
    label: 'Maria Santos',
    subtitle: 'Family of 5 • Active Member',
    traits: ['Home dispenser', 'Kids hydration', 'Sustainability-focused', 'Flavored water'],
    profile: mariaSantos,
  },
  {
    id: 'david-park',
    label: 'David Park',
    subtitle: 'Office Manager • No Loyalty Yet',
    traits: ['25-person office', 'Evaluating delivery', 'Cost-conscious', 'B2B potential'],
    profile: davidPark,
  },
  {
    id: 'emma-thompson',
    label: 'Emma Thompson',
    subtitle: 'Wellness Seeker • Merkury Appended',
    traits: ['No brand record', 'Eco-conscious', 'Wellness signals', '3P enriched'],
    profile: emmaThompson,
  },
  {
    id: 'carlos-mendez',
    label: 'Carlos Mendez',
    subtitle: 'Eco Homeowner • Hydrated Member',
    traits: ['Phoenix heat', 'Zero-waste goal', 'Filter user', 'Tap water concerns'],
    profile: carlosMendez,
  },
  {
    id: 'jennifer-walsh',
    label: 'Jennifer Walsh',
    subtitle: 'Premium Lifestyle • Champion Member',
    traits: ['Miami climate', 'Sparkling devotee', 'High LTV', 'Brand ambassador potential'],
    profile: jenniferWalsh,
  },
  {
    id: 'anonymous-visitor',
    label: 'Anonymous Visitor',
    subtitle: 'No identity resolved',
    traits: ['No Merkury match', 'First visit', 'Top of funnel'],
    profile: anonymousVisitor,
  },
];

// Default export for backward compat with existing persona selector
export const DEMO_PERSONAS = CUSTOMER_PERSONAS;
