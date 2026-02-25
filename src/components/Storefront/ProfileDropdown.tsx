import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import { useStore } from '@/contexts/StoreContext';
import { MerkuryProfilePicker } from './MerkuryProfilePicker';
import type { CustomerProfile } from '@/types/customer';

// ─── Helpers (matching IdentityPanel) ────────────────────────────

function buildSubtitle(profile: CustomerProfile): string {
  const tier = profile.merkuryIdentity?.identityTier || 'anonymous';
  if (tier === 'anonymous') return 'Merkury: No Match';
  if (tier === 'appended') return 'Merkury: Matched · Appended Only';
  const loyalty = profile.loyalty?.tier;
  if (loyalty) return `Merkury: Matched · ${loyalty.charAt(0).toUpperCase() + loyalty.slice(1)} Member`;
  return 'Merkury: Matched · No Loyalty';
}

function buildTraits(profile: CustomerProfile, isAuthenticated = false): string[] {
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

  // Only show skin type for authenticated users — feels intrusive before sign-in
  if (isAuthenticated && profile.beautyProfile?.skinType && profile.beautyProfile.skinType !== 'normal') {
    traits.push(`${profile.beautyProfile.skinType.charAt(0).toUpperCase() + profile.beautyProfile.skinType.slice(1)} skin`);
  }
  const orderCount = profile.orders?.length || 0;
  if (orderCount > 0) traits.push(`${orderCount} order${orderCount !== 1 ? 's' : ''}`);
  if (profile.loyalty) {
    const pts = profile.loyalty.pointsBalance;
    if (pts) traits.push(`${pts.toLocaleString()} pts`);
  }
  // Only show concerns for authenticated users
  if (isAuthenticated && profile.beautyProfile?.concerns?.length) {
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
      <ProfileSection key="beauty" title="Beauty Profile" source="Contact" defaultOpen>
        <ProfileField label="Skin Type" value={bp.skinType} />
        <ProfileField label="Concerns" value={bp.concerns?.join(', ')} />
        <ProfileField label="Allergies" value={bp.allergies?.join(', ')} />
        <ProfileField label="Brands" value={bp.preferredBrands?.join(', ')} />
      </ProfileSection>
    );
  }

  if (customer.orders && customer.orders.length > 0) {
    sections.push(
      <ProfileSection key="orders" title={`Orders (${customer.orders.length})`} source="Order">
        {customer.orders.slice(0, 3).map((o, i) => (
          <div key={i} className="py-1 border-b border-stone-50 last:border-b-0">
            <div className="flex justify-between">
              <span className="text-[11px] text-stone-600">{o.orderId}</span>
              <span className="text-[11px] text-stone-400">{o.orderDate}</span>
            </div>
            <div className="text-[10px] text-stone-400 truncate">
              {o.lineItems.map(li => li.productName).join(', ')} — ${o.totalAmount}
            </div>
          </div>
        ))}
      </ProfileSection>
    );
  }

  if (customer.chatSummaries && customer.chatSummaries.length > 0) {
    sections.push(
      <ProfileSection key="chat" title={`Chat Summaries (${customer.chatSummaries.length})`} source="Chat_Summary__c">
        {customer.chatSummaries.map((c, i) => (
          <div key={i} className="py-1 border-b border-stone-50 last:border-b-0">
            <div className="flex justify-between">
              <span className="text-[10px] text-stone-400">{c.sessionDate}</span>
              <span className={`text-[10px] ${c.sentiment === 'positive' ? 'text-green-600' : c.sentiment === 'negative' ? 'text-red-500' : 'text-stone-400'}`}>
                {c.sentiment}
              </span>
            </div>
            <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">{c.summary}</p>
          </div>
        ))}
      </ProfileSection>
    );
  }

  if (customer.meaningfulEvents && customer.meaningfulEvents.length > 0) {
    sections.push(
      <ProfileSection key="events" title={`Meaningful Events (${customer.meaningfulEvents.length})`} source="Meaningful_Event__c">
        {customer.meaningfulEvents.map((e, i) => (
          <div key={i} className="py-1 border-b border-stone-50 last:border-b-0">
            <div className="flex justify-between">
              <span className="text-[10px] px-1 rounded bg-stone-100 text-stone-500">{e.eventType}</span>
              <span className="text-[10px] text-stone-400">{e.capturedAt}</span>
            </div>
            <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">{e.description}</p>
            {e.agentNote && <p className="text-[10px] text-stone-400 italic mt-0.5">{e.agentNote}</p>}
          </div>
        ))}
      </ProfileSection>
    );
  }

  if (customer.agentCapturedProfile) {
    const fields = Object.entries(customer.agentCapturedProfile).filter(([, v]) => v?.value);
    if (fields.length > 0) {
      sections.push(
        <ProfileSection key="captured" title={`Agent Captured (${fields.length})`} source="Agent_Captured_Profile__c">
          {fields.map(([key, field]) => (
            <div key={key} className="py-1 border-b border-stone-50 last:border-b-0">
              <div className="flex justify-between">
                <span className="text-[11px] text-stone-500">{key}</span>
                <span className={`text-[10px] ${field!.confidence === 'stated' ? 'text-blue-500' : 'text-amber-500'}`}>
                  {field!.confidence}
                </span>
              </div>
              <p className="text-[11px] text-stone-700">
                {Array.isArray(field!.value) ? field!.value.join(', ') : String(field!.value)}
              </p>
            </div>
          ))}
        </ProfileSection>
      );
    }
  }

  if (customer.browseSessions && customer.browseSessions.length > 0) {
    sections.push(
      <ProfileSection key="browse" title={`Browse Sessions (${customer.browseSessions.length})`} source="Browse_Session__c">
        {customer.browseSessions.map((b, i) => (
          <div key={i} className="py-1 border-b border-stone-50 last:border-b-0">
            <div className="flex justify-between">
              <span className="text-[10px] text-stone-400">{b.sessionDate}</span>
              <span className="text-[10px] text-stone-400">{b.durationMinutes}min / {b.device}</span>
            </div>
            <ProfileField label="Categories" value={b.categoriesBrowsed?.join(', ')} />
            <ProfileField label="Products" value={b.productsViewed?.join(', ')} />
          </div>
        ))}
      </ProfileSection>
    );
  }

  if (customer.loyalty) {
    const l = customer.loyalty;
    sections.push(
      <ProfileSection key="loyalty" title="Loyalty" source="LoyaltyProgramMember">
        <ProfileField label="Tier" value={l.tier.charAt(0).toUpperCase() + l.tier.slice(1)} />
        <ProfileField label="Points" value={`${l.pointsBalance?.toLocaleString()} balance / ${l.lifetimePoints?.toLocaleString()} lifetime`} />
        <ProfileField label="Member Since" value={l.memberSince} />
      </ProfileSection>
    );
  }

  if (customer.appendedProfile) {
    const ap = customer.appendedProfile;
    sections.push(
      <ProfileSection key="appended" title="Merkury Appended (3P)" source="Merkury">
        <ProfileField label="Age Range" value={ap.ageRange} />
        <ProfileField label="Gender" value={ap.gender} />
        <ProfileField label="Income" value={ap.householdIncome} />
        <ProfileField label="Region" value={ap.geoRegion} />
        <ProfileField label="Interests" value={ap.interests?.join(', ')} />
        <ProfileField label="Lifestyle" value={ap.lifestyleSignals?.join(', ')} />
      </ProfileSection>
    );
  }

  return sections;
}

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
                      {customer && buildTraits(customer, true).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {buildTraits(customer, true).map((trait) => (
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
                      {/* Trait badges for pseudonymous — no skin type or concerns */}
                      {customer && buildTraits(customer, false).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {buildTraits(customer, false).map((trait) => (
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
