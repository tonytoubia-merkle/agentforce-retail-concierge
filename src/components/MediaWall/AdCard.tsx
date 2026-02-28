import { motion } from 'framer-motion';
import type { AdCreative } from '@/types/campaign';

// ─── Platform icons (simple SVG shapes) ──────────────────────────

const platformConfig: Record<AdCreative['platform'], { label: string; color: string; icon: React.ReactNode }> = {
  instagram: {
    label: 'Instagram',
    color: 'bg-gradient-to-br from-purple-500 to-pink-500',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  youtube: {
    label: 'YouTube',
    color: 'bg-red-600',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  'google-display': {
    label: 'Google Display',
    color: 'bg-blue-600',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
  tiktok: {
    label: 'TikTok',
    color: 'bg-stone-900',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.18 8.18 0 004.77 1.52V6.82a4.84 4.84 0 01-1-.13z" />
      </svg>
    ),
  },
  pinterest: {
    label: 'Pinterest',
    color: 'bg-red-700',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" />
      </svg>
    ),
  },
  ctv: {
    label: 'Connected TV',
    color: 'bg-indigo-600',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  email: {
    label: 'Email',
    color: 'bg-emerald-600',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 4l-10 8L2 4" />
      </svg>
    ),
  },
};

const strategyLabels: Record<string, string> = {
  'lookalike': 'Lookalike',
  'retargeting': 'Retargeting',
  'interest-based': 'Interest',
  'demographic': 'Demographic',
  'contextual': 'Contextual',
  'first-party': '1P CRM',
  'household': 'Household',
};

const creativeTypeLabels: Record<string, string> = {
  'static-image': 'Static',
  'video': 'Video',
  'carousel': 'Carousel',
  'story': 'Story',
  'native': 'Native',
};

interface AdCardProps {
  ad: AdCreative;
  onClick: () => void;
}

export const AdCard: React.FC<AdCardProps> = ({ ad, onClick }) => {
  const platform = platformConfig[ad.platform];

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group relative w-full text-left rounded-xl overflow-hidden bg-stone-900 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-2xl transition-shadow"
    >
      {/* Creative visual area */}
      <div className={`relative h-48 bg-gradient-to-br ${ad.gradientFrom} ${ad.gradientTo} overflow-hidden`}>
        {/* Product image */}
        {ad.productImage && (
          <img
            src={ad.productImage}
            alt=""
            className="absolute right-2 bottom-2 w-24 h-24 object-contain opacity-90 group-hover:scale-110 transition-transform duration-500 drop-shadow-lg"
          />
        )}

        {/* Platform badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-white text-[10px] font-medium ${platform.color}`}>
            {platform.icon}
            {platform.label}
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-white/80 text-[9px] font-medium backdrop-blur-sm">
            {creativeTypeLabels[ad.creativeType]}
          </span>
        </div>

        {/* Headline overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
          <h3 className="text-white font-semibold text-base leading-tight">
            {ad.headline}
          </h3>
        </div>
      </div>

      {/* Metadata area */}
      <div className="p-4 space-y-3">
        {/* Description */}
        <p className="text-white/50 text-xs leading-relaxed line-clamp-2">
          {ad.description}
        </p>

        {/* Campaign name */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-white/70">
            {ad.campaignName}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-medium">
            {strategyLabels[ad.targetingStrategy]}
          </span>
        </div>

        {/* Audience segment */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[10px] text-cyan-400/80 truncate">
              {ad.audienceSegment.segmentName}
            </span>
          </div>
          <span className="text-[9px] text-white/30 flex-shrink-0 ml-2">
            {ad.audienceSegment.segmentSize}
          </span>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <span className="text-[10px] text-white/40 group-hover:text-white/70 transition-colors font-medium">
            Click to visit storefront
          </span>
          <svg className="w-3 h-3 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </motion.button>
  );
};
