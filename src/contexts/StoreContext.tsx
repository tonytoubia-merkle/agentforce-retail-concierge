import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Product, ProductCategory } from '@/types/product';

export type StoreView = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'order-confirmation';

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
  setSearchQuery: (query: string) => void;
  goBack: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view, setView] = useState<StoreView>('home');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderResult, setLastOrderResult] = useState<OrderResult | null>(null);
  const [history, setHistory] = useState<StoreView[]>(['home']);

  const pushView = useCallback((newView: StoreView) => {
    setHistory((prev) => [...prev, newView]);
    setView(newView);
  }, []);

  const navigateHome = useCallback(() => {
    setSelectedCategory(null);
    setSelectedProduct(null);
    setSearchQuery('');
    setHistory(['home']);
    setView('home');
  }, []);

  const navigateToCategory = useCallback((category: ProductCategory) => {
    setSelectedCategory(category);
    setSelectedProduct(null);
    pushView('category');
  }, [pushView]);

  const navigateToProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    pushView('product');
  }, [pushView]);

  const navigateToCart = useCallback(() => {
    pushView('cart');
  }, [pushView]);

  const navigateToCheckout = useCallback(() => {
    pushView('checkout');
  }, [pushView]);

  const navigateToOrderConfirmation = useCallback((orderId: string, result?: OrderResult) => {
    setLastOrderId(orderId);
    setLastOrderResult(result || null);
    setHistory(['home', 'order-confirmation']);
    setView('order-confirmation');
  }, []);

  const goBack = useCallback(() => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      const prevView = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setView(prevView);
      if (prevView === 'home') {
        setSelectedCategory(null);
        setSelectedProduct(null);
      } else if (prevView === 'category') {
        setSelectedProduct(null);
      }
    }
  }, [history]);

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
