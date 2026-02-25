import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PERSONA_STUBS } from '@/mocks/customerPersonas';
import type { PersonaStub } from '@/mocks/customerPersonas';
import type { CustomerProfile, DemoContact } from '@/types/customer';
import { useCustomer } from '@/contexts/CustomerContext';
import { fetchDemoContacts } from '@/services/demo/contacts';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

function buildSubtitle(profile: CustomerProfile): string {
  const tier = profile.merkuryIdentity?.identityTier || 'anonymous';
  if (tier === 'anonymous') return 'Merkury: No Match';
  if (tier === 'appended') return 'Merkury Appended Only';
  const loyalty = profile.loyalty?.tier;
  if (loyalty) return `Known · Loyalty ${loyalty.charAt(0).toUpperCase() + loyalty.slice(1)}`;
  return 'Known · No Loyalty';
}

function buildTraits(profile: CustomerProfile): string[] {
  const traits: string[] = [];
  const tier = profile.merkuryIdentity?.identityTier || 'anonymous';

  if (tier === 'anonymous') {
    return ['No identity resolved', 'No history', 'Discovery mode'];
  }

  if (tier === 'appended' && profile.appendedProfile?.interests?.length) {
    for (const interest of profile.appendedProfile.interests.slice(0, 3)) {
      traits.push(interest.charAt(0).toUpperCase() + interest.slice(1));
    }
    if (profile.appendedProfile.geoRegion) traits.push(profile.appendedProfile.geoRegion);
    traits.push('No purchase history');
    return traits.slice(0, 5);
  }

  if (profile.beautyProfile.skinType && profile.beautyProfile.skinType !== 'normal') {
    traits.push(`${profile.beautyProfile.skinType.charAt(0).toUpperCase() + profile.beautyProfile.skinType.slice(1)} skin`);
  }

  const orderCount = profile.orders?.length || 0;
  if (orderCount > 0) traits.push(`${orderCount} order${orderCount !== 1 ? 's' : ''}`);

  if (profile.loyalty) {
    const pts = profile.loyalty.pointsBalance;
    const tierLabel = profile.loyalty.tier.charAt(0).toUpperCase() + profile.loyalty.tier.slice(1);
    traits.push(pts ? `${tierLabel} · ${pts.toLocaleString()} pts` : tierLabel);
  } else if (tier === 'known') {
    traits.push('Not a loyalty member');
  }

  if (profile.beautyProfile.concerns?.length) {
    traits.push(profile.beautyProfile.concerns[0].charAt(0).toUpperCase() + profile.beautyProfile.concerns[0].slice(1));
  }

  if (profile.meaningfulEvents?.length) {
    const desc = profile.meaningfulEvents[0].description;
    traits.push(desc.length > 30 ? desc.slice(0, 28) + '…' : desc);
  } else if (profile.browseSessions?.length) {
    const cats = profile.browseSessions[0].categoriesBrowsed;
    if (cats.length) traits.push(`Browsing ${cats.join(', ')}`);
  }

  return traits.slice(0, 5);
}

