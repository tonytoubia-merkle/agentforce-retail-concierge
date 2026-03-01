import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, UIAction } from '@/types/agent';
import type { CustomerSessionContext, CustomerProfile, AgentCapturedProfile, CapturedProfileField, ChatSummary, TaggedContextField } from '@/types/customer';
import { PROVENANCE_USAGE } from '@/types/customer';
import { useScene } from './SceneContext';
import { useCustomer } from './CustomerContext';
import { useCampaign } from './CampaignContext';
import { generateMockResponse, setMockCustomerContext, getMockAgentSnapshot, restoreMockAgentSnapshot } from '@/services/mock/mockAgent';
import type { MockAgentSnapshot } from '@/services/mock/mockAgent';
import type { AgentResponse } from '@/types/agent';
import { getAgentforceClient } from '@/services/agentforce/client';
import { getDataCloudWriteService } from '@/services/datacloud';
import type { SceneSnapshot } from './SceneContext';
import { useActivityToast } from '@/components/ActivityToast';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

let sessionInitialized = false;

/** Snapshot of a persona's full session state for instant restore. */
interface SessionSnapshot {
  messages: AgentMessage[];
  suggestedActions: string[];
  sceneSnapshot: SceneSnapshot;
  agentSessionId: string | null;
  agentSequenceId: number;
  mockSnapshot: MockAgentSnapshot | null;
  sessionInitialized: boolean;
}

