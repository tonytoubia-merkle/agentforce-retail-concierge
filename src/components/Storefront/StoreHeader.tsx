import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { useCart } from '@/contexts/CartContext';
import { useCustomer } from '@/contexts/CustomerContext';
import { ProfileDropdown } from './ProfileDropdown';
import { MerkuryProfilePicker } from './MerkuryProfilePicker';
import type { ProductCategory } from '@/types/product';

const CATEGORIES: { label: string; value: ProductCategory }[] = [
  { label: 'Skincare', value: 'moisturizer' },
  { label: 'Cleansers', value: 'cleanser' },
  { label: 'Serums', value: 'serum' },
  { label: 'Sunscreen', value: 'sunscreen' },
  { label: 'Makeup', value: 'foundation' },
  { label: 'Lips', value: 'lipstick' },
  { label: 'Fragrance', value: 'fragrance' },
  { label: 'Haircare', value: 'shampoo' },
];

interface StoreHeaderProps {
  onBeautyAdvisorClick: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({ onBeautyAdvisorClick }) => {
  const { navigateHome, navigateToCategory, navigateToCart, navigateToAccount, searchQuery, setSearchQuery } = useStore();
  const { itemCount } = useCart();
  const { isAuthenticated, customer, signIn } = useCustomer();
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const isAnonymous = !customer || !customer.merkuryIdentity || customer.merkuryIdentity.identityTier === 'anonymous';
  const isKnown = customer?.merkuryIdentity?.identityTier === 'known';
  const isAppended = customer?.merkuryIdentity?.identityTier === 'appended';
  const isPseudonymous = (isKnown || isAppended) && !isAuthenticated;
  const showRegisterButton = !isAuthenticated && isAnonymous;
  const showSignInButton = isPseudonymous;

  return (
    <>
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
      {/* Top bar - promo */}
      <div className="bg-stone-900 text-white text-center py-2 text-xs tracking-wide">
        <span className="hidden sm:inline">Complimentary shipping on orders over $50 | </span>
        <button
          onClick={onBeautyAdvisorClick}
          className="underline hover:text-rose-300 transition-colors font-medium"
        >
          Try our AI Beauty Advisor
        </button>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={navigateHome}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-purple-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-stone-900">
              BEAUTÉ
            </span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {CATEGORIES.slice(0, 6).map((cat) => (
              <button
                key={cat.value}
                onClick={() => navigateToCategory(cat.value)}
                className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium"
              >
                {cat.label}
              </button>
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <AnimatePresence>
              {showSearch ? (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 200, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => !searchQuery && setShowSearch(false)}
                    autoFocus
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-full focus:outline-none focus:border-rose-300"
                  />
                </motion.div>
              ) : (
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-2 text-stone-600 hover:text-stone-900 transition-colors"
                  aria-label="Search"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </button>
              )}
            </AnimatePresence>

            {/* Beauty Advisor button - desktop */}
            <button
              onClick={onBeautyAdvisorClick}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-purple-500 text-white text-sm font-medium rounded-full hover:shadow-lg hover:shadow-rose-500/25 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>Beauty Advisor</span>
            </button>

            {/* Cart */}
            <button
              onClick={navigateToCart}
              className="relative p-2 text-stone-600 hover:text-stone-900 transition-colors"
              aria-label="Shopping bag"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </button>

            {/* My Account - visible when authenticated */}
            {isAuthenticated && (
              <button
                onClick={navigateToAccount}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                My Account
              </button>
            )}

            {/* Sign In - visible for pseudonymous (known/appended but not authenticated) */}
            {showSignInButton && (
              <button
                onClick={signIn}
                className="hidden sm:block px-3 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors"
              >
                Sign In
              </button>
            )}

            {/* Register - visible only for truly anonymous visitors */}
            {showRegisterButton && (
              <button
                onClick={() => setShowRegister(true)}
                className="hidden sm:block px-3 py-1.5 text-sm font-medium border border-stone-300 text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
              >
                Register
              </button>
            )}

            {/* Profile */}
            <ProfileDropdown />

            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 text-stone-600 hover:text-stone-900 transition-colors"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden border-t border-gray-100 overflow-hidden"
          >
            <nav className="max-w-7xl mx-auto px-4 py-4 space-y-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => {
                    navigateToCategory(cat.value);
                    setShowMobileMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors"
                >
                  {cat.label}
                </button>
              ))}
              <button
                onClick={() => {
                  onBeautyAdvisorClick();
                  setShowMobileMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors font-medium"
              >
                Talk to Beauty Advisor
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>

    {/* Merkury Profile Picker Modal */}
    <MerkuryProfilePicker
      isOpen={showRegister}
      onClose={() => setShowRegister(false)}
    />
    </>
  );
};
