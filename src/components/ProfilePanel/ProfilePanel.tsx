import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import type { CustomerProfile } from '@/types/customer';

const RefreshIcon: React.FC<{ spinning?: boolean }> = ({ spinning }) => (
  <svg
    className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const Section: React.FC<{ title: string; source: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, source, children, defaultOpen = true,
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

function formatProfile(customer: CustomerProfile) {
  const bp = customer.beautyProfile;
  const sections: React.ReactNode[] = [];

  // Beauty Profile
  sections.push(
    <Section key="beauty" title="Beauty Profile" source="Contact">
      <Field label="Skin Type" value={bp.skinType} />
      <Field label="Concerns" value={bp.concerns?.join(', ')} />
      <Field label="Allergies" value={bp.allergies?.join(', ')} />
      <Field label="Preferred Brands" value={bp.preferredBrands?.join(', ')} />
    </Section>
  );

  // Orders
  if (customer.orders.length > 0) {
    sections.push(
      <Section key="orders" title={`Orders (${customer.orders.length})`} source="Order" defaultOpen={false}>
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

  // Chat Summaries
  if (customer.chatSummaries.length > 0) {
    sections.push(
      <Section key="chat" title={`Chat Summaries (${customer.chatSummaries.length})`} source="Chat_Summary__c" defaultOpen={false}>
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

  // Meaningful Events
  if (customer.meaningfulEvents.length > 0) {
    sections.push(
      <Section key="events" title={`Meaningful Events (${customer.meaningfulEvents.length})`} source="Meaningful_Event__c" defaultOpen={false}>
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

  // Agent Captured Profile
  if (customer.agentCapturedProfile) {
    const acp = customer.agentCapturedProfile;
    const fields = Object.entries(acp).filter(([, v]) => v?.value);
    if (fields.length > 0) {
      sections.push(
        <Section key="captured" title={`Agent Captured (${fields.length})`} source="Agent_Captured_Profile__c" defaultOpen={false}>
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

  // Browse Sessions
  if (customer.browseSessions.length > 0) {
    sections.push(
      <Section key="browse" title={`Browse Sessions (${customer.browseSessions.length})`} source="Browse_Session__c" defaultOpen={false}>
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

  // Loyalty
  if (customer.loyalty) {
    const l = customer.loyalty;
    sections.push(
      <Section key="loyalty" title="Loyalty" source="LoyaltyProgramMember" defaultOpen={false}>
        <Field label="Tier" value={l.tier} />
        <Field label="Points" value={`${l.pointsBalance.toLocaleString()} balance / ${l.lifetimePoints.toLocaleString()} lifetime`} />
        <Field label="Member Since" value={l.memberSince} />
      </Section>
    );
  }

  return sections;
}

export const ProfilePanel: React.FC = () => {
  const { customer, refreshProfile } = useCustomer();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfile]);

  if (!customer) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-xs text-white/70 hover:text-white/90 hover:bg-black/70 transition-all"
      >
        {isOpen ? 'Close' : 'Profile'} — {customer.name}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl"
          >
            <div className="px-3 py-2 border-b border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{customer.name}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
                    title="Refresh profile data"
                  >
                    <RefreshIcon spinning={isRefreshing} />
                  </button>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Salesforce CRM</span>
                </div>
              </div>
              <div className="text-[11px] text-white/50 mt-0.5">{customer.email} — {customer.id}</div>
            </div>
            {formatProfile(customer)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