function buildSessionContext(customer: CustomerProfile, campaignAttribution?: import('@/types/campaign').CampaignAttribution): CustomerSessionContext {
  // Flatten recent orders into readable purchase summaries
  const recentOrders = (customer.orders || [])
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
    .slice(0, 3);
  const recentPurchases = recentOrders.flatMap((o) =>
    o.lineItems.map((li) => li.productId)
  );
  const recentActivity = recentOrders.map((o) => {
    const items = o.lineItems.map((li) => li.productName).join(', ');
    return `Order ${o.orderId} on ${o.orderDate} (${o.channel}): ${items}`;
  });

  // Chat context summaries
  const chatContext = (customer.chatSummaries || [])
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
    .slice(0, 3)
    .map((c) => `[${c.sessionDate}] ${c.summary}`);

  // Meaningful events
  const meaningfulEvents = (customer.meaningfulEvents || [])
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .map((e) => {
      const note = e.agentNote ? ` (Note: ${e.agentNote})` : '';
      return `[${e.capturedAt}] ${e.description}${note}`;
    });

  // Browse interests
  const browseInterests = (customer.browseSessions || [])
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
    .slice(0, 3)
    .map((b) => `Browsed ${b.categoriesBrowsed.join(', ')} on ${b.sessionDate} (${b.durationMinutes}min, ${b.device})`);

  // Also include legacy recentActivity if orders are empty
  if (!recentActivity.length && customer.recentActivity?.length) {
    recentActivity.push(...customer.recentActivity.map((a) => a.description));
  }
  if (!recentPurchases.length && customer.purchaseHistory?.length) {
    recentPurchases.push(...customer.purchaseHistory.map((p) => p.productId));
  }

  // Agent-captured profile fields — flatten to readable strings
  const captured = customer.agentCapturedProfile;
  const capturedProfile: string[] = [];
  const missingProfileFields: string[] = [];

  if (captured) {
    const fieldLabel: Record<string, string> = {
      birthday: 'Birthday', anniversary: 'Anniversary', partnerName: 'Partner name',
      giftsFor: 'Buys gifts for', upcomingOccasions: 'Upcoming occasions',
      morningRoutineTime: 'Morning routine', makeupFrequency: 'Makeup frequency',
      exerciseRoutine: 'Exercise', workEnvironment: 'Work environment',
      beautyPriority: 'Beauty priority', priceRange: 'Price sensitivity',
      sustainabilityPref: 'Sustainability', climateContext: 'Climate',
      waterIntake: 'Hydration habits', sleepPattern: 'Sleep pattern',
    };
    for (const [key, label] of Object.entries(fieldLabel)) {
      const field = captured[key as keyof AgentCapturedProfile] as CapturedProfileField | undefined;
      if (field) {
        const val = Array.isArray(field.value) ? field.value.join(', ') : field.value;
        capturedProfile.push(`${label}: ${val} (${field.confidence}, ${field.capturedFrom})`);
      } else {
        missingProfileFields.push(label);
      }
    }
  } else {
    // No captured profile at all — everything is missing
    missingProfileFields.push(
      'Birthday', 'Anniversary', 'Morning routine', 'Exercise',
      'Work environment', 'Beauty priority', 'Price sensitivity',
    );
  }

  // ─── Build provenance-tagged context ───────────────────────────
  const taggedContext: TaggedContextField[] = [];

  // 1P-EXPLICIT (declared): beauty profile from preference center
  if (customer.beautyProfile?.skinType) {
    taggedContext.push({ value: `Skin type: ${customer.beautyProfile.skinType}`, provenance: 'declared', usage: 'direct' });
  }
  if (customer.beautyProfile?.concerns?.length) {
    taggedContext.push({ value: `Concerns: ${customer.beautyProfile.concerns.join(', ')}`, provenance: 'declared', usage: 'direct' });
  }
  if (customer.beautyProfile?.allergies?.length) {
    taggedContext.push({ value: `Allergies: ${customer.beautyProfile.allergies.join(', ')}`, provenance: 'declared', usage: 'direct' });
  }
  if (customer.beautyProfile?.fragrancePreference) {
    taggedContext.push({ value: `Fragrance preference: ${customer.beautyProfile.fragrancePreference}`, provenance: 'declared', usage: 'direct' });
  }

  // 1P-BEHAVIORAL (observed): purchase history
  for (const order of (customer.orders || []).slice(0, 5)) {
    const items = order.lineItems.map((li) => li.productName).join(', ');
    taggedContext.push({ value: `Purchased ${items} on ${order.orderDate} (${order.channel})`, provenance: 'observed', usage: 'direct' });
  }

  // Loyalty — observed (they enrolled)
  if (customer.loyalty) {
    const pts = customer.loyalty.pointsBalance ? ` (${customer.loyalty.pointsBalance} pts)` : '';
    taggedContext.push({ value: `Loyalty: ${customer.loyalty.tier}${pts}`, provenance: 'observed', usage: 'direct' });
  }

  // Chat summaries — observed (from prior conversations)
  for (const chat of (customer.chatSummaries || []).slice(0, 3)) {
    taggedContext.push({ value: `[${chat.sessionDate}] ${chat.summary}`, provenance: 'observed', usage: 'direct' });
  }

  // Meaningful events — may be stated or agent-inferred
  for (const event of customer.meaningfulEvents || []) {
    const prov = event.eventType === 'preference' || event.eventType === 'milestone' ? 'stated' : 'agent_inferred';
    taggedContext.push({ value: event.description, provenance: prov, usage: PROVENANCE_USAGE[prov] });
  }

  // 1P-IMPLICIT (inferred): browse sessions
  for (const session of (customer.browseSessions || []).slice(0, 3)) {
    taggedContext.push({
      value: `Browsed ${session.categoriesBrowsed.join(', ')} on ${session.sessionDate} (${session.durationMinutes}min)`,
      provenance: 'inferred',
      usage: 'soft',
    });
  }

  // Agent-captured profile fields
  if (customer.agentCapturedProfile) {
    for (const [key, field] of Object.entries(customer.agentCapturedProfile)) {
      if (!field) continue;
      const typedField = field as CapturedProfileField;
      const prov = typedField.confidence === 'stated' ? 'stated' : 'agent_inferred';
      const val = Array.isArray(typedField.value) ? typedField.value.join(', ') : typedField.value;
      taggedContext.push({ value: `${key}: ${val}`, provenance: prov, usage: PROVENANCE_USAGE[prov] });
    }
  }

  // 3P-APPENDED: Merkury enrichment
  if (customer.appendedProfile?.interests) {
    for (const interest of customer.appendedProfile.interests) {
      taggedContext.push({ value: interest, provenance: 'appended', usage: 'influence_only' });
    }
  }
  if (customer.appendedProfile?.lifestyleSignals) {
    for (const signal of customer.appendedProfile.lifestyleSignals) {
      taggedContext.push({ value: signal, provenance: 'appended', usage: 'influence_only' });
    }
  }

  // Detect Salesforce Contact IDs (15-18 char alphanumeric starting with '003')
  const isSalesforceId = /^[a-zA-Z0-9]{15,18}$/.test(customer.id) && customer.id.startsWith('003');

  return {
    customerId: customer.email || customer.id,
    name: customer.name,
    email: customer.email,
    // Pass the actual Salesforce Contact ID when available so the agent can use it
    // for action inputs (Create_Meaningful_Event, Update_Contact_Profile, etc.)
    contactId: isSalesforceId ? customer.id : customer.email,
    identityTier: customer.merkuryIdentity?.identityTier || 'anonymous',
    skinType: customer.beautyProfile?.skinType,
    concerns: customer.beautyProfile?.concerns,
    recentPurchases,
    recentActivity,
    appendedInterests: customer.appendedProfile?.interests || [],
    loyaltyTier: customer.loyalty?.tier || customer.loyaltyTier,
    loyaltyPoints: customer.loyalty?.pointsBalance,
    chatContext,
    meaningfulEvents,
    browseInterests,
    capturedProfile,
    missingProfileFields,
    taggedContext,
    ...(campaignAttribution ? {
      campaignContext: {
        campaignName: campaignAttribution.adCreative.campaignName,
        channel: `${campaignAttribution.adCreative.platform} / ${campaignAttribution.adCreative.utmParams.utm_medium}`,
        audienceSegment: campaignAttribution.adCreative.audienceSegment.segmentName,
        targetingStrategy: campaignAttribution.adCreative.targetingStrategy,
        inferredInterests: campaignAttribution.adCreative.inferredInterests,
      },
    } : {}),
  };
}

