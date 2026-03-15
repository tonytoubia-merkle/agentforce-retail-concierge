import type { AgentResponse, UIAction, UIDirective } from '@/types/agent';
import type { AgentforceConfig } from './types';
import type { CustomerSessionContext } from '@/types/customer';
import { parseUIDirective, normalizeProducts } from './parseDirectives';

/**
 * Parse Adaptive Response Format messages (Card Carousel, Choices, Buttons)
 * into a UIDirective. Returns null if no structured messages are present.
 *
 * Card Carousel items map to products with images (Rich Choice With Images).
 * Choices/Buttons map to a product list without images, or to suggestedActions
 * if the choices look like navigation options rather than product selections.
 */
function parseStructuredMessages(rawMessages: unknown[]): UIDirective | null {
  for (const m of rawMessages) {
    const msg = m as Record<string, unknown>;
    const type = ((msg.type as string) || '').toLowerCase().trim();

    // Card Carousel — Rich Choice With Images
    if (type === 'card carousel' || type === 'cardcarousel' || type === 'card_carousel') {
      const choices = (msg.choices || msg.items || msg.cards || []) as unknown[];
      if (!Array.isArray(choices) || choices.length === 0) continue;

      const rawProducts = choices.map((c: unknown, i: number) => {
        const item = c as Record<string, unknown>;
        return {
          id: (item.value as string) || (item.id as string) || `carousel-${i}`,
          name: (item.title as string) || (item.label as string) || (item.itemName as string) || `Product ${i + 1}`,
          description: (item.description as string) || (item.itemDescriptionText as string) || '',
          shortDescription: (item.description as string) || (item.itemDescriptionText as string) || '',
          imageUrl: (item.imageUrl as string) || (item.itemImageUrl as string) || '',
          images: [(item.imageUrl as string) || (item.itemImageUrl as string) || ''].filter(Boolean),
          brand: '',
          category: 'moisturizer',
          price: 0,
          currency: 'USD',
          attributes: {},
          rating: 0,
          reviewCount: 0,
          inStock: true,
        };
      });

      const products = normalizeProducts(rawProducts);
      console.log('[agentforce] Card Carousel → mapped', products.length, 'products');

      return {
        action: 'SHOW_PRODUCTS' as UIAction,
        payload: { products } as UIDirective['payload'],
      };
    }

    // Choices / Buttons — Rich Choice Response (text-only)
    if (type === 'choices' || type === 'buttons' || type === 'list selector' || type === 'list_selector') {
      const choices = (msg.choices || msg.items || msg.options || []) as unknown[];
      if (!Array.isArray(choices) || choices.length === 0) continue;

      const rawProducts = choices.map((c: unknown, i: number) => {
        const item = c as Record<string, unknown>;
        return {
          id: (item.value as string) || (item.id as string) || `choice-${i}`,
          name: (item.label as string) || (item.title as string) || (item.text as string) || `Option ${i + 1}`,
          description: (item.description as string) || '',
          shortDescription: '',
          imageUrl: '',
          images: [],
          brand: '',
          category: 'moisturizer',
          price: 0,
          currency: 'USD',
          attributes: {},
          rating: 0,
          reviewCount: 0,
          inStock: true,
        };
      });

      const products = normalizeProducts(rawProducts);
      console.log('[agentforce] Choices →', products.length, 'options');

      return {
        action: 'SHOW_PRODUCTS' as UIAction,
        payload: { products } as UIDirective['payload'],
      };
    }
  }

  return null;
}

export class AgentforceClient {
  private config: AgentforceConfig;
  private sessionId: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private sequenceId = 0;
  // Tracks whether SSE streaming is supported by the connected Agentforce org.
  // Defaults to true (unsupported) because the Agentforce /messages endpoint currently
  // returns 500 for Accept: text/event-stream, and a failed SSE attempt sends the message
  // to SF which processes it, causing a duplicate-sequenceId error on the JSON retry.
  // Reset to false on each new session so future SF SSE support is auto-detected per session.
  private _sseUnsupported = true;
  // Serialization lock — Agentforce sessions don't support concurrent messages.
  // The background welcome (seq=1) and the user's first message (seq=2) must be
  // sent sequentially, or the API may process seq=2 before seq=1's context is
  // established (contactId, instructions, etc.), causing missing event captures.
  private _sendLock: Promise<void> = Promise.resolve();

