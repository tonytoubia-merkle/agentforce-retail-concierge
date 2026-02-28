import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import { useStore } from '@/contexts/StoreContext';
import { MerkuryProfilePicker } from './MerkuryProfilePicker';

export const ProfileDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showMerkuryPicker, setShowMerkuryPicker] = useState(false);
  const { customer, isAuthenticated, signIn, signOut } = useCustomer();
  const { navigateToAccount, navigateToAppointment } = useStore();

  const isKnown = customer?.merkuryIdentity?.identityTier === 'known';
  const isAppended = customer?.merkuryIdentity?.identityTier === 'appended';
  const isPseudonymous = (isKnown || isAppended) && !isAuthenticated;
  const firstName = customer?.name?.split(' ')[0] || 'Guest';

  const handleSignIn = () => {
    signIn();
    setIsOpen(false);
  };

  const handleSignOut = () => {
    signOut();
  };

  const handleNotMe = () => {
    // Reset to anonymous — handled by DemoPanel now but kept for "Not you?" button
    signOut();
    setIsOpen(false);
  };

  const handleRegister = () => {
    setIsOpen(false);
    setShowMerkuryPicker(true);
  };

  return (
    <>
      <div className="relative">
        {/* Trigger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 p-1.5 text-stone-600 hover:text-stone-900 transition-colors rounded-full hover:bg-stone-100"
          aria-label="Account"
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
            isAuthenticated && isKnown
              ? 'bg-gradient-to-br from-rose-400 to-purple-500'
              : isAuthenticated && isAppended
                ? 'bg-gradient-to-br from-amber-400 to-orange-400'
                : 'bg-stone-400'
          }`}>
            {isAuthenticated && customer?.name && customer?.name !== 'Guest' ? firstName.charAt(0).toUpperCase() : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                {/* ─── GREETING ─── */}
                <div className="px-4 py-4 bg-gradient-to-br from-stone-50 to-rose-50 border-b border-gray-100">
                  {isAuthenticated && isKnown ? (
                    <p className="text-lg font-medium text-stone-900">
                      Hello, {firstName}
                    </p>
                  ) : isPseudonymous ? (
                    <>
                      <p className="text-lg font-medium text-stone-900">
                        Welcome{isKnown ? `, ${firstName}` : ''}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Sign in to access your account
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={handleSignIn}
                          className="px-4 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors"
                        >
                          Sign In
                        </button>
                        {isKnown && (
                          <button
                            onClick={handleNotMe}
                            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
                          >
                            Not you?
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-stone-900">Welcome</p>
                      <p className="text-sm text-stone-500 mt-0.5">
                        Sign in or create an account
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={handleRegister}
                          className="px-4 py-1.5 text-sm font-medium border border-stone-300 text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
                        >
                          Register
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick links - only for authenticated known customers */}
                {isAuthenticated && isKnown && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="space-y-1">
                      <button
                        onClick={() => { navigateToAccount(); setIsOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        Order History
                      </button>
                      <button
                        onClick={() => { navigateToAccount(); setIsOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Beauty Preferences
                      </button>
                      <button
                        onClick={() => { navigateToAppointment(); setIsOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Book a Consultation
                      </button>
                    </div>
                  </div>
                )}

                {/* Sign out - only for authenticated users */}
                {isAuthenticated && isKnown && (
                  <div className="px-4 py-2">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Merkury Profile Picker Modal */}
      <MerkuryProfilePicker
        isOpen={showMerkuryPicker}
        onClose={() => setShowMerkuryPicker(false)}
        onComplete={() => setIsOpen(false)}
      />
    </>
  );
};
