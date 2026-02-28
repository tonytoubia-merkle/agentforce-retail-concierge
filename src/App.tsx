import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SceneProvider } from '@/contexts/SceneContext';
import { ConversationProvider } from '@/contexts/ConversationContext';
import { CustomerProvider } from '@/contexts/CustomerContext';
import { CampaignProvider } from '@/contexts/CampaignContext';
import { CartProvider } from '@/contexts/CartContext';
import { StoreProvider } from '@/contexts/StoreContext';
import { ActivityToastProvider } from '@/components/ActivityToast';
import { AdvisorPage } from '@/components/AdvisorPage';
import { StorefrontPage } from '@/components/Storefront';
import { MediaWallPage } from '@/components/MediaWall';
import { resolveUTMToCampaign } from '@/mocks/adCreatives';
import type { Product } from '@/types/product';
import type { CampaignAttribution } from '@/types/campaign';
import { MOCK_PRODUCTS } from '@/mocks/products';

/**
 * AppShell — owns mode state and the CampaignProvider so it can
 * pass handleOpenMediaWall directly as a prop.
 */
function AppShell({ initialCampaign }: { initialCampaign: CampaignAttribution | null }) {
  const [mode, setMode] = useState<'storefront' | 'advisor' | 'media'>('storefront');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProducts(MOCK_PRODUCTS);
    setLoading(false);
  }, []);

  const handleOpenAdvisor = useCallback(() => setMode('advisor'), []);
  const handleCloseAdvisor = useCallback(() => setMode('storefront'), []);
  const handleBackToStore = useCallback(() => setMode('storefront'), []);
  const handleOpenMediaWall = useCallback(() => setMode('media'), []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4">
            <svg className="animate-spin w-full h-full text-rose-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-stone-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <CampaignProvider
      initialCampaign={initialCampaign}
      onNavigateToMediaWall={handleOpenMediaWall}
    >
      <CartProvider>
        <StoreProvider>
          <SceneProvider>
            <ActivityToastProvider>
              <AnimatePresence mode="wait">
                {mode === 'storefront' && (
                  <motion.div
                    key="storefront"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <StorefrontPage
                      products={products}
                      onBeautyAdvisorClick={handleOpenAdvisor}
                    />
                  </motion.div>
                )}
                {mode === 'advisor' && (
                  <motion.div
                    key="advisor"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative"
                  >
                    <ConversationProvider>
                      <AdvisorPage />
                    </ConversationProvider>

                    <motion.button
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      onClick={handleCloseAdvisor}
                      className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm text-stone-700 text-sm font-medium rounded-full shadow-lg border border-stone-200 hover:bg-white hover:shadow-xl transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Store
                    </motion.button>
                  </motion.div>
                )}
                {mode === 'media' && (
                  <motion.div
                    key="media"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MediaWallPage
                      onAdClick={handleBackToStore}
                      onBackToStore={handleBackToStore}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </ActivityToastProvider>
          </SceneProvider>
        </StoreProvider>
      </CartProvider>
    </CampaignProvider>
  );
}

/**
 * Root App — parses UTM params once on mount (before any providers),
 * then hands the result to AppShell as initialCampaign.
 */
function App() {
  // Parse UTM from URL once on mount (lazy initializer — no re-renders)
  const [initialCampaign] = useState<CampaignAttribution | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('utm_source')) {
      const attribution = resolveUTMToCampaign(params);
      window.history.replaceState({}, '', window.location.pathname);
      return attribution;
    }
    return null;
  });

  return (
    <CustomerProvider>
      <AppShell initialCampaign={initialCampaign} />
    </CustomerProvider>
  );
}

export default App;
