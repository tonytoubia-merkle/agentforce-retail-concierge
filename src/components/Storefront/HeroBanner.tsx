import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { CustomerProfile } from '@/types/customer';
import type { CampaignAttribution } from '@/types/campaign';
import { useCampaign } from '@/contexts/CampaignContext';
import { isPersonalizationConfigured, getHeroCampaignDecision, type PersonalizationDecision } from '@/services/personalization';

interface HeroBannerProps {
  onShopNow: () => void;
  customer?: CustomerProfile | null;
  isAuthenticated?: boolean;
}

// Hero image mapping for personalization scenarios
const HERO_IMAGES = {
  authenticated: '/assets/hero/hero-dispenser-home.png',    // Known + signed in → home dispenser
  pseudonymous: '/assets/hero/hero-sparkling-pour.png',     // Known + not signed in → fresh pour
  fitness: '/assets/hero/hero-athlete-hydration.png',       // 3P fitness/active interests
  wellness: '/assets/hero/hero-wellness-water.png',         // 3P wellness interests
  family: '/assets/hero/hero-family-kitchen.png',           // 3P family interests
  default: '/assets/hero/hero-water-fresh.png',             // Anonymous → aspirational clean water
};

interface HeroVariant {
  badge: string;
  headlineTop: string;
  headlineBottom: string;
  subtitle: string;
  heroImage: string;
  imageAlt: string;
  /** Where the variant was resolved from — 'default' means no specific context matched */
  source: 'campaign' | 'authenticated' | 'appended' | 'default';
}

// Map campaign themes to hero badge + copy overrides
const CAMPAIGN_HERO_MAP: Record<string, { badge: string; headlineTop: string; headlineBottom: string; subtitle: string }> = {
  'summer-hydration': { badge: 'Summer Hydration', headlineTop: 'Stay Cool,', headlineBottom: 'Stay Hydrated', subtitle: 'Beat the heat with pure, refreshing water delivered to your door.' },
  'fitness-fuel': { badge: 'Fuel Your Performance', headlineTop: 'Hydrate Like', headlineBottom: 'A Champion', subtitle: 'Elite athletes know hydration is everything. Your personalized plan starts here.' },
  'clean-water': { badge: 'Pure & Clean', headlineTop: 'Pure Water,', headlineBottom: 'Purified Process', subtitle: 'Multi-step purification removes 99% of contaminants for water you can trust.' },
  'sparkling-new': { badge: 'New Sparkling Flavors', headlineTop: 'Discover', headlineBottom: 'Bold New Flavors', subtitle: 'Crisp, zero-calorie sparkling water in flavors you will love.' },
  'family-wellness': { badge: 'Family Wellness', headlineTop: 'Keep Your Family', headlineBottom: 'Hydrated', subtitle: 'The whole family, properly hydrated — with the right delivery plan for your home.' },
  'office-solution': { badge: 'Office Hydration', headlineTop: 'Your Office,', headlineBottom: 'Refreshed', subtitle: 'Replace your bottled water service with Primo and save up to 60%.' },
  'eco-refill': { badge: 'Go Greener', headlineTop: 'Reduce Plastic,', headlineBottom: 'Not Taste', subtitle: 'Refillable jugs and exchange programs to help you cut single-use plastic waste.' },
  'loyalty-engagement': { badge: '2x Points Weekend', headlineTop: 'Double Points', headlineBottom: 'This Weekend', subtitle: 'Earn 2x Primo Perks points on every order. Exclusive for Active+ members.' },
  'new-delivery': { badge: 'Introducing Delivery+', headlineTop: 'Water, Delivered', headlineBottom: 'Your Way', subtitle: 'Set your schedule, skip when you want, never run out. Starting at $12.99/jug.' },
};

