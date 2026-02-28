import type { AgentResponse, UIAction, UIDirective } from '@/types/agent';
import type { AgentforceConfig } from './types';
import type { CustomerSessionContext } from '@/types/customer';
import { parseUIDirective } from './parseDirectives';

export class AgentforceClient {
  private config: AgentforceConfig;
  private sessionId: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private sequenceId = 0;

  constructor(config: AgentforceConfig) {
    this.config = config;
    this.accessToken = config.accessToken || null;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      if (this.accessToken) return this.accessToken;
      throw new Error('No access token or client credentials configured');
    }

    // Always use proxy to avoid CORS — works in both dev and production (Vercel)
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
      throw new Error(`OAuth token request failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Expire 5 minutes early to avoid edge cases
    this.tokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 7200_000) - 300_000;
    return this.accessToken!;
  }

  async initSession(customerContext?: CustomerSessionContext): Promise<string> {
    const token = await this.getAccessToken();
    this.sequenceId = 0;

    const url = `${this.config.baseUrl}/agents/${this.config.agentId}/sessions`;

    const sessionBody: Record<string, unknown> = {
      externalSessionKey: customerContext?.customerId || crypto.randomUUID(),
      instanceConfig: { endpoint: this.config.instanceUrl },
      streamingCapabilities: { chunkTypes: ['Text'] },
      bypassUser: true,
    };

    // Pass customer context as session variables so the agent knows who it's talking to
    // Agentforce API requires { name, value, type } for each variable
    if (customerContext) {
      const toStr = (v: unknown): string =>
        Array.isArray(v) ? v.join('; ') : String(v ?? '');

      sessionBody.variables = [
        { name: 'customerId', type: 'Text', value: toStr(customerContext.customerId) },
        { name: 'customerEmail', type: 'Text', value: toStr(customerContext.email) },
        { name: 'sessionId', type: 'Text', value: toStr(customerContext.customerId) }, // placeholder; Agentforce may also use its internal session ID
        { name: 'customerName', type: 'Text', value: toStr(customerContext.name) },
        { name: 'identityTier', type: 'Text', value: toStr(customerContext.identityTier || 'anonymous') },
        { name: 'skinType', type: 'Text', value: toStr(customerContext.skinType) },
        { name: 'concerns', type: 'Text', value: toStr(customerContext.concerns) },
        { name: 'recentPurchases', type: 'Text', value: toStr(customerContext.recentPurchases) },
        { name: 'recentActivity', type: 'Text', value: toStr(customerContext.recentActivity) },
        { name: 'appendedInterests', type: 'Text', value: toStr(customerContext.appendedInterests) },
        { name: 'loyaltyTier', type: 'Text', value: toStr(customerContext.loyaltyTier) },
        { name: 'loyaltyPoints', type: 'Text', value: toStr(customerContext.loyaltyPoints) },
        { name: 'chatContext', type: 'Text', value: toStr(customerContext.chatContext) },
        { name: 'meaningfulEvents', type: 'Text', value: toStr(customerContext.meaningfulEvents) },
        { name: 'browseInterests', type: 'Text', value: toStr(customerContext.browseInterests) },
        { name: 'capturedProfile', type: 'Text', value: toStr(customerContext.capturedProfile) },
        { name: 'missingProfileFields', type: 'Text', value: toStr(customerContext.missingProfileFields) },
      ].filter(v => v.value !== '');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Session creation failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    this.sessionId = data.sessionId;
    return this.sessionId!;
  }

  async sendMessage(message: string): Promise<AgentResponse> {
    if (!this.sessionId) {
      throw new Error('Session not initialized. Call initSession() first.');
    }

    const token = await this.getAccessToken();
    this.sequenceId++;

    const response = await fetch(
      `${this.config.baseUrl}/sessions/${this.sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            sequenceId: this.sequenceId,
            type: 'Text',
            text: message,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Send message failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log('[agentforce] response keys:', Object.keys(data), 'messages count:', (data.messages || data.responseMessages || []).length);

    // The API may return messages in different shapes depending on version
    const rawMessages: unknown[] = data.messages || data.responseMessages || [];
    const agentMessages = rawMessages.map((m: unknown) => {
      const msg = m as Record<string, unknown>;
      return {
        type: (msg.type as string) || '',
        message: (msg.message as string) || (msg.text as string) || (msg.content as string) || '',
      };
    });

    // Some API versions return a flat text field instead of messages array
    if (agentMessages.length === 0 && (data.text || data.response)) {
      const flat = (data.text || data.response) as string;
      if (typeof flat === 'string' && flat.trim()) {
        agentMessages.push({ type: 'Text', message: flat });
      }
    }

    // Concatenate all message chunks (agent may split long responses across multiple messages)
    const fullText = agentMessages.map((m) => m.message).join('');

    console.log('[agentforce] raw text:', fullText.substring(0, 500));

    // Try to parse the combined text as a directive
    let uiDirective: ReturnType<typeof parseUIDirective> = undefined;
    const directive = parseUIDirective({ message: fullText, rawText: fullText });
    if (directive) {
      console.log('[agentforce] parsed directive:', directive.action, JSON.stringify(directive.payload).substring(0, 300));
      uiDirective = directive;
    }

    // If no directive found, collect individual messages as display text
    const textParts: string[] = [];
    if (!uiDirective) {
      for (const msg of agentMessages) {
        const text = msg.message || '';
        // Try each message individually as a directive (in case only one chunk is JSON)
        const d = parseUIDirective({ message: text, rawText: text });
        if (d) {
          uiDirective = d;
        } else if (text) {
          textParts.push(text);
        }
      }
    } else {
      // Directive was found in the combined text. Extract any prose text
      // that appeared before/after the JSON block as the display message.
      const jsonStart = fullText.indexOf('{');
      const jsonEnd = fullText.lastIndexOf('}');
      if (jsonStart > 0) {
        const before = fullText.slice(0, jsonStart).trim();
        if (before) textParts.push(before);
      }
      if (jsonEnd >= 0 && jsonEnd < fullText.length - 1) {
        const after = fullText.slice(jsonEnd + 1).trim();
        if (after) textParts.push(after);
      }
    }

    // Strip any text parts that look like raw JSON (failed parse but still JSON-like)
    const cleanTextParts = textParts.filter((t) => {
      const trimmed = t.trim();
      return !(trimmed.startsWith('{') && trimmed.endsWith('}'));
    });

    // If we found a directive but no separate text, generate a friendly message from the directive
    let displayMessage = cleanTextParts.join('\n');
    // Check for a message embedded in the directive payload itself
    if (!displayMessage && uiDirective) {
      const payloadMsg = (uiDirective.payload as Record<string, unknown>)?.message as string | undefined;
      if (payloadMsg) {
        displayMessage = payloadMsg;
      }
    }
    if (!displayMessage && uiDirective) {
      const products = uiDirective.payload?.products;
      if (products && products.length > 0) {
        const names = products.slice(0, 3).map(p => p.name).join(', ');
        displayMessage = products.length === 1
          ? `I'd recommend the ${products[0].name} — ${products[0].description || 'a great choice for you.'}`
          : `Here are ${products.length} products I've curated for you, including ${names}.`;
      } else if (uiDirective.action === 'CHANGE_SCENE') {
        displayMessage = 'Let me set the scene for you.';
      } else if (uiDirective.action === 'WELCOME_SCENE') {
        const parts = [uiDirective.payload?.welcomeMessage || 'Welcome!'];
        if (uiDirective.payload?.welcomeSubtext) parts.push(uiDirective.payload.welcomeSubtext);
        displayMessage = parts.join(' ');
      } else if (uiDirective.action === 'INITIATE_CHECKOUT') {
        displayMessage = 'Let me start the checkout process.';
      } else if (uiDirective.action === 'IDENTIFY_CUSTOMER') {
        displayMessage = "Great, I've saved your profile! Now I can give you more personalized recommendations.";
      } else if (uiDirective.action === 'CAPTURE_ONLY') {
        // Captures-only directive — agent prose was already extracted as displayMessage above.
        // If somehow empty, use a generic fallback.
        displayMessage = 'How can I help you further?';
      } else {
        displayMessage = "Here's what I found for you.";
      }
    }

    // ─── Client-side event capture detection ─────────────────────
    // The agent sometimes describes event captures as text instead of
    // invoking the server-side action. Detect and surface as toast notifications.
    const captureRegex = /\((?:Event [Cc]aptured|event captured|Captured|captured):\s*(.+?)\)/g;
    const detectedCaptures: Array<{ type: 'meaningful_event'; label: string }> = [];
    let captureMatch;
    while ((captureMatch = captureRegex.exec(displayMessage)) !== null) {
      detectedCaptures.push({ type: 'meaningful_event', label: `Event Captured: ${captureMatch[1]}` });
    }
    if (detectedCaptures.length > 0) {
      console.log('[agentforce] Detected event captures from text:', detectedCaptures);
      // Inject into directive so ConversationContext shows toasts
      if (uiDirective) {
        const existing = (uiDirective.payload as Record<string, unknown>)?.captures as unknown[] || [];
        (uiDirective.payload as Record<string, unknown>).captures = [...existing, ...detectedCaptures];
      } else {
        // Create a minimal CAPTURE_ONLY directive to carry the captures
        uiDirective = {
          action: 'CAPTURE_ONLY' as UIAction,
          payload: { captures: detectedCaptures } as unknown as UIDirective['payload'],
        };
      }
    }

    // ─── Strip meta-text noise from displayed message ───────────
    // Agent sometimes adds parenthetical meta-notes not meant for the customer
    displayMessage = displayMessage
      .replace(/\((?:Event [Cc]aptured|event captured|Captured|captured):\s*.+?\)/g, '')
      .replace(/\(uiDirective\s+forthcoming[^)]*\)/gi, '')
      .replace(/\(Note:?\s*[^)]*\)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Warn when agent mentions products but no directive was parsed
    if (!uiDirective && displayMessage) {
      const lower = displayMessage.toLowerCase();
      if (lower.includes('recommend') || lower.includes('here are') || lower.includes('product')) {
        console.warn('[agentforce] Agent mentioned products but no uiDirective was parsed. The agent may not be returning the JSON directive block. Full text:', fullText.substring(0, 500));
      }
    }

    // Final safety net: never return a completely blank response
    if (!displayMessage && !uiDirective) {
      console.warn('[agentforce] Empty response. Full data:', JSON.stringify(data).substring(0, 1000));
      displayMessage = "I'm processing your request. Could you try asking again?";
    }

    return {
      sessionId: this.sessionId,
      message: displayMessage,
      uiDirective,
      suggestedActions: data.suggestedActions?.length
        ? data.suggestedActions
        : (uiDirective?.payload as Record<string, unknown>)?.suggestedActions as string[] || [],
      confidence: data.confidence || 1,
    };
  }

  /** Snapshot current session state for later restoration. */
  getSessionSnapshot(): { sessionId: string | null; sequenceId: number } {
    return { sessionId: this.sessionId, sequenceId: this.sequenceId };
  }

  /** Restore a previously snapshotted session (no API call — session persists server-side). */
  restoreSession(sessionId: string, sequenceId: number): void {
    this.sessionId = sessionId;
    this.sequenceId = sequenceId;
  }

  async endSession(): Promise<void> {
    if (this.sessionId) {
      const token = await this.getAccessToken();
      await fetch(`${this.config.baseUrl}/sessions/${this.sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      this.sessionId = null;
    }
  }
}

let agentforceClient: AgentforceClient | null = null;

export const getAgentforceClient = (): AgentforceClient => {
  if (!agentforceClient) {
    agentforceClient = new AgentforceClient({
      baseUrl: '/api/agentforce',
      agentId: import.meta.env.VITE_AGENTFORCE_AGENT_ID || '',
      clientId: import.meta.env.VITE_AGENTFORCE_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_AGENTFORCE_CLIENT_SECRET || '',
      instanceUrl: import.meta.env.VITE_AGENTFORCE_INSTANCE_URL || '',
    });
  }
  return agentforceClient;
};
