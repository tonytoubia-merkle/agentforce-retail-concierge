export type IdentityTier = 'known' | 'appended' | 'anonymous';

// ─── Data Provenance & Usage Permissions ────────────────────────
// Tags every piece of customer context with HOW it was obtained,
// which determines HOW the agent may reference it.
export type DataProvenance =
  | 'stated'          // 0P: customer said it in conversation
  | 'declared'        // 1P-explicit: preference form, account profile
  | 'observed'        // 1P-behavioral: purchase history, orders
  | 'inferred'        // 1P-implicit: browse behavior, click patterns
  | 'agent_inferred'  // Derived: agent's inference from conversations
  | 'appended';       // 3P: Merkury or other third-party append

export type UsagePermission = 'direct' | 'soft' | 'influence_only';

export const PROVENANCE_USAGE: Record<DataProvenance, UsagePermission> = {
  stated: 'direct',
  declared: 'direct',
  observed: 'direct',
  inferred: 'soft',
  agent_inferred: 'soft',
  appended: 'influence_only',
};

export interface TaggedContextField {
  value: string;
  provenance: DataProvenance;
  usage: UsagePermission;
}

export interface MerkuryIdentity {
  /** @deprecated Use merkuryPid instead */
  merkuryId: string;
  /** Merkury Personal ID — individual-level identifier */
  merkuryPid?: string;
  /** Merkury Household ID — household-level identifier (shared across household members) */
  merkuryHid?: string;
  identityTier: IdentityTier;
  confidence: number;
  resolvedAt: string;
}

// ─── 3P: Merkury Appended Data ──────────────────────────────────
export interface AppendedProfile {
  ageRange?: string;
  gender?: string;
  householdIncome?: string;
  hasChildren?: boolean;
  homeOwnership?: 'own' | 'rent' | 'unknown';
  educationLevel?: string;
  interests?: string[];
  lifestyleSignals?: string[];
  geoRegion?: string;
}

// ─── Demo Contact (lightweight CRM record) ─────────────────────
export interface DemoContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  demoProfile: 'Seeded' | 'Merkury' | 'Created';
  merkuryId: string | null;
}

// ─── Purchase Data (Order-level) ────────────────────────────────
export interface OrderLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  isGift?: boolean;
}

export interface OrderRecord {
  orderId: string;
  orderNumber?: string;
  orderDate: string;
  channel: 'online' | 'in-store' | 'mobile-app';
  lineItems: OrderLineItem[];
  totalAmount: number;
  status: 'completed' | 'shipped' | 'returned';
  trackingNumber?: string;
  carrier?: string;
  shippingStatus?: string;
  estimatedDelivery?: string;
  shippedDate?: string;
  deliveredDate?: string;
  paymentMethod?: string;
}

// ─── Summarized Chat Context (Agent-generated) ──────────────────
export interface ChatSummary {
  id?: string;  // Salesforce record ID for delete operations
  sessionDate: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  topicsDiscussed: string[];
}

// ─── Meaningful Events (Agent-captured) ─────────────────────────
export type EventUrgency = 'Immediate' | 'This Week' | 'This Month' | 'Future' | 'No Date';

export interface MeaningfulEvent {
  id?: string;  // Salesforce record ID for delete operations
  eventType: 'preference' | 'milestone' | 'life-event' | 'concern' | 'intent' | 'hydration-goal';
  description: string;
  capturedAt: string;
  agentNote?: string;
  metadata?: Record<string, string>;
  // Temporal fields for journey orchestration
  relativeTimeText?: string;  // Original phrase: "in two weeks", "next month"
  eventDate?: string;         // ISO date calculated from relative time
  urgency?: EventUrgency;     // Calculated urgency bucket
}

// ─── Browse Data ────────────────────────────────────────────────
export interface BrowseSession {
  sessionDate: string;
  categoriesBrowsed: string[];
  productsViewed: string[];   // product IDs
  durationMinutes: number;
  device: 'desktop' | 'mobile' | 'tablet';
  utmCampaign?: string;
  utmSource?: string;
  utmMedium?: string;
}

// ─── 1P Profile Data (Preference Center) ────────────────────────
export interface ProfilePreferences {
  /** Primary hydration use context */
  primaryUse?: 'home' | 'office' | 'fitness' | 'travel' | 'mixed';
  /** Daily intake goal in ounces */
  dailyIntakeGoalOz?: number;
  /** Water type preferences */
  waterPreferences?: ('still' | 'sparkling' | 'flavored' | 'mineral')[];
  /** Preferred delivery frequency */
  deliveryFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'on-demand';
  /** Number of people in household */
  householdSize?: number;
  /** Whether customer currently has a Primo dispenser */
  hasDispenser?: boolean;
  communicationPrefs?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  preferredBrands: string[];
  ageRange?: string;
}

// ─── Loyalty Data (Salesforce Loyalty Management) ───────────────
export interface LoyaltyData {
  tier: 'hydrated' | 'active' | 'elite' | 'champion';
  pointsBalance: number;
  lifetimePoints: number;
  memberSince: string;
  rewardsAvailable: { name: string; pointsCost: number }[];
  tierExpiryDate?: string;
  nextTierThreshold?: number;
}