function getHeroVariant(customer?: CustomerProfile | null, isAuthenticated?: boolean, campaign?: CampaignAttribution | null): HeroVariant {
  const tier = customer?.merkuryIdentity?.identityTier;
  const firstName = customer?.name?.split(' ')[0];

  // Campaign-driven variant (when visitor arrived via ad, before identity check)
  if (campaign && !isAuthenticated) {
    const themeOverride = CAMPAIGN_HERO_MAP[campaign.adCreative.campaignTheme];
    if (themeOverride) {
      return {
        ...themeOverride,
        heroImage: HERO_IMAGES.default,
        imageAlt: `${themeOverride.badge} campaign`,
        source: 'campaign' as const,
      };
    }
  }

  // Authenticated known customer
  if (isAuthenticated && tier === 'known' && firstName) {
    const loyaltyLine = customer?.loyalty
      ? `${customer.loyalty.tier.charAt(0).toUpperCase() + customer.loyalty.tier.slice(1)} Member · ${customer.loyalty.pointsBalance?.toLocaleString()} pts`
      : null;
    return {
      badge: 'Your Hydration Hub',
      headlineTop: `Welcome back,`,
      headlineBottom: firstName,
      subtitle: loyaltyLine
        ? `Great to see you. ${loyaltyLine}.`
        : 'Your personalized hydration plan and next delivery, right here.',
      heroImage: HERO_IMAGES.authenticated,
      imageAlt: 'Home water dispenser',
      source: 'authenticated' as const,
    };
  }

  // Pseudonymous known customer (not signed in) — fall through to appended/default.
  // Greeting is subtle, shown in the top promo banner instead of the hero.

  // Appended (3P Merkury data)
  if (tier === 'appended' && customer?.appendedProfile?.interests) {
    const interests = customer.appendedProfile.interests.map((i) => i.toLowerCase());
    if (interests.some((i) => i.includes('fitness') || i.includes('running') || i.includes('triathlon') || i.includes('cycling'))) {
      return {
        badge: 'Fuel Your Performance',
        headlineTop: 'Hydrate Like',
        headlineBottom: 'An Athlete',
        subtitle: 'High-performance hydration for runners, cyclists, and athletes. Your personalized plan starts here.',
        heroImage: HERO_IMAGES.fitness,
        imageAlt: 'Athlete hydrating on a trail run',
        source: 'appended' as const,
      };
    }
    if (interests.some((i) => i.includes('wellness') || i.includes('yoga') || i.includes('organic') || i.includes('clean'))) {
      return {
        badge: 'Wellness Starts with Water',
        headlineTop: 'Pure Water,',
        headlineBottom: 'Whole Body Wellness',
        subtitle: 'Clean, sustainably sourced water for your wellness lifestyle.',
        heroImage: HERO_IMAGES.wellness,
        imageAlt: 'Wellness spa water setting',
        source: 'appended' as const,
      };
    }
    if (interests.some((i) => i.includes('family') || i.includes('kids') || i.includes('parent'))) {
      return {
        badge: 'Family Hydration',
        headlineTop: 'Keep Your Family',
        headlineBottom: 'Refreshed',
        subtitle: 'Safe, pure water for the whole family — with delivery that fits your home.',
        heroImage: HERO_IMAGES.family,
        imageAlt: 'Family in kitchen with water dispenser',
        source: 'appended' as const,
      };
    }
  }

  // Anonymous / default
  return {
    badge: 'Pure Water, Delivered',
    headlineTop: 'Hydration That',
    headlineBottom: 'Fits Your Life',
    subtitle: 'Personalized water solutions for every lifestyle — from home delivery to sparkling flavors. Find your perfect hydration plan.',
    heroImage: HERO_IMAGES.default,
    imageAlt: 'Fresh clean water',
    source: 'default' as const,
  };
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onShopNow, customer, isAuthenticated }) => {
  const [sfpDecision, setSfpDecision] = useState<PersonalizationDecision | null>(null);
  const { campaign } = useCampaign();
  const navigate = useNavigate();
  const onHydrationConcierge = useCallback(() => navigate('/advisor'), [navigate]);

  // Try SF Personalization campaign decision when customer changes.
  // Only adopt the decision if it carries at least one meaningful display field —
  // an empty-but-structurally-valid response (e.g. campaignId set, display fields blank)
  // should NOT override the local campaign/identity-driven variant.
  useEffect(() => {
    if (!isPersonalizationConfigured()) return;
    getHeroCampaignDecision().then((d) => {
      if (d && (d.badge || d.headlineTop || d.headlineBottom || d.subtitle)) {
        setSfpDecision(d);
      }
    });
  }, [customer]);

  // Priority: campaign/identity/appended variants (local) > SF Personalization > default.
  // SF Personalization only overrides when the local logic has no specific context
  // (i.e. source === 'default'). Campaign-driven and identity-driven variants are
  // more specific than a generic SF Personalization decision.
  const variant = useMemo(() => {
    const localVariant = getHeroVariant(customer, isAuthenticated, campaign);
    if (sfpDecision && localVariant.source === 'default') {
      return {
        ...localVariant,
        ...(sfpDecision.badge ? { badge: sfpDecision.badge } : {}),
        ...(sfpDecision.headlineTop ? { headlineTop: sfpDecision.headlineTop } : {}),
        ...(sfpDecision.headlineBottom ? { headlineBottom: sfpDecision.headlineBottom } : {}),
        ...(sfpDecision.subtitle ? { subtitle: sfpDecision.subtitle } : {}),
        heroImage: sfpDecision.heroImage || localVariant.heroImage,
        imageAlt: sfpDecision.imageAlt || localVariant.imageAlt,
      };
    }
    return localVariant;
  }, [sfpDecision, customer, isAuthenticated, campaign]);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-stone-100 via-blue-50 to-cyan-50">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-20 w-96 h-96 bg-cyan-200 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full mb-6">
              {variant.badge}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-stone-900 leading-tight mb-6">
              {variant.headlineTop}
              <span className="block font-medium bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                {variant.headlineBottom}
              </span>
            </h1>
            <p className="text-lg text-stone-600 mb-8 max-w-md">
              {variant.subtitle}
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={onShopNow}
                className="px-8 py-3 bg-stone-900 text-white font-medium rounded-full hover:bg-stone-800 transition-colors"
              >
                Shop Collection
              </button>
              <button
                onClick={onHydrationConcierge}
                className="group px-8 py-3 bg-white text-stone-900 font-medium rounded-full border border-stone-200 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Hydration Concierge
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-6 mt-10 pt-8 border-t border-stone-200/50">
              <div className="text-center">
                <div className="text-2xl font-semibold text-stone-900">1M+</div>
                <div className="text-xs text-stone-500">Happy Customers</div>
              </div>
              <div className="w-px h-10 bg-stone-200" />
              <div className="text-center">
                <div className="text-2xl font-semibold text-stone-900">4.8</div>
                <div className="text-xs text-stone-500">Average Rating</div>
              </div>
              <div className="w-px h-10 bg-stone-200" />
              <div className="text-center">
                <div className="text-2xl font-semibold text-stone-900">99%</div>
                <div className="text-xs text-stone-500">Contaminants Removed</div>
              </div>
            </div>
          </motion.div>

          {/* Product showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative w-full aspect-square max-w-lg mx-auto">
              {/* Decorative circles */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-80 h-80 rounded-full border border-rose-200/50" />
                <div className="absolute w-64 h-64 rounded-full border border-purple-200/50" />
                <div className="absolute w-48 h-48 rounded-full bg-gradient-to-br from-rose-100 to-purple-100" />
              </div>

              {/* Product images — 5 scattered products with minimal overlap */}
              <motion.img
                src="/assets/products/ff-moisturizer-daily.png"
                alt="Featured moisturizer"
                className="absolute inset-0 m-auto w-56 h-56 object-contain drop-shadow-2xl z-10"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.img
                src="/assets/products/serum-brightening.png"
                alt="Featured serum"
                className="absolute top-0 right-0 w-48 h-48 object-contain drop-shadow-xl"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              />
              <motion.img
                src="/assets/products/sunscreen-tinted.png"
                alt="Featured sunscreen"
                className="absolute bottom-0 left-0 w-56 h-56 object-contain drop-shadow-xl"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              />
              <motion.img
                src="/assets/products/lipstick-satin.png"
                alt="Featured lipstick"
                className="absolute top-0 left-0 w-40 h-40 object-contain drop-shadow-xl"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
              <motion.img
                src="/assets/products/eye-cream-brightening.png"
                alt="Featured eye cream"
                className="absolute bottom-0 right-0 w-48 h-48 object-contain drop-shadow-xl"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
