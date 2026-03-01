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

    // DO NOT pass session variables — the Agentforce API consistently rejects them with
    // InternalVariableMutationAttemptException regardless of which variable name we use.
    // All customer identity (Contact ID, email, name, etc.) is passed via the welcome
    // message text in buildWelcomeMessage() and the agent extracts it from there when
    // calling actions like Create_Meaningful_Event.

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
    const cleanTextParts = textParts
      .filter((t) => {
        const trimmed = t.trim();
        return !(trimmed.startsWith('{') && trimmed.endsWith('}'));
      })
      // Strip embedded JSON blocks from within prose text (e.g., agent leaking
      // capture JSON like {"captured": true, "eventType": "Travel", ...})
      .map((t) => t
        .replace(/\{[^{}]*"(?:captured|eventType|captureNotification|uiDirective)"[^}]*\}/g, '')
        .trim()
      )
      .filter(Boolean);

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

    // ─── Detect capture JSON in the raw response text ──────────
    // The prompt template may output {"captured": true, "eventType": ...}
    // which isn't a uiDirective but indicates a server-side capture happened.
    const captureJsonMatch = fullText.match(/\{\s*"captured"\s*:\s*true[^}]*"eventType"\s*:\s*"([^"]+)"[^}]*\}/);
    if (captureJsonMatch) {
      const captureType = captureJsonMatch[1];
      console.log('[agentforce] Detected capture JSON in response for event type:', captureType);
      // Try to extract the notification label from the JSON
      const labelMatch = captureJsonMatch[0].match(/"label"\s*:\s*"([^"]+)"/);
      const label = labelMatch ? labelMatch[1] : `Event Captured: ${captureType}`;
      // Ensure we have a directive to carry this capture
      if (!uiDirective) {
        uiDirective = {
          action: 'CAPTURE_ONLY' as UIAction,
          payload: { captures: [{ type: 'meaningful_event', label }] } as unknown as UIDirective['payload'],
        };
      } else {
        const existing = (uiDirective.payload as Record<string, unknown>)?.captures as unknown[] || [];
        (uiDirective.payload as Record<string, unknown>).captures = [...existing, { type: 'meaningful_event', label }];
      }
    }

    // ─── Client-side event capture detection ─────────────────────
    // Detect captures from multiple sources and surface as toast notifications.
    const detectedCaptures: Array<{ type: 'meaningful_event' | 'profile_enrichment'; label: string }> = [];

    // 1a. Parenthetical notation: (Event Captured: ...) or (Profile Updated: ...)
    const captureRegex = /\((?:Event [Cc]aptured|event captured|Captured|captured):\s*(.+?)\)/g;
    let captureMatch;
    while ((captureMatch = captureRegex.exec(displayMessage)) !== null) {
      detectedCaptures.push({ type: 'meaningful_event', label: `Event Captured: ${captureMatch[1]}` });
    }
    const profileRegex = /\((?:Profile [Uu]pdated|profile updated|Updated|Saved):\s*(.+?)\)/g;
    while ((captureMatch = profileRegex.exec(displayMessage)) !== null) {
      detectedCaptures.push({ type: 'profile_enrichment', label: `Profile Updated: ${captureMatch[1]}` });
    }

    // 1b. Bare text notation: "Event Captured: Anniversary trip" (no parentheses)
    //     Match "Event Captured: <summary>" that appears as a standalone fragment in the text
    const bareEventRegex = /(?:^|\s)Event\s+Captured:\s*([^\n.!?]+)/gi;
    while ((captureMatch = bareEventRegex.exec(displayMessage)) !== null) {
      const label = `Event Captured: ${captureMatch[1].trim()}`;
      // Avoid duplicate if already detected from parenthetical notation
      if (!detectedCaptures.some(c => c.label === label)) {
        detectedCaptures.push({ type: 'meaningful_event', label });
      }
    }

    // 2. Scan raw API messages for action invocations (Inform messages from
    //    CaptureKeyEventsService, MeaningfulEventService, ProfileEnrichmentService, etc.)
    for (const m of rawMessages) {
      const msg = m as Record<string, unknown>;
      const msgType = ((msg.type as string) || '').toLowerCase();
      // Skip regular text messages — look for Inform, Action, ActionResult, etc.
      if (msgType === 'text' || msgType === '') continue;
      const content = ((msg.message || msg.text || msg.content || '') as string).toLowerCase();
      const actionName = ((msg.actionName || msg.name || msg.identifier || '') as string).toLowerCase();
      const combined = `${content} ${actionName}`;

      if (combined.includes('meaningful') || combined.includes('capturekey') || combined.includes('capture_key')) {
        // Avoid duplicate if already detected from text
        if (!detectedCaptures.some(c => c.type === 'meaningful_event')) {
          detectedCaptures.push({ type: 'meaningful_event', label: 'Event Captured' });
        }
      }
      if (combined.includes('profileenrichment') || combined.includes('profile_enrichment') ||
          combined.includes('updatecontactprofile') || combined.includes('update_contact_profile')) {
        if (!detectedCaptures.some(c => c.type === 'profile_enrichment')) {
          detectedCaptures.push({ type: 'profile_enrichment', label: 'Profile Updated' });
        }
      }
    }

    // 3. Natural language detection — agent confirms a capture in its response text
    if (detectedCaptures.length === 0) {
      const lower = displayMessage.toLowerCase();
      // Meaningful event patterns
      const eventPhrases = [
        /i'(?:ve|ll)\s+(?:noted|captured|recorded|saved)\s+(?:your\s+)?(?:upcoming\s+)?(?:trip|travel|wedding|birthday|anniversary|move|graduation|pregnancy|baby)/i,
        /i'(?:ve|ll)\s+(?:noted|recorded|saved)\s+that\s+you(?:'re| are)\s+(?:planning|going|traveling|moving|expecting|getting married)/i,
      ];
      for (const re of eventPhrases) {
        const m = displayMessage.match(re);
        if (m) {
          const summary = m[0].replace(/^i'(?:ve|ll)\s+(?:noted|captured|recorded|saved)\s+/i, '').trim();
          detectedCaptures.push({ type: 'meaningful_event', label: `Event Captured: ${summary.substring(0, 50)}` });
          break;
        }
      }
      // Profile enrichment patterns
      if (lower.includes("i've noted your skin") || lower.includes("i've saved your") ||
          lower.includes("i've updated your profile") || lower.includes("got it, i've noted")) {
        detectedCaptures.push({ type: 'profile_enrichment', label: 'Profile Updated' });
      }
    }

    if (detectedCaptures.length > 0) {
      console.log('[agentforce] Detected captures:', detectedCaptures);
      // Merge into directive, but avoid duplicates from the JSON capture detection phase above
      const existingCaptures = ((uiDirective?.payload as Record<string, unknown>)?.captures as Array<{ type: string; label: string }>) || [];
      const hasExistingEvent = existingCaptures.some(c => c.type === 'meaningful_event');
      const deduped = detectedCaptures.filter(c => {
        // If we already have a meaningful_event from JSON capture detection, skip text-detected ones
        if (c.type === 'meaningful_event' && hasExistingEvent) return false;
        return true;
      });
      if (deduped.length > 0) {
        if (uiDirective) {
          (uiDirective.payload as Record<string, unknown>).captures = [...existingCaptures, ...deduped];
        } else {
          uiDirective = {
            action: 'CAPTURE_ONLY' as UIAction,
            payload: { captures: deduped } as unknown as UIDirective['payload'],
          };
        }
      }
    }

    // ─── Quality filter: remove false-positive meaningful_event captures ───
    // The agent sometimes tags conversational preferences (e.g., "open to lipstick
    // options") as meaningful events. Real meaningful events describe life events,
    // travel plans, milestones, etc. — filter out labels that don't match.
    const allCaptures = ((uiDirective?.payload as Record<string, unknown>)?.captures as Array<{ type: string; label: string }>) || [];
    if (allCaptures.length > 0) {
      const lifeEventKeywords = /\b(trip|travel|anniversary|birthday|wedding|baby|pregnan|moving|graduat|retire|vacation|holiday|honeymoon|prom|reunion|concert|festival|event|appointment|surgery|celebration)\b/i;
      const filtered = allCaptures.filter(c => {
        if (c.type !== 'meaningful_event') return true; // keep non-event captures
        // Extract the descriptive part after "Event Captured: " prefix
        const desc = c.label.replace(/^Event\s+Captured:\s*/i, '').trim();
        // Accept if it contains a recognized life-event keyword
        if (lifeEventKeywords.test(desc)) return true;
        // Accept if label was from structured JSON capture detection (has proper prefix)
        if (c.label.startsWith('Event Captured:') && desc.length > 15) return true;
        console.log('[agentforce] Filtered out low-quality capture:', c.label);
        return false;
      });
      if (filtered.length < allCaptures.length) {
        (uiDirective!.payload as Record<string, unknown>).captures = filtered;
      }
    }

    // ─── Strip meta-text noise from displayed message ───────────
    // Agent sometimes adds parenthetical meta-notes not meant for the customer
    displayMessage = displayMessage
      .replace(/\((?:Event [Cc]aptured|event captured|Captured|captured):\s*.+?\)/g, '')
      .replace(/\((?:Profile [Uu]pdated|profile updated|Updated|Saved):\s*.+?\)/g, '')
      .replace(/\(uiDirective\s+forthcoming[^)]*\)/gi, '')
      .replace(/\(Note:?\s*[^)]*\)/gi, '')
      // Strip bare "Event Captured: <summary>" text (without parentheses)
      .replace(/Event\s+Captured:\s*[^\n.!?]+/gi, '')
      // Strip any remaining JSON blocks that leaked through (capture metadata, directive fragments)
      .replace(/\{[^{}]*"(?:captured|eventType|captureNotification|uiDirective|eventDescription|agentNote|metadataJson)"[^}]*\}/g, '')
      // Strip bare "uiDirective" mentions the agent may output as text
      .replace(/\buiDirective\b[^.!?\n]*/gi, '')
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
