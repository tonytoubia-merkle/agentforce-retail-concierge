import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import { useStore } from '@/contexts/StoreContext';
import { PERSONA_STUBS } from '@/mocks/customerPersonas';
import { fetchDemoContacts } from '@/services/demo/contacts';
import { MerkuryProfilePicker } from './MerkuryProfilePicker';
import type { DemoContact } from '@/types/customer';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

export const ProfileDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);
  const [showMerkuryPicker, setShowMerkuryPicker] = useState(false);
  const [crmContacts, setCrmContacts] = useState<DemoContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsFetched, setContactsFetched] = useState(false);
  const { customer, selectedPersonaId, isAuthenticated, selectPersona, signIn, signOut, isResolving, isLoading } = useCustomer();
  const { navigateToAccount } = useStore();

  const isKnown = customer?.merkuryIdentity?.identityTier === 'known';
  const isAppended = customer?.merkuryIdentity?.identityTier === 'appended';
  const isPseudonymous = (isKnown || isAppended) && !isAuthenticated;
  const firstName = customer?.name?.split(' ')[0] || 'Guest';

  // Lazy-load CRM contacts when demo section is opened (real mode only)
  useEffect(() => {
    if (!showDemoProfiles || useMockData || contactsFetched) return;
    setContactsLoading(true);
    fetchDemoContacts()
      .then((contacts) => {
        setCrmContacts(contacts);
        setContactsFetched(true);
      })
      .finally(() => setContactsLoading(false));
  }, [showDemoProfiles, contactsFetched]);

  const handleSelect = async (personaId: string) => {
    await selectPersona(personaId);
  };

  const handleSignIn = () => {
    signIn();
    setIsOpen(false);
  };

  const handleSignOut = () => {
    signOut();
  };

  const handleNotMe = () => {
    selectPersona('anonymous');
    setIsOpen(false);
  };

  const handleRegister = () => {
    setIsOpen(false);
    setShowMerkuryPicker(true);
  };

  // Group CRM contacts by demoProfile type
  const seededContacts = crmContacts.filter((c) => c.demoProfile === 'Seeded');
  const merkuryContacts = crmContacts.filter((c) => c.demoProfile === 'Merkury');
  const createdContacts = crmContacts.filter((c) => c.demoProfile === 'Created');

  const renderContactItem = (contact: DemoContact, tierOverride?: string) => {
    const isActive = contact.id === selectedPersonaId;
    const tier = tierOverride || contact.demoProfile;
    const contactFirstName = contact.firstName || 'Guest';
    return (
      <button
        key={contact.id}
        onClick={() => handleSelect(contact.id)}
        disabled={isResolving || isLoading}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
          isActive
            ? 'bg-white border border-rose-200 shadow-sm'
            : 'hover:bg-stone-100 border border-transparent'
        } ${(isResolving || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 ${
          tier === 'Merkury'
            ? 'bg-gradient-to-br from-amber-400 to-orange-400'
            : tier === 'Created'
              ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
              : 'bg-gradient-to-br from-rose-400 to-purple-500'
        }`}>
          {contactFirstName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-stone-900 truncate">
            {contact.firstName} {contact.lastName}
          </div>
          <div className="text-xs text-stone-500 truncate">
            {tier === 'Seeded' ? 'Rich history' : tier === 'Merkury' ? '3P identity only' : 'Demo-created'}
          </div>
        </div>
        {isActive && (
          <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
        )}
      </button>
    );
  };

  const renderGroupLabel = (label: string, count: number) => (
    <div className="text-[10px] font-medium text-stone-400 uppercase tracking-wider px-3 pt-2 pb-1">
      {label} ({count})
    </div>
  );

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
            isKnown
              ? 'bg-gradient-to-br from-rose-400 to-purple-500'
              : isAppended
                ? 'bg-gradient-to-br from-amber-400 to-orange-400'
                : 'bg-stone-400'
          }`}>
            {(isKnown || isAppended) && customer?.name !== 'Guest' ? firstName.charAt(0).toUpperCase() : (
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
                {/* ─── REAL PROFILE SECTION ─── */}
                <div className="px-4 py-4 bg-gradient-to-br from-stone-50 to-rose-50 border-b border-gray-100">
                  {isAuthenticated && isKnown ? (
                    <>
                      <p className="text-lg font-medium text-stone-900">
                        Hello, {firstName}
                      </p>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {customer?.loyalty?.tier && (
                          <span className="inline-flex items-center gap-1">
                            <span className="capitalize">{customer.loyalty.tier} Member</span>
                            {customer.loyalty.pointsBalance != null && (
                              <span> · {customer.loyalty.pointsBalance.toLocaleString()} pts</span>
                            )}
                          </span>
                        )}
                        {!customer?.loyalty && 'Welcome back'}
                      </p>
                    </>
                  ) : isPseudonymous ? (
                    <>
                      <p className="text-lg font-medium text-stone-900">
                        Welcome{isKnown ? `, ${firstName}` : ''}
                      </p>
                      <p className="text-sm text-stone-500 mt-1">
                        Sign in to access your account
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={handleSignIn}
                          className="px-4 py-1.5 text-sm font-medium bg-stone-900 text-white rounded-full hover:bg-stone-800 transition-colors"
                        >
                          Sign In
                        </button>
                        <button
                          onClick={handleRegister}
                          className="px-4 py-1.5 text-sm font-medium border border-stone-300 text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
                        >
                          Register
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
                    </div>
                  </div>
                )}

                {/* Sign out - only for authenticated users */}
                {isAuthenticated && isKnown && (
                  <div className="px-4 py-2 border-b border-gray-100">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}

                {/* ─── DEMO SWITCHER SECTION ─── */}
                <div className="bg-stone-50 border-t-2 border-dashed border-stone-200">
                  <button
                    onClick={() => setShowDemoProfiles(!showDemoProfiles)}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                        Demo Profiles
                      </span>
                      <span className="text-[10px] text-stone-400 bg-stone-200 px-2 py-0.5 rounded">
                        Testing
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-stone-400 transition-transform ${showDemoProfiles ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {showDemoProfiles && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 space-y-0.5 max-h-64 overflow-y-auto">
                          {contactsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                              <span className="ml-2 text-xs text-stone-500">Loading from CRM...</span>
                            </div>
                          ) : useMockData || crmContacts.length === 0 ? (
                            /* Mock mode: use PERSONA_STUBS */
                            PERSONA_STUBS.map((stub) => {
                              const isActive = stub.id === selectedPersonaId;
                              const stubFirstName = stub.defaultLabel.split(' ')[0];
                              return (
                                <button
                                  key={stub.id}
                                  onClick={() => handleSelect(stub.id)}
                                  disabled={isResolving || isLoading}
                                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                    isActive
                                      ? 'bg-white border border-rose-200 shadow-sm'
                                      : 'hover:bg-stone-100 border border-transparent'
                                  } ${(isResolving || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 ${
                                    stub.identityTier === 'anonymous'
                                      ? 'bg-stone-400'
                                      : stub.identityTier === 'appended'
                                        ? 'bg-gradient-to-br from-amber-400 to-orange-400'
                                        : 'bg-gradient-to-br from-rose-400 to-purple-500'
                                  }`}>
                                    {stub.identityTier === 'anonymous' ? '?' : stubFirstName.charAt(0)}
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-medium text-stone-900 truncate">
                                      {stub.defaultLabel}
                                    </div>
                                    <div className="text-xs text-stone-500 truncate">
                                      {stub.identityTier === 'anonymous'
                                        ? 'New visitor'
                                        : stub.identityTier === 'appended'
                                          ? '3rd party data only'
                                          : 'Known customer'}
                                    </div>
                                  </div>
                                  {isActive && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })
                          ) : (
                            /* Real mode: grouped CRM contacts */
                            <>
                              {seededContacts.length > 0 && (
                                <>
                                  {renderGroupLabel('Seeded Profiles', seededContacts.length)}
                                  {seededContacts.map((c) => renderContactItem(c))}
                                </>
                              )}
                              {merkuryContacts.length > 0 && (
                                <>
                                  {renderGroupLabel('Merkury Profiles', merkuryContacts.length)}
                                  {merkuryContacts.map((c) => renderContactItem(c))}
                                </>
                              )}
                              {createdContacts.length > 0 && (
                                <>
                                  {renderGroupLabel('Created Accounts', createdContacts.length)}
                                  {createdContacts.map((c) => renderContactItem(c))}
                                </>
                              )}
                              {/* Anonymous option */}
                              <div className="border-t border-stone-200 mt-2 pt-2">
                                <button
                                  onClick={() => handleSelect('anonymous')}
                                  disabled={isResolving || isLoading}
                                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                    selectedPersonaId === 'anonymous'
                                      ? 'bg-white border border-rose-200 shadow-sm'
                                      : 'hover:bg-stone-100 border border-transparent'
                                  } ${(isResolving || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 bg-stone-400">
                                    ?
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="text-sm font-medium text-stone-900">Anonymous Visitor</div>
                                    <div className="text-xs text-stone-500">New visitor</div>
                                  </div>
                                  {selectedPersonaId === 'anonymous' && (
                                    <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                                  )}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
