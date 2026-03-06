import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoreHeader } from './StoreHeader';
import { HeroBanner } from './HeroBanner';
import { ProductSection } from './ProductSection';
import { CategoryPage } from './CategoryPage';
import { ProductDetailPage } from './ProductDetailPage';
import { CartPage } from './CartPage';
import { CheckoutPage } from './CheckoutPage';
import { OrderConfirmationPage } from './OrderConfirmationPage';
import { AccountPage } from './AccountPage';
import { AppointmentBooking } from './AppointmentBooking';
import { EmailSignup } from './EmailSignup';
import { ExitIntentOverlay } from './ExitIntentOverlay';
import { useStore } from '@/contexts/StoreContext';
import { useCustomer } from '@/contexts/CustomerContext';
import { useBrowseTracking } from '@/hooks/useBrowseTracking';
import type { Product, ProductCategory } from '@/types/product';

interface StorefrontPageProps {
  products: Product[];
}

export const StorefrontPage: React.FC<StorefrontPageProps> = ({
  products,
}) => {
  const { view, selectedCategory, selectedProduct, navigateHome, navigateToCategory } = useStore();
  const { customer, isAuthenticated } = useCustomer();
  const navigate = useNavigate();
  const navigateToAdvisor = useCallback(() => navigate('/advisor'), [navigate]);
  useBrowseTracking();

  // Group products by category for home page sections
  const productGroups = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [products]);

  // Get featured/bestseller products
  const featuredProducts = useMemo(() => {
    return products
      .filter((p) => (p.personalizationScore || 0) > 0.8 || p.rating > 4.5)
      .slice(0, 8);
  }, [products]);

  // Get new arrivals (just use first 8 for demo)
  const newArrivals = useMemo(() => {
    return products.slice(0, 8);
  }, [products]);

  // Delivery & dispenser products
  const deliveryProducts = useMemo(() => {
    return products
      .filter((p) => ['dispenser', 'delivery'].includes(p.category))
      .slice(0, 4);
  }, [products]);

  // Sparkling & flavored products
  const sparklingProducts = useMemo(() => {
    return products
      .filter((p) => ['sparkling', 'flavored'].includes(p.category))
      .slice(0, 4);
  }, [products]);

  // Still water & accessories
  const stillProducts = useMemo(() => {
    return products
      .filter((p) => ['still', 'bottle', 'filter'].includes(p.category))
      .slice(0, 4);
  }, [products]);

  const renderContent = () => {
    switch (view) {
      case 'category':
        if (!selectedCategory) return null;
        return <CategoryPage category={selectedCategory} products={products} />;

      case 'product':
        if (!selectedProduct) return null;
        return (
          <ProductDetailPage
            product={selectedProduct}
          />
        );

      case 'cart':
        return <CartPage />;

      case 'checkout':
        return <CheckoutPage />;

      case 'order-confirmation':
        return <OrderConfirmationPage />;

      case 'account':
        return <AccountPage />;

      case 'appointment':
        return <AppointmentBooking />;

      case 'home':
      default:
        return (
          <>
            <HeroBanner
              onShopNow={() => navigateToCategory('delivery' as ProductCategory)}
              customer={customer}
              isAuthenticated={isAuthenticated}
            />

            {/* Loyalty banner for authenticated members */}
            {isAuthenticated && customer?.loyalty && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-center gap-3 text-sm">
                  <span className="text-amber-800 font-medium">
                    You have {customer.loyalty.pointsBalance?.toLocaleString()} points, {customer.name?.split(' ')[0]}!
                  </span>
                  <span className="text-amber-600 capitalize">
                    {customer.loyalty.tier} Member
                  </span>
                  <span className="text-amber-600">—</span>
                  <span className="text-amber-700">
                    Redeem for up to ${Math.floor((customer.loyalty.pointsBalance || 0) / 100)} off
                  </span>
                </div>
              </div>
            )}

            {/* Featured/Best Sellers */}
            {featuredProducts.length > 0 && (
              <ProductSection
                title="Best Sellers"
                subtitle="Our most-loved products"
                products={featuredProducts}
              />
            )}

            {/* Categories quick links */}
            <section className="py-12 bg-stone-50">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <h2 className="text-2xl sm:text-3xl font-medium text-stone-900 mb-8 text-center">
                  Shop by Category
                </h2>
                {/* Delivery & Dispensers row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Dispensers', category: 'dispenser' as ProductCategory, color: 'from-blue-100 to-sky-100' },
                    { label: 'Home Delivery', category: 'delivery' as ProductCategory, color: 'from-cyan-100 to-teal-100' },
                    { label: 'Sparkling', category: 'sparkling' as ProductCategory, color: 'from-sky-100 to-blue-100' },
                    { label: 'Flavored Water', category: 'flavored' as ProductCategory, color: 'from-green-100 to-teal-100' },
                  ].map((cat) => (
                    <button
                      key={cat.category}
                      onClick={() => navigateToCategory(cat.category)}
                      className={`bg-gradient-to-br ${cat.color} rounded-2xl p-6 sm:p-8 text-center hover:shadow-lg transition-shadow group`}
                    >
                      <span className="text-lg font-medium text-stone-900 group-hover:text-blue-600 transition-colors">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Accessories row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Still Water', category: 'still' as ProductCategory, color: 'from-slate-100 to-blue-100' },
                    { label: 'Bottles', category: 'bottle' as ProductCategory, color: 'from-indigo-100 to-blue-100' },
                    { label: 'Filters', category: 'filter' as ProductCategory, color: 'from-emerald-100 to-teal-100' },
                    { label: 'Primo Perks', category: 'subscription' as ProductCategory, color: 'from-amber-100 to-yellow-100' },
                  ].map((cat) => (
                    <button
                      key={cat.category}
                      onClick={() => navigateToCategory(cat.category)}
                      className={`bg-gradient-to-br ${cat.color} rounded-2xl p-6 sm:p-8 text-center hover:shadow-lg transition-shadow group`}
                    >
                      <span className="text-lg font-medium text-stone-900 group-hover:text-blue-600 transition-colors">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Delivery & Dispensers Section */}
            {deliveryProducts.length > 0 && (
              <ProductSection
                title="Delivery & Dispensers"
                subtitle="Pure water, delivered to your door"
                products={deliveryProducts}
                showViewAll
                onViewAll={() => navigateToCategory('delivery' as ProductCategory)}
              />
            )}

            {/* Hydration Concierge CTA */}
            <section className="py-16 bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h2 className="text-3xl sm:text-4xl font-medium text-stone-900 mb-4">
                  Not sure what's right for you?
                </h2>
                <p className="text-lg text-stone-600 mb-8 max-w-2xl mx-auto">
                  Our AI-powered Hydration Intelligence Concierge builds a personalized hydration plan based on your
                  lifestyle, activity level, household size, and wellness goals.
                </p>
                <button
                  onClick={() => navigateToAdvisor()}
                  className="px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-full hover:shadow-xl hover:shadow-blue-500/30 transition-all text-lg"
                >
                  Build My Hydration Plan
                </button>
              </div>
            </section>

            {/* Sparkling & Flavored Section */}
            {sparklingProducts.length > 0 && (
              <ProductSection
                title="Sparkling & Flavored"
                subtitle="Zero sugar, all the refreshment"
                products={sparklingProducts}
                showViewAll
                onViewAll={() => navigateToCategory('sparkling' as ProductCategory)}
              />
            )}

            {/* Still Water & Accessories Section */}
            {stillProducts.length > 0 && (
              <div className="bg-stone-50">
                <ProductSection
                  title="Bottles, Filters & Still Water"
                  subtitle="Hydration essentials for every lifestyle"
                  products={stillProducts}
                  showViewAll
                  onViewAll={() => navigateToCategory('bottle' as ProductCategory)}
                />
              </div>
            )}

            {/* New Arrivals */}
            {newArrivals.length > 0 && (
              <div className="bg-stone-50">
                <ProductSection
                  title="New Arrivals"
                  subtitle="Fresh picks just for you"
                  products={newArrivals}
                />
              </div>
            )}

            {/* Email Signup */}
            <EmailSignup />

            {/* Footer */}
            <footer className="bg-stone-900 text-white py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">P</span>
                      </div>
                      <span className="text-xl font-semibold">PRIMO</span>
                    </div>
                    <p className="text-stone-400 text-sm">
                      Pure water, delivered your way.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-4">Shop</h4>
                    <ul className="space-y-2 text-sm text-stone-400">
                      <li><button className="hover:text-white transition-colors">Dispensers</button></li>
                      <li><button className="hover:text-white transition-colors">Home Delivery</button></li>
                      <li><button className="hover:text-white transition-colors">Sparkling Water</button></li>
                      <li><button className="hover:text-white transition-colors">Primo Perks</button></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-4">Help</h4>
                    <ul className="space-y-2 text-sm text-stone-400">
                      <li><button className="hover:text-white transition-colors">Contact Us</button></li>
                      <li><button className="hover:text-white transition-colors">Shipping</button></li>
                      <li><button className="hover:text-white transition-colors">Returns</button></li>
                      <li><button className="hover:text-white transition-colors">FAQ</button></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-4">Connect</h4>
                    <div className="flex gap-4">
                      <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                        </svg>
                      </button>
                      <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="border-t border-stone-800 mt-12 pt-8 text-center text-sm text-stone-500">
                  <p>© 2025 Primo Brands. All rights reserved. Demo site — Primo Brands x Merkury x Agentforce.</p>
                </div>
              </div>
            </footer>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <StoreHeader />
      {renderContent()}
      <ExitIntentOverlay />
    </div>
  );
};
