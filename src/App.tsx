import { useEffect, useState, useMemo } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SceneProvider } from '@/contexts/SceneContext';
import { ConversationProvider } from '@/contexts/ConversationContext';
import { CustomerProvider } from '@/contexts/CustomerContext';
import { CampaignProvider } from '@/contexts/CampaignContext';
import { CartProvider } from '@/contexts/CartContext';
import { StoreProvider } from '@/contexts/StoreContext';
import { ActivityToastProvider } from '@/components/ActivityToast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AdvisorPage } from '@/components/AdvisorPage';
import { StorefrontPage } from '@/components/Storefront';
import { MediaWallPage } from '@/components/MediaWall';
import { resolveUTMToCampaign } from '@/mocks/adCreatives';
import type { Product } from '@/types/product';
import type { CampaignAttribution } from '@/types/campaign';
import { MOCK_PRODUCTS } from '@/mocks/products';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

/**
 * AdvisorWrapper — wraps AdvisorPage (beauty mode) with ConversationProvider.
 */
function AdvisorWrapper() {
  return (
    <ConversationProvider>
      <AdvisorPage mode="beauty" />
    </ConversationProvider>
  );
}

/**
 * SkinAdvisorWrapper — wraps AdvisorPage in skin-concierge mode.
 * Uses its own ConversationProvider (with skin concierge agent ID) so history
 * and session are fully isolated from the beauty advisor.
 */
function SkinAdvisorWrapper() {
  const skinAgentId = import.meta.env.VITE_SKIN_ADVISOR_AGENT_ID as string | undefined;
  return (
    <ConversationProvider agentId={skinAgentId}>
      <AdvisorPage mode="skin-concierge" />
    </ConversationProvider>
  );
}

/**
 * AnimatedRoutes — wraps Routes in AnimatePresence.
 * Uses a section-level key so only storefront ↔ advisor ↔ media transitions fade.
 */
function AnimatedRoutes({ products }: { products: Product[] }) {
  const location = useLocation();

  const animationKey = useMemo(() => {
    if (location.pathname === '/advisor') return 'advisor';
    if (location.pathname === '/skin-advisor') return 'skin-advisor';
    if (location.pathname === '/media-wall') return 'media';
    return 'storefront';
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animationKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className={animationKey === 'advisor' ? 'relative' : undefined}
      >
        <Routes location={location}>
          <Route path="/advisor" element={<AdvisorWrapper />} />
          <Route path="/skin-advisor" element={<SkinAdvisorWrapper />} />
          <Route path="/media-wall" element={<MediaWallPage />} />
          <Route path="*" element={<StorefrontPage products={products} />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * AppShell — provider tree + animated routes.
 */
function AppShell({ initialCampaign }: { initialCampaign: CampaignAttribution | null }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (useMockData) {
      setProducts(MOCK_PRODUCTS);
      setLoading(false);
      return;
    }

    // Use local catalog on initial load; Commerce Cloud is queried via agent responses
    setProducts(MOCK_PRODUCTS);
    setLoading(false);
  }, []);

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
          <p className="text-stone-500">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <CampaignProvider initialCampaign={initialCampaign}>
      <CartProvider>
        <StoreProvider>
          <SceneProvider>
            <ActivityToastProvider>
              <AnimatedRoutes products={products} />
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
    <ErrorBoundary>
      <CustomerProvider>
        <AppShell initialCampaign={initialCampaign} />
      </CustomerProvider>
    </ErrorBoundary>
  );
}

export default App;
