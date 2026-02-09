import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import { useStore } from '@/contexts/StoreContext';
import { PERSONA_STUBS } from '@/mocks/customerPersonas';
import { fetchDemoContacts } from '@/services/demo/contacts';
import { MerkuryProfilePicker } from './MerkuryProfilePicker';
import type { DemoContact, CustomerProfile } from '@/types/customer';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

// ─── Helpers (matching IdentityPanel) ────────────────────────────

function buildSubtitle(profile: CustomerProfile): string {
  const tier = profile.merkuryIdentity?.identityTier || 'anonymous';
  if (tier === 'anonymous') return 'Merkury: No Match';
  if (tier === 'appended') return 'Merkury: Matched · Appended Only';
  const loyalty = profile.loyalty?.tier;
  if (loyalty) return `Merkury: Matched · ${loyalty.charAt(0).toUpperCase() + loyalty.slice(1)} Member`;
  return 'Merkury: Matched · No Loyalty';
}

function buildTraits(profile: CustomerProfile): string[] {
  const traits: string[] = [];
  const tier = profile.merkuryIdentity?.identityTier || 'anonymous';

  if (tier === 'anonymous') return [];

  if (tier === 'appended' && profile.appendedProfile?.interests?.length) {
    for (const interest of profile.appendedProfile.interests.slice(0, 3)) {
      traits.push(interest.charAt(0).toUpperCase() + interest.slice(1));
    }
    if (profile.appendedProfile.geoRegion) traits.push(profile.appendedProfile.geoRegion);
    return traits.slice(0, 4);
  }

  if (profile.beautyProfile?.skinType && profile.beautyProfile.skinType !== 'normal') {
    traits.push(`${profile.beautyProfile.skinType.charAt(0).toUpperCase() + profile.beautyProfile.skinType.slice(1)} skin`);
  }
  const orderCount = profile.orders?.length || 0;
  if (orderCount > 0) traits.push(`${orderCount} order${orderCount !== 1 ? 's' : ''}`);
  if (profile.loyalty) {
    const pts = profile.loyalty.pointsBalance;
    if (pts) traits.push(`${pts.toLocaleString()} pts`);
  }
  if (profile.beautyProfile?.concerns?.length) {
    traits.push(profile.beautyProfile.concerns[0].charAt(0).toUpperCase() + profile.beautyProfile.concerns[0].slice(1));
  }
  return traits.slice(0, 4);
}

// ─── Profile Section Component ───────────────────────────────────

const ProfileSection: React.FC<{ title: string; source?: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, source, children, defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-stone-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-stone-50 transition-colors"
      >
        <span className="text-xs font-medium text-stone-700">{title}</span>
        <div className="flex items-center gap-2">
          {source && <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">{source}</span>}
          <span className="text-stone-400 text-xs">{open ? '−' : '+'}</span>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProfileField: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-[11px] text-stone-500 shrink-0">{label}</span>
      <span className="text-[11px] text-stone-700 text-right">{value}</span>
    </div>
  );
};

