import type { AgentResponse, UIAction } from '@/types/agent';
import type { CustomerSessionContext } from '@/types/customer';
import { MOCK_PRODUCTS } from '@/mocks/products';

interface ConversationState {
  lastShownProductIds: string[];
  currentProductId: string | null;
  shownCategories: string[];
  hasGreeted: boolean;
}

const state: ConversationState = {
  lastShownProductIds: [],
  currentProductId: null,
  shownCategories: [],
  hasGreeted: false,
};

// Customer context set by ConversationContext when persona changes
let customerCtx: CustomerSessionContext | null = null;

export function setMockCustomerContext(ctx: CustomerSessionContext | null): void {
  customerCtx = ctx;
  state.lastShownProductIds = [];
  state.currentProductId = null;
  state.shownCategories = [];
  state.hasGreeted = false;
}

export interface MockAgentSnapshot {
  state: ConversationState;
  customerCtx: CustomerSessionContext | null;
}

export function getMockAgentSnapshot(): MockAgentSnapshot {
  return { state: { ...state }, customerCtx };
}

export function restoreMockAgentSnapshot(snapshot: MockAgentSnapshot): void {
  Object.assign(state, snapshot.state);
  customerCtx = snapshot.customerCtx;
}

const findProduct = (id: string) => MOCK_PRODUCTS.find((p) => p.id === id);

// ─── Subtle enrichment probes ────────────────────────────────────
// Maps missing profile fields to conversationally natural follow-up prompts.
// The agent slips one of these into suggested actions to capture profile data.
const ENRICHMENT_PROBES: Record<string, string[]> = {
  'Birthday': ['Any special occasions coming up?'],
  'Anniversary': ['Shopping for someone special?', 'Any celebrations on the horizon?'],
  'Morning routine': ['How much time do you usually have in the morning?'],
  'Exercise': ['Do you work out regularly? It can affect your skin!'],
  'Work environment': ['Do you work indoors or outdoors? Helps me pick the right SPF.'],
  'Beauty priority': ['What matters most to you in skincare?'],
  'Price sensitivity': ['Do you have a budget in mind?'],
};

/** Pick a subtle enrichment probe based on missing fields, or null if none relevant. */
function getEnrichmentProbe(): string | null {
  const missing = customerCtx?.missingProfileFields;
  if (!missing?.length) return null;
  // Pick a random missing field that has probes
  const candidates = missing.filter((f) => ENRICHMENT_PROBES[f]);
  if (!candidates.length) return null;
  const field = candidates[Math.floor(Math.random() * candidates.length)];
  const probes = ENRICHMENT_PROBES[field];
  return probes[Math.floor(Math.random() * probes.length)];
}

// ─── Personalized welcome responses ───────────────────────────────

