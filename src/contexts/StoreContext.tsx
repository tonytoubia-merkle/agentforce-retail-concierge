import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Product, ProductCategory } from '@/types/product';
import { MOCK_PRODUCTS } from '@/mocks/products';
import { isPersonalizationConfigured, notifyNavigation } from '@/services/personalization';

export type StoreView = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'order-confirmation' | 'account' | 'appointment';

export interface OrderResult {
  success: boolean;
  orderId: string;
  orderNumber: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery: string;
  shippingStatus: string;
  pointsEarned: number;
}

interface StoreContextValue {
  view: StoreView;
  selectedCategory: ProductCategory | null;
  selectedProduct: Product | null;
  searchQuery: string;
  lastOrderId: string | null;
  lastOrderResult: OrderResult | null;
  navigateHome: () => void;
  navigateToCategory: (category: ProductCategory) => void;
  navigateToProduct: (product: Product) => void;
  navigateToCart: () => void;
  navigateToCheckout: () => void;
  navigateToOrderConfirmation: (orderId: string, result?: OrderResult) => void;
  navigateToAccount: () => void;
  navigateToAppointment: () => void;
  setSearchQuery: (query: string) => void;
  goBack: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// Static route map for simple path -> view lookups
const STATIC_ROUTES: Record<string, StoreView> = {
  '/cart': 'cart',
  '/checkout': 'checkout',
  '/order-confirmation': 'order-confirmation',
  '/account': 'account',
  '/appointment': 'appointment',
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Derive view, selectedCategory, selectedProduct from URL ──────────
  const derived = useMemo(() => {
    const path = location.pathname;

    // /shop/:category/:productId
    const productMatch = path.match(/^\/shop\/([^/]+)\/([^/]+)$/);
    if (productMatch) {
      const category = productMatch[1] as ProductCategory;
      const productId = productMatch[2];
      const product = MOCK_PRODUCTS.find((p) => p.id === productId) || null;
      return {
        view: 'product' as StoreView,
        selectedCategory: category,
        selectedProduct: product,
      };
    }

    // /shop/:category
    const categoryMatch = path.match(/^\/shop\/([^/]+)$/);
    if (categoryMatch) {
      return {
        view: 'category' as StoreView,
        selectedCategory: categoryMatch[1] as ProductCategory,
        selectedProduct: null,
      };
    }

    // Static routes (/cart, /checkout, etc.)
    const staticView = STATIC_ROUTES[path];
    if (staticView) {
      return { view: staticView, selectedCategory: null, selectedProduct: null };
    }

    // Default: home
    return { view: 'home' as StoreView, selectedCategory: null, selectedProduct: null };
  }, [location.pathname]);

  const { view, selectedCategory, selectedProduct } = derived;

  // ── Transient state (not URL-representable) ──────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);

  // ── Navigation methods (identical public API, router internals) ──────
  const navigateHome = useCallback(() => {
    setSearchQuery('');
    navigate('/');
  }, [navigate]);

  const navigateToCategory = useCallback((category: ProductCategory) => {
    navigate(`/shop/${category}`);
  }, [navigate]);

  const navigateToProduct = useCallback((product: Product) => {
    navigate(`/shop/${product.category}/${product.id}`);
  }, [navigate]);

  const navigateToCart = useCallback(() => {
    navigate('/cart');
  }, [navigate]);

  const navigateToCheckout = useCallback(() => {
    navigate('/checkout');
  }, [navigate]);

  const navigateToOrderConfirmation = useCallback((orderId: string, result?: OrderResult) => {
    setLastOrderId(orderId);
    setLastOrderResult(result || null);
    navigate('/order-confirmation', { replace: true });
  }, [navigate]);

  const navigateToAccount = useCallback(() => {
    navigate('/account');
  }, [navigate]);

  const navigateToAppointment = useCallback(() => {
    navigate('/appointment');
  }, [navigate]);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // ── SF Personalization: notify SDK of SPA navigation changes ─────────
  useEffect(() => {
    if (!isPersonalizationConfigured()) return;
    notifyNavigation(view, {
      categoryId: selectedCategory || undefined,
      productId: selectedProduct?.id,
      productSalesforceId: selectedProduct?.salesforceId,
      productName: selectedProduct?.name,
      productCategory: selectedProduct?.category,
    });
  }, [view, selectedCategory, selectedProduct?.id]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <StoreContext.Provider
      value={{
        view,
        selectedCategory,
        selectedProduct,
        searchQuery,
        lastOrderId,
        lastOrderResult,
        navigateHome,
        navigateToCategory,
        navigateToProduct,
        navigateToCart,
        navigateToCheckout,
        navigateToOrderConfirmation,
        navigateToAccount,
        navigateToAppointment,
        setSearchQuery,
        goBack,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextValue => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
};