/** Build a welcome message that embeds customer context so the agent can personalize.
 *  Uses provenance-tagged fields so the agent knows what it can reference directly
 *  vs. what should only influence curation vs. what must never be mentioned. */
function buildWelcomeMessage(ctx: CustomerSessionContext): string {
  const isAppended = ctx.identityTier === 'appended';
  const isAnonymous = ctx.identityTier === 'anonymous';

  const lines: string[] = ['[WELCOME]'];

  // ── Identity header ──────────────────────────────────────────
  if (isAppended) {
    lines.push(`Customer: First-time visitor (identity resolved via Merkury, NOT a hand-raiser)`);
    lines.push(`Identity: appended`);
    lines.push(`[INSTRUCTION] Do NOT greet by name. Do NOT reference specific demographic or interest data directly. Instead, use appended signals to subtly curate product selections and scene choices. Frame recommendations as "popular picks", "trending", or "you might enjoy" — never "based on your profile" or "we know you like X".`);
  } else if (isAnonymous) {
    lines.push(`Customer: Anonymous visitor`);
    lines.push(`Identity: anonymous`);
  } else {
    lines.push(`Customer: ${ctx.name} (greet by first name)`, `Email: ${ctx.email || 'unknown'}`, `Identity: ${ctx.identityTier}`);
    if (ctx.contactId) lines.push(`Salesforce Contact ID: ${ctx.contactId}`);
    // Tell the planner exactly what values to use for action inputs
    if (ctx.email) {
      lines.push(`[ACTION INPUT VALUES] When calling ANY action during this conversation, use these values:`);
      lines.push(`  - contactId = "${ctx.email}"`);
      lines.push(`  - customerEmail = "${ctx.email}"`);
      lines.push(`  - sessionId = "${ctx.email}"`);
      lines.push(`  - customerId = "${ctx.email}"`);
      lines.push(`These are REQUIRED. NEVER leave contactId empty when calling Create Meaningful Event, Update Contact Profile, or any other action.`);
    }
    lines.push(`[INSTRUCTION] Keep your welcome greeting SHORT — 2 sentences maximum. Greet by first name. If there is ONE standout context item (an upcoming trip, a recent life event, a loyalty milestone), acknowledge it briefly in a warm, natural way. Do NOT list multiple preferences, product types, or questions. End with a single warm invitation or open question. Be conversational, not encyclopedic.`);
  }

  // ── Data usage rules ─────────────────────────────────────────
  lines.push('');
  lines.push('[DATA USAGE RULES]');
  lines.push('Context below is tagged by provenance. Follow these rules strictly:');
  lines.push('- [CONFIRMED]: Customer stated or declared this. Reference explicitly ("You mentioned...", "Based on your profile...").');
  lines.push('- [OBSERVED/INFERRED]: Behavioral signals or agent inferences. Reference gently ("You were looking at...", "It seems like...").');
  lines.push('- [INFLUENCE ONLY]: Third-party appended data. NEVER mention directly. Use only to curate product selection, scene mood, or ordering of recommendations.');

  // ── Provenance-tagged context ────────────────────────────────
  if (ctx.taggedContext?.length) {
    const direct = ctx.taggedContext.filter(f => f.usage === 'direct');
    const soft = ctx.taggedContext.filter(f => f.usage === 'soft');
    const influence = ctx.taggedContext.filter(f => f.usage === 'influence_only');

    if (direct.length) {
      lines.push('');
      lines.push('[CONFIRMED — OK to reference directly]');
      direct.forEach(f => lines.push(`  ${f.value}`));
    }
    if (soft.length) {
      lines.push('');
      lines.push('[OBSERVED/INFERRED — reference gently, e.g. "it looks like..." or "you might enjoy..."]');
      soft.forEach(f => lines.push(`  ${f.value}`));
    }
    if (influence.length) {
      lines.push('');
      lines.push('[INFLUENCE ONLY — use to curate selections, NEVER reference directly]');
      influence.forEach(f => lines.push(`  ${f.value}`));
    }
  }

  // ── Campaign attribution (from ad click-through) ────────────
  if (ctx.campaignContext) {
    const cc = ctx.campaignContext;
    lines.push('');
    lines.push('[CAMPAIGN ATTRIBUTION — visitor arrived via a paid media ad]');
    lines.push(`  Campaign: ${cc.campaignName}`);
    lines.push(`  Channel: ${cc.channel}`);
    lines.push(`  Audience Segment: ${cc.audienceSegment}`);
    lines.push(`  Targeting Strategy: ${cc.targetingStrategy}`);
    if (cc.inferredInterests.length) {
      lines.push(`  Inferred Interests: ${cc.inferredInterests.join(', ')}`);
    }
    lines.push(`[INSTRUCTION] This is background context only. Do NOT mention the ad, campaign, or targeting in conversation. Do NOT reference this in your welcome message. Use it purely as a soft signal when choosing which products to recommend — e.g., if the campaign theme was "Summer Glow", slightly favor radiance products. The visitor should never know you have this context.`);
  }

  // ── Enrichment opportunity ───────────────────────────────────
  if (ctx.missingProfileFields?.length) {
    lines.push('');
    lines.push(`[ENRICHMENT OPPORTUNITY] Try to naturally learn: ${ctx.missingProfileFields.join(', ')}`);
  }

  return lines.join('\n');
}