function generateWelcomeResponse(): AgentResponse | null {
  if (state.hasGreeted) return null;
  state.hasGreeted = true;

  if (!customerCtx) return null;

  const tier = customerCtx.identityTier;

  if (tier === 'known') {
    // Check for meaningful events and context from the richer data
    const hasTripEvent = customerCtx.meaningfulEvents?.some((e) => e.includes('Mumbai') || e.includes('trip'));
    const hasAnniversary = customerCtx.meaningfulEvents?.some((e) => e.toLowerCase().includes('anniversary'));
    const hasBrowseFragrance = customerCtx.browseInterests?.some((b) => b.includes('fragrance'));
    const hasBrowseSerum = customerCtx.browseInterests?.some((b) => b.includes('serum'));
    const loyaltyInfo = customerCtx.loyaltyTier
      ? `${customerCtx.loyaltyTier} member${customerCtx.loyaltyPoints ? ` with ${customerCtx.loyaltyPoints.toLocaleString()} points` : ''}`
      : null;
    const isNotLoyalty = !customerCtx.loyaltyTier;

    // Sarah-like: known + trip + loyalty
    if (hasTripEvent && loyaltyInfo) {
      return {
        sessionId: 'mock-session',
        message: `Welcome back, ${customerCtx.name}! How was Mumbai? As a ${loyaltyInfo}, you've earned some rewards while you were away.`,
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: `Welcome back, ${customerCtx.name}!`,
            welcomeSubtext: `Your travel SPF is probably running low after that trip. Let me help you restock — and you have rewards to redeem!`,
            sceneContext: {
              setting: 'lifestyle',
              mood: 'warm-travel-return',
              generateBackground: true,
              backgroundPrompt: 'Warm golden hour luxury lifestyle setting, welcoming atmosphere, soft ambient light, travel memories, elegant beauty space',
            },
          },
        },
        suggestedActions: ['Restock my travel essentials', "What's new since I've been away?", 'Show me evening skincare'],
        confidence: 0.98,
      };
    }

    // James-like: known + anniversary + browsing fragrances + no loyalty
    if (hasAnniversary && hasBrowseFragrance) {
      const enrollText = isNotLoyalty
        ? " Also, I'd love to tell you about our loyalty program — you'd earn points on every purchase."
        : '';
      return {
        sessionId: 'mock-session',
        message: `Welcome back, ${customerCtx.name}! I see you've been browsing fragrances — shopping for something special?${enrollText}`,
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: `Welcome back, ${customerCtx.name}!`,
            welcomeSubtext: `I noticed you've been looking at fragrances. I can help you find the perfect gift.${isNotLoyalty ? ' Plus, join our loyalty program today and earn points!' : ''}`,
            sceneContext: {
              setting: 'bedroom',
              mood: 'elegant-gifting',
              generateBackground: true,
              backgroundPrompt: 'Elegant intimate bedroom setting, soft evening light, luxury fragrance display atmosphere, romantic gift-giving mood',
            },
          },
        },
        suggestedActions: ['Show me fragrances', 'Help me find a gift', isNotLoyalty ? 'Tell me about loyalty' : 'Restock my cleanser'],
        confidence: 0.96,
      };
    }

    // Maya-like: known + platinum + had a return + makeup focus
    const hasReturnEvent = customerCtx.meaningfulEvents?.some((e) => e.toLowerCase().includes('return'));
    const hasBrowseMakeup = customerCtx.browseInterests?.some((b) => /foundation|blush|makeup|lipstick|mascara/.test(b));
    if (hasReturnEvent && loyaltyInfo) {
      return {
        sessionId: 'mock-session',
        message: `Welcome back, ${customerCtx.name}! As a ${loyaltyInfo}, I wanted to follow up — I have some lighter alternatives that might be a better fit for you.`,
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: `Welcome back, ${customerCtx.name}!`,
            welcomeSubtext: `I remember you returned something that wasn't quite right. Let me find you something better — plus you have rewards to redeem!`,
            sceneContext: {
              setting: 'vanity',
              mood: 'elegant-makeup',
              generateBackground: true,
              backgroundPrompt: 'Luxurious makeup vanity setting, soft glamorous lighting, high-end beauty atmosphere, warm and inviting',
            },
          },
        },
        suggestedActions: ['Show me lighter serums', 'Restock my makeup', 'What\'s new?'],
        confidence: 0.97,
      };
    }

    // Marcus-like: known + beginner + no loyalty + recent first order
    const isBeginnerEvent = customerCtx.meaningfulEvents?.some((e) => e.toLowerCase().includes('beginner'));
    if (isBeginnerEvent && isNotLoyalty) {
      return {
        sessionId: 'mock-session',
        message: `Hey ${customerCtx.name}! Great to see you back. How's the cleanser working out? Ready to add the next step to your routine?`,
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: `Welcome back, ${customerCtx.name}!`,
            welcomeSubtext: `Let's build on your new routine. I'll keep it simple — just one step at a time.`,
            sceneContext: {
              setting: 'bathroom',
              mood: 'fresh-start',
              generateBackground: true,
              backgroundPrompt: 'Clean modern bathroom setting, bright natural light, minimalist beauty space, fresh and inviting',
            },
          },
        },
        suggestedActions: ['What should I add next?', 'Show me moisturizers', 'Build me a simple routine'],
        confidence: 0.96,
      };
    }

    // Generic known with browse context
    if (hasBrowseSerum || hasBrowseFragrance || hasBrowseMakeup) {
      const browseContext = hasBrowseFragrance ? 'fragrances' : hasBrowseMakeup ? 'makeup' : 'serums';
      const setting = hasBrowseFragrance ? 'bedroom' : hasBrowseMakeup ? 'vanity' : 'lifestyle';
      return {
        sessionId: 'mock-session',
        message: `Welcome back, ${customerCtx.name}! I noticed you were looking at ${browseContext} recently.`,
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: `Welcome back, ${customerCtx.name}!`,
            welcomeSubtext: `I noticed you were browsing ${browseContext} recently. Shall I pick up where we left off?`,
            sceneContext: {
              setting,
              mood: 'personalized-return',
              generateBackground: true,
              backgroundPrompt: hasBrowseFragrance
                ? 'Elegant intimate bedroom setting, soft evening light, luxury fragrance display atmosphere'
                : hasBrowseMakeup
                  ? 'Luxurious makeup vanity setting, soft glamorous lighting, high-end beauty atmosphere'
                  : 'Sophisticated lifestyle beauty setting, warm natural light, luxury skincare atmosphere',
            },
          },
        },
        suggestedActions: [
          browseContext === 'fragrances' ? 'Show me fragrances' : browseContext === 'makeup' ? 'Show me makeup' : 'Show me serums',
          'Recommend something new',
          'Restock my favorites',
        ],
        confidence: 0.96,
      };
    }

    // Known customer, generic welcome
    const loyaltySubtext = loyaltyInfo
      ? `As a ${loyaltyInfo}, you have early access to our new arrivals.`
      : isNotLoyalty
        ? "Let me help you discover something perfect today. Have you considered joining our loyalty program?"
        : "Let me help you discover something perfect today.";
    return {
      sessionId: 'mock-session',
      message: `Welcome back, ${customerCtx.name}! Great to see you again.`,
      uiDirective: {
        action: 'WELCOME_SCENE' as UIAction,
        payload: {
          welcomeMessage: `Welcome back, ${customerCtx.name}!`,
          welcomeSubtext: loyaltySubtext,
          sceneContext: {
            setting: 'lifestyle',
            mood: 'personalized-welcome',
            generateBackground: true,
            backgroundPrompt: 'Elegant luxury beauty lifestyle setting, warm welcoming atmosphere, soft golden light',
          },
        },
      },
      suggestedActions: ['Show me what\'s new', 'Restock my favorites', 'Build me a routine'],
      confidence: 0.95,
    };
  }

  if (tier === 'appended') {
    // Appended tier: Merkury resolved identity and appended demographic/interest data,
    // but this person never gave us their info directly. We must NOT:
    //   - Greet by name (they didn't tell us their name)
    //   - Reference specific interests directly ("I see you like wellness")
    //   - Reveal we know anything about them
    // We CAN subtly use appended signals to:
    //   - Curate which products we lead with
    //   - Choose an appropriate scene/mood
    //   - Tailor suggested actions toward likely interests
    const interests = customerCtx.appendedInterests || [];
    const isWellness = interests.some((i) => i.includes('wellness') || i.includes('yoga'));
    const isClean = interests.some((i) => i.includes('clean'));
    const isAntiAging = interests.some((i) => i.includes('anti-aging') || i.includes('spa'));
    const isLuxury = interests.some((i) => i.includes('luxury'));

    // Priya-like: anti-aging + luxury + spa — lead with premium, don't say why
    if (isAntiAging && isLuxury) {
      return {
        sessionId: 'mock-session',
        message: "Welcome! We have some incredible new arrivals this season. I'd love to help you find something perfect.",
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: 'Welcome!',
            welcomeSubtext: "Discover our latest collection — from targeted treatments to everyday essentials.",
            sceneContext: {
              setting: 'neutral',
              generateBackground: false,
            },
          },
        },
        // Subtly surface anti-aging and premium options without saying "we know you want this"
        suggestedActions: ['Show me your bestsellers', "What's trending in skincare?", 'Help me build a routine'],
        confidence: 0.9,
      };
    }

    // Aisha-like: clean beauty + wellness — set a calming tone, don't reference interests
    return {
      sessionId: 'mock-session',
      message: "Welcome! I'm here to help you discover something you'll love. What are you looking for today?",
      uiDirective: {
        action: 'WELCOME_SCENE' as UIAction,
        payload: {
          welcomeMessage: 'Welcome!',
          welcomeSubtext: "Your personal beauty concierge — let's find your perfect match.",
          sceneContext: {
            setting: 'neutral',
            generateBackground: false,
          },
        },
      },
      // Subtly steer toward likely interests without being explicit
      suggestedActions: [
        isClean ? 'Show me clean beauty brands' : 'Show me skincare',
        isWellness ? 'Help me build a routine' : 'What do you recommend?',
        'Show me bestsellers',
      ],
      confidence: 0.9,
    };
  }

  // Anonymous
  return {
    sessionId: 'mock-session',
    message: "Welcome to your personal beauty concierge! What can I help you discover today?",
    uiDirective: {
      action: 'WELCOME_SCENE' as UIAction,
      payload: {
        welcomeMessage: 'Welcome!',
        welcomeSubtext: 'Your personal beauty concierge is ready to help you discover something perfect.',
        sceneContext: {
          setting: 'neutral',
          mood: 'elegant-welcome',
          generateBackground: false,
        },
      },
    },
    suggestedActions: ['Show me moisturizers', 'I need travel products', 'What do you recommend?'],
    confidence: 0.85,
  };
}

