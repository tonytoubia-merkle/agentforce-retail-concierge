import type { BrowseSession, ChatSummary, MeaningfulEvent, CapturedProfileField, ProfilePreferences } from '@/types/customer';
import type { DataCloudConfig } from './types';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

/** User-editable beauty preferences for the preference center */
export interface BeautyPreferencesUpdate {
  skinType?: ProfilePreferences['skinType'];
  concerns?: string[];
  allergies?: string[];
}

/** Communication preferences */
export interface CommunicationPreferencesUpdate {
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  pushOptIn?: boolean;
}

export class DataCloudWriteService {
  private config: DataCloudConfig;
  private accessToken: string | null;
  private tokenExpiresAt = 0;

  constructor(config: DataCloudConfig) {
    this.config = config;
    this.accessToken = config.accessToken || null;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

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
      throw new Error(`Data Cloud OAuth failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 7200_000) - 300_000;
    return this.accessToken!;
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<void> {
    const token = await this.getAccessToken();
    // Route through proxy to avoid CORS
    const proxyPath = path.replace(/^\/services\/data\/v60\.0/, '/api/datacloud');
    const response = await fetch(proxyPath, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Data Cloud write failed (${response.status}): ${errText}`);
    }
  }

  private async patchJson(path: string, body: Record<string, unknown>): Promise<void> {
    const token = await this.getAccessToken();
    // Route through proxy to avoid CORS
    const proxyPath = path.replace(/^\/services\/data\/v60\.0/, '/api/datacloud');
    const response = await fetch(proxyPath, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Data Cloud patch failed (${response.status}): ${errText}`);
    }
  }

  /**
   * Delete multiple Salesforce records by ID. Uses individual DELETE calls
   * since the Salesforce REST API doesn't support batch delete on sobjects.
   */
  async deleteRecords(sobjectType: string, recordIds: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    if (useMockData) {
      console.log(`[mock] Would delete ${recordIds.length} ${sobjectType} records`);
      return { deleted: recordIds, failed: [] };
    }

    const token = await this.getAccessToken();
    const deleted: string[] = [];
    const failed: string[] = [];

    await Promise.all(recordIds.map(async (id) => {
      try {
        const response = await fetch(`/api/sf-record/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sobject: sobjectType, token }),
        });
        if (response.ok || response.status === 204) {
          deleted.push(id);
        } else {
          console.error(`[datacloud] Failed to delete ${sobjectType}/${id}: ${response.status}`);
          failed.push(id);
        }
      } catch (err) {
        console.error(`[datacloud] Delete error for ${sobjectType}/${id}:`, err);
        failed.push(id);
      }
    }));

    return { deleted, failed };
  }

  async writeChatSummary(
    customerId: string,
    sessionId: string,
    summary: ChatSummary,
  ): Promise<void> {
    if (useMockData) {
      console.log('[mock] Would write chat summary:', summary.summary);
      return;
    }

    await this.postJson('/services/data/v60.0/sobjects/Chat_Summary__c', {
      Customer_Id__c: customerId,
      Session_Id__c: sessionId,
      Session_Date__c: summary.sessionDate,
      Summary_Text__c: summary.summary,
      Sentiment__c: summary.sentiment,
      Topics_Discussed__c: summary.topicsDiscussed.join(';'),
    });
  }

  async writeMeaningfulEvent(
    customerId: string,
    sessionId: string,
    event: MeaningfulEvent,
  ): Promise<void> {
    if (useMockData) {
      console.log('[mock] Would write meaningful event:', event.description, event.eventDate ? `(${event.eventDate})` : '');
      return;
    }

    // Build the record with optional temporal fields
    const record: Record<string, unknown> = {
      Customer_Id__c: customerId,
      Session_Id__c: sessionId,
      Event_Type__c: event.eventType,
      Description__c: event.description,
      Captured_At__c: event.capturedAt,
      Agent_Note__c: event.agentNote || '',
      Metadata_JSON__c: event.metadata ? JSON.stringify(event.metadata) : null,
    };

    // Add temporal fields for journey orchestration
    if (event.relativeTimeText) {
      record.Relative_Time_Text__c = event.relativeTimeText;
    }
    if (event.eventDate) {
      record.Event_Date__c = event.eventDate;
    }
    if (event.urgency) {
      record.Urgency__c = event.urgency;
    }

    await this.postJson('/services/data/v60.0/sobjects/Meaningful_Event__c', record);
  }

  async writeBrowseSession(
    customerId: string,
    session: BrowseSession,
  ): Promise<void> {
    if (useMockData) {
      console.log('[mock] Would write browse session:', {
        categories: session.categoriesBrowsed,
        products: session.productsViewed,
        duration: session.durationMinutes,
      });
      return;
    }

    await this.postJson('/services/data/v60.0/sobjects/Browse_Session__c', {
      Customer_Id__c: customerId,
      Session_Date__c: session.sessionDate,
      Categories_Browsed__c: session.categoriesBrowsed.join(';'),
      Products_Viewed__c: session.productsViewed.join(';'),
      Duration_Minutes__c: session.durationMinutes,
      Device__c: session.device,
    });
  }

  async writeCapturedProfileField(
    customerId: string,
    sessionId: string,
    fieldName: string,
    field: CapturedProfileField,
  ): Promise<void> {
    if (useMockData) {
      console.log('[mock] Would write profile field:', fieldName, '=', field.value);
      return;
    }

    const dataType = Array.isArray(field.value) ? 'array' : 'string';
    const fieldValue = dataType === 'array' ? JSON.stringify(field.value) : String(field.value);

    await this.postJson('/services/data/v60.0/sobjects/Agent_Captured_Profile__c', {
      Customer_Id__c: customerId,
      Field_Name__c: fieldName,
      Field_Value__c: fieldValue,
      Captured_At__c: field.capturedAt,
      Captured_From__c: field.capturedFrom || `chat session ${sessionId}`,
      Confidence__c: field.confidence,
      Data_Type__c: dataType,
    });
  }

  /**
   * Update Contact beauty preferences (user-editable fields in preference center).
   * Maps to Contact custom fields in Salesforce.
   *
   * @param contactId - Salesforce Contact ID (starts with 003)
   * @param preferences - Beauty preferences to update
   */
  async updateBeautyPreferences(
    contactId: string,
    preferences: BeautyPreferencesUpdate,
  ): Promise<void> {
    if (useMockData) {
      console.log('[mock] Would update beauty preferences for', contactId, ':', preferences);
      return;
    }

    // Map skinType values to Salesforce picklist format (capitalize first letter)
    const skinTypeMap: Record<string, string> = {
      dry: 'Dry',
      oily: 'Oily',
      combination: 'Combination',
      sensitive: 'Sensitive',
      normal: 'Normal',
    };

    const record: Record<string, unknown> = {};

    if (preferences.skinType) {
      record.Skin_Type__c = skinTypeMap[preferences.skinType] || preferences.skinType;
    }
    if (preferences.concerns !== undefined) {
      record.Skin_Concerns__c = preferences.concerns.join(';');
    }
    if (preferences.allergies !== undefined) {
      record.Allergies__c = preferences.allergies.join(';');
    }

    if (Object.keys(record).length === 0) return;

    await this.patchJson(`/services/data/v60.0/sobjects/Contact/${contactId}`, record);
    console.log('[datacloud] Updated beauty preferences for', contactId);
  }

  /**
   * Update Contact communication preferences.
   * Maps to Contact opt-in checkbox fields in Salesforce.
   *
   * @param contactId - Salesforce Contact ID (starts with 003)
   * @param preferences - Communication opt-in preferences
   */
  async updateCommunicationPreferences(
    contactId: string,
    preferences: CommunicationPreferencesUpdate,
  ): Promise<void> {
    if (useMockData) {
      console.log('[mock] Would update communication preferences for', contactId, ':', preferences);
      return;
    }

    const record: Record<string, unknown> = {};

    if (preferences.emailOptIn !== undefined) {
      record.Email_Opt_In__c = preferences.emailOptIn;
    }
    if (preferences.smsOptIn !== undefined) {
      record.SMS_Opt_In__c = preferences.smsOptIn;
    }
    if (preferences.pushOptIn !== undefined) {
      record.Push_Opt_In__c = preferences.pushOptIn;
    }

    if (Object.keys(record).length === 0) return;

    await this.patchJson(`/services/data/v60.0/sobjects/Contact/${contactId}`, record);
    console.log('[datacloud] Updated communication preferences for', contactId);
  }
}

let writeService: DataCloudWriteService | null = null;

export const getDataCloudWriteService = (): DataCloudWriteService => {
  if (!writeService) {
    writeService = new DataCloudWriteService({
      baseUrl: import.meta.env.VITE_DATACLOUD_BASE_URL || '',
      accessToken: import.meta.env.VITE_DATACLOUD_ACCESS_TOKEN || '',
      clientId: import.meta.env.VITE_DATACLOUD_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_DATACLOUD_CLIENT_SECRET || '',
    });
  }
  return writeService;
};
