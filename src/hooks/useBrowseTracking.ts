import { useEffect } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useCustomer } from '@/contexts/CustomerContext';
import { getBrowseTracker } from '@/services/datacloud/browseTracker';

/**
 * Side-effect-only hook that bridges React state to the BrowseSessionTracker singleton.
 * Tracks product views and category navigation for the current customer.
 * Mount once in StorefrontPage — produces no re-renders.
 */
export function useBrowseTracking() {
  const { view, selectedProduct, selectedCategory } = useStore();
  const { customer } = useCustomer();
  const tracker = getBrowseTracker();

  // Sync customer identity — flushes old session on persona switch
  useEffect(() => {
    tracker.setCustomer(customer?.id ?? null);
  }, [customer?.id]);

  // Track product views
  useEffect(() => {
    if (view === 'product' && selectedProduct) {
      tracker.trackProductView(selectedProduct.id, selectedProduct.category);
    }
  }, [view, selectedProduct?.id]);

  // Track category views
  useEffect(() => {
    if (view === 'category' && selectedCategory) {
      tracker.trackCategoryView(selectedCategory);
    }
  }, [view, selectedCategory]);

  // Flush on unmount (e.g. switching to advisor mode)
  useEffect(() => {
    return () => { tracker.flush(); };
  }, []);
}
