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

    const tokenUrl = '/api/oauth/token';
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Data Cloud OAuth failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 7200_000) - 300_000;
    return this.accessToken!;
  }

  private async fetchJson(path: string): Promise<any> {
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

  // ─── Full Profile (parallel sub-queries) ────────────────────────

  async getCustomerProfile(customerId: string): Promise<CustomerProfile> {
    // Look up Contact by Merkury_Id__c via SOQL
    const contactData = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Id,FirstName,LastName,Email,Merkury_Id__c,Skin_Type__c,Skin_Concerns__c,Allergies__c,Preferred_Brands__c,MailingStreet,MailingCity,MailingState,MailingPostalCode,MailingCountry+FROM+Contact+WHERE+Merkury_Id__c='${customerId}'+LIMIT+1`
    );

    const records = contactData.records || [];
    if (records.length === 0) {
      throw new Error(`No Contact found with Merkury_Id__c = ${customerId}`);
    }
    const raw = records[0];
    const contactId = raw.Id;

    const parseSemicolon = (val: string | null | undefined): string[] =>
      val ? val.split(';').map((s: string) => s.trim()).filter(Boolean) : [];

    // Fetch all related data in parallel using the Contact Id
    const [orders, chatSummaries, meaningfulEvents, browseSessions, loyalty, agentCapturedProfile] =
      await Promise.all([
        this.getCustomerOrders(contactId).catch(() => [] as OrderRecord[]),
        this.getCustomerChatSummaries(contactId).catch(() => [] as ChatSummary[]),
        this.getCustomerMeaningfulEvents(contactId).catch(() => [] as MeaningfulEvent[]),
        this.getCustomerBrowseSessions(contactId).catch(() => [] as BrowseSession[]),
        this.getCustomerLoyalty(contactId).catch(() => null),
        this.getCustomerCapturedProfile(contactId).catch(() => undefined),
      ]);

    return {
      id: contactId,
      name: raw.FirstName || 'Guest',
      email: raw.Email || '',
      beautyProfile: {
        skinType: (raw.Skin_Type__c || 'normal').toLowerCase(),
        concerns: parseSemicolon(raw.Skin_Concerns__c),
        allergies: parseSemicolon(raw.Allergies__c),
        preferredBrands: parseSemicolon(raw.Preferred_Brands__c),
        ageRange: '',
      },
      orders,
      chatSummaries,
      meaningfulEvents,
      browseSessions,
      loyalty,
      agentCapturedProfile,
      merkuryIdentity: undefined,
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

  // ─── Lookup by Email ───────────────────────────────────────────

  async getCustomerProfileByEmail(email: string): Promise<CustomerProfile> {
    const contactData = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Id,FirstName,LastName,Email,Merkury_Id__c,Skin_Type__c,Skin_Concerns__c,Allergies__c,Preferred_Brands__c,MailingStreet,MailingCity,MailingState,MailingPostalCode,MailingCountry+FROM+Contact+WHERE+Email='${encodeURIComponent(email)}'+LIMIT+1`
    );

    const records = contactData.records || [];
    if (records.length === 0) {
      throw new Error(`No Contact found with Email = ${email}`);
    }
    const raw = records[0];
    const contactId = raw.Id;

    const parseSemicolon = (val: string | null | undefined): string[] =>
      val ? val.split(';').map((s: string) => s.trim()).filter(Boolean) : [];

    const [orders, chatSummaries, meaningfulEvents, browseSessions, loyalty, agentCapturedProfile] =
      await Promise.all([
        this.getCustomerOrders(contactId).catch(() => [] as OrderRecord[]),
        this.getCustomerChatSummaries(contactId).catch(() => [] as ChatSummary[]),
        this.getCustomerMeaningfulEvents(contactId).catch(() => [] as MeaningfulEvent[]),
        this.getCustomerBrowseSessions(contactId).catch(() => [] as BrowseSession[]),
        this.getCustomerLoyalty(contactId).catch(() => null),
        this.getCustomerCapturedProfile(contactId).catch(() => undefined),
      ]);

    return {
      id: contactId,
      name: raw.FirstName || 'Guest',
      email: raw.Email || '',
      beautyProfile: {
        skinType: (raw.Skin_Type__c || 'normal').toLowerCase(),
        concerns: parseSemicolon(raw.Skin_Concerns__c),
        allergies: parseSemicolon(raw.Allergies__c),
        preferredBrands: parseSemicolon(raw.Preferred_Brands__c),
        ageRange: '',
      },
      orders,
      chatSummaries,
      meaningfulEvents,
      browseSessions,
      loyalty,
      agentCapturedProfile,
      merkuryIdentity: undefined,
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

  // ─── Lookup by Contact ID ──────────────────────────────────────

  async getCustomerProfileById(contactId: string): Promise<CustomerProfile> {
    const contactData = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Id,FirstName,LastName,Email,Merkury_Id__c,Skin_Type__c,Skin_Concerns__c,Allergies__c,Preferred_Brands__c,MailingStreet,MailingCity,MailingState,MailingPostalCode,MailingCountry+FROM+Contact+WHERE+Id='${contactId}'+LIMIT+1`
    );

    const records = contactData.records || [];
    if (records.length === 0) {
      throw new Error(`No Contact found with Id = ${contactId}`);
    }
    const raw = records[0];

    const parseSemicolon = (val: string | null | undefined): string[] =>
      val ? val.split(';').map((s: string) => s.trim()).filter(Boolean) : [];

    const [orders, chatSummaries, meaningfulEvents, browseSessions, loyalty, agentCapturedProfile] =
      await Promise.all([
        this.getCustomerOrders(contactId).catch(() => [] as OrderRecord[]),
        this.getCustomerChatSummaries(contactId).catch(() => [] as ChatSummary[]),
        this.getCustomerMeaningfulEvents(contactId).catch(() => [] as MeaningfulEvent[]),
        this.getCustomerBrowseSessions(contactId).catch(() => [] as BrowseSession[]),
        this.getCustomerLoyalty(contactId).catch(() => null),
        this.getCustomerCapturedProfile(contactId).catch(() => undefined),
      ]);

    return {
      id: contactId,
      name: raw.FirstName || 'Guest',
      email: raw.Email || '',
      beautyProfile: {
        skinType: (raw.Skin_Type__c || 'normal').toLowerCase(),
        concerns: parseSemicolon(raw.Skin_Concerns__c),
        allergies: parseSemicolon(raw.Allergies__c),
        preferredBrands: parseSemicolon(raw.Preferred_Brands__c),
        ageRange: '',
      },
      orders,
      chatSummaries,
      meaningfulEvents,
      browseSessions,
      loyalty,
      agentCapturedProfile,
      merkuryIdentity: raw.Merkury_Id__c ? {
        merkuryId: raw.Merkury_Id__c,
        identityTier: 'known' as const,
        confidence: 1.0,
        resolvedAt: new Date().toISOString(),
      } : undefined,
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

  // ─── Sub-queries ────────────────────────────────────────────────

  async getCustomerOrders(customerId: string): Promise<OrderRecord[]> {
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Id,OrderNumber,EffectiveDate,Status,TotalAmount,Channel__c,Tracking_Number__c,Carrier__c,Shipping_Status__c,Estimated_Delivery__c,Shipped_Date__c,Delivered_Date__c,Payment_Method__c+FROM+Order+WHERE+AccountId+IN+(SELECT+AccountId+FROM+Contact+WHERE+Id='${customerId}')+ORDER+BY+EffectiveDate+DESC+LIMIT+10`
    );

    const orders: OrderRecord[] = [];
    for (const record of data.records || []) {
      // Fetch line items for this order
      let lineItems: OrderLineItem[] = [];
      try {
        const liData = await this.fetchJson(
          `/services/data/v60.0/query/?q=SELECT+Product2Id,Product2.Name,Quantity,UnitPrice+FROM+OrderItem+WHERE+OrderId='${record.Id}'`
        );
        lineItems = (liData.records || []).map((li: any) => ({
          productId: li.Product2Id,
          productName: li.Product2?.Name || '',
          quantity: li.Quantity,
          unitPrice: li.UnitPrice,
        }));
      } catch {
        // Continue without line items
      }

      orders.push({
        orderId: record.OrderNumber || record.Id,
        orderNumber: record.OrderNumber,
        orderDate: record.EffectiveDate,
        channel: record.Channel__c || 'online',
        lineItems,
        totalAmount: record.TotalAmount || 0,
        status: record.Status === 'Activated' ? 'completed' : (record.Status?.toLowerCase() as any) || 'completed',
        trackingNumber: record.Tracking_Number__c || undefined,
        carrier: record.Carrier__c || undefined,
        shippingStatus: record.Shipping_Status__c || undefined,
        estimatedDelivery: record.Estimated_Delivery__c || undefined,
        shippedDate: record.Shipped_Date__c || undefined,
        deliveredDate: record.Delivered_Date__c || undefined,
        paymentMethod: record.Payment_Method__c || undefined,
      });
    }

    return orders;
  }

  async getCustomerChatSummaries(customerId: string): Promise<ChatSummary[]> {
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Session_Date__c,Summary_Text__c,Sentiment__c,Topics_Discussed__c+FROM+Chat_Summary__c+WHERE+Customer_Id__c='${customerId}'+ORDER+BY+Session_Date__c+DESC+LIMIT+5`
    );

    return (data.records || []).map((r: any) => ({
      sessionDate: r.Session_Date__c,
      summary: r.Summary_Text__c,
      sentiment: r.Sentiment__c || 'neutral',
      topicsDiscussed: r.Topics_Discussed__c ? r.Topics_Discussed__c.split(';') : [],
    }));
  }

  async getCustomerMeaningfulEvents(customerId: string): Promise<MeaningfulEvent[]> {
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Event_Type__c,Description__c,Captured_At__c,Agent_Note__c,Metadata_JSON__c+FROM+Meaningful_Event__c+WHERE+Customer_Id__c='${customerId}'+ORDER+BY+Captured_At__c+DESC`
    );

    return (data.records || []).map((r: any) => ({
      eventType: r.Event_Type__c,
      description: r.Description__c,
      capturedAt: r.Captured_At__c,
      agentNote: r.Agent_Note__c,
      metadata: r.Metadata_JSON__c ? JSON.parse(r.Metadata_JSON__c) : undefined,
    }));
  }

  async getCustomerBrowseSessions(customerId: string): Promise<BrowseSession[]> {
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Session_Date__c,Categories_Browsed__c,Products_Viewed__c,Duration_Minutes__c,Device__c+FROM+Browse_Session__c+WHERE+Customer_Id__c='${customerId}'+ORDER+BY+Session_Date__c+DESC+LIMIT+5`
    );

    return (data.records || []).map((r: any) => ({
      sessionDate: r.Session_Date__c,
      categoriesBrowsed: r.Categories_Browsed__c ? r.Categories_Browsed__c.split(';') : [],
      productsViewed: r.Products_Viewed__c ? r.Products_Viewed__c.split(';') : [],
      durationMinutes: r.Duration_Minutes__c || 0,
      device: r.Device__c || 'desktop',
    }));
  }

  async getCustomerLoyalty(customerId: string): Promise<LoyaltyData | null> {
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+MembershipNumber,TierName,TotalPointsAccrued,TotalPointsRedeemed,EnrollmentDate,TierExpirationDate+FROM+LoyaltyProgramMember+WHERE+ContactId='${customerId}'+LIMIT+1`
    );

    const records = data.records || [];
    if (records.length === 0) return null;

    const member = records[0];
    const balance = (member.TotalPointsAccrued || 0) - (member.TotalPointsRedeemed || 0);

    return {
      tier: (member.TierName || 'bronze').toLowerCase() as LoyaltyData['tier'],
      pointsBalance: balance,
      lifetimePoints: member.TotalPointsAccrued || 0,
      memberSince: member.EnrollmentDate,
      tierExpiryDate: member.TierExpirationDate,
      rewardsAvailable: [],
    };
  }

  async getCustomerCapturedProfile(customerId: string): Promise<AgentCapturedProfile | undefined> {
    const data = await this.fetchJson(
      `/services/data/v60.0/query/?q=SELECT+Field_Name__c,Field_Value__c,Captured_At__c,Captured_From__c,Confidence__c,Data_Type__c+FROM+Agent_Captured_Profile__c+WHERE+Customer_Id__c='${customerId}'`
    );

    const records = data.records || [];
    if (records.length === 0) return undefined;

    const profile: AgentCapturedProfile = {};
    for (const r of records) {
      const fieldName = r.Field_Name__c as keyof AgentCapturedProfile;
      let value: any = r.Field_Value__c;

      if (r.Data_Type__c === 'array' && typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.split(',').map((s: string) => s.trim());
        }
      }

      const field: CapturedProfileField<any> = {
        value,
        capturedAt: r.Captured_At__c,
        capturedFrom: r.Captured_From__c,
        confidence: r.Confidence__c,
      };

      (profile as any)[fieldName] = field;
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
      clientId: import.meta.env.VITE_DATACLOUD_CLIENT_ID || import.meta.env.VITE_AGENTFORCE_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_DATACLOUD_CLIENT_SECRET || import.meta.env.VITE_AGENTFORCE_CLIENT_SECRET || '',
    });
  }
  return dataCloudService;
};
