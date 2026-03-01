import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PERSONA_STUBS } from '@/mocks/customerPersonas';
import type { PersonaStub } from '@/mocks/customerPersonas';
import type { CustomerProfile } from '@/types/customer';
import { useCustomer } from '@/contexts/CustomerContext';

// ─── Helpers ────────────────────────────────────────────────────

function buildSubtitle(profile: CustomerProfile): string {
  const tier = profile.merkuryIdentity?.identityTier || 'anonymous';
  if (tier === 'anonymous') return 'Merkury: No Match';
  if (tier === 'appended') return 'Merkury: Matched · Appended Only';
  const loyalty = profile.loyalty?.tier;
  if (loyalty) return `Merkury: Matched · Loyalty ${loyalty.charAt(0).toUpperCase() + loyalty.slice(1)}`;
  return 'Merkury: Matched · No Loyalty';
}

function buildTraits(profile: CustomerProfile): string[] {
  const traits: string[] = [];
  const tier = profile.merkuryIdentity?.identityTier || 'anonymous';

  if (tier === 'anonymous') return ['No identity resolved', 'No history', 'Discovery mode'];

  if (tier === 'appended' && profile.appendedProfile?.interests?.length) {
    for (const interest of profile.appendedProfile.interests.slice(0, 3)) {
      traits.push(interest.charAt(0).toUpperCase() + interest.slice(1));
    }
    if (profile.appendedProfile.geoRegion) traits.push(profile.appendedProfile.geoRegion);
    traits.push('No purchase history');
    return traits.slice(0, 5);
  }

  if (profile.beautyProfile?.skinType && profile.beautyProfile.skinType !== 'normal') {
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
  if (profile.beautyProfile?.concerns?.length) {
    traits.push(profile.beautyProfile.concerns[0].charAt(0).toUpperCase() + profile.beautyProfile.concerns[0].slice(1));
  }
  return traits.slice(0, 5);
}

// ─── Profile data sections ──────────────────────────────────────

const Section: React.FC<{ title: string; source: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, source, children, defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-xs font-medium text-white/90">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{source}</span>
          <span className="text-white/40 text-xs">{open ? '−' : '+'}</span>
        </div>
      </button>
      {open && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-[11px] text-white/40 shrink-0">{label}</span>
      <span className="text-[11px] text-white/80 text-right">{value}</span>
    </div>
  );
};

function renderProfileSections(customer: CustomerProfile) {
  const sections: React.ReactNode[] = [];
  const bp = customer.beautyProfile;

  if (bp?.skinType) {
    sections.push(
      <Section key="beauty" title="Beauty Profile" source="Contact" defaultOpen>
        <Field label="Skin Type" value={bp.skinType} />
        <Field label="Concerns" value={bp.concerns?.join(', ')} />
        <Field label="Allergies" value={bp.allergies?.join(', ')} />
        <Field label="Preferred Brands" value={bp.preferredBrands?.join(', ')} />
      </Section>
    );
  }

  if (customer.orders?.length > 0) {
    sections.push(
      <Section key="orders" title={`Orders (${customer.orders.length})`} source="Order">
        {customer.orders.map((o, i) => (
          <div key={i} className="py-1 border-b border-white/5 last:border-b-0">
            <div className="flex justify-between">
              <span className="text-[11px] text-white/70">{o.orderId}</span>
              <span className="text-[11px] text-white/50">{o.orderDate}</span>
            </div>
            <div className="text-[10px] text-white/40">
              {o.lineItems.map(li => li.productName).join(', ')} — ${o.totalAmount}
            </div>
          </div>
        ))}
      </Section>
    );
  }

  if (customer.chatSummaries?.length > 0) {
    sections.push(
      <Section key="chat" title={`Chat Summaries (${customer.chatSummaries.length})`} source="Chat_Summary__c">
        {customer.chatSummaries.map((c, i) => (
          <div key={i} className="py-1 border-b border-white/5 last:border-b-0">
            <div className="flex justify-between">
              <span className="text-[10px] text-white/50">{c.sessionDate}</span>
              <span className={`text-[10px] ${c.sentiment === 'positive' ? 'text-green-400/60' : c.sentiment === 'negative' ? 'text-red-400/60' : 'text-white/40'}`}>
                {c.sentiment}
              </span>
            </div>
            <p className="text-[11px] text-white/70 mt-0.5 leading-snug">{c.summary}</p>
          </div>
        ))}
      </Section>
    );
  }

  if (customer.meaningfulEvents?.length > 0) {
    sections.push(
      <Section key="events" title={`Meaningful Events (${customer.meaningfulEvents.length})`} source="Meaningful_Event__c">
        {customer.meaningfulEvents.map((e, i) => (
          <div key={i} className="py-1 border-b border-white/5 last:border-b-0">
            <div className="flex justify-between">
              <span className="text-[10px] px-1 rounded bg-white/10 text-white/50">{e.eventType}</span>
              <span className="text-[10px] text-white/40">{e.capturedAt}</span>
            </div>
            <p className="text-[11px] text-white/70 mt-0.5 leading-snug">{e.description}</p>
            {e.agentNote && <p className="text-[10px] text-white/40 italic mt-0.5">{e.agentNote}</p>}
          </div>
        ))}
      </Section>
    );
  }

  if (customer.agentCapturedProfile) {
    const fields = Object.entries(customer.agentCapturedProfile).filter(([, v]) => v?.value);
    if (fields.length > 0) {
      sections.push(
        <Section key="captured" title={`Agent Captured (${fields.length})`} source="Agent_Captured_Profile__c">
          {fields.map(([key, field]) => (
            <div key={key} className="py-1 border-b border-white/5 last:border-b-0">
              <div className="flex justify-between">
                <span className="text-[11px] text-white/60">{key}</span>
                <span className={`text-[10px] ${field!.confidence === 'stated' ? 'text-blue-400/60' : 'text-yellow-400/60'}`}>
                  {field!.confidence}
                </span>
              </div>
              <p className="text-[11px] text-white/80">
                {Array.isArray(field!.value) ? field!.value.join(', ') : String(field!.value)}
              </p>
            </div>
          ))}
        </Section>
      );
    }
  }

  if (customer.browseSessions?.length > 0) {
    sections.push(
      <Section key="browse" title={`Browse Sessions (${customer.browseSessions.length})`} source="Browse_Session__c">
        {customer.browseSessions.map((b, i) => (
          <div key={i} className="py-1 border-b border-white/5 last:border-b-0">
            <div className="flex justify-between">
              <span className="text-[10px] text-white/50">{b.sessionDate}</span>
              <span className="text-[10px] text-white/40">{b.durationMinutes}min / {b.device}</span>
            </div>
            <Field label="Categories" value={b.categoriesBrowsed?.join(', ')} />
            <Field label="Products" value={b.productsViewed?.join(', ')} />
          </div>
        ))}
      </Section>
    );
  }

  if (customer.loyalty) {
    const l = customer.loyalty;
    sections.push(
      <Section key="loyalty" title="Loyalty" source="LoyaltyProgramMember">
        <Field label="Tier" value={l.tier} />
        <Field label="Points" value={`${l.pointsBalance.toLocaleString()} balance / ${l.lifetimePoints.toLocaleString()} lifetime`} />
        <Field label="Member Since" value={l.memberSince} />
      </Section>
    );
  }

  // Appended profile (3P)
  if (customer.appendedProfile) {
    const ap = customer.appendedProfile;
    sections.push(
      <Section key="appended" title="Merkury Appended (3P)" source="Merkury">
        <Field label="Age Range" value={ap.ageRange} />
        <Field label="Gender" value={ap.gender} />
        <Field label="Income" value={ap.householdIncome} />
        <Field label="Region" value={ap.geoRegion} />
        <Field label="Interests" value={ap.interests?.join(', ')} />
        <Field label="Lifestyle" value={ap.lifestyleSignals?.join(', ')} />
      </Section>
    );
  }

  return sections;
}

// ─── Main component ─────────────────────────────────────────────

export const IdentityPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { selectPersona, customer, selectedPersonaId, isResolving, isLoading, refreshProfile, resetPersonaSession } = useCustomer();

  const activeStub = PERSONA_STUBS.find((s) => s.id === selectedPersonaId);

  const handleSelect = (personaId: string) => {
    selectPersona(personaId);
    // Don't close — let user see the profile data load
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

  const buttonLabel = isResolving
    ? 'Resolving...'
    : isLoading
      ? 'Loading...'
      : activeStub
        ? (customer?.name || activeStub.defaultLabel)
        : 'Select Identity';

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white/90 hover:bg-black/70 transition-all"
      >
        <span className={`w-2 h-2 rounded-full ${activeStub ? 'bg-emerald-400' : 'bg-white/30'} ${isResolving ? 'animate-pulse' : ''}`} />
        <span className="font-medium">{buttonLabel}</span>
        <span className="text-white/40">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Invisible backdrop to close on outside click */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 max-h-[85vh] overflow-y-auto rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50"
            >
              {/* ── Active persona + profile data (pinned at top) ── */}
              {activeStub && (
                <div className="border-b border-white/10">
                  {/* Active persona card */}
                  <div className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                        activeStub.identityTier === 'anonymous'
                          ? 'bg-gradient-to-br from-gray-500 to-gray-600'
                          : activeStub.identityTier === 'appended'
                            ? 'bg-gradient-to-br from-amber-400 to-orange-400'
                            : 'bg-gradient-to-br from-purple-400 to-pink-400'
                      }`}>
                        {activeStub.identityTier === 'anonymous' ? '?' : getLabel(activeStub).charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white text-sm font-medium">{getLabel(activeStub)}</span>
                          <span className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); refreshProfile(); }}
                              disabled={isLoading || isResolving}
                              title="Refresh profile data"
                              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-30"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.841V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.841v1.255a.75.75 0 0 1-1.5 0V9.14a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.681.75.75 0 0 1 1.025-.274Z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); resetPersonaSession(activeStub!.id); }}
                              disabled={isLoading || isResolving}
                              title="Reset this session"
                              className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-red-400/80 transition-colors disabled:opacity-30"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                              </svg>
                            </button>
                            <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Active
                            </span>
                          </span>
                        </div>
                        <div className="text-[11px] text-white/50">{getSubtitle(activeStub)}</div>
                      </div>
                    </div>
                    {getTraits(activeStub).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 ml-12">
                        {getTraits(activeStub).map((trait) => (
                          <span key={trait} className="inline-block px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px]">
                            {trait}
                          </span>
                        ))}
                      </div>
                    )}
                    {isLoading && (
                      <div className="text-white/40 text-[10px] mt-2 ml-12">Loading profile from Data Cloud...</div>
                    )}
                  </div>

                  {/* Profile data sections (only when customer is loaded) */}
                  {customer && (
                    <div>
                      <div className="px-3 py-2 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-white">{customer.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            {customer.merkuryIdentity?.identityTier === 'appended' ? 'Merkury 3P' : 'Salesforce CRM'}
                          </span>
                        </div>
                        {customer.email && (
                          <div className="text-[10px] text-white/50 mt-0.5">{customer.email} — {customer.id}</div>
                        )}
                      </div>
                      {renderProfileSections(customer)}
                    </div>
                  )}
                </div>
              )}

              {/* ── Persona list (all others) ── */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white/80">
                    {activeStub ? 'Switch Identity' : 'Merkury Identity'}
                  </span>
                  <span className="text-[10px] text-white/30">Demo personas</span>
                </div>
                <div className="space-y-1.5">
                  {PERSONA_STUBS.filter((s) => s.id !== activeStub?.id).map((stub) => {
                    const label = getLabel(stub);
                    const subtitle = stub.defaultSubtitle;
                    return (
                      <button
                        key={stub.id}
                        onClick={() => handleSelect(stub.id)}
                        disabled={isResolving || isLoading}
                        className={`w-full text-left rounded-lg p-2.5 transition-all bg-white/5 border border-transparent hover:bg-white/10 ${
                          isResolving || isLoading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${
                            stub.identityTier === 'anonymous'
                              ? 'bg-gradient-to-br from-gray-500 to-gray-600'
                              : stub.identityTier === 'appended'
                                ? 'bg-gradient-to-br from-amber-400 to-orange-400'
                                : 'bg-gradient-to-br from-purple-400 to-pink-400'
                          }`}>
                            {stub.identityTier === 'anonymous' ? '?' : label.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-white text-xs font-medium">{label}</span>
                            <div className={`text-[10px] ${stub.identityTier === 'anonymous' ? 'text-red-400/70' : 'text-white/50'}`}>
                              {subtitle}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-white/10">
                <p className="text-white/30 text-[9px] leading-relaxed">
                  In production, Merkury's Identity tag fires automatically on page load. This panel simulates identity resolution for demo purposes.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
