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
const ENRICHMENT_PROBES: Record<string, string[]> = {
  'Daily intake goal': ['How much water are you aiming to drink each day?'],
  'Activity level': ['Do you work out regularly? It affects how much water you need.'],
  'Household size': ['How many people are you hydrating for at home?'],
  'Work environment': ['Do you work from home or in an office?'],
  'Climate': ['What's the climate like where you live? Heat and humidity change everything.'],
  'Sparkling preference': ['Do you prefer still or sparkling water?'],
  'Delivery frequency': ['How often would you want a delivery — weekly or every two weeks?'],
};

function getEnrichmentProbe(): string | null {
  const missing = customerCtx?.missingProfileFields;
  if (!missing?.length) return null;
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
    const hasDeliveryOrder = customerCtx.recentPurchases?.some((id) => id.includes('delivery') || id.includes('5gal'));
    const hasSparklingOrder = customerCtx.recentPurchases?.some((id) => id.includes('sparkling'));
    const hasHydrationGoal = customerCtx.meaningfulEvents?.some((e) => e.toLowerCase().includes('marathon') || e.toLowerCase().includes('training'));
    const hasFamilyEvent = customerCtx.meaningfulEvents?.some((e) => e.toLowerCase().includes('moving') || e.toLowerCase().includes('family'));
    const hasOfficeContext = customerCtx.primaryUse === 'office';
    const loyaltyInfo = customerCtx.loyaltyTier
      ? `${customerCtx.loyaltyTier} member${customerCtx.loyaltyPoints ? ` with ${customerCtx.loyaltyPoints.toLocaleString()} points` : ''}`
      : null;
    const isNotLoyalty = !customerCtx.loyaltyTier;

    // Alex-like: athlete with training goal
    if (hasHydrationGoal && loyaltyInfo) {
      return {
        sessionId: 'mock-session',
        message: `Welcome back, ${customerCtx.name}! Your marathon training is in full swing — let me help you stay ahead on hydration.`,
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: `Welcome back, ${customerCtx.name}!`,
            welcomeSubtext: `Marathon training starts with the right hydration. Let's talk.`,
            sceneContext: {
              setting: 'fitness',
              generateBackground: true,
              backgroundPrompt: 'Early morning trail run at golden hour, athlete holding water bottle, pine trees and mountain mist, energizing and fresh',
            },
          },
        },
        suggestedActions: ['Build my training hydration plan', 'Show me sparkling water', 'Adjust my delivery'],
        confidence: 0.98,
      };
    }

    // Maria-like: family, moving
    if (hasFamilyEvent) {
      return {
        sessionId: 'mock-session',
        message: `Welcome back, ${customerCtx.name}! New place — let's make sure your hydration setup is ready for the whole family.`,
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: `Welcome back, ${customerCtx.name}!`,
            welcomeSubtext: `New home, same great water. Let's get you set up.`,
            sceneContext: {
              setting: 'home-kitchen',
              generateBackground: true,
              backgroundPrompt: 'Bright sunny kitchen with unpacked moving boxes, Primo water dispenser on counter, warm morning light, fresh start energy',
            },
          },
        },
        suggestedActions: ['Help me set up my dispenser', 'Show kids water bottles', 'Update my delivery address'],
        confidence: 0.96,
      };
    }

    // David-like: office manager
    if (hasOfficeContext) {
      return {
        sessionId: 'mock-session',
        message: `Welcome back, ${customerCtx.name}! Let's make sure your office stays hydrated. I can help you optimize your delivery schedule.`,
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: `Welcome back, ${customerCtx.name}!`,
            welcomeSubtext: `Keeping your team hydrated. Let's review your setup.`,
            sceneContext: {
              setting: 'office',
              generateBackground: true,
              backgroundPrompt: 'Modern open-plan office with floor-to-ceiling windows, water dispenser station with team members, professional and energized atmosphere',
            },
          },
        },
        suggestedActions: ['Review my delivery schedule', 'Add another dispenser', 'Optimize my order'],
        confidence: 0.95,
      };
    }

    // Generic known customer with delivery
    if (hasDeliveryOrder && loyaltyInfo) {
      return {
        sessionId: 'mock-session',
        message: `Welcome back, ${customerCtx.name}! Your next delivery is on the way. Anything I can help you with today?`,
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: `Welcome back, ${customerCtx.name}!`,
            welcomeSubtext: `Your water is on the way — anything else I can help with?`,
            sceneContext: {
              setting: 'home-kitchen',
              generateBackground: true,
              backgroundPrompt: 'Clean bright kitchen with Primo dispenser, morning light through window, fresh fruit on the counter, calm and inviting',
            },
          },
        },
        suggestedActions: ['Track my delivery', 'Show me new sparkling flavors', 'Manage my subscription'],
        confidence: 0.95,
      };
    }

    // Known customer, no specific context match
    const loyaltySubtext = loyaltyInfo
      ? `Great to see you — ${loyaltyInfo}. What can I help with today?`
      : "What can I help you with today?";
    return {
      sessionId: 'mock-session',
      message: `Welcome back, ${customerCtx.name}! How can I help you stay hydrated today?`,
      uiDirective: {
        action: 'WELCOME_SCENE' as UIAction,
        payload: {
          welcomeMessage: `Welcome back, ${customerCtx.name}!`,
          welcomeSubtext: loyaltySubtext,
          sceneContext: {
            setting: 'home-kitchen',
            generateBackground: true,
            backgroundPrompt: 'Welcoming modern kitchen with natural light, water dispenser gleaming, clean minimalist surfaces, bright and fresh',
          },
        },
      },
      suggestedActions: ["What's new?", 'Build my hydration plan', 'Manage my delivery'],
      confidence: 0.95,
    };
  }

  if (tier === 'appended') {
    // Appended: Merkury recognized, no CRM record. Don't reveal we know their interests.
    const interests = customerCtx.appendedInterests || [];
    const isFitness = interests.some((i) => i.includes('fitness') || i.includes('running') || i.includes('triathlon'));
    const isWellness = interests.some((i) => i.includes('wellness') || i.includes('yoga') || i.includes('organic'));
    const isFamily = interests.some((i) => i.includes('family') || i.includes('kids'));

    if (isFitness) {
      return {
        sessionId: 'mock-session',
        message: "Welcome! Staying properly hydrated can transform your performance. Want me to help you find the right setup?",
        uiDirective: {
          action: 'WELCOME_SCENE' as UIAction,
          payload: {
            welcomeMessage: 'Welcome!',
            welcomeSubtext: "Let's find the hydration plan that fits your lifestyle.",
            sceneContext: { setting: 'fitness', generateBackground: false },
          },
        },
        suggestedActions: ['Show me sparkling water', 'Help me build a hydration plan', 'Show me water bottles'],
        confidence: 0.9,
      };
    }

    return {
      sessionId: 'mock-session',
      message: "Welcome! I'm your Hydration Intelligence Concierge — here to help you discover the best water for your life.",
      uiDirective: {
        action: 'WELCOME_SCENE' as UIAction,
        payload: {
          welcomeMessage: 'Welcome!',
          welcomeSubtext: "Your personal hydration advisor — let's get you started.",
          sceneContext: { setting: 'wellness', generateBackground: false },
        },
      },
      suggestedActions: [
        isWellness ? 'Show me clean hydration options' : 'Show me what you offer',
        isFamily ? 'Solutions for the whole family' : 'Help me build a hydration plan',
        'Show me bestsellers',
      ],
      confidence: 0.9,
    };
  }

  // Anonymous
  return {
    sessionId: 'mock-session',
    message: "Welcome to Primo Brands! I'm your Hydration Intelligence Concierge — here to help you find the perfect water solution.",
    uiDirective: {
      action: 'WELCOME_SCENE' as UIAction,
      payload: {
        welcomeMessage: 'Welcome to Primo!',
        welcomeSubtext: 'Pure water, delivered your way. Let me help you get started.',
        sceneContext: {
          setting: 'home-kitchen',
          generateBackground: false,
        },
      },
    },
    suggestedActions: ['Show me home delivery', 'Show me sparkling water', 'Help me choose a dispenser'],
    confidence: 0.85,
  };
}

