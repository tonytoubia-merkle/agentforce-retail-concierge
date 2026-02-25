import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import { PERSONA_STUBS } from '@/mocks/customerPersonas';
import { fetchDemoContacts } from '@/services/demo/contacts';
import type { DemoContact } from '@/types/customer';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

export const DemoPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [crmContacts, setCrmContacts] = useState<DemoContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const { customer, selectedPersonaId, selectPersona, isResolving, isLoading } = useCustomer();

  // Fetch CRM contacts when panel opens (real mode only)
  useEffect(() => {
    if (!isOpen || useMockData) return;
    setContactsLoading(true);
    fetchDemoContacts()
      .then(setCrmContacts)
      .finally(() => setContactsLoading(false));
  }, [isOpen]);

  const handleSelect = async (personaId: string) => {
    await selectPersona(personaId);
  };

  // Group CRM contacts by demoProfile type
  const seededContacts = crmContacts.filter((c) => c.demoProfile === 'Seeded');
  const merkuryContacts = crmContacts.filter((c) => c.demoProfile === 'Merkury');
  const createdContacts = crmContacts.filter((c) => c.demoProfile === 'Created');

  const renderContactItem = (contact: DemoContact) => {
    const isActive = contact.id === selectedPersonaId;
    const tier = contact.demoProfile;
    const contactFirstName = contact.firstName || 'Guest';
    return (
      <button
        key={contact.id}
        onClick={() => handleSelect(contact.id)}
        disabled={isResolving || isLoading}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
          isActive
            ? 'bg-white/10 border border-emerald-500/50'
            : 'hover:bg-white/5 border border-transparent'
        } ${(isResolving || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 ${
          tier === 'Merkury'
            ? 'bg-gradient-to-br from-amber-400 to-orange-400'
            : tier === 'Created'
              ? 'bg-gradient-to-br from-emerald-400 to-teal-500'
              : 'bg-gradient-to-br from-purple-400 to-pink-400'
        }`}>
          {contactFirstName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">
            {contact.firstName} {contact.lastName}
          </div>
          <div className="text-[10px] text-white/50 truncate">
            {tier === 'Seeded' ? 'Known · CRM match' : tier === 'Merkury' ? 'Merkury 3P only' : 'Demo-created'}
          </div>
        </div>
        {isActive && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        )}
      </button>
    );
  };

  const activeLabel = (() => {
    if (isResolving) return 'Resolving...';
    if (isLoading) return 'Loading...';
    if (customer?.name && customer.name !== 'Guest') return customer.name.split(' ')[0];
    return 'Demo';
  })();

  return (
    <>
      {/* Floating trigger button — bottom right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-stone-800/90 backdrop-blur-md border border-white/10 px-3.5 py-2.5 text-white text-sm shadow-lg hover:bg-stone-700/90 transition-colors"
      >
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <span className="font-medium text-xs">{activeLabel}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </button>

      {/* Panel overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/20"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-20 right-6 z-50 w-72 bg-gradient-to-b from-stone-800 to-stone-900 rounded-xl shadow-2xl border border-white/10 overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <span className="text-[11px] font-medium text-white/70 uppercase tracking-wider">
                    Demo Mode
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/40 hover:text-white text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Profile list */}
              <div className="px-3 py-2 space-y-1 max-h-72 overflow-y-auto">
                {contactsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
                    <span className="ml-2 text-xs text-white/50">Loading from CRM...</span>
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
                            ? 'bg-white/10 border border-emerald-500/50'
                            : 'hover:bg-white/5 border border-transparent'
                        } ${(isResolving || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 ${
                          stub.identityTier === 'anonymous'
                            ? 'bg-gradient-to-br from-gray-500 to-gray-600'
                            : stub.identityTier === 'appended'
                              ? 'bg-gradient-to-br from-amber-400 to-orange-400'
                              : 'bg-gradient-to-br from-purple-400 to-pink-400'
                        }`}>
                          {stub.identityTier === 'anonymous' ? '?' : stubFirstName.charAt(0)}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-medium text-white/90 truncate">
                            {stub.defaultLabel}
                          </div>
                          <div className={`text-[10px] truncate ${
                            stub.identityTier === 'anonymous' ? 'text-red-400/70' : 'text-white/50'
                          }`}>
                            {stub.identityTier === 'anonymous'
                              ? 'No identity match'
                              : stub.identityTier === 'appended'
                                ? 'Merkury 3P only'
                                : 'Known · CRM match'}
                          </div>
                        </div>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  /* Real mode: grouped CRM contacts + static Merkury appended */
                  <>
                    {seededContacts.length > 0 && (
                      <>
                        <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider px-3 pt-2 pb-1">
                          Seeded ({seededContacts.length})
                        </div>
                        {seededContacts.map((c) => renderContactItem(c))}
                      </>
                    )}
                    {/* Merkury Appended profiles (not in CRM — static from PERSONA_STUBS) */}
                    {(() => {
                      const appendedStubs = PERSONA_STUBS.filter((s) => s.identityTier === 'appended');
                      const totalMerkury = merkuryContacts.length + appendedStubs.length;
                      if (totalMerkury === 0) return null;
                      return (
                        <>
                          <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider px-3 pt-2 pb-1">
                            Merkury ({totalMerkury})
                          </div>
                          {merkuryContacts.map((c) => renderContactItem(c))}
                          {appendedStubs.map((stub) => {
                            const isActive = stub.id === selectedPersonaId;
                            const stubFirstName = stub.defaultLabel.split(' ')[0];
                            return (
                              <button
                                key={stub.id}
                                onClick={() => handleSelect(stub.id)}
                                disabled={isResolving || isLoading}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                  isActive
                                    ? 'bg-white/10 border border-emerald-500/50'
                                    : 'hover:bg-white/5 border border-transparent'
                                } ${(isResolving || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 bg-gradient-to-br from-amber-400 to-orange-400">
                                  {stubFirstName.charAt(0)}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <div className="text-sm font-medium text-white/90 truncate">
                                    {stub.defaultLabel}
                                  </div>
                                  <div className="text-[10px] text-white/50 truncate">
                                    Merkury 3P only
                                  </div>
                                </div>
                                {isActive && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}
                    {createdContacts.length > 0 && (
                      <>
                        <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider px-3 pt-2 pb-1">
                          Created ({createdContacts.length})
                        </div>
                        {createdContacts.map((c) => renderContactItem(c))}
                      </>
                    )}
                    {/* Anonymous option */}
                    <div className="border-t border-white/10 mt-2 pt-2">
                      <button
                        onClick={() => handleSelect('anonymous')}
                        disabled={isResolving || isLoading}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          selectedPersonaId === 'anonymous'
                            ? 'bg-white/10 border border-emerald-500/50'
                            : 'hover:bg-white/5 border border-transparent'
                        } ${(isResolving || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 bg-gradient-to-br from-gray-500 to-gray-600">
                          ?
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-medium text-white/90">Anonymous Visitor</div>
                          <div className="text-[10px] text-red-400/70">No identity match</div>
                        </div>
                        {selectedPersonaId === 'anonymous' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-white/5">
                <p className="text-white/20 text-[9px] leading-relaxed">
                  Switch identities to simulate Merkury resolution
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
