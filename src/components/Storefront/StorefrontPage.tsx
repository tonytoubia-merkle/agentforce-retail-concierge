import { useMemo } from 'react';
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
import { useStore } from '@/contexts/StoreContext';
import { useCustomer } from '@/contexts/CustomerContext';
import { useBrowseTracking } from '@/hooks/useBrowseTracking';
import type { Product, ProductCategory } from '@/types/product';

interface StorefrontPageProps {
  products: Product[];
  onBeautyAdvisorClick: () => void;
}

export const StorefrontPage: React.FC<StorefrontPageProps> = ({
  products,
  onBeautyAdvisorClick,
}) => {
  const { view, selectedCategory, selectedProduct, navigateHome, navigateToCategory } = useStore();
  const { customer, isAuthenticated } = useCustomer();
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

  // Skincare products
  const skincareProducts = useMemo(() => {
    return products
      .filter((p) =>
        ['moisturizer', 'cleanser', 'serum', 'sunscreen', 'mask', 'toner', 'eye-cream', 'spot-treatment'].includes(
          p.category
        )
      )
      .slice(0, 4);
  }, [products]);

  // Makeup products
  const makeupProducts = useMemo(() => {
    return products
      .filter((p) => ['foundation', 'lipstick', 'mascara', 'blush'].includes(p.category))
      .slice(0, 4);
  }, [products]);

  // Haircare products
  const haircareProducts = useMemo(() => {
    return products
      .filter((p) => ['shampoo', 'conditioner', 'hair-treatment'].includes(p.category))
      .slice(0, 4);
  }, [products]);

  // Fragrance products
  const fragranceProducts = useMemo(() => {
    return products.filter((p) => p.category === 'fragrance').slice(0, 4);
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
            onBeautyAdvisor={onBeautyAdvisorClick}
          />
        );

      case 'cart':
        return <CartPage onContinueShopping={navigateHome} />;

      case 'checkout':
        return <CheckoutPage />;

      case 'order-confirmation':
        return <OrderConfirmationPage onBeautyAdvisor={onBeautyAdvisorClick} />;

      case 'account':
        return <AccountPage />;

      case 'appointment':
        return <AppointmentBooking />;

      case 'home':
      default:
        return (
          <>
            <HeroBanner
              onShopNow={() => navigateToCategory('moisturizer' as ProductCategory)}
              onBeautyAdvisor={onBeautyAdvisorClick}
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
                {/* Skincare row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Moisturizers', category: 'moisturizer' as ProductCategory, color: 'from-rose-100 to-pink-100' },
                    { label: 'Cleansers', category: 'cleanser' as ProductCategory, color: 'from-sky-100 to-blue-100' },
                    { label: 'Serums', category: 'serum' as ProductCategory, color: 'from-purple-100 to-violet-100' },
                    { label: 'Sun Care', category: 'sunscreen' as ProductCategory, color: 'from-amber-100 to-yellow-100' },
                  ].map((cat) => (
                    <button
                      key={cat.category}
                      onClick={() => navigateToCategory(cat.category)}
                      className={`bg-gradient-to-br ${cat.color} rounded-2xl p-6 sm:p-8 text-center hover:shadow-lg transition-shadow group`}
                    >
                      <span className="text-lg font-medium text-stone-900 group-hover:text-rose-600 transition-colors">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Makeup row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Foundation', category: 'foundation' as ProductCategory, color: 'from-orange-100 to-amber-100' },
                    { label: 'Lipstick', category: 'lipstick' as ProductCategory, color: 'from-red-100 to-rose-100' },
                    { label: 'Mascara', category: 'mascara' as ProductCategory, color: 'from-stone-200 to-stone-100' },
                    { label: 'Blush', category: 'blush' as ProductCategory, color: 'from-pink-100 to-rose-100' },
                  ].map((cat) => (
                    <button
                      key={cat.category}
                      onClick={() => navigateToCategory(cat.category)}
                      className={`bg-gradient-to-br ${cat.color} rounded-2xl p-6 sm:p-8 text-center hover:shadow-lg transition-shadow group`}
                    >
                      <span className="text-lg font-medium text-stone-900 group-hover:text-rose-600 transition-colors">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Hair & Fragrance row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Shampoo', category: 'shampoo' as ProductCategory, color: 'from-teal-100 to-cyan-100' },
                    { label: 'Conditioner', category: 'conditioner' as ProductCategory, color: 'from-emerald-100 to-green-100' },
                    { label: 'Hair Care', category: 'hair-treatment' as ProductCategory, color: 'from-lime-100 to-green-100' },
                    { label: 'Fragrance', category: 'fragrance' as ProductCategory, color: 'from-violet-100 to-purple-100' },
                  ].map((cat) => (
                    <button
                      key={cat.category}
                      onClick={() => navigateToCategory(cat.category)}
                      className={`bg-gradient-to-br ${cat.color} rounded-2xl p-6 sm:p-8 text-center hover:shadow-lg transition-shadow group`}
                    >
                      <span className="text-lg font-medium text-stone-900 group-hover:text-rose-600 transition-colors">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Skincare Section */}
            {skincareProducts.length > 0 && (
              <ProductSection
                title="Skincare Essentials"
                subtitle="Build your perfect routine"
                products={skincareProducts}
                showViewAll
                onViewAll={() => navigateToCategory('moisturizer' as ProductCategory)}
              />
            )}

            {/* Beauty Advisor CTA */}
            <section className="py-16 bg-gradient-to-br from-rose-50 via-purple-50 to-rose-50">
              <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-rose-400 to-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h2 className="text-3xl sm:text-4xl font-medium text-stone-900 mb-4">
                  Not sure what to get?
                </h2>
                <p className="text-lg text-stone-600 mb-8 max-w-2xl mx-auto">
                  Our AI-powered Beauty Advisor provides personalized recommendations based on your unique skin type,
                  concerns, and preferences.
                </p>
                <button
                  onClick={onBeautyAdvisorClick}
                  className="px-8 py-4 bg-gradient-to-r from-rose-500 to-purple-500 text-white font-medium rounded-full hover:shadow-xl hover:shadow-rose-500/30 transition-all text-lg"
                >
                  Talk to Beauty Advisor
                </button>
              </div>
            </section>

            {/* Makeup Section */}
            {makeupProducts.length > 0 && (
              <ProductSection
                title="Makeup Must-Haves"
                subtitle="Color that inspires"
                products={makeupProducts}
                showViewAll
                onViewAll={() => navigateToCategory('foundation' as ProductCategory)}
              />
            )}

            {/* Haircare Section */}
            {haircareProducts.length > 0 && (
              <div className="bg-stone-50">
                <ProductSection
                  title="Hair Care"
                  subtitle="Healthy hair, beautiful you"
                  products={haircareProducts}
                  showViewAll
                  onViewAll={() => navigateToCategory('shampoo' as ProductCategory)}
                />
              </div>
            )}

            {/* Fragrance Section */}
            {fragranceProducts.length > 0 && (
              <ProductSection
                title="Signature Scents"
                subtitle="Find your perfect fragrance"
                products={fragranceProducts}
                showViewAll
                onViewAll={() => navigateToCategory('fragrance' as ProductCategory)}
              />
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
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">B</span>
                      </div>
                      <span className="text-xl font-semibold">BEAUTÉ</span>
                    </div>
                    <p className="text-stone-400 text-sm">
                      Curated beauty for the modern you.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-4">Shop</h4>
                    <ul className="space-y-2 text-sm text-stone-400">
                      <li><button className="hover:text-white transition-colors">Skincare</button></li>
                      <li><button className="hover:text-white transition-colors">Makeup</button></li>
                      <li><button className="hover:text-white transition-colors">Fragrance</button></li>
                      <li><button className="hover:text-white transition-colors">Haircare</button></li>
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
                  <p>© 2024 BEAUTÉ. All rights reserved. Demo site for Merkle x Agentforce.</p>
                </div>
              </div>
            </footer>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <StoreHeader onBeautyAdvisorClick={onBeautyAdvisorClick} />
      {renderContent()}
    </div>
  );
};