async function getAgentResponse(content: string): Promise<AgentResponse> {
  if (useMockData) {
    return generateMockResponse(content);
  }
  const client = getAgentforceClient();
  if (!sessionInitialized) {
    await client.initSession();
    sessionInitialized = true;
  }
  return client.sendMessage(content);
}

/** Write a chat summary to Data Cloud when a conversation ends. */
function writeConversationSummary(customerId: string, msgs: AgentMessage[]): void {
  if (msgs.length < 2) return; // Need at least one exchange

  const topics = extractTopicsFromMessages(msgs);
  const summary: ChatSummary = {
    sessionDate: new Date().toISOString().split('T')[0],
    summary: `Customer discussed ${topics.join(', ')}. ${msgs.length} messages exchanged.`,
    sentiment: 'neutral',
    topicsDiscussed: topics,
  };

  const sessionId = uuidv4();
  getDataCloudWriteService().writeChatSummary(customerId, sessionId, summary).catch((err) => {
    console.error('[datacloud] Failed to write chat summary:', err);
  });
}

function extractTopicsFromMessages(msgs: AgentMessage[]): string[] {
  const allText = msgs.map((m) => m.content.toLowerCase()).join(' ');
  const topics: string[] = [];
  if (allText.includes('moisturizer') || allText.includes('hydrat')) topics.push('moisturizer');
  if (allText.includes('serum') || allText.includes('retinol')) topics.push('serum');
  if (allText.includes('cleanser')) topics.push('cleanser');
  if (allText.includes('sunscreen') || allText.includes('spf')) topics.push('sun protection');
  if (allText.includes('fragrance') || allText.includes('perfume')) topics.push('fragrance');
  if (allText.includes('travel')) topics.push('travel');
  if (allText.includes('gift') || allText.includes('anniversary')) topics.push('gifting');
  if (allText.includes('routine')) topics.push('skincare routine');
  if (allText.includes('checkout') || allText.includes('buy')) topics.push('purchase intent');
  return topics.length ? topics : ['general inquiry'];
}

