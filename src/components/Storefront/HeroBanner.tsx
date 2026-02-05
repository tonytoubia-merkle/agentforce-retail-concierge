import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { CustomerProfile } from '@/types/customer';
import { isPersonalizationConfigured, getHeroCampaignDecision, type PersonalizationDecision } from '@/services/personalization';

interface HeroBannerProps {
  onShopNow: () => void;
  onBeautyAdvisor: () => void;
  customer?: CustomerProfile | null;
  isAuthenticated?: boolean;
}

function getHeroVariant(customer?: CustomerProfile | null, isAuthenticated?: boolean) {
  const tier = customer?.merkuryIdentity?.identityTier;
  const firstName = customer?.name?.split(' ')[0];

  // Authenticated known customer
  if (isAuthenticated && tier === 'known' && firstName) {
    const loyaltyLine = customer?.loyalty
      ? `${customer.loyalty.tier.charAt(0).toUpperCase() + customer.loyalty.tier.slice(1)} Member · ${customer.loyalty.pointsBalance?.toLocaleString()} pts`
      : null;
    return {
      badge: 'For You',
      headlineTop: `Your Beauty Edit,`,
      headlineBottom: firstName,
      subtitle: loyaltyLine
        ? `Curated picks for you. ${loyaltyLine}.`
        : 'Curated skincare and beauty essentials, just for you.',
    };
  }

  // Pseudonymous known customer (not signed in)
  if (tier === 'known' && firstName) {
    const skinType = customer?.beautyProfile?.skinType;
    const subtitleParts: string[] = [];
    if (skinType && skinType !== 'normal') {
      subtitleParts.push(`Picks for your ${skinType} skin.`);
    }
    subtitleParts.push('Sign in for the full personalized experience.');
    return {
      badge: 'Picked for You',
      headlineTop: `Welcome back,`,
      headlineBottom: firstName,
      subtitle: subtitleParts.join(' '),
    };
  }

  // Appended (3P Merkury data)
  if (tier === 'appended' && customer?.appendedProfile?.interests) {
    const interests = customer.appendedProfile.interests.map((i) => i.toLowerCase());
    if (interests.some((i) => i.includes('clean') || i.includes('natural'))) {
      return {
        badge: 'Trending in Clean Beauty',
        headlineTop: 'Clean Beauty,',
        headlineBottom: 'Naturally You',
        subtitle: 'Curated clean and natural beauty essentials for a conscious routine.',
      };
    }
    if (interests.some((i) => i.includes('luxury') || i.includes('premium'))) {
      return {
        badge: 'Luxury Picks',
        headlineTop: 'Luxury Essentials,',
        headlineBottom: 'Curated for You',
        subtitle: 'Premium skincare and beauty from the brands you love.',
      };
    }
    if (interests.some((i) => i.includes('wellness') || i.includes('yoga') || i.includes('fitness'))) {
      return {
        badge: 'Beauty Meets Wellness',
        headlineTop: 'Beauty Meets',
        headlineBottom: 'Wellness',
        subtitle: 'Skincare and beauty that complements your active lifestyle.',
      };
    }
  }

  // Anonymous / default
  return {
    badge: 'New Season Collection',
    headlineTop: 'Discover Your',
    headlineBottom: 'Perfect Glow',
    subtitle: 'Curated skincare and beauty essentials, personalized to your unique needs. Experience the future of beauty with our AI-powered recommendations.',
  };
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onShopNow, onBeautyAdvisor, customer, isAuthenticated }) => {
  const [sfpDecision, setSfpDecision] = useState<PersonalizationDecision | null>(null);

  // Try SF Personalization campaign decision when customer changes
  useEffect(() => {
    if (!isPersonalizationConfigured()) return;
    getHeroCampaignDecision().then(setSfpDecision);
  }, [customer]);

  // SF Personalization decision takes priority, fallback to local logic
  const variant = useMemo(
    () => sfpDecision || getHeroVariant(customer, isAuthenticated),
    [sfpDecision, customer, isAuthenticated]
  );

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-stone-100 via-rose-50 to-purple-50">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-rose-200 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-20 w-96 h-96 bg-purple-200 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-3 py-1 bg-rose-100 text-rose-600 text-xs font-medium rounded-full mb-6">
              {variant.badge}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-stone-900 leading-tight mb-6">
              {variant.headlineTop}
              <span className="block font-medium bg-gradient-to-r from-rose-500 to-purple-500 bg-clip-text text-transparent">
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
                onClick={onBeautyAdvisor}
                className="group px-8 py-3 bg-white text-stone-900 font-medium rounded-full border border-stone-200 hover:border-rose-300 hover:bg-rose-50 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Talk to Beauty Advisor
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-6 mt-10 pt-8 border-t border-stone-200/50">
              <div className="text-center">
                <div className="text-2xl font-semibold text-stone-900">50K+</div>
                <div className="text-xs text-stone-500">Happy Customers</div>
              </div>
              <div className="w-px h-10 bg-stone-200" />
              <div className="text-center">
                <div className="text-2xl font-semibold text-stone-900">4.9</div>
                <div className="text-xs text-stone-500">Average Rating</div>
              </div>
              <div className="w-px h-10 bg-stone-200" />
              <div className="text-center">
                <div className="text-2xl font-semibold text-stone-900">100%</div>
                <div className="text-xs text-stone-500">Clean Beauty</div>
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

              {/* Product images */}
              <motion.img
                src="/assets/products/moisturizer-sensitive.png"
                alt="Featured product"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 object-contain drop-shadow-2xl"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.img
                src="/assets/products/serum-vitamin-c.png"
                alt="Featured serum"
                className="absolute top-10 right-10 w-24 h-24 object-contain drop-shadow-xl"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              />
              <motion.img
                src="/assets/products/sunscreen-lightweight.png"
                alt="Featured sunscreen"
                className="absolute bottom-16 left-10 w-28 h-28 object-contain drop-shadow-xl"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