  constructor(config: AgentforceConfig) {
    this.config = config;
    this.accessToken = config.accessToken || null;
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (this.accessToken && !this.tokenExpiresAt) {
      // Static token with no expiry tracking
      return this.accessToken;
    }

    // OAuth via server-side proxy — credentials stay server-side, never in the browser bundle
    const t0token = Date.now();
    const response = await fetch('/api/sf/token', { method: 'POST' });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OAuth token request failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log(`[timing] token fetch: ${Date.now() - t0token}ms`);
    this.accessToken = data.access_token;
    // Expire 5 minutes early to avoid edge cases
    this.tokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 7200_000) - 300_000;
    return this.accessToken!;
  }

  async initSession(customerContext?: CustomerSessionContext): Promise<string> {
    const token = await this.getAccessToken();
    this.sequenceId = 0;
    this._sendLock = Promise.resolve(); // reset lock for fresh session
    this._sseUnsupported = true; // re-detect SSE support per session (currently unsupported)

    const url = `${this.config.baseUrl}/agents/${this.config.agentId}/sessions`;

    const sessionBody: Record<string, unknown> = {
      externalSessionKey: customerContext?.customerId || crypto.randomUUID(),
      instanceConfig: { endpoint: this.config.instanceUrl },
      // Declare support for structured message formats (Adaptive Response Formats).
      // This enables the agent to return Card Carousel and Choices messages instead
      // of embedding JSON in text — more reliable than prompt-template JSON output.
      streamingCapabilities: {
        chunkTypes: ['Text'],
      },
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

  /**
   * Parse a raw API response object into an AgentResponse.
   * Shared between sendMessage (buffered) and sendMessageStreaming (SSE).
   */
  private _processResponse(data: Record<string, unknown>): AgentResponse {
    const rawMessages: unknown[] = (data.messages || data.responseMessages || []) as unknown[];
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

    // ─── Adaptive Response Formats: structured message parsing ────────────
    const structuredDirective = parseStructuredMessages(rawMessages);
    if (structuredDirective) {
      console.log('[agentforce] Parsed structured message directive:', structuredDirective.action, `(${structuredDirective.payload?.products?.length ?? 0} products)`);
      const precedingText = agentMessages
        .filter(m => m.type === 'Text' || m.type === '' || m.type === 'text')
        .map(m => m.message)
        .join('\n')
        .trim();
      return {
        sessionId: this.sessionId!,
        message: precedingText || '',
        uiDirective: structuredDirective,
        suggestedActions: (data.suggestedActions as string[]) || [],
        confidence: (data.confidence as number) || 1,
      };
    }

    const fullText = agentMessages.map((m) => m.message).join('');
    console.log('[agentforce] raw text:', fullText.substring(0, 500));

    let uiDirective: ReturnType<typeof parseUIDirective> = undefined;
    const directive = parseUIDirective({ message: fullText, rawText: fullText });
    if (directive) {
      console.log('[agentforce] parsed directive:', directive.action, JSON.stringify(directive.payload).substring(0, 300));
      uiDirective = directive;
    }

    const textParts: string[] = [];
    if (!uiDirective) {
      for (const msg of agentMessages) {
        const text = msg.message || '';
        const d = parseUIDirective({ message: text, rawText: text });
        if (d) {
          uiDirective = d;
        } else if (text) {
          textParts.push(text);
        }
      }
    } else {
      const jsonStart = fullText.indexOf('{');
      const jsonEnd = fullText.lastIndexOf('}');
      if (jsonStart > 0) {
        const before = fullText.slice(0, jsonStart).trim();
        if (before) textParts.push(before);
      }
      if (jsonEnd >= 0 && jsonEnd < fullText.length - 1) {
        const after = fullText.slice(jsonEnd + 1).trim();
        if (after && !after.includes('"') && !after.includes('{') && !after.includes('}')) {
          textParts.push(after);
        }
      }
    }

    const cleanTextParts = textParts
      .filter((t) => {
        const trimmed = t.trim();
        return !(trimmed.startsWith('{') && trimmed.endsWith('}'));
      })
      .map((t) => t
        .replace(/\{[^{}]*"(?:captured|eventType|captureNotification|uiDirective)"[^}]*\}/g, '')
        .trim()
      )
      .filter(Boolean);

    let displayMessage = cleanTextParts.join('\n');
    if (!displayMessage && uiDirective) {
      const payloadMsg = (uiDirective.payload as Record<string, unknown>)?.message as string | undefined;
      if (payloadMsg) displayMessage = payloadMsg;
    }
    if (!displayMessage && uiDirective) {
      if (uiDirective.action === 'WELCOME_SCENE') {
        const parts = [uiDirective.payload?.welcomeMessage || 'Welcome!'];
        if (uiDirective.payload?.welcomeSubtext) parts.push(uiDirective.payload.welcomeSubtext);
        displayMessage = parts.join(' ');
      } else if (uiDirective.action === 'IDENTIFY_CUSTOMER') {
        displayMessage = "Great, I've saved your profile! Now I can give you more personalized recommendations.";
      }
    }

    // ─── Detect capture JSON in the raw response text ──────────
    const captureJsonMatch = fullText.match(/\{\s*"captured"\s*:\s*true[^}]*"eventType"\s*:\s*"([^"]+)"[^}]*\}/);
    if (captureJsonMatch) {
      const captureType = captureJsonMatch[1];
      console.log('[agentforce] Detected capture JSON in response for event type:', captureType);
      const labelMatch = captureJsonMatch[0].match(/"label"\s*:\s*"([^"]+)"/);
      const label = labelMatch ? labelMatch[1] : `Event Captured: ${captureType}`;
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
    const detectedCaptures: Array<{ type: 'meaningful_event' | 'profile_enrichment'; label: string }> = [];

    const captureRegex = /\((?:Event [Cc]aptured|event captured|Captured|captured):\s*(.+?)\)/g;
    let captureMatch;
    while ((captureMatch = captureRegex.exec(displayMessage)) !== null) {
      detectedCaptures.push({ type: 'meaningful_event', label: `Event Captured: ${captureMatch[1]}` });
    }
    const profileRegex = /\((?:Profile [Uu]pdated|profile updated|Updated|Saved):\s*(.+?)\)/g;
    while ((captureMatch = profileRegex.exec(displayMessage)) !== null) {
      detectedCaptures.push({ type: 'profile_enrichment', label: `Profile Updated: ${captureMatch[1]}` });
    }

    const bareEventRegex = /(?:^|\s)Event\s+Captured:\s*([^\n.!?]+)/gi;
    while ((captureMatch = bareEventRegex.exec(displayMessage)) !== null) {
      const label = `Event Captured: ${captureMatch[1].trim()}`;
      if (!detectedCaptures.some(c => c.label === label)) {
        detectedCaptures.push({ type: 'meaningful_event', label });
      }
    }

    for (const m of rawMessages) {
      const msg = m as Record<string, unknown>;
      const msgType = ((msg.type as string) || '').toLowerCase();
      if (msgType === 'text' || msgType === '') continue;
      const content = ((msg.message || msg.text || msg.content || '') as string).toLowerCase();
      const actionName = ((msg.actionName || msg.name || msg.identifier || '') as string).toLowerCase();
      const combined = `${content} ${actionName}`;

      if (combined.includes('meaningful') || combined.includes('capturekey') || combined.includes('capture_key')) {
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

    if (detectedCaptures.length === 0) {
      const lower = displayMessage.toLowerCase();
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
      if (lower.includes("i've noted your skin") || lower.includes("i've saved your") ||
          lower.includes("i've updated your profile") || lower.includes("got it, i've noted")) {
        detectedCaptures.push({ type: 'profile_enrichment', label: 'Profile Updated' });
      }
    }

    if (detectedCaptures.length > 0) {
      console.log('[agentforce] Detected captures:', detectedCaptures);
      const existingCaptures = ((uiDirective?.payload as Record<string, unknown>)?.captures as Array<{ type: string; label: string }>) || [];
      const hasExistingEvent = existingCaptures.some(c => c.type === 'meaningful_event');
      const deduped = detectedCaptures.filter(c => {
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
    const allCaptures = ((uiDirective?.payload as Record<string, unknown>)?.captures as Array<{ type: string; label: string }>) || [];
    if (allCaptures.length > 0) {
      const lifeEventKeywords = /\b(trip|travel|anniversary|birthday|wedding|baby|pregnan|moving|graduat|retire|vacation|holiday|honeymoon|prom|reunion|concert|festival|event|appointment|surgery|celebration)\b/i;
      const filtered = allCaptures.filter(c => {
        if (c.type !== 'meaningful_event') return true;
        const desc = c.label.replace(/^Event\s+Captured:\s*/i, '').trim();
        if (lifeEventKeywords.test(desc)) return true;
        if (c.label.startsWith('Event Captured:') && desc.length > 15) return true;
        console.log('[agentforce] Filtered out low-quality capture:', c.label);
        return false;
      });
      if (filtered.length < allCaptures.length) {
        (uiDirective!.payload as Record<string, unknown>).captures = filtered;
      }
    }

    // ─── Strip meta-text noise from displayed message ───────────
    displayMessage = displayMessage
      .replace(/\((?:Event [Cc]aptured|event captured|Captured|captured):\s*.+?\)/g, '')
      .replace(/\((?:Profile [Uu]pdated|profile updated|Updated|Saved):\s*.+?\)/g, '')
      .replace(/\(uiDirective\s+forthcoming[^)]*\)/gi, '')
      .replace(/\(Note:?\s*[^)]*\)/gi, '')
      .replace(/Event\s+Captured:\s*[^\n.!?]+/gi, '')
      .replace(/\{[^{}]*"(?:captured|eventType|captureNotification|uiDirective|eventDescription|agentNote|metadataJson)"[^}]*\}/g, '')
      .replace(/\buiDirective\b[^.!?\n]*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!uiDirective && displayMessage) {
      const lower = displayMessage.toLowerCase();
      if (lower.includes('recommend') || lower.includes('here are') || lower.includes('product')) {
        console.warn('[agentforce] Agent mentioned products but no uiDirective was parsed. Full text:', fullText.substring(0, 500));
      }
    }

    if (!displayMessage && !uiDirective) {
      console.warn('[agentforce] Empty response. Full data:', JSON.stringify(data).substring(0, 1000));
      displayMessage = "I'm processing your request. Could you try asking again?";
    }

    return {
      sessionId: this.sessionId!,
      message: displayMessage,
      uiDirective,
      suggestedActions: (data.suggestedActions as string[])?.length
        ? data.suggestedActions as string[]
        : (uiDirective?.payload as Record<string, unknown>)?.suggestedActions as string[] || [],
      confidence: (data.confidence as number) || 1,
    };
  }

  async sendMessage(message: string): Promise<AgentResponse> {
    if (!this.sessionId) {
      throw new Error('Session not initialized. Call initSession() first.');
    }

    // Acquire the send lock — wait for any in-flight message (e.g. background welcome)
    // to complete before sending the next one.
    let releaseLock!: () => void;
    const nextLock = new Promise<void>(resolve => { releaseLock = resolve; });
    const prevLock = this._sendLock;
    this._sendLock = nextLock;

    try {
      await prevLock;
    } catch {
      // Previous send failed — lock chain is broken, proceed anyway
    }

    try {
      const t0 = Date.now();
      const token = await this.getAccessToken();
      const t1 = Date.now();
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
            message: { sequenceId: this.sequenceId, type: 'Text', text: message },
          }),
        }
      );
      const t2 = Date.now();

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Send message failed (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const t3 = Date.now();
      console.log(
        `[timing] seq=${this.sequenceId} | token: ${t1 - t0}ms (${t1 - t0 < 5 ? 'cached' : 'fetched'})` +
        ` | agent roundtrip: ${t2 - t1}ms | json parse: ${t3 - t2}ms | total: ${t3 - t0}ms`
      );
      console.log('[agentforce] response keys:', Object.keys(data), 'messages count:', (data.messages || data.responseMessages || []).length);

      return this._processResponse(data as Record<string, unknown>);
    } finally {
      releaseLock();
    }
  }

  /**
   * Send a message using SSE streaming so text chunks arrive incrementally.
   * onChunk is called with each text fragment as it arrives. JSON directive
   * content is never passed to onChunk — only clean prose text is streamed.
   * Falls back to buffered JSON parsing if the server doesn't support SSE.
   */
  async sendMessageStreaming(
    message: string,
    onChunk: (text: string) => void,
  ): Promise<AgentResponse> {
    if (!this.sessionId) {
      throw new Error('Session not initialized. Call initSession() first.');
    }

    let releaseLock!: () => void;
    const nextLock = new Promise<void>(resolve => { releaseLock = resolve; });
    const prevLock = this._sendLock;
    this._sendLock = nextLock;

    try {
      await prevLock;
    } catch {
      // Previous send failed — proceed anyway
    }

    try {
      const t0 = Date.now();
      const token = await this.getAccessToken();
      const t1 = Date.now();
      this.sequenceId++;

      const url = `${this.config.baseUrl}/sessions/${this.sessionId}/messages`;
      const bodyPayload = JSON.stringify({
        message: { sequenceId: this.sequenceId, type: 'Text', text: message },
      });

      // ── Helper: buffered JSON request (no SSE) ─────────────────
      // Used both for the SSE-unsupported fast path and as a fallback
      // after a 406. Does NOT re-acquire the lock — lock is already held.
      const sendBuffered = async (): Promise<AgentResponse> => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: bodyPayload,
        });
        if (!r.ok) {
          const errText = await r.text();
          throw new Error(`Send message failed (${r.status}): ${errText}`);
        }
        const data = await r.json();
        const t2 = Date.now();
        console.log(`[timing] seq=${this.sequenceId} | token: ${t1 - t0}ms | agent roundtrip: ${t2 - t1}ms | total: ${t2 - t0}ms`);
        return this._processResponse(data as Record<string, unknown>);
      };

      // Skip SSE attempt if previously found to be unsupported
      if (this._sseUnsupported) {
        return await sendBuffered();
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: bodyPayload,
      });

      if (!response.ok) {
        // 406 = SSE not accepted by this API version. Mark and fall back to JSON.
        if (response.status === 406 || response.status === 415 || response.status === 500) {
          this._sseUnsupported = true;
          console.log(`[agentforce] SSE not supported (${response.status}) — falling back to JSON for this session`);
          // Need a fresh token check but can reuse the one we already have.
          // Retry as buffered (lock is already held, so safe to call directly).
          return await sendBuffered();
        }
        const errText = await response.text();
        throw new Error(`Send message failed (${response.status}): ${errText}`);
      }

      // Fallback: server returned JSON instead of SSE — parse normally
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = await response.json();
        const t2 = Date.now();
        console.log(`[timing] seq=${this.sequenceId} (SSE→JSON fallback) | total: ${t2 - t0}ms`);
        return this._processResponse(data as Record<string, unknown>);
      }

      // ── SSE streaming path ──────────────────────────────────────
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let firstChunkAt: number | null = null;
      let finalData: Record<string, unknown> | null = null;
      // Accumulate streamed text so we can detect when JSON starts.
      // Once '{' appears we stop calling onChunk (no JSON leaks to UI).
      let accumulatedStreamText = '';
      let jsonStarted = false;

      const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const rawData = line.slice(6).trim();
        if (!rawData || rawData === '[DONE]') return;
        try {
          const parsed = JSON.parse(rawData) as Record<string, unknown>;

          // Final event containing the full messages array
          if (parsed.messages || parsed.responseMessages) {
            finalData = parsed;
            return;
          }

          // Incremental text chunk
          const chunkText = ((parsed.message || parsed.text || parsed.chunk || '') as string);
          if (chunkText && typeof chunkText === 'string' && !jsonStarted) {
            if (!firstChunkAt) {
              firstChunkAt = Date.now();
              console.log(`[timing] seq=${this.sequenceId} | first SSE chunk: ${firstChunkAt - t1}ms`);
            }
            accumulatedStreamText += chunkText;
            // Stop streaming to UI once JSON directive begins
            const braceIdx = accumulatedStreamText.indexOf('{');
            if (braceIdx !== -1) {
              jsonStarted = true;
              // Call with any clean text that preceded the brace
              const cleanBefore = accumulatedStreamText.slice(0, braceIdx).trim();
              if (cleanBefore) onChunk(cleanBefore);
            } else {
              onChunk(chunkText);
            }
          }
        } catch {
          // Ignore malformed SSE lines
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) processLine(line);
      }
      if (buffer) processLine(buffer);

      const t2 = Date.now();
      console.log(`[timing] seq=${this.sequenceId} | SSE stream complete: ${t2 - t0}ms | first chunk: ${firstChunkAt ? firstChunkAt - t1 : 'none'}ms`);

      // Use the final event data if the server sent one; otherwise synthesize from chunks
      if (finalData) {
        return this._processResponse(finalData);
      }
      // Synthetic fallback: treat accumulated stream text as the agent message
      const syntheticData: Record<string, unknown> = {
        messages: [{ type: 'Text', message: accumulatedStreamText }],
        suggestedActions: [],
        confidence: 1,
      };
      return this._processResponse(syntheticData);
    } finally {
      releaseLock();
    }
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
      instanceUrl: import.meta.env.VITE_AGENTFORCE_INSTANCE_URL || '',
    });
  }
  return agentforceClient;
};

/** Create a fresh client for a specific agent ID (e.g. Skin Concierge agent). */
export const createAgentforceClient = (agentId: string): AgentforceClient => {
  return new AgentforceClient({
    baseUrl: '/api/agentforce',
    agentId,
    instanceUrl: import.meta.env.VITE_AGENTFORCE_INSTANCE_URL || '',
  });
};