export const PersonaSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [crmContacts, setCrmContacts] = useState<DemoContact[]>([]);
  const { selectPersona, customer, isResolving, isLoading } = useCustomer();

  // Fetch CRM contacts when drawer opens (real mode only)
  useEffect(() => {
    if (!isOpen || useMockData) return;
    fetchDemoContacts().then(setCrmContacts);
  }, [isOpen]);

  const activeStub = PERSONA_STUBS.find((s) =>
    customer?.id === `persona-${s.id}` || customer?.merkuryIdentity?.merkuryId === s.merkuryId
  );

  const handleSelect = (personaId: string) => {
    setIsOpen(false);
    selectPersona(personaId);
  };

  const getLabel = (stub: PersonaStub) => {
    if (activeStub?.id === stub.id && customer) return customer.name || stub.defaultLabel;
    return stub.defaultLabel;
  };

  const getSubtitle = (stub: PersonaStub) => {
    if (activeStub?.id === stub.id && customer) return buildSubtitle(customer);
    return stub.defaultSubtitle;
  };

  const getTraits = (stub: PersonaStub) => {
    if (activeStub?.id === stub.id && customer) return buildTraits(customer);
    return [];
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 text-white text-sm shadow-lg hover:bg-white/20 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-medium">
          {isResolving ? 'Resolving...' : isLoading ? 'Loading...' : activeStub ? getLabel(activeStub) : 'Select Identity'}
        </span>
      </button>

      {/* Backdrop + Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-80 bg-gray-900/95 backdrop-blur-xl border-r border-white/10 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-white text-lg font-semibold">Merkury Identity</h2>
                    <p className="text-white/50 text-xs mt-0.5">Select a demo persona</p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-white/50 hover:text-white text-xl"
                  >
                    &times;
                  </button>
                </div>

                <div className="space-y-3">
                  {PERSONA_STUBS.map((stub) => {
                    const isActive = activeStub?.id === stub.id;
                    const label = getLabel(stub);
                    const subtitle = getSubtitle(stub);
                    const traits = getTraits(stub);
                    return (
                      <button
                        key={stub.id}
                        onClick={() => handleSelect(stub.id)}
                        disabled={isResolving || isLoading}
                        className={`w-full text-left rounded-xl p-4 transition-all ${
                          isActive
                            ? 'bg-white/15 border border-white/30 ring-1 ring-white/20'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        } ${isResolving || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                            stub.identityTier === 'anonymous'
                              ? 'bg-gradient-to-br from-gray-500 to-gray-600'
                              : stub.identityTier === 'appended'
                                ? 'bg-gradient-to-br from-amber-400 to-orange-400'
                                : 'bg-gradient-to-br from-purple-400 to-pink-400'
                          }`}>
                            {stub.identityTier === 'anonymous'
                              ? '?'
                              : label.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white font-medium text-sm">{label}</div>
                            <div className={`text-xs ${
                              stub.identityTier === 'anonymous'
                                ? 'text-red-400/70'
                                : 'text-white/50'
                            }`}>{subtitle}</div>
                            {isActive && isLoading && (
                              <div className="text-white/40 text-[10px] mt-1">Loading profile from Data Cloud...</div>
                            )}
                            {traits.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {traits.map((trait) => (
                                  <span
                                    key={trait}
                                    className="inline-block px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px]"
                                  >
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {isActive && !isLoading && (
                          <div className="mt-2 text-emerald-400 text-xs font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* CRM Contacts (real mode only) */}
                {!useMockData && crmContacts.length > 0 && (() => {
                  const seeded = crmContacts.filter((c) => c.demoProfile === 'Seeded');
                  const created = crmContacts.filter((c) => c.demoProfile === 'Created');
                  const renderGroup = (label: string, contacts: DemoContact[], gradient: string) =>
                    contacts.length > 0 && (
                      <>
                        <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider mt-4 mb-1">
                          {label} ({contacts.length})
                        </div>
                        {contacts.map((c) => {
                          const isActive = c.id === customer?.id;
                          return (
                            <button
                              key={c.id}
                              onClick={() => handleSelect(c.id)}
                              disabled={isResolving || isLoading}
                              className={`w-full text-left rounded-xl p-3 transition-all ${
                                isActive
                                  ? 'bg-white/15 border border-white/30 ring-1 ring-white/20'
                                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
                              } ${isResolving || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-gradient-to-br ${gradient}`}>
                                  {(c.firstName || '?').charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-white font-medium text-sm truncate">
                                    {c.firstName} {c.lastName}
                                  </div>
                                  <div className="text-white/50 text-[10px] truncate">
                                    {c.demoProfile === 'Seeded' ? 'Known · CRM match' : 'Demo-created'}
                                  </div>
                                </div>
                                {isActive && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 ml-auto" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </>
                    );
                  return (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-white/60 text-xs font-semibold mb-1">CRM Contacts</div>
                      {renderGroup('Seeded', seeded, 'from-rose-400 to-purple-500')}
                      {renderGroup('Created', created, 'from-emerald-400 to-teal-500')}
                    </div>
                  );
                })()}

                <div className="mt-6 pt-4 border-t border-white/10">
                  <p className="text-white/30 text-[10px] leading-relaxed">
                    In production, Merkury's Identity tag fires automatically on page load and resolves the visitor via cookie/device graph. This selector simulates that resolution for demo purposes.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