interface ConversationContextValue {
  messages: AgentMessage[];
  isAgentTyping: boolean;
  isLoadingWelcome: boolean;
  suggestedActions: string[];
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

export const ConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [isLoadingWelcome, setIsLoadingWelcome] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([
    'Show me moisturizers',
    'I need travel products',
    'What do you recommend?',
  ]);
  const { processUIDirective, resetScene, setBackground, getSceneSnapshot, restoreSceneSnapshot } = useScene();
  const { customer, selectedPersonaId, isAuthenticated, isResolving, identifyByEmail, _isRefreshRef, _onSessionReset } = useCustomer();
  const { campaign } = useCampaign();
  const { showCapture } = useActivityToast();
  const messagesRef = useRef<AgentMessage[]>([]);
  const suggestedActionsRef = useRef<string[]>([]);
  const prevCustomerIdRef = useRef<string | null>(null);
  const prevPersonaIdRef = useRef<string | null>(null);
  const sessionCacheRef = useRef<Map<string, SessionSnapshot>>(new Map());

  // Keep refs in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    suggestedActionsRef.current = suggestedActions;
  }, [suggestedActions]);

  // Register for session reset notifications from CustomerContext
  useEffect(() => {
    return _onSessionReset((personaId: string) => {
      sessionCacheRef.current.delete(personaId);
      console.log('[session] Cleared cached session for', personaId);
    });
  }, [_onSessionReset]);

  // Write conversation summary when switching away from a customer
  useEffect(() => {
    const prevId = prevCustomerIdRef.current;
    prevCustomerIdRef.current = customer?.id || null;

    if (prevId && prevId !== customer?.id && messagesRef.current.length > 1) {
      writeConversationSummary(prevId, messagesRef.current);
    }
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: save current persona's state into the session cache
  const saveCurrentSession = useCallback((personaId: string) => {
    const client = getAgentforceClient();
    const agentSnap = client.getSessionSnapshot();
    const snapshot: SessionSnapshot = {
      messages: [...messagesRef.current],
      suggestedActions: [...suggestedActionsRef.current],
      sceneSnapshot: getSceneSnapshot(),
      agentSessionId: agentSnap.sessionId,
      agentSequenceId: agentSnap.sequenceId,
      mockSnapshot: useMockData ? getMockAgentSnapshot() : null,
      sessionInitialized,
    };
    sessionCacheRef.current.set(personaId, snapshot);
    console.log('[session] Saved session for', personaId, `(${snapshot.messages.length} messages)`);
  }, [getSceneSnapshot]);

  // When persona changes, reset conversation and trigger welcome
  useEffect(() => {
    // Wait for identity resolution to complete before acting on persona changes
    // This prevents clearing messages when selectedPersonaId changes but customer
    // hasn't resolved yet (race condition during persona switch)
    if (isResolving) {
      console.log('[session] Identity resolution in progress — waiting...');
      return;
    }

    // If this is a profile refresh (not a persona switch), skip session reset
    if (_isRefreshRef.current) {
      console.log('[session] Profile refresh — keeping conversation intact');
      return;
    }

    const prevPersonaId = prevPersonaIdRef.current;
    prevPersonaIdRef.current = selectedPersonaId;

    // Save outgoing persona's session (if any)
    if (prevPersonaId && prevPersonaId !== selectedPersonaId && messagesRef.current.length > 0) {
      saveCurrentSession(prevPersonaId);
    }

    if (!customer) {
      // Anonymous / no identity — reset to default starting page with default background
      resetScene();
      setBackground({ type: 'image', value: '/assets/backgrounds/default.png' });
      setMessages([]);
      setSuggestedActions([
        'Show me moisturizers',
        'I need travel products',
        'What do you recommend?',
      ]);
      setIsLoadingWelcome(false);
      return;
    }

    // Check if we have a cached session for this persona
    const cached = selectedPersonaId ? sessionCacheRef.current.get(selectedPersonaId) : null;

    if (cached) {
      // ── Restore cached session instantly ──
      console.log('[session] Restoring cached session for', selectedPersonaId, `(${cached.messages.length} messages)`);
      setMessages(cached.messages);
      setSuggestedActions(cached.suggestedActions);

      // Check if the cached scene has an incomplete background (was still loading when saved)
      const sceneBg = cached.sceneSnapshot.background;
      const isIncompleteBackground =
        (sceneBg.type === 'generative' && (!sceneBg.value || sceneBg.isLoading)) ||
        (sceneBg.type === 'image' && !sceneBg.value);

      if (isIncompleteBackground) {
        // Restore scene but use fallback background instead of incomplete one
        console.log('[session] Cached scene had incomplete background, using fallback');
        restoreSceneSnapshot({
          ...cached.sceneSnapshot,
          background: { type: 'image', value: '/assets/backgrounds/default.png' },
        });
      } else {
        restoreSceneSnapshot(cached.sceneSnapshot);
      }
      setIsLoadingWelcome(false);

      // Restore agent client state
      if (useMockData && cached.mockSnapshot) {
        restoreMockAgentSnapshot(cached.mockSnapshot);
      } else if (cached.agentSessionId) {
        getAgentforceClient().restoreSession(cached.agentSessionId, cached.agentSequenceId);
      }
      sessionInitialized = cached.sessionInitialized;
      return;
    }

    // ── No cache — fresh session ──
    const sessionCtx = buildSessionContext(customer, campaign ?? undefined);

    if (useMockData) {
      setMockCustomerContext(sessionCtx);
    } else {
      sessionInitialized = false;
    }

    // Clear conversation, scene state, and trigger welcome
    resetScene();
    setMessages([]);
    setSuggestedActions([]);
    setIsLoadingWelcome(true);

    const welcomeMsg = buildWelcomeMessage(sessionCtx);

    const timer = setTimeout(async () => {
      try {
        // Await session init so profile variables are available to the agent
        if (!useMockData) {
          try {
            await getAgentforceClient().initSession(sessionCtx);
            sessionInitialized = true;
          } catch (err) {
            console.error('Failed to init session:', err);
          }
        }

        // Appended-tier customers: session is initialized with 3P signals
        // (so subsequent messages can use them for curation), but the welcome
        // screen looks identical to anonymous — no personalized greeting.
        // Known-but-not-authenticated: Merkury identified them but they haven't
        // signed in. Treat the same — generic welcome, no personalization.
        // Their full profile is loaded and ready for when they do sign in.
        if (sessionCtx.identityTier === 'appended' ||
            (sessionCtx.identityTier === 'known' && !isAuthenticated)) {
          setBackground({ type: 'image', value: '/assets/backgrounds/default.png' });
          setSuggestedActions([
            'Show me moisturizers',
            'I need travel products',
            'What do you recommend?',
          ]);
          return;
        }

        const response = await getAgentResponse(welcomeMsg);

        // The real Agentforce agent may return CHANGE_SCENE, SHOW_PRODUCTS,
        // or even plain text with no uiDirective on the first message. Since we
        // know this IS the welcome flow, normalize it to WELCOME_SCENE so the
        // welcome overlay renders.
        if (!response.uiDirective || response.uiDirective.action !== 'WELCOME_SCENE') {
          const d = response.uiDirective;
          const firstSentence = response.message?.split(/[.!?]/)[0]?.trim() || 'Welcome!';
          response.uiDirective = {
            ...(d || {}),
            action: 'WELCOME_SCENE' as UIAction,
            payload: {
              ...(d?.payload || {}),
              welcomeMessage: d?.payload?.welcomeMessage || firstSentence,
              welcomeSubtext: d?.payload?.welcomeSubtext || response.message || '',
              sceneContext: d?.payload?.sceneContext || {
                setting: 'neutral',
                generateBackground: false,
              },
            },
          };
        }

        // For unknown customers (appended/anonymous), use the static default
        // background instead of generating one — save generation for known users.
        if (sessionCtx.identityTier !== 'known' && response.uiDirective?.payload) {
          response.uiDirective.payload.sceneContext = {
            ...response.uiDirective.payload.sceneContext,
            setting: 'neutral',
            generateBackground: false,
          };
        }

        const agentMessage: AgentMessage = {
          id: uuidv4(),
          role: 'agent',
          content: response.message,
          timestamp: new Date(),
          uiDirective: response.uiDirective,
        };
        setMessages([agentMessage]);
        let actions = response.suggestedActions || [];
        // Build context-aware fallback suggestions if agent didn't provide any
        if (!actions.length && response.uiDirective?.action === 'WELCOME_SCENE') {
          if (sessionCtx.identityTier === 'known' && sessionCtx.recentPurchases?.length) {
            actions = ['Restock my favorites', "What's new for me?", 'Show me something different'];
          } else {
            actions = ['Show me moisturizers', 'I need travel products', 'What do you recommend?'];
          }
        }
        setSuggestedActions(actions);

        if (response.uiDirective) {
          await processUIDirective(response.uiDirective);
        }
      } catch (error) {
        console.error('Welcome failed:', error);
      } finally {
        setIsLoadingWelcome(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customer, selectedPersonaId, isAuthenticated, isResolving]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: AgentMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setSuggestedActions([]);
    setIsAgentTyping(true);

    try {
      const response = await getAgentResponse(content);

      // If the agent returns a WELCOME_SCENE during a normal conversation
      // (user typed a message), downgrade it to CHANGE_SCENE so products
      // and background still render — just without the welcome overlay.
      if (response.uiDirective?.action === 'WELCOME_SCENE') {
        response.uiDirective = {
          ...response.uiDirective,
          action: (response.uiDirective.payload?.products?.length ? 'SHOW_PRODUCTS' : 'CHANGE_SCENE') as UIAction,
        };
      }

      const agentMessage: AgentMessage = {
        id: uuidv4(),
        role: 'agent',
        content: response.message,
        timestamp: new Date(),
        uiDirective: response.uiDirective,
      };
      setMessages((prev) => [...prev, agentMessage]);
      setSuggestedActions(response.suggestedActions || []);
      // Stop typing indicator before processing directive so background
      // transitions don't show a second typing bubble.
      setIsAgentTyping(false);

      if (response.uiDirective) {
        // Handle identity capture: upgrade anonymous → known without resetting conversation
        if (response.uiDirective.action === 'IDENTIFY_CUSTOMER' && response.uiDirective.payload?.customerEmail) {
          const email = response.uiDirective.payload.customerEmail;
          console.log('[conversation] IDENTIFY_CUSTOMER directive received for:', email);
          const success = await identifyByEmail(email);
          if (success) {
            showCapture({ type: 'contact_created', label: 'New Contact Created' });
          }
        } else {
          await processUIDirective(response.uiDirective);
        }

        // Show toast notifications for any background captures
        const captures = response.uiDirective.payload?.captures;
        if (captures?.length) {
          for (const c of captures) {
            showCapture(c);
            // Write client-detected meaningful events to Salesforce (best-effort).
            // Pass the SF Contact ID so the record is linked via Contact__c lookup.
            if (c.type === 'meaningful_event' && (customer?.email || customer?.id)) {
              const isSfId = customer?.id && /^003[a-zA-Z0-9]{12,15}$/.test(customer.id);
              getDataCloudWriteService().writeMeaningfulEvent(
                customer.email || customer.id,
                uuidv4(),
                {
                  eventType: 'life-event',
                  description: c.label.replace(/^Event Captured:\s*/i, ''),
                  capturedAt: new Date().toISOString(),
                  agentNote: 'Auto-captured from agent conversation text',
                },
                isSfId ? customer.id : undefined,
              ).catch(err => console.warn('[datacloud] Failed to write event:', err));
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to get agent response:', error);
      const errorMessage: AgentMessage = {
        id: uuidv4(),
        role: 'agent',
        content: "I'm sorry, I encountered an issue. Could you try again?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsAgentTyping(false);
    }
  }, [processUIDirective, identifyByEmail, showCapture]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setSuggestedActions([
      'Show me moisturizers',
      'I need travel products',
      'What do you recommend?',
    ]);
  }, []);

  return (
    <ConversationContext.Provider
      value={{ messages, isAgentTyping, isLoadingWelcome, suggestedActions, sendMessage, clearConversation }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = (): ConversationContextValue => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within ConversationProvider');
  }
  return context;
};
