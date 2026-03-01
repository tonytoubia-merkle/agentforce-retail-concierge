import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import { useCampaign } from '@/contexts/CampaignContext';
import { PERSONA_STUBS } from '@/mocks/customerPersonas';
import { fetchDemoContacts } from '@/services/demo/contacts';
import { getDataCloudWriteService } from '@/services/datacloud';
import type { DemoContact, CustomerProfile } from '@/types/customer';
import type { CampaignAttribution } from '@/types/campaign';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

// ─── Profile detail sub-components (dark theme) ─────────────────

const DetailField: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2 py-0.5">
      <span className="text-[11px] text-white/40 shrink-0">{label}</span>
      <span className="text-[11px] text-white/80 text-right">{value}</span>
    </div>
  );
};

const DetailSection: React.FC<{ title: string; source?: string; children: React.ReactNode }> = ({
  title, source, children,
}) => (
  <div className="border-b border-white/5 last:border-b-0 pb-2 mb-2 last:mb-0 last:pb-0">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">{title}</span>
      {source && <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-white/30">{source}</span>}
    </div>
    {children}
  </div>
);

interface ManageOptions {
  isManageMode: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

const DeleteCheckbox: React.FC<{ id: string; selected: boolean; onToggle: (id: string) => void }> = ({ id, selected, onToggle }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onToggle(id); }}
    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
      selected
        ? 'bg-red-500 border-red-500'
        : 'border-white/30 hover:border-white/50'
    }`}
  >
    {selected && (
      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    )}
  </button>
);

function renderProfileDetail(customer: CustomerProfile, manage?: ManageOptions) {
  const sections: React.ReactNode[] = [];
  const bp = customer.beautyProfile;

  if (bp?.skinType) {
    sections.push(
      <DetailSection key="beauty" title="Beauty Profile" source="Contact">
        <DetailField label="Skin Type" value={bp.skinType} />
        <DetailField label="Concerns" value={bp.concerns?.join(', ')} />
        <DetailField label="Allergies" value={bp.allergies?.join(', ')} />
        <DetailField label="Brands" value={bp.preferredBrands?.join(', ')} />
      </DetailSection>
    );
  }

  if (customer.orders && customer.orders.length > 0) {
    sections.push(
      <DetailSection key="orders" title={`Orders (${customer.orders.length})`} source="Order">
        {customer.orders.slice(0, 3).map((o, i) => (
          <div key={i} className="py-0.5">
            <div className="flex justify-between">
              <span className="text-[10px] text-white/60">{o.orderId}</span>
              <span className="text-[10px] text-white/30">{o.orderDate}</span>
            </div>
            <div className="text-[10px] text-white/40 truncate">
              {o.lineItems.map(li => li.productName).join(', ')} — ${o.totalAmount}
            </div>
          </div>
        ))}
      </DetailSection>
    );
  }

  if (customer.chatSummaries && customer.chatSummaries.length > 0) {
    sections.push(
      <DetailSection key="chat" title={`Chat Summaries (${customer.chatSummaries.length})`} source="Chat_Summary__c">
        {customer.chatSummaries.map((c, i) => (
          <div key={c.id || i} className={`py-0.5 ${manage?.isManageMode ? 'flex items-start gap-2' : ''}`}>
            {manage?.isManageMode && c.id && (
              <DeleteCheckbox id={c.id} selected={manage.selectedIds.has(c.id)} onToggle={manage.onToggle} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between">
                <span className="text-[10px] text-white/30">{c.sessionDate}</span>
                <span className={`text-[10px] ${c.sentiment === 'positive' ? 'text-emerald-400/70' : c.sentiment === 'negative' ? 'text-red-400/70' : 'text-white/30'}`}>
                  {c.sentiment}
                </span>
              </div>
              <p className="text-[10px] text-white/60 mt-0.5 leading-snug">{c.summary}</p>
            </div>
          </div>
        ))}
      </DetailSection>
    );
  }

  if (customer.meaningfulEvents && customer.meaningfulEvents.length > 0) {
    sections.push(
      <DetailSection key="events" title={`Meaningful Events (${customer.meaningfulEvents.length})`} source="Meaningful_Event__c">
        {customer.meaningfulEvents.map((e, i) => (
          <div key={e.id || i} className={`py-0.5 ${manage?.isManageMode ? 'flex items-start gap-2' : ''}`}>
            {manage?.isManageMode && e.id && (
              <DeleteCheckbox id={e.id} selected={manage.selectedIds.has(e.id)} onToggle={manage.onToggle} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between">
                <span className="text-[10px] px-1 rounded bg-white/10 text-white/50">{e.eventType}</span>
                <span className="text-[10px] text-white/30">{e.capturedAt}</span>
              </div>
              <p className="text-[10px] text-white/60 mt-0.5 leading-snug">{e.description}</p>
            </div>
          </div>
        ))}
      </DetailSection>
    );
  }

  if (customer.agentCapturedProfile) {
    const fields = Object.entries(customer.agentCapturedProfile).filter(([, v]) => v?.value);
    if (fields.length > 0) {
      sections.push(
        <DetailSection key="captured" title={`Agent Captured (${fields.length})`} source="Agent_Captured_Profile__c">
          {fields.map(([key, field]) => (
            <div key={key} className="py-0.5">
              <div className="flex justify-between">
                <span className="text-[10px] text-white/50">{key}</span>
                <span className={`text-[10px] ${field!.confidence === 'stated' ? 'text-blue-400/70' : 'text-amber-400/70'}`}>
                  {field!.confidence}
                </span>
              </div>
              <p className="text-[10px] text-white/70">
                {Array.isArray(field!.value) ? field!.value.join(', ') : String(field!.value)}
              </p>
            </div>
          ))}
        </DetailSection>
      );
    }
  }

  if (customer.browseSessions && customer.browseSessions.length > 0) {
    sections.push(
      <DetailSection key="browse" title={`Browse Sessions (${customer.browseSessions.length})`} source="Browse_Session__c">
        {customer.browseSessions.map((b, i) => (
          <div key={i} className="py-0.5">
            <div className="flex justify-between">
              <span className="text-[10px] text-white/30">{b.sessionDate}</span>
              <span className="text-[10px] text-white/30">{b.durationMinutes}min / {b.device}</span>
            </div>
            <DetailField label="Categories" value={b.categoriesBrowsed?.join(', ')} />
            <DetailField label="Products" value={b.productsViewed?.join(', ')} />
          </div>
        ))}
      </DetailSection>
    );
  }

  if (customer.loyalty) {
    const l = customer.loyalty;
    sections.push(
      <DetailSection key="loyalty" title="Loyalty" source="LoyaltyProgramMember">
        <DetailField label="Tier" value={l.tier.charAt(0).toUpperCase() + l.tier.slice(1)} />
        <DetailField label="Points" value={`${l.pointsBalance?.toLocaleString()} balance / ${l.lifetimePoints?.toLocaleString()} lifetime`} />
        <DetailField label="Member Since" value={l.memberSince} />
      </DetailSection>
    );
  }

  if (customer.appendedProfile) {
    const ap = customer.appendedProfile;
    sections.push(
      <DetailSection key="appended" title="Merkury Appended (3P)" source="Merkury">
        <DetailField label="Age Range" value={ap.ageRange} />
        <DetailField label="Gender" value={ap.gender} />
        <DetailField label="Income" value={ap.householdIncome} />
        <DetailField label="Region" value={ap.geoRegion} />
        <DetailField label="Interests" value={ap.interests?.join(', ')} />
        <DetailField label="Lifestyle" value={ap.lifestyleSignals?.join(', ')} />
      </DetailSection>
    );
  }

  return sections;
}

// ─── Campaign Attribution Section ────────────────────────────────

const strategyDisplayLabels: Record<string, string> = {
  'lookalike': 'Lookalike Modeling',
  'retargeting': 'Retargeting',
  'interest-based': 'Interest-Based',
  'demographic': 'Demographic',
  'contextual': 'Contextual',
  'first-party': '1P CRM Activation',
  'household': 'Household Targeting',
};

const matchTypeLabels: Record<string, string> = {
  pid: 'PID (Individual)',
  hid: 'HID (Household)',
  modeled: 'Modeled (Lookalike)',
};

function renderCampaignAttribution(campaign: CampaignAttribution, onClear: () => void) {
  const ad = campaign.adCreative;
  return (
    <DetailSection title="Campaign Attribution" source="UTM">
      <DetailField label="Campaign" value={ad.campaignName} />
      <DetailField
        label="Channel"
        value={`${ad.platform.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())} · ${ad.utmParams.utm_medium.replace(/_/g, ' ')}`}
      />
      <DetailField label="Audience" value={ad.audienceSegment.segmentName} />
      <DetailField label="Segment Size" value={ad.audienceSegment.segmentSize} />
      <DetailField label="Strategy" value={strategyDisplayLabels[ad.targetingStrategy] || ad.targetingStrategy} />
      <DetailField label="Match Type" value={matchTypeLabels[ad.audienceSegment.matchType] || ad.audienceSegment.matchType} />
      {ad.inferredInterests.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px] text-white/40">Inferred Interests</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {ad.inferredInterests.map((interest) => (
              <span key={interest} className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400/70">
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}
      {ad.inferredIntentSignals.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px] text-white/40">Intent Signals</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {ad.inferredIntentSignals.map((signal) => (
              <span key={signal} className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400/70">
                {signal}
              </span>
            ))}
          </div>
        </div>
      )}
      {ad.audienceSegment.dataSignals.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px] text-white/40">Data Signals</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {ad.audienceSegment.dataSignals.map((signal) => (
              <span key={signal} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400/70">
                {signal}
              </span>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={onClear}
        className="mt-2 text-[10px] text-white/30 hover:text-white/60 underline transition-colors"
      >
        Clear attribution
      </button>
    </DetailSection>
  );
}

// ─── Main DemoPanel ─────────────────────────────────────────────

type PanelView = 'list' | 'detail';

export const DemoPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<PanelView>('list');
  const [crmContacts, setCrmContacts] = useState<DemoContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const { customer, selectedPersonaId, selectPersona, isResolving, isLoading, refreshProfile } = useCustomer();
  const { campaign, clearCampaign } = useCampaign();
  const navigate = useNavigate();
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile]);

  // Fetch CRM contacts when panel opens (real mode only)
  useEffect(() => {
    if (!isOpen || useMockData) return;
    setContactsLoading(true);
    fetchDemoContacts()
      .then(setCrmContacts)
      .finally(() => setContactsLoading(false));
  }, [isOpen]);

  // Reset to list view and manage mode when panel closes
  useEffect(() => {
    if (!isOpen) {
      setView('list');
      setIsManageMode(false);
      setSelectedForDelete(new Set());
    }
  }, [isOpen]);

  const handleSelect = async (personaId: string) => {
    await selectPersona(personaId);
  };

  const toggleDeleteSelection = (id: string) => {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedForDelete.size === 0 || !customer) return;
    setIsDeleting(true);
    try {
      const writeService = getDataCloudWriteService();
      // Separate IDs by sObject type
      const chatIds = customer.chatSummaries
        ?.filter((c) => c.id && selectedForDelete.has(c.id))
        .map((c) => c.id!) || [];
      const eventIds = customer.meaningfulEvents
        ?.filter((e) => e.id && selectedForDelete.has(e.id))
        .map((e) => e.id!) || [];

      const results = await Promise.all([
        chatIds.length > 0 ? writeService.deleteRecords('Chat_Summary__c', chatIds) : { deleted: [], failed: [] },
        eventIds.length > 0 ? writeService.deleteRecords('Meaningful_Event__c', eventIds) : { deleted: [], failed: [] },
      ]);

      const totalDeleted = results[0].deleted.length + results[1].deleted.length;
      const totalFailed = results[0].failed.length + results[1].failed.length;
      console.log(`[demo] Deleted ${totalDeleted} records${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`);

      // Exit manage mode and refresh profile once
      setIsManageMode(false);
      setSelectedForDelete(new Set());
      await refreshProfile();
    } catch (err) {
      console.error('[demo] Batch delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Group CRM contacts by demoProfile type
  const seededContacts = crmContacts.filter((c) => c.demoProfile === 'Seeded');
  const merkuryContacts = crmContacts.filter((c) => c.demoProfile === 'Merkury');
  const createdContacts = crmContacts.filter((c) => c.demoProfile === 'Created');

  const handleDeleteContact = async (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this demo contact?')) return;
    try {
      const writeService = getDataCloudWriteService();
      await writeService.deleteRecords('Contact', [contactId]);
      // Remove from local state and switch to anonymous if it was active
      setCrmContacts((prev) => prev.filter((c) => c.id !== contactId));
      if (selectedPersonaId === contactId) {
        await selectPersona('anonymous');
      }
    } catch (err) {
      console.error('[demo] Failed to delete contact:', err);
    }
  };

  const renderContactItem = (contact: DemoContact, showDelete = false) => {
    const isActive = contact.id === selectedPersonaId;
    const tier = contact.demoProfile;
    const contactFirstName = contact.firstName || 'Guest';
    return (
      <div key={contact.id} className="flex items-center gap-1">
        <button
          onClick={() => handleSelect(contact.id)}
          disabled={isResolving || isLoading}
          className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
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
        {showDelete && (
          <button
            onClick={(e) => handleDeleteContact(contact.id, e)}
            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
            title="Delete contact"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  const activeLabel = (() => {
    if (isResolving) return 'Resolving...';
    if (isLoading) return 'Loading...';
    if (customer?.name && customer.name !== 'Guest') return customer.name.split(' ')[0];
    return 'Demo';
  })();

  const tierLabel = (() => {
    const tier = customer?.merkuryIdentity?.identityTier;
    if (!tier || tier === 'anonymous') return 'Anonymous';
    if (tier === 'appended') return 'Merkury Appended';
    const loyalty = customer?.loyalty?.tier;
    if (loyalty) return `Known · ${loyalty.charAt(0).toUpperCase() + loyalty.slice(1)}`;
    return 'Known · No Loyalty';
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
              className="fixed bottom-20 right-6 z-50 w-80 bg-gradient-to-b from-stone-800 to-stone-900 rounded-xl shadow-2xl border border-white/10 overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {view === 'detail' ? (
                    <button
                      onClick={() => setView('list')}
                      className="text-white/50 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  )}
                  <span className="text-[11px] font-medium text-white/70 uppercase tracking-wider">
                    {view === 'detail' ? 'Profile Detail' : 'Demo Mode'}
                  </span>
                  {view === 'list' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/40 hover:text-white text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <AnimatePresence mode="wait">
                {view === 'list' ? (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                  >
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
                              {createdContacts.map((c) => renderContactItem(c, true))}
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

                    {/* View Profile / Campaign button */}
                    {(customer && selectedPersonaId && selectedPersonaId !== 'anonymous') || campaign ? (
                      <div className="px-3 pb-2">
                        <button
                          onClick={() => setView('detail')}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {customer && selectedPersonaId !== 'anonymous'
                            ? `View ${customer.name?.split(' ')[0] || 'Profile'}'s Profile`
                            : 'View Campaign Attribution'}
                        </button>
                      </div>
                    ) : null}

                    {/* Footer: Media Wall link + hint */}
                    <div className="px-3 py-2 border-t border-white/5 space-y-1.5">
                      <button
                        onClick={() => { setIsOpen(false); navigate('/media-wall'); }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400/80 hover:text-cyan-400 text-[10px] font-medium transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Merkury Media Wall
                      </button>
                      <p className="text-white/20 text-[9px] leading-relaxed text-center">
                        Switch identities to simulate Merkury resolution
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="detail"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Profile detail header */}
                    {customer && (
                      <div className="px-4 py-3 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
                            customer.merkuryIdentity?.identityTier === 'appended'
                              ? 'bg-gradient-to-br from-amber-400 to-orange-400'
                              : 'bg-gradient-to-br from-purple-400 to-pink-400'
                          }`}>
                            {(customer.name || 'G').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white/90 truncate">
                              {customer.name || 'Guest'}
                            </div>
                            <div className="text-[10px] text-white/40">
                              {tierLabel}
                            </div>
                          </div>
                          {/* Refresh profile data */}
                          <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-50"
                            title="Refresh profile data"
                          >
                            <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                          {/* Manage (trash) toggle — only when there are deletable records */}
                          {((customer.chatSummaries && customer.chatSummaries.length > 0) ||
                            (customer.meaningfulEvents && customer.meaningfulEvents.length > 0)) && (
                            <button
                              onClick={() => {
                                setIsManageMode(!isManageMode);
                                if (isManageMode) setSelectedForDelete(new Set());
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isManageMode
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                              }`}
                              title={isManageMode ? 'Cancel manage' : 'Manage records'}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Manage mode banner */}
                    {isManageMode && (
                      <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
                        <p className="text-[10px] text-red-400">Select chat summaries and events to delete</p>
                      </div>
                    )}

                    {/* Profile data sections */}
                    <div className="px-4 py-3 max-h-80 overflow-y-auto">
                      {/* Campaign attribution — renders independently of identity */}
                      {campaign && renderCampaignAttribution(campaign, clearCampaign)}

                      {customer ? (
                        renderProfileDetail(customer, {
                          isManageMode,
                          selectedIds: selectedForDelete,
                          onToggle: toggleDeleteSelection,
                        })
                      ) : (
                        !campaign && (
                          <p className="text-xs text-white/30 text-center py-4">
                            No profile loaded
                          </p>
                        )
                      )}
                    </div>

                    {/* Delete confirmation footer (manage mode) */}
                    {isManageMode && selectedForDelete.size > 0 ? (
                      <div className="px-3 py-2 border-t border-red-500/20 bg-red-500/5">
                        <button
                          onClick={handleBatchDelete}
                          disabled={isDeleting}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete {selectedForDelete.size} selected
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      /* Switch profiles button */
                      <div className="px-3 py-2 border-t border-white/5">
                        <button
                          onClick={() => { setView('list'); setIsManageMode(false); setSelectedForDelete(new Set()); }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white text-xs transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          Switch Profiles
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
