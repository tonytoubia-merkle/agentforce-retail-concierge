import type {
  CustomerProfile,
  OrderRecord,
  OrderLineItem,
  ChatSummary,
  MeaningfulEvent,
  BrowseSession,
  LoyaltyData,
  AgentCapturedProfile,
  CapturedProfileField,
  MerkuryIdentity,
  AppendedProfile,
} from '@/types/customer';
import type { DataCloudConfig } from './types';

export class DataCloudCustomerService {
  private config: DataCloudConfig;
  private accessToken: string | null;
  private tokenExpiresAt = 0;

  constructor(config: DataCloudConfig) {
    this.config = config;
    this.accessToken = config.accessToken || null;
  }

  // ─── OAuth Token Management ─────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // If we have a static token and no OAuth credentials, use it
    if (this.accessToken && !this.config.clientId) {
      return this.accessToken;
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      if (this.accessToken) return this.accessToken;
      throw new Error('No Data Cloud access token or OAuth credentials configured');
    }

    const response = await fetch('/api/sf/token', { method: 'POST' });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Data Cloud OAuth failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 7200_000) - 300_000;
    return this.accessToken!;
  }

  private async fetchJson(path: string): Promise<Record<string, unknown>> {
    const token = await this.getAccessToken();
    // Route through proxy to avoid CORS. Strip the /services/data/v60.0 prefix
    // since the proxy rewrites /api/datacloud → /services/data/v60.0
    const proxyPath = path.replace(/^\/services\/data\/v60\.0/, '/api/datacloud');
    const response = await fetch(proxyPath, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Data Cloud request failed (${response.status}): ${response.statusText}`);
    }

    return response.json();
  }

  // ─── SOQL sanitization ──────────────────────────────────────────

  /** Escape a value for safe inclusion in a SOQL WHERE clause single-quoted string. */
  private sanitizeSoql(value: string): string {
    // Remove characters that could break out of SOQL string literals
    return value.replace(/['\\\n\r]/g, '');
  }

  // ─── Profile building (shared) ──────────────────────────────────

  private parseSemicolon(val: string | null | undefined): string[] {
    return val ? val.split(';').map((s: string) => s.trim()).filter(Boolean) : [];
  }

  private buildProfileFromContact(
    raw: Record<string, string | null>,
    contactId: string,
    relatedData: {
      orders: OrderRecord[];
      chatSummaries: ChatSummary[];
      meaningfulEvents: MeaningfulEvent[];
      browseSessions: BrowseSession[];
      loyalty: LoyaltyData | null;
      agentCapturedProfile: AgentCapturedProfile | undefined;
    },
    merkuryIdentity?: CustomerProfile['merkuryIdentity'],
  ): CustomerProfile {
    return {
      id: contactId,
      name: raw.FirstName || 'Guest',
      email: raw.Email || '',
      beautyProfile: {
        skinType: (raw.Skin_Type__c || 'normal').toLowerCase(),
        concerns: this.parseSemicolon(raw.Skin_Concerns__c),
        allergies: this.parseSemicolon(raw.Allergies__c),
        preferredBrands: this.parseSemicolon(raw.Preferred_Brands__c),
        ageRange: '',
      },
      ...relatedData,
      merkuryIdentity,
      appendedProfile: undefined,
      purchaseHistory: [],
      savedPaymentMethods: [],
      shippingAddresses: raw.MailingStreet ? [{
        id: 'primary',
        name: `${raw.FirstName} ${raw.LastName}`,
        line1: raw.MailingStreet,
        city: raw.MailingCity || '',
        state: raw.MailingState || '',
        postalCode: raw.MailingPostalCode || '',
        country: raw.MailingCountry || '',
        isDefault: true,
      }] : [],
      travelPreferences: undefined,
    };
  }

  private async fetchRelatedData(contactId: string) {
    const [orders, chatSummaries, meaningfulEvents, browseSessions, loyalty, agentCapturedProfile] =
      await Promise.all([
        this.getCustomerOrders(contactId).catch(() => [] as OrderRecord[]),
        this.getCustomerChatSummaries(contactId).catch(() => [] as ChatSummary[]),
        this.getCustomerMeaningfulEvents(contactId).catch(() => [] as MeaningfulEvent[]),
        this.getCustomerBrowseSessions(contactId).catch(() => [] as BrowseSession[]),
        this.getCustomerLoyalty(contactId).catch(() => null),
        this.getCustomerCapturedProfile(contactId).catch(() => undefined),
      ]);
    return { orders, chatSummaries, meaningfulEvents, browseSessions, loyalty, agentCapturedProfile };
  }

  private static readonly CONTACT_FIELDS = 'Id,FirstName,LastName,Email,Merkury_Id__c,Skin_Type__c,Skin_Concerns__c,Allergies__c,Preferred_Brands__c,MailingStreet,MailingCity,MailingState,MailingPostalCode,MailingCountry';

  // ─── Full Profile (parallel sub-queries) ────────────────────────

  async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
    const safe = this.sanitizeSoql(customerId);
    const contactData = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+${DataCloudCustomerService.CONTACT_FIELDS}+FROM+Contact+WHERE+Merkury_Id__c='${safe}'+LIMIT+1`
    );

    const records = (contactData.records || []) as Record<string, string | null>[];
    if (records.length === 0) {
      throw new Error(`No Contact found with Merkury_Id__c = ${customerId}`);
    }
    const raw = records[0];
    const contactId = raw.Id!;
    const relatedData = await this.fetchRelatedData(contactId);
    return this.buildProfileFromContact(raw, contactId, relatedData);
  }

  // ─── Lookup by Email ───────────────────────────────────────────

  async getCustomerProfileByEmail(email: string): Promise<CustomerProfile> {
    const safe = this.sanitizeSoql(email);
    const contactData = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+${DataCloudCustomerService.CONTACT_FIELDS}+FROM+Contact+WHERE+Email='${safe}'+LIMIT+1`
    );

    const records = (contactData.records || []) as Record<string, string | null>[];
    if (records.length === 0) {
      throw new Error(`No Contact found with Email = ${email}`);
    }
    const raw = records[0];
    const contactId = raw.Id!;
    const relatedData = await this.fetchRelatedData(contactId);
    return this.buildProfileFromContact(raw, contactId, relatedData);
  }

  // ─── Lookup by Contact ID ──────────────────────────────────────

  async getCustomerProfileById(contactId: string): Promise<CustomerProfile> {
    const safe = this.sanitizeSoql(contactId);
    const contactData = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+${DataCloudCustomerService.CONTACT_FIELDS}+FROM+Contact+WHERE+Id='${safe}'+LIMIT+1`
    );

    const records = (contactData.records || []) as Record<string, string | null>[];
    if (records.length === 0) {
      throw new Error(`No Contact found with Id = ${contactId}`);
    }
    const raw = records[0];
    const relatedData = await this.fetchRelatedData(contactId);
    return this.buildProfileFromContact(raw, contactId, relatedData, raw.Merkury_Id__c ? {
      merkuryId: raw.Merkury_Id__c,
      identityTier: 'known' as const,
      confidence: 1.0,
      resolvedAt: new Date().toISOString(),
    } : undefined);
  }

  // ─── Sub-queries ────────────────────────────────────────────────

  async getCustomerOrders(customerId: string): Promise<OrderRecord[]> {
    const safe = this.sanitizeSoql(customerId);
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Id,OrderNumber,EffectiveDate,Status,TotalAmount,Channel__c,Tracking_Number__c,Carrier__c,Shipping_Status__c,Estimated_Delivery__c,Shipped_Date__c,Delivered_Date__c,Payment_Method__c+FROM+Order+WHERE+AccountId+IN+(SELECT+AccountId+FROM+Contact+WHERE+Id='${safe}')+ORDER+BY+EffectiveDate+DESC+LIMIT+10`
    );

    const orders: OrderRecord[] = [];
    for (const record of (data.records || []) as Record<string, string | number | null>[]) {
      // Fetch line items for this order — OrderId comes from Salesforce so is safe
      let lineItems: OrderLineItem[] = [];
      try {
        const orderId = this.sanitizeSoql(record.Id as string);
        const liData = await this.fetchJson(
          `/services/data/v60.0/query/?q=SELECT+Product2Id,Product2.Name,Quantity,UnitPrice+FROM+OrderItem+WHERE+OrderId='${orderId}'`
        );
        lineItems = ((liData.records || []) as Record<string, unknown>[]).map((li) => ({
          productId: li.Product2Id as string,
          productName: ((li.Product2 as Record<string, string>)?.Name) || '',
          quantity: li.Quantity as number,
          unitPrice: li.UnitPrice as number,
        }));
      } catch {
        // Continue without line items
      }

      orders.push({
        orderId: (record.OrderNumber || record.Id) as string,
        orderNumber: record.OrderNumber as string,
        orderDate: record.EffectiveDate as string,
        channel: (record.Channel__c as string) || 'online',
        lineItems,
        totalAmount: (record.TotalAmount as number) || 0,
        status: record.Status === 'Activated' ? 'completed' : ((record.Status as string)?.toLowerCase() as OrderRecord['status']) || 'completed',
        trackingNumber: (record.Tracking_Number__c as string) || undefined,
        carrier: (record.Carrier__c as string) || undefined,
        shippingStatus: (record.Shipping_Status__c as string) || undefined,
        estimatedDelivery: (record.Estimated_Delivery__c as string) || undefined,
        shippedDate: (record.Shipped_Date__c as string) || undefined,
        deliveredDate: (record.Delivered_Date__c as string) || undefined,
        paymentMethod: (record.Payment_Method__c as string) || undefined,
      });
    }

    return orders;
  }

  async getCustomerChatSummaries(customerId: string): Promise<ChatSummary[]> {
    const safe = this.sanitizeSoql(customerId);
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Id,Session_Date__c,Summary_Text__c,Sentiment__c,Topics_Discussed__c+FROM+Chat_Summary__c+WHERE+Customer_Id__c='${safe}'+ORDER+BY+Session_Date__c+DESC+LIMIT+5`
    );

    return ((data.records || []) as Record<string, string | null>[]).map((r) => ({
      id: r.Id as string,
      sessionDate: r.Session_Date__c as string,
      summary: r.Summary_Text__c as string,
      sentiment: (r.Sentiment__c as ChatSummary['sentiment']) || 'neutral',
      topicsDiscussed: r.Topics_Discussed__c ? r.Topics_Discussed__c.split(';') : [],
    }));
  }

  async getCustomerMeaningfulEvents(customerId: string): Promise<MeaningfulEvent[]> {
    const safe = this.sanitizeSoql(customerId);
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Id,Event_Type__c,Description__c,Captured_At__c,Agent_Note__c,Metadata_JSON__c+FROM+Meaningful_Event__c+WHERE+Customer_Id__c='${safe}'+ORDER+BY+Captured_At__c+DESC`
    );

    return ((data.records || []) as Record<string, string | null>[]).map((r) => ({
      id: r.Id as string,
      eventType: r.Event_Type__c as string,
      description: r.Description__c as string,
      capturedAt: r.Captured_At__c as string,
      agentNote: r.Agent_Note__c as string | undefined,
      metadata: r.Metadata_JSON__c ? JSON.parse(r.Metadata_JSON__c) : undefined,
    }));
  }

  async getCustomerBrowseSessions(customerId: string): Promise<BrowseSession[]> {
    const safe = this.sanitizeSoql(customerId);
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Session_Date__c,Categories_Browsed__c,Products_Viewed__c,Duration_Minutes__c,Device__c+FROM+Browse_Session__c+WHERE+Customer_Id__c='${safe}'+ORDER+BY+Session_Date__c+DESC+LIMIT+5`
    );

    return ((data.records || []) as Record<string, string | number | null>[]).map((r) => ({
      sessionDate: r.Session_Date__c as string,
      categoriesBrowsed: r.Categories_Browsed__c ? (r.Categories_Browsed__c as string).split(';') : [],
      productsViewed: r.Products_Viewed__c ? (r.Products_Viewed__c as string).split(';') : [],
      durationMinutes: (r.Duration_Minutes__c as number) || 0,
      device: (r.Device__c as BrowseSession['device']) || 'desktop',
    }));
  }

  async getCustomerLoyalty(customerId: string): Promise<LoyaltyData | null> {
    const safe = this.sanitizeSoql(customerId);
    const memberData = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Id,MembershipNumber,EnrollmentDate,MemberStatus+FROM+LoyaltyProgramMember+WHERE+ContactId='${safe}'+AND+MemberStatus='Active'+LIMIT+1`
    );

    const memberRecords = (memberData.records || []) as Record<string, string>[];
    if (memberRecords.length === 0) return null;

    const member = memberRecords[0];
    const memberId = this.sanitizeSoql(member.Id);

    const tierRank: Record<string, number> = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
    let tier: LoyaltyData['tier'] = 'bronze';
    try {
      const memberTierData = await this.fetchJson(
        `/services/data/v60.0/query/?q=SELECT+LoyaltyTierId,LoyaltyTier.Name+FROM+LoyaltyMemberTier+WHERE+LoyaltyMemberId='${memberId}'`
      );
      let bestRank = 0;
      for (const mt of ((memberTierData.records || []) as Record<string, unknown>[])) {
        const raw = (mt.LoyaltyTier as Record<string, string>)?.Name;
        if (!raw) continue;
        const name = raw.toLowerCase().replace(' tier', '');
        const rank = tierRank[name] || 0;
        if (rank > bestRank) {
          bestRank = rank;
          tier = name as LoyaltyData['tier'];
        }
      }
    } catch (e) {
      console.warn('[datacloud] Could not fetch tier:', e);
    }

    let pointsBalance = 0;
    let lifetimePoints = 0;
    try {
      const currencyData = await this.fetchJson(
        `/services/data/v60.0/query/?q=SELECT+PointsBalance,TotalPointsAccrued+FROM+LoyaltyMemberCurrency+WHERE+LoyaltyMemberId='${memberId}'`
      );
      for (const c of ((currencyData.records || []) as Record<string, number>[])) {
        const bal = c.PointsBalance || 0;
        const acc = c.TotalPointsAccrued || 0;
        if (bal > pointsBalance) pointsBalance = bal;
        if (acc > lifetimePoints) lifetimePoints = acc;
      }
      if (lifetimePoints === 0 && pointsBalance > 0) lifetimePoints = pointsBalance;
    } catch (e) {
      console.warn('[datacloud] Could not fetch points balance:', e);
    }

    // Demo fallback: Loyalty Management accrual engine hasn't processed
    // points for seeded contacts — use expected values for known demos.
    if (pointsBalance === 0) {
      try {
        const contactData = await this.fetchJson(
          `/services/data/v60.0/query/?q=SELECT+Email+FROM+Contact+WHERE+Id='${safe}'+LIMIT+1`
        );
        const email = ((contactData.records as Record<string, string>[])?.[0])?.Email;
        const demoPoints: Record<string, [number, number]> = {
          'sarah.chen@example.com': [2450, 4800],
          'maya.thompson@example.com': [5200, 12400],
          'aisha.patel@example.com': [980, 1460],
        };
        if (email && demoPoints[email]) {
          [pointsBalance, lifetimePoints] = demoPoints[email];
        }
      } catch { /* best-effort */ }
    }

    return {
      tier,
      pointsBalance,
      lifetimePoints,
      memberSince: member.EnrollmentDate,
      tierExpiryDate: undefined,
      rewardsAvailable: [],
    };
  }

  async getCustomerCapturedProfile(customerId: string): Promise<AgentCapturedProfile | undefined> {
    const safe = this.sanitizeSoql(customerId);
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Field_Name__c,Field_Value__c,Captured_At__c,Captured_From__c,Confidence__c,Data_Type__c+FROM+Agent_Captured_Profile__c+WHERE+Customer_Id__c='${safe}'`
    );

    const records = (data.records || []) as Record<string, string>[];
    if (records.length === 0) return undefined;

    const profile: AgentCapturedProfile = {};
    for (const r of records) {
      const fieldName = r.Field_Name__c as keyof AgentCapturedProfile;
      let value: string | string[] = r.Field_Value__c;

      if (r.Data_Type__c === 'array' && typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.split(',').map((s: string) => s.trim());
        }
      }

      const field: CapturedProfileField = {
        value,
        capturedAt: r.Captured_At__c,
        capturedFrom: r.Captured_From__c,
        confidence: r.Confidence__c,
      };

      (profile as Record<string, CapturedProfileField>)[fieldName] = field;
    }

    return profile;
  }
}

let dataCloudService: DataCloudCustomerService | null = null;

export const getDataCloudService = (): DataCloudCustomerService => {
  if (!dataCloudService) {
    dataCloudService = new DataCloudCustomerService({
      baseUrl: import.meta.env.VITE_DATACLOUD_BASE_URL || import.meta.env.VITE_AGENTFORCE_INSTANCE_URL || '',
      accessToken: import.meta.env.VITE_DATACLOUD_ACCESS_TOKEN || '',
    });
  }
  return dataCloudService;
};