// ─── Agent-Captured Profile (conversational enrichment) ─────────
// Fields the agent captures naturally through conversation, NOT via forms.
// These persist on the customer record and inform all future interactions.
// Each field tracks when/how it was captured for transparency.
export interface CapturedProfileField<T = string> {
  value: T;
  capturedAt: string;       // ISO date when the agent noted this
  capturedFrom: string;     // e.g. "chat session 2025-12-18", "inferred from order"
  confidence: 'stated' | 'inferred';  // did customer say it directly, or did agent infer it?
}

export interface AgentCapturedProfile {
  // Personal milestones & dates
  birthday?: CapturedProfileField;             // "My birthday is in March"
  anniversary?: CapturedProfileField;          // "Our anniversary is February 14"
  partnerName?: CapturedProfileField;          // "I'm buying for my wife, Elena"

  // Gifting context
  giftsFor?: CapturedProfileField<string[]>;   // ["partner", "coworkers", "family"]
  upcomingOccasions?: CapturedProfileField<string[]>; // ["housewarming", "office event"]

  // Hydration lifestyle
  dailyIntakeGoal?: CapturedProfileField;      // "I'm trying to drink 100oz a day"
  activityLevel?: CapturedProfileField;        // "I run every morning", "mostly sedentary"
  workEnvironment?: CapturedProfileField;      // "I work from home", "large office building"
  climateContext?: CapturedProfileField;       // "It's really hot and dry where I live"
  hydrationChallenges?: CapturedProfileField;  // "I forget to drink water", "tap tastes bad"

  // Water preferences
  flavorsPreferred?: CapturedProfileField;     // "I like citrus flavors", "plain only"
  sparklingPreference?: CapturedProfileField;  // "I love sparkling", "only still water"
  tapWaterQuality?: CapturedProfileField;      // "Our tap water is terrible"

  // Delivery & subscription context
  deliveryPreference?: CapturedProfileField;   // "Weekly would be ideal for our family"
  householdContext?: CapturedProfileField;     // "Family of 5 including 3 kids"
  officeContext?: CapturedProfileField;        // "I manage water for 30 employees"

  // Values & priorities
  sustainabilityGoals?: CapturedProfileField;  // "Trying to cut plastic bottle use"
  budgetContext?: CapturedProfileField;        // "We spend too much on bottled water"
  priceRange?: CapturedProfileField;           // "Open to premium if quality is there"
}

// ─── Legacy compat alias ────────────────────────────────────────
export type HydrationProfile = ProfilePreferences;
/** @deprecated Use HydrationProfile */
export type BeautyProfile = ProfilePreferences;

export interface DeliveryPreferences {
  /** Preferred delivery frequency */
  frequency?: 'weekly' | 'biweekly' | 'monthly' | 'on-demand';
  /** Preferred delivery day */
  preferredDay?: string;
  /** Whether customer wants delivery alerts */
  deliveryAlerts?: boolean;
}

/** @deprecated Use OrderRecord instead */
export interface PurchaseRecord {
  productId: string;
  productName: string;
  purchaseDate: string;
  quantity: number;
  rating?: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'applepay';
  last4?: string;
  brand?: string;
  isDefault: boolean;
}

export interface Address {
  id: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;

  // 1P Profile (preference center)
  hydrationProfile: ProfilePreferences;
  /** @deprecated Use hydrationProfile */
  beautyProfile?: ProfilePreferences;

  // Purchase history (order-level)
  orders: OrderRecord[];
  /** @deprecated Use orders instead */
  purchaseHistory: PurchaseRecord[];

  // Agent-generated context
  chatSummaries: ChatSummary[];
  meaningfulEvents: MeaningfulEvent[];

  // Browse behavior
  browseSessions: BrowseSession[];

  // Loyalty
  loyalty: LoyaltyData | null;
  /** @deprecated Use loyalty?.tier instead */
  loyaltyTier?: 'hydrated' | 'active' | 'elite' | 'champion';
  lifetimeValue?: number;

  // Agent-captured conversational profile
  agentCapturedProfile?: AgentCapturedProfile;

  // Identity
  merkuryIdentity?: MerkuryIdentity;
  appendedProfile?: AppendedProfile;

  // Legacy fields kept for backward compat
  savedPaymentMethods: PaymentMethod[];
  shippingAddresses: Address[];
  deliveryPreferences?: DeliveryPreferences;
  /** @deprecated Use meaningfulEvents / browseSessions instead */
  recentActivity?: RecentActivity[];
}

export interface RecentActivity {
  type: 'purchase' | 'trip' | 'browse' | 'return';
  description: string;
  date: string;
  productIds?: string[];
  metadata?: Record<string, string>;
}

export interface CustomerSessionContext {
  customerId: string;
  name: string;
  email?: string;
  /** Salesforce Contact ID (starts with '003') when available, or email as fallback */
  contactId?: string;
  identityTier: IdentityTier;
  primaryUse?: string;
  waterPreferences?: string[];
  recentPurchases?: string[];
  recentActivity?: string[];
  appendedInterests?: string[];
  loyaltyTier?: string;
  loyaltyPoints?: number;
  chatContext?: string[];
  meaningfulEvents?: string[];
  browseInterests?: string[];
  // Agent-captured conversational profile fields (flattened for the agent)
  capturedProfile?: string[];
  // Fields the agent should try to capture (missing from profile)
  missingProfileFields?: string[];
  // Provenance-tagged context fields for privacy-aware agent prompting
  taggedContext?: TaggedContextField[];
  // Campaign attribution from ad click-through (UTM params)
  campaignContext?: {
    campaignName: string;
    channel: string;
    audienceSegment: string;
    targetingStrategy: string;
    inferredInterests: string[];
  };
}
