import { motion } from 'framer-motion';
import { AD_CREATIVES } from '@/mocks/adCreatives';
import { useCampaign } from '@/contexts/CampaignContext';
import { AdCard } from './AdCard';
import type { AdCreative, CampaignAttribution } from '@/types/campaign';

interface MediaWallPageProps {
  onAdClick: () => void;
  onBackToStore: () => void;
}

export const MediaWallPage: React.FC<MediaWallPageProps> = ({
  onAdClick,
  onBackToStore,
}) => {
  const { setCampaign } = useCampaign();

  const handleAdClick = (ad: AdCreative) => {
    const attribution: CampaignAttribution = {
      adCreative: ad,
      clickedAt: new Date().toISOString(),
      entrySource: 'media-wall',
    };
    setCampaign(attribution);
    onAdClick();
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-stone-950/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Merkury logo */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight">
                    Merkury Media Wall
                  </h1>
                  <p className="text-[11px] text-white/40 leading-tight">
                    Person-based media activation powered by Merkury identity
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onBackToStore}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white/70 hover:text-white text-sm font-medium transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Storefront
            </button>
          </div>
        </div>
      </header>

      {/* Explainer bar */}
      <div className="border-b border-white/5 bg-stone-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Merkury audience segments enable cross-channel person-based targeting
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              Click any ad to simulate a click-through to the commerce site
            </span>
            <span className="hidden md:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Campaign attribution context flows to the storefront + beauty advisor
            </span>
          </div>
        </div>
      </div>

      {/* Ad grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.06 },
            },
          }}
        >
          {AD_CREATIVES.map((ad) => (
            <motion.div
              key={ad.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <AdCard ad={ad} onClick={() => handleAdClick(ad)} />
            </motion.div>
          ))}
        </motion.div>

        {/* Footer legend */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex flex-wrap gap-4 text-[10px] text-white/30">
            <span className="font-medium text-white/50 uppercase tracking-wider">Targeting:</span>
            {['Lookalike', 'Retargeting', 'Interest', 'Demographic', 'Contextual', '1P CRM', 'Household'].map((s) => (
              <span key={s} className="px-2 py-0.5 rounded bg-white/5">{s}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-[10px] text-white/30">
            <span className="font-medium text-white/50 uppercase tracking-wider">Match type:</span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400/60">PID = Individual</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400/60">HID = Household</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400/60">Modeled = Lookalike</span>
          </div>
          <p className="mt-4 text-[10px] text-white/20">
            Simulated media placements for demo purposes. Merkury enables dentsu clients to activate
            audiences across 140+ media partners using deterministic, privacy-safe identity matching.
          </p>
        </div>
      </div>
    </div>
  );
};