// ─── Standard response patterns ───────────────────────────────────

const RESPONSE_PATTERNS: {
  pattern: RegExp;
  response: () => Partial<AgentResponse>;
}[] = [
  {
    pattern: /cleanser|wash|face wash|cleanse/i,
    response: () => {
      const product = findProduct('cleanser-gentle')!;
      state.currentProductId = product.id;
      state.shownCategories.push('cleanser');
      return {
        message: `I'd recommend our ${product.name}. It's a creamy, sulfate-free formula that removes impurities without stripping your skin. Great for daily use!`,
        uiDirective: {
          action: 'SHOW_PRODUCT' as UIAction,
          payload: {
            products: [product],
            sceneContext: { setting: 'bathroom' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Add to bag', 'Show me something for acne', 'What else do you have?'],
      };
    },
  },
  {
    pattern: /moisturizer|hydrat|dry skin|sensitive/i,
    response: () => {
      const product = findProduct('moisturizer-sensitive')!;
      state.currentProductId = product.id;
      state.shownCategories.push('moisturizer');
      return {
        message: "I'd recommend our Hydra-Calm Sensitive Moisturizer. It's specifically formulated for sensitive skin with soothing centella and hyaluronic acid.",
        uiDirective: {
          action: 'SHOW_PRODUCT' as UIAction,
          payload: {
            products: [product],
            sceneContext: { setting: 'bathroom' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Add to bag', 'Tell me about the ingredients', 'Show me serums instead'],
      };
    },
  },
  {
    pattern: /serum|vitamin c|brightening|bright/i,
    response: () => {
      const serums = MOCK_PRODUCTS.filter((p) => p.category === 'serum');
      state.lastShownProductIds = serums.map((p) => p.id);
      state.shownCategories.push('serum');
      return {
        message: "We have some incredible serums! Our Vitamin C is perfect for brightening, the Retinol works overnight for fine lines, the Peptide Lift is our most advanced anti-aging, and the Niacinamide is great for pores and oil control.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products: serums,
            sceneContext: { setting: 'lifestyle' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Tell me about Vitamin C', 'I want the retinol', 'What about peptides?'],
      };
    },
  },
  {
    pattern: /sunscreen|spf|sun protect|uv/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.category === 'sunscreen');
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('sunscreen');
      return {
        message: "Sun protection is essential! Our Invisible Shield SPF 50 is ultra-lightweight with zero white cast — perfect for daily wear. For sensitive or acne-prone skin, try our Barrier Shield Mineral SPF 40.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'outdoor' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Add to bag', 'Show me travel products', 'What about moisturizers?'],
      };
    },
  },
  {
    pattern: /acne|breakout|pimple|blemish/i,
    response: () => {
      const products = [findProduct('cleanser-acne')!, findProduct('serum-niacinamide')!, findProduct('spot-treatment')!];
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('cleanser');
      return {
        message: "For acne-prone skin, here's a targeted trio: our Salicylic Cleanser to unclog pores, the Niacinamide Serum to calm and refine, and SOS Blemish Patches for overnight spot treatment.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'bathroom' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Get all three', 'Just the cleanser', 'What moisturizer for oily skin?'],
      };
    },
  },
  {
    pattern: /retinol|anti.?aging|wrinkle|fine line|firm|lift/i,
    response: () => {
      const products = [findProduct('serum-retinol')!, findProduct('serum-anti-aging')!, findProduct('eye-cream')!];
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('serum');
      return {
        message: "For anti-aging, I'd recommend our Midnight Renewal Retinol for overnight cell turnover, the Peptide Lift Pro for daytime firming, and our Bright Eyes Caffeine Cream for the delicate eye area.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'lifestyle' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Get all three', 'Tell me more about retinol', 'Just the peptide serum'],
      };
    },
  },
  {
    pattern: /routine|regimen|skincare routine|full routine/i,
    response: () => {
      const routine = [
        findProduct('cleanser-gentle')!,
        findProduct('toner-aha')!,
        findProduct('serum-vitamin-c')!,
        findProduct('moisturizer-sensitive')!,
        findProduct('sunscreen-lightweight')!,
      ];
      state.lastShownProductIds = routine.map((p) => p.id);
      return {
        message: "Here's a complete morning routine: Cleanse with Cloud Cream, tone with our AHA Glow Tonic, treat with Vitamin C Serum, moisturize with Hydra-Calm, and protect with SPF 50. Five steps to radiant skin!",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products: routine,
            sceneContext: { setting: 'bathroom' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Get the full routine', 'Customize for my skin type', 'What about nighttime?'],
      };
    },
  },
  {
    pattern: /evening|night routine|candlelight|warm light|wind down/i,
    response: () => {
      const products = [findProduct('cleanser-gentle')!, findProduct('serum-retinol')!, findProduct('mask-hydrating')!];
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: "Here's a calming evening routine: gentle cleanse, retinol serum for overnight renewal, and our hydrating sleep mask. I've set the mood with warm candlelight.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: {
              setting: 'bathroom' as const,
              generateBackground: true,
              editMode: true,
              cmsTag: 'scene-bathroom-evening',
              backgroundPrompt: 'Add warm golden candlelight glow, evening atmosphere, dimmed soft lighting',
            },
          },
        },
        suggestedActions: ['Get the night routine', 'Tell me about retinol', 'What about an eye cream?'],
      };
    },
  },
  {
    pattern: /mask|hydrating mask|sleeping mask|overnight/i,
    response: () => {
      const product = findProduct('mask-hydrating')!;
      state.currentProductId = product.id;
      return {
        message: `Our ${product.name} is perfect for an overnight moisture boost. Apply as the last step of your evening routine — wake up to plump, dewy skin.`,
        uiDirective: {
          action: 'SHOW_PRODUCT' as UIAction,
          payload: {
            products: [product],
            sceneContext: { setting: 'bedroom' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Add to bag', 'Show me a night routine', 'What else for dry skin?'],
      };
    },
  },
  {
    pattern: /toner|exfoli|pore|texture/i,
    response: () => {
      const product = findProduct('toner-aha')!;
      state.currentProductId = product.id;
      return {
        message: `Our ${product.name} is a gentle 5% glycolic acid toner that smooths texture, minimizes pores, and preps skin for your serum.`,
        uiDirective: {
          action: 'SHOW_PRODUCT' as UIAction,
          payload: {
            products: [product],
            sceneContext: { setting: 'bathroom' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Add to bag', 'Show me a full routine', 'What serum pairs well?'],
      };
    },
  },
  {
    pattern: /makeup|foundation|base|coverage|concealer/i,
    response: () => {
      const products = [findProduct('foundation-dewy')!, findProduct('blush-silk')!, findProduct('mascara-volume')!];
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: "Let me set up our makeup station! Here are our bestsellers: the Skin Glow Serum Foundation for luminous coverage, Silk Petal Blush for a natural flush, and Lash Drama Mascara for buildable volume.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'vanity' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Tell me about the foundation', 'Show me lipsticks', 'I want a full look'],
      };
    },
  },
  {
    pattern: /lipstick|lip color|lip/i,
    response: () => {
      const product = findProduct('lipstick-velvet')!;
      state.currentProductId = product.id;
      return {
        message: `Our ${product.name} is a hydrating matte formula that feels weightless and never dries out.`,
        uiDirective: {
          action: 'SHOW_PRODUCT' as UIAction,
          payload: {
            products: [product],
            sceneContext: { setting: 'vanity' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Add to bag', 'Show me more makeup', 'What about blush?'],
      };
    },
  },
  {
    pattern: /blush|cheek/i,
    response: () => {
      const product = findProduct('blush-silk')!;
      state.currentProductId = product.id;
      return {
        message: `The ${product.name} melts into skin for a natural, lit-from-within flush.`,
        uiDirective: {
          action: 'SHOW_PRODUCT' as UIAction,
          payload: {
            products: [product],
            sceneContext: { setting: 'vanity' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Add to bag', 'Show me foundation', 'Build me a full makeup look'],
      };
    },
  },
  {
    pattern: /mascara|lash|eyelash/i,
    response: () => {
      const product = findProduct('mascara-volume')!;
      state.currentProductId = product.id;
      return {
        message: `The ${product.name} has an hourglass-shaped brush that coats every lash root to tip. No clumping!`,
        uiDirective: {
          action: 'SHOW_PRODUCT' as UIAction,
          payload: {
            products: [product],
            sceneContext: { setting: 'vanity' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Add to bag', 'Show me a full makeup look', 'What about lipstick?'],
      };
    },
  },
  {
    pattern: /fragrance|perfume|cologne|scent|smell|eau de/i,
    response: () => {
      const products = [findProduct('fragrance-floral')!, findProduct('fragrance-woody')!];
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: "Step into our fragrance collection. Jardin de Nuit is a sophisticated floral — perfect for evening. Bois Sauvage is a fresh woody scent — great for everyday.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'bedroom' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Tell me about Jardin de Nuit', 'I prefer woody scents', 'Show me skincare instead'],
      };
    },
  },
  {
    pattern: /hair|shampoo|conditioner|damaged hair|color.?treated/i,
    response: () => {
      const products = [findProduct('shampoo-repair')!, findProduct('conditioner-hydrating')!];
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: "For your hair, I'd recommend our Bond Repair duo: the shampoo strengthens damaged bonds, and the Silk Hydration Conditioner adds shine and detangles.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'bathroom' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Get both', 'Just the shampoo', 'Show me skincare instead'],
      };
    },
  },
  {
    pattern: /restock|running low|refill|favorite|my product/i,
    response: () => {
      if (customerCtx?.recentPurchases?.length) {
        // Deduplicate product IDs
        const uniqueIds = [...new Set(customerCtx.recentPurchases)];
        const products = uniqueIds
          .map((id) => findProduct(id))
          .filter(Boolean) as NonNullable<ReturnType<typeof findProduct>>[];
        if (products.length) {
          state.lastShownProductIds = products.map((p) => p.id);
          return {
            message: `Here are your recent purchases, ${customerCtx.name}. Shall I add any to your bag for a quick restock?`,
            uiDirective: {
              action: 'SHOW_PRODUCTS' as UIAction,
              payload: {
                products,
                sceneContext: { setting: 'bathroom' as const, generateBackground: false },
              },
            },
            suggestedActions: ['Reorder all', 'Just the SPF', 'Show me something new instead'],
          };
        }
      }
      return {
        message: "I'd love to help you restock! What products are you running low on?",
        suggestedActions: ['Moisturizer', 'Cleanser', 'SPF', 'Show me everything'],
      };
    },
  },
  {
    pattern: /recommend|what should|suggest|what do you|for me|bestseller|new|what.?s new/i,
    response: () => {
      const picks = [
        findProduct('moisturizer-sensitive')!,
        findProduct('serum-vitamin-c')!,
        findProduct('foundation-dewy')!,
        findProduct('fragrance-floral')!,
      ];
      state.lastShownProductIds = picks.map((p) => p.id);
      return {
        message: "Here are my top picks across categories: Hydra-Calm Moisturizer, our bestselling Vitamin C Serum, the luminous Skin Glow Foundation, and our signature Jardin de Nuit fragrance.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products: picks,
            sceneContext: { setting: 'lifestyle' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Show me skincare', 'Show me makeup', 'Show me fragrances'],
      };
    },
  },
  {
    pattern: /buy|purchase|add to (bag|cart)|get (it|this|both|all|the|them)/i,
    response: () => ({
      message: "Perfect choice! I'll set that up for you.",
      uiDirective: {
        action: 'INITIATE_CHECKOUT' as UIAction,
        payload: {
          checkoutData: { products: [], useStoredPayment: true },
        },
      },
      suggestedActions: [],
    }),
  },
  {
    pattern: /travel|trip|going to|vacation|india|hot (weather|climate)/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.attributes.isTravel);
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: "Here are our travel essentials — all compact and carry-on friendly.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'travel' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Get the travel kit', 'Just the sunscreen', 'What about a cleanser?'],
      };
    },
  },
  {
    pattern: /ingredient|what.?s in|contain|formul/i,
    response: () => {
      if (state.currentProductId) {
        const product = findProduct(state.currentProductId);
        if (product && product.attributes?.ingredients) {
          return {
            message: `The ${product.name} contains: ${product.attributes.ingredients.join(', ')}.`,
            suggestedActions: ['Add to bag', 'Show me something else', 'Any alternatives?'],
          };
        }
      }
      return {
        message: "I'd be happy to tell you about ingredients! Which product are you curious about?",
        suggestedActions: ['Moisturizer ingredients', 'Serum ingredients', 'Cleanser ingredients'],
      };
    },
  },
  {
    pattern: /thank|thanks|bye|goodbye/i,
    response: () => ({
      message: "You're welcome! It was lovely helping you today. Enjoy your new products!",
      uiDirective: {
        action: 'RESET_SCENE' as UIAction,
        payload: {},
      },
      suggestedActions: [],
    }),
  },
  {
    pattern: /hi|hello|hey|good (morning|afternoon|evening)/i,
    response: () => {
      const welcome = generateWelcomeResponse();
      if (welcome) return welcome;
      return {
        message: "Hello! Welcome to your personal beauty concierge. What are you looking for today?",
        suggestedActions: ['Show me moisturizers', 'Show me makeup', 'Show me fragrances', 'Build me a routine'],
      };
    },
  },
];

export const generateMockResponse = async (message: string): Promise<AgentResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

  // Auto-welcome trigger from ConversationContext on persona change
  if (message === '[WELCOME]') {
    const welcome = generateWelcomeResponse();
    if (welcome) return welcome;
  }

  for (const { pattern, response } of RESPONSE_PATTERNS) {
    if (message.match(pattern)) {
      const result = response();
      // Occasionally slip in an enrichment probe as the last suggested action
      const actions = [...(result.suggestedActions || [])];
      const probe = getEnrichmentProbe();
      if (probe && actions.length >= 2 && Math.random() < 0.4) {
        actions[actions.length - 1] = probe;
      }
      return {
        sessionId: 'mock-session',
        message: result.message!,
        uiDirective: result.uiDirective,
        suggestedActions: actions,
        confidence: result.confidence || 0.95,
      };
    }
  }

  return {
    sessionId: 'mock-session',
    message: "I'd be happy to help! I can recommend skincare, makeup, fragrances, or hair care. What interests you?",
    suggestedActions: ['Show me skincare', 'Show me makeup', 'Show me fragrances', 'Build me a routine'],
    confidence: 0.8,
  };
};