function renderProfileSections(customer: CustomerProfile) {
  const sections: React.ReactNode[] = [];
  const bp = customer.beautyProfile;

  if (bp?.skinType) {
    sections.push(
      <ProfileSection key="beauty" title="Beauty Profile" source="CRM" defaultOpen>
        <ProfileField label="Skin Type" value={bp.skinType} />
        <ProfileField label="Concerns" value={bp.concerns?.join(', ')} />
        <ProfileField label="Allergies" value={bp.allergies?.join(', ')} />
        <ProfileField label="Brands" value={bp.preferredBrands?.join(', ')} />
      </ProfileSection>
    );
  }

  if (customer.orders && customer.orders.length > 0) {
    sections.push(
      <ProfileSection key="orders" title={`Orders (${customer.orders.length})`} source="CRM">
        {customer.orders.slice(0, 3).map((o, i) => (
          <div key={i} className="py-1 border-b border-stone-50 last:border-b-0">
            <div className="flex justify-between">
              <span className="text-[11px] text-stone-600">{o.orderId}</span>
              <span className="text-[11px] text-stone-400">${o.totalAmount}</span>
            </div>
            <div className="text-[10px] text-stone-400 truncate">
              {o.lineItems.map(li => li.productName).join(', ')}
            </div>
          </div>
        ))}
      </ProfileSection>
    );
  }

  if (customer.loyalty) {
    const l = customer.loyalty;
    sections.push(
      <ProfileSection key="loyalty" title="Loyalty" source="CRM">
        <ProfileField label="Tier" value={l.tier.charAt(0).toUpperCase() + l.tier.slice(1)} />
        <ProfileField label="Points Balance" value={l.pointsBalance?.toLocaleString()} />
        <ProfileField label="Lifetime Points" value={l.lifetimePoints?.toLocaleString()} />
        <ProfileField label="Member Since" value={l.memberSince} />
      </ProfileSection>
    );
  }

  if (customer.appendedProfile) {
    const ap = customer.appendedProfile;
    sections.push(
      <ProfileSection key="appended" title="Merkury 3P Data" source="Merkury">
        <ProfileField label="Age Range" value={ap.ageRange} />
        <ProfileField label="Gender" value={ap.gender} />
        <ProfileField label="Income" value={ap.householdIncome} />
        <ProfileField label="Region" value={ap.geoRegion} />
        <ProfileField label="Interests" value={ap.interests?.join(', ')} />
      </ProfileSection>
    );
  }

  return sections;
}

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

  // Re-fetch CRM contacts each time the demo section is opened (real mode only)
  useEffect(() => {
    if (!showDemoProfiles || useMockData) return;
    setContactsLoading(true);
    fetchDemoContacts()
      .then((contacts) => {
        setCrmContacts(contacts);
        setContactsFetched(true);
      })
      .finally(() => setContactsLoading(false));
  }, [showDemoProfiles]);

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

  // Dark theme version for demo section
  const renderContactItemDark = (contact: DemoContact) => {
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
                {/* ─── REAL PROFILE SECTION ─── */}
                <div className="px-4 py-4 bg-gradient-to-br from-stone-50 to-rose-50 border-b border-gray-100">
                  {isAuthenticated && isKnown ? (
                    <>
                      <p className="text-lg font-medium text-stone-900">
                        Hello, {firstName}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {customer ? buildSubtitle(customer) : 'Welcome back'}
                      </p>
                      {/* Trait badges */}
                      {customer && buildTraits(customer).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {buildTraits(customer).map((trait) => (
                            <span key={trait} className="inline-block px-2 py-0.5 rounded-full bg-white/80 text-stone-600 text-[10px] border border-stone-200">
                              {trait}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : isPseudonymous ? (
                    <>
                      <p className="text-lg font-medium text-stone-900">
                        Welcome{isKnown ? `, ${firstName}` : ''}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {customer ? buildSubtitle(customer) : 'Sign in to access your account'}
                      </p>
                      {/* Trait badges for pseudonymous */}
                      {customer && buildTraits(customer).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {buildTraits(customer).map((trait) => (
                            <span key={trait} className="inline-block px-2 py-0.5 rounded-full bg-white/80 text-stone-600 text-[10px] border border-stone-200">
                              {trait}
                            </span>
                          ))}
                        </div>
                      )}
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

                {/* ─── PROFILE DATA SECTIONS (for authenticated/pseudonymous) ─── */}
                {customer && (isAuthenticated || isPseudonymous) && (
                  <div className="border-b border-gray-100 max-h-48 overflow-y-auto">
                    {renderProfileSections(customer)}
                  </div>
                )}

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

                {/* ─── DEMO SWITCHER SECTION (Dark Admin Tool Aesthetic) ─── */}
                <div className="bg-gradient-to-b from-stone-800 to-stone-900 rounded-b-xl">
                  <button
                    onClick={() => setShowDemoProfiles(!showDemoProfiles)}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {/* Flask/beaker icon for "lab" feel */}
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <span className="text-[11px] font-medium text-white/70 uppercase tracking-wider">
                        Demo Mode
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <svg
                      className={`w-4 h-4 text-white/40 transition-transform ${showDemoProfiles ? 'rotate-180' : ''}`}
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
                        <div className="px-3 pb-3 space-y-1 max-h-64 overflow-y-auto">
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
                                  {seededContacts.map((c) => renderContactItemDark(c))}
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
                                    {merkuryContacts.map((c) => renderContactItemDark(c))}
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
                                  {createdContacts.map((c) => renderContactItemDark(c))}
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