// ─── Standard response patterns ───────────────────────────────────

const RESPONSE_PATTERNS: {
  pattern: RegExp;
  response: () => Partial<AgentResponse>;
}[] = [
  {
    pattern: /dispenser|water machine|water cooler/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.category === 'dispenser');
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('dispenser');
      return {
        message: "Here are our dispensers! The Bottom-Loading is our most popular — no heavy lifting required. The Top-Loading is a classic budget option. The Countertop is perfect for apartments and small offices.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'home-kitchen' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Tell me about the bottom-loading', 'Which is best for an office?', 'How does delivery work?'],
      };
    },
  },
  {
    pattern: /delivery|5.?gallon|jug|5 gallon|water delivery|schedule/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.category === 'delivery');
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('delivery');
      return {
        message: "Our 5-gallon delivery is the most cost-effective way to get pure water at home. Choose weekly or bi-weekly — most families order 2–4 jugs per delivery at $12.99 each. Easy to pause or modify anytime.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'home-kitchen' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Weekly delivery', 'Bi-weekly delivery', 'How many jugs do I need?'],
      };
    },
  },
  {
    pattern: /sparkling|bubbly|carbonat/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.category === 'sparkling');
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('sparkling');
      return {
        message: "Our sparkling line is zero sugar, zero calories, perfectly carbonated. Original is crisp and clean. Lemon is our #1 seller — bright and citrusy. Mixed Berry is fruity, Lime is sharp and refreshing.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'fitness' as const, generateBackground: false },
          },
        },
        suggestedActions: ['I love citrus', 'Show me the berry', 'Mix a variety pack'],
      };
    },
  },
  {
    pattern: /flavored|infused|cucumber|watermelon|peach/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.category === 'flavored');
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('flavored');
      return {
        message: "Our flavored still water is perfect for those who want a hint of taste without carbonation. Cucumber Mint is our spa-inspired bestseller. Watermelon is popular with families and kids. Peach Ginger has a lovely wellness warmth.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'wellness' as const, generateBackground: false },
          },
        },
        suggestedActions: ['I like the cucumber mint', 'Perfect for my kids', 'Show me sparkling instead'],
      };
    },
  },
  {
    pattern: /bottle|still water|pure life|spring water|single.?serve/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.category === 'still');
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('still');
      return {
        message: "Pure Life is our trusted single-serve still water line. Sourced from carefully selected springs with a blend of minerals for great taste. We have standard 16.9oz (24-pack), sport cap bottles for workouts, and 1-gallon jugs.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'outdoor' as const, generateBackground: false },
          },
        },
        suggestedActions: ['The 24-pack', 'Sport cap for workouts', 'Gallon jugs for home'],
      };
    },
  },
  {
    pattern: /reusable bottle|water bottle|stainless|insulated|carry/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.category === 'bottle');
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('bottle');
      return {
        message: "Our stainless steel bottles keep water cold for 24 hours — perfect for filling from your Primo dispenser. The 32oz is ideal for athletes. The 24oz slim version fits in cup holders for commuters. The Kids bottle is spill-proof and drop-resistant.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'fitness' as const, generateBackground: false },
          },
        },
        suggestedActions: ['The 32oz for workouts', 'Slim 24oz for commuting', 'Kids bottle'],
      };
    },
  },
  {
    pattern: /filter|pitcher|filtration|contaminant|tap water/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.category === 'filter');
      state.lastShownProductIds = products.map((p) => p.id);
      state.shownCategories.push('filter');
      return {
        message: "Our filter pitcher removes 30+ contaminants including chlorine, lead, and mercury. Great if your tap water has an off taste or if you want budget-friendly filtered water at home. Filter replacements last ~2 months.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'home-kitchen' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Get the filter pitcher', 'How often do I change the filter?', 'Test my tap water first'],
      };
    },
  },
  {
    pattern: /test.*(water|tap)|quality|contaminant|what.?s in.*water/i,
    response: () => {
      const product = findProduct('water-quality-test-kit');
      if (!product) return { message: "Our Water Quality Test Kit can test 12 parameters in minutes." };
      state.currentProductId = product.id;
      return {
        message: "Not sure what's in your tap water? Our Home Water Quality Test Kit tests for 12 parameters — chlorine, lead, hardness, pH, bacteria, and more. Results in minutes, easy color-chart reading.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products: [product],
            sceneContext: { setting: 'home-kitchen' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Add test kit', 'Show me filter pitchers', 'Tell me about delivery instead'],
      };
    },
  },
  {
    pattern: /hydration plan|daily goal|how much water|intake|oz|ounces|how much should I drink/i,
    response: () => {
      const primaryUse = customerCtx?.primaryUse;
      let planText = "";
      let products: typeof MOCK_PRODUCTS = [];
      if (primaryUse === 'fitness') {
        planText = "For athletes training hard, I recommend 100–128oz per day. On rest days, 80–90oz is plenty. Sparkling water post-workout is great for recovery — the carbonation helps settle the stomach.";
        products = MOCK_PRODUCTS.filter((p) => ['sparkling', 'bottle'].includes(p.category)).slice(0, 3);
      } else if (primaryUse === 'office') {
        planText = "For office workers, the recommended baseline is 64oz/day — but most people fall short because they forget. Having a Primo dispenser nearby boosts intake by ~30%. A 32oz bottle at your desk is a great visual reminder.";
        products = MOCK_PRODUCTS.filter((p) => ['dispenser', 'bottle'].includes(p.category)).slice(0, 2);
      } else {
        planText = "The general guideline is 64–80oz per day for most adults. Hot climates add 20–30%. Active people need more. For a family of 4, you're looking at 5+ gallons per week — our weekly delivery is perfect for that.";
        products = MOCK_PRODUCTS.filter((p) => ['delivery', 'sparkling'].includes(p.category)).slice(0, 2);
      }
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: planText,
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'wellness' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Build my full hydration plan', 'Show me delivery options', 'What about sparkling?'],
      };
    },
  },
  {
    pattern: /office|work|team|employees|workplace|corporate/i,
    response: () => {
      const products = [
        findProduct('primo-dispenser-bottom')!,
        findProduct('primo-5gal-delivery-weekly')!,
      ].filter(Boolean);
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: "For offices, our most popular setup is the Bottom-Loading Dispenser with weekly 5-gallon delivery. Most offices of 20–30 people need 3–5 jugs per week. You'll typically save 40–60% vs. a traditional bottled water service.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'office' as const, generateBackground: false },
          },
        },
        suggestedActions: ['How many jugs do I need?', 'Tell me about the dispenser', 'Compare to bottled service'],
      };
    },
  },
  {
    pattern: /family|kids|children|household|home setup/i,
    response: () => {
      const products = [
        findProduct('primo-dispenser-bottom')!,
        findProduct('primo-5gal-delivery-weekly')!,
        findProduct('bottle-kids-16oz')!,
        findProduct('flavored-watermelon')!,
      ].filter(Boolean);
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: "For families, our most popular setup is a bottom-loading dispenser with weekly delivery — kids love having water easily accessible. Our Kids Bottle is spill-proof and drop-resistant. Watermelon flavored water is a huge hit with kids who don't love plain water.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'home-kitchen' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Set up weekly delivery', 'Show me kids bottles', 'How much for a family of 5?'],
      };
    },
  },
  {
    pattern: /membership|primo perks|loyalty|points|tier|reward/i,
    response: () => {
      const products = MOCK_PRODUCTS.filter((p) => p.category === 'subscription');
      state.lastShownProductIds = products.map((p) => p.id);
      const loyaltyInfo = customerCtx?.loyaltyTier
        ? `You're currently a ${customerCtx.loyaltyTier} member with ${(customerCtx.loyaltyPoints || 0).toLocaleString()} points.`
        : null;
      return {
        message: loyaltyInfo
          ? `${loyaltyInfo} Primo Perks has 4 tiers: Hydrated (entry), Active (1,000 pts — 5% off accessories), Elite (2,500 pts — 10% off + free sanitizer kit), and Champion (5,000 pts — dedicated concierge + wellness events).`
          : "Primo Perks is our membership program. Active members ($9.99/mo) get 5% off accessories and priority delivery. Elite ($19.99/mo) gets 10% off everything, free annual sanitizer kit, and wellness content. Champion tier is earned by spending.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'neutral' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Join Active membership', 'Upgrade to Elite', 'How do I earn points?'],
      };
    },
  },
  {
    pattern: /sustainability|eco|plastic|recycle|environment|zero.?waste|green/i,
    response: () => {
      const products = [
        findProduct('primo-5gal-delivery-biweekly')!,
        findProduct('filter-pitcher-10cup')!,
        findProduct('bottle-stainless-32oz')!,
      ].filter(Boolean);
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: "Great choice for the planet! Our 5-gallon delivery uses refillable, returnable jugs — significantly reducing plastic waste vs. single-use bottles. Filter pitchers eliminate hundreds of bottles per year. Our stainless steel bottles replace thousands of single-use plastic bottles over their lifetime.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'outdoor' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Start refillable delivery', 'Get a filter pitcher', 'Show me reusable bottles'],
      };
    },
  },
  {
    pattern: /restock|running low|refill|reorder|my order|previous|favorite/i,
    response: () => {
      if (customerCtx?.recentPurchases?.length) {
        const uniqueIds = [...new Set(customerCtx.recentPurchases)];
        const products = uniqueIds
          .map((id) => findProduct(id))
          .filter(Boolean) as NonNullable<ReturnType<typeof findProduct>>[];
        if (products.length) {
          state.lastShownProductIds = products.map((p) => p.id);
          return {
            message: `Here are your recent orders, ${customerCtx.name || 'there'}. Ready to reorder?`,
            uiDirective: {
              action: 'SHOW_PRODUCTS' as UIAction,
              payload: {
                products,
                sceneContext: { setting: 'home-kitchen' as const, generateBackground: false },
              },
            },
            suggestedActions: ['Reorder all', 'Add more sparkling', 'Adjust my delivery schedule'],
          };
        }
      }
      return {
        message: "I'd be happy to help you reorder! What are you running low on?",
        suggestedActions: ['Sparkling water', '5-gallon delivery', 'Filter replacements', 'Show me everything'],
      };
    },
  },
  {
    pattern: /recommend|what should|suggest|what do you|for me|bestseller|new|what.?s new/i,
    response: () => {
      const picks = [
        findProduct('primo-dispenser-bottom')!,
        findProduct('sparkling-lemon')!,
        findProduct('flavored-cucumber-mint')!,
        findProduct('bottle-stainless-32oz')!,
      ].filter(Boolean);
      state.lastShownProductIds = picks.map((p) => p.id);
      return {
        message: "Here are my top picks: our most popular bottom-loading dispenser, the bestselling Sparkling Lemon (our #1 flavor), Cucumber Mint flavored water for a spa-quality experience, and our 24-hour insulated stainless bottle.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products: picks,
            sceneContext: { setting: 'home-kitchen' as const, generateBackground: false },
          },
        },
        suggestedActions: ['Show me dispensers', 'Show me sparkling', 'Help me build a plan'],
      };
    },
  },
  {
    pattern: /buy|purchase|add to (bag|cart)|get (it|this|both|all|the|them)|checkout/i,
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
    pattern: /marathon|training|athlete|triathlon|running|cycling|workout|sport/i,
    response: () => {
      const products = [
        findProduct('sparkling-lemon')!,
        findProduct('sparkling-original')!,
        findProduct('bottle-stainless-32oz')!,
        findProduct('pure-life-sport-700ml')!,
      ].filter(Boolean);
      state.lastShownProductIds = products.map((p) => p.id);
      return {
        message: "For athletes, I love Primo Sparkling as a post-workout reward — the carbonation helps settle your stomach. Our 32oz stainless bottle stays cold all day. Pure Life Sport has a squeeze-friendly cap perfect for mid-run.",
        uiDirective: {
          action: 'SHOW_PRODUCTS' as UIAction,
          payload: {
            products,
            sceneContext: { setting: 'fitness' as const, generateBackground: true, backgroundPrompt: 'Trail running at golden hour through pine forest, athlete with water bottle, energizing morning light and fresh mountain air' },
          },
        },
        suggestedActions: ['Build my training hydration plan', 'Show me more sparkling', 'The 32oz bottle'],
      };
    },
  },
  {
    pattern: /thank|thanks|bye|goodbye/i,
    response: () => ({
      message: "You're welcome! Stay hydrated — it makes a real difference. Enjoy your Primo water!",
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
        message: "Hello! Welcome to Primo Brands. What can I help you with today?",
        suggestedActions: ['Show me home delivery', 'Show me sparkling water', 'Help me choose a dispenser', 'Build my hydration plan'],
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
    message: "I can help you with home delivery, dispensers, sparkling water, hydration plans, and your Primo Perks membership. What would you like to explore?",
    suggestedActions: ['Show me home delivery', 'Show me sparkling water', 'Build my hydration plan', 'Tell me about Primo Perks'],
    confidence: 0.8,
  };
};
