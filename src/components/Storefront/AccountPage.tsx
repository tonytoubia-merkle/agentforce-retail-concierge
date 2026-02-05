import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import { useStore } from '@/contexts/StoreContext';
import type { OrderRecord, AgentCapturedProfile, CapturedProfileField } from '@/types/customer';

const TIER_THRESHOLDS: Record<string, { next: string; points: number }> = {
  bronze: { next: 'Silver', points: 1000 },
  silver: { next: 'Gold', points: 2500 },
  gold: { next: 'Platinum', points: 5000 },
  platinum: { next: 'Platinum', points: 999999 },
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  shipped: 'bg-blue-100 text-blue-700',
  returned: 'bg-amber-100 text-amber-700',
};

export const AccountPage: React.FC = () => {
  const { customer, isAuthenticated } = useCustomer();
  const { goBack, navigateHome } = useStore();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [showDataSources, setShowDataSources] = useState(false);

  if (!customer) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-500 mb-4">Please sign in to view your account.</p>
          <button onClick={navigateHome} className="text-sm text-rose-600 hover:text-rose-700">
            Back to Store
          </button>
        </div>
      </div>
    );
  }

  const firstName = customer.name?.split(' ')[0] || 'Guest';
  const loyalty = customer.loyalty;
  const bp = customer.beautyProfile;
  const tierInfo = loyalty ? TIER_THRESHOLDS[loyalty.tier] : null;
  const tierProgress = loyalty && tierInfo
    ? Math.min(100, (loyalty.lifetimePoints / tierInfo.points) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Back button */}
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* ─── HEADER ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm mb-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-purple-500 flex items-center justify-center text-white text-2xl font-medium flex-shrink-0">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-medium text-stone-900">{customer.name}</h1>
              <p className="text-stone-500 text-sm">{customer.email}</p>
              {loyalty && (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    loyalty.tier === 'platinum' ? 'bg-purple-100 text-purple-700'
                    : loyalty.tier === 'gold' ? 'bg-amber-100 text-amber-700'
                    : loyalty.tier === 'silver' ? 'bg-slate-100 text-slate-700'
                    : 'bg-orange-100 text-orange-700'
                  }`}>
                    {loyalty.tier} Member
                  </span>
                  <span className="text-xs text-stone-400">
                    {loyalty.pointsBalance.toLocaleString()} pts
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <div className="grid gap-6">
          {/* ─── BEAUTY PROFILE ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <h2 className="text-lg font-medium text-stone-900 mb-4">Beauty Profile</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Skin Type</span>
                <p className="text-sm text-stone-900 mt-0.5 capitalize">{bp.skinType}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Fragrance</span>
                <p className="text-sm text-stone-900 mt-0.5 capitalize">{bp.fragrancePreference || 'No preference'}</p>
              </div>
              {bp.concerns.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Concerns</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {bp.concerns.map((c) => (
                      <span key={c} className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {bp.allergies.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Allergies</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {bp.allergies.map((a) => (
                      <span key={a} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {bp.preferredBrands.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Preferred Brands</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {bp.preferredBrands.map((b) => (
                      <span key={b} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* ─── LOYALTY ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <h2 className="text-lg font-medium text-stone-900 mb-4">Loyalty</h2>
            {loyalty ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-stone-50 rounded-xl">
                    <div className="text-2xl font-semibold text-stone-900">{loyalty.pointsBalance.toLocaleString()}</div>
                    <div className="text-xs text-stone-500 mt-0.5">Points Balance</div>
                  </div>
                  <div className="text-center p-3 bg-stone-50 rounded-xl">
                    <div className="text-2xl font-semibold text-stone-900">{loyalty.lifetimePoints.toLocaleString()}</div>
                    <div className="text-xs text-stone-500 mt-0.5">Lifetime Points</div>
                  </div>
                  <div className="text-center p-3 bg-stone-50 rounded-xl">
                    <div className="text-2xl font-semibold text-stone-900 capitalize">{loyalty.tier}</div>
                    <div className="text-xs text-stone-500 mt-0.5">Current Tier</div>
                  </div>
                </div>

                {/* Tier progress */}
                {tierInfo && loyalty.tier !== 'platinum' && (
                  <div>
                    <div className="flex justify-between text-xs text-stone-500 mb-1">
                      <span className="capitalize">{loyalty.tier}</span>
                      <span>{tierInfo.next}</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-rose-400 to-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${tierProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-stone-400 mt-1">
                      {(tierInfo.points - loyalty.lifetimePoints).toLocaleString()} more points to {tierInfo.next}
                    </p>
                  </div>
                )}

                {/* Rewards */}
                {loyalty.rewardsAvailable.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Available Rewards</span>
                    <div className="mt-2 space-y-1.5">
                      {loyalty.rewardsAvailable.map((r) => (
                        <div key={r.name} className="flex justify-between items-center text-sm py-1.5 px-3 bg-stone-50 rounded-lg">
                          <span className="text-stone-700">{r.name}</span>
                          <span className="text-stone-500 text-xs">{r.pointsCost.toLocaleString()} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-stone-400">Member since {loyalty.memberSince}</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-stone-500 text-sm mb-3">You're not enrolled in our loyalty program yet.</p>
                <button className="px-6 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-full hover:bg-stone-800 transition-colors">
                  Join Now
                </button>
              </div>
            )}
          </motion.div>

          {/* ─── ORDERS ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <h2 className="text-lg font-medium text-stone-900 mb-4">
              Order History {customer.orders.length > 0 && <span className="text-stone-400 font-normal">({customer.orders.length})</span>}
            </h2>
            {customer.orders.length > 0 ? (
              <div className="space-y-3">
                {customer.orders.map((order) => (
                  <OrderCard
                    key={order.orderId}
                    order={order}
                    isExpanded={expandedOrder === order.orderId}
                    onToggle={() => setExpandedOrder(expandedOrder === order.orderId ? null : order.orderId)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-stone-500 text-sm text-center py-4">No orders yet.</p>
            )}
          </motion.div>

          {/* ─── SHIPPING ADDRESSES ─── */}
          {customer.shippingAddresses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl p-6 shadow-sm"
            >
              <h2 className="text-lg font-medium text-stone-900 mb-4">Shipping Addresses</h2>
              <div className="space-y-3">
                {customer.shippingAddresses.map((addr) => (
                  <div key={addr.id} className="p-3 bg-stone-50 rounded-xl text-sm">
                    <p className="font-medium text-stone-900">{addr.name}</p>
                    <p className="text-stone-600">{addr.line1}</p>
                    {addr.line2 && <p className="text-stone-600">{addr.line2}</p>}
                    <p className="text-stone-600">{addr.city}, {addr.state} {addr.postalCode}</p>
                    {addr.isDefault && (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                        Default
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── DEMO: DATA SOURCES ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="border-2 border-dashed border-stone-300 rounded-2xl overflow-hidden"
          >
            <button
              onClick={() => setShowDataSources(!showDataSources)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wider bg-stone-100 px-2 py-0.5 rounded">
                  Demo
                </span>
                <span className="text-sm font-medium text-stone-600">
                  Data Sources & Agent Access Rules
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-stone-400 transition-transform ${showDataSources ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDataSources && (
              <div className="px-6 pb-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* CRM 1P */}
                  <ProvenanceCard
                    title="CRM 1P (Declared)"
                    color="emerald"
                    agentRule="Direct — agent can reference openly"
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    }
                  >
                    <DataField label="Skin Type" value={bp.skinType} />
                    <DataField label="Concerns" value={bp.concerns.join(', ') || '—'} />
                    <DataField label="Allergies" value={bp.allergies.join(', ') || '—'} />
                    <DataField label="Preferred Brands" value={bp.preferredBrands.join(', ') || '—'} />
                    {loyalty && (
                      <>
                        <DataField label="Loyalty Tier" value={loyalty.tier} />
                        <DataField label="Points" value={loyalty.pointsBalance.toLocaleString()} />
                      </>
                    )}
                    <DataField label="Addresses" value={`${customer.shippingAddresses.length} saved`} />
                  </ProvenanceCard>

                  {/* Agent Captured 0P */}
                  <ProvenanceCard
                    title="Agent Captured 0P (Stated)"
                    color="blue"
                    agentRule="Direct — agent can reference as previously discussed"
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    }
                  >
                    {customer.agentCapturedProfile ? (
                      <>
                        {renderCapturedFields(customer.agentCapturedProfile)}
                      </>
                    ) : (
                      <p className="text-xs text-stone-400 italic">No conversational data captured yet</p>
                    )}
                    <DataField label="Chat Sessions" value={`${customer.chatSummaries.length}`} />
                    <DataField label="Meaningful Events" value={`${customer.meaningfulEvents.length}`} />
                  </ProvenanceCard>

                  {/* Merkury 3P */}
                  <ProvenanceCard
                    title="Merkury 3P (Appended)"
                    color="amber"
                    agentRule="Influence only — agent shapes recommendations but never quotes this data"
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                      </svg>
                    }
                  >
                    {customer.appendedProfile ? (
                      <>
                        <DataField label="Age Range" value={customer.appendedProfile.ageRange || '—'} />
                        <DataField label="Gender" value={customer.appendedProfile.gender || '—'} />
                        <DataField label="HH Income" value={customer.appendedProfile.householdIncome || '—'} />
                        <DataField label="Geo Region" value={customer.appendedProfile.geoRegion || '—'} />
                        <DataField label="Has Children" value={customer.appendedProfile.hasChildren ? 'Yes' : 'No'} />
                        <DataField label="Home" value={customer.appendedProfile.homeOwnership || '—'} />
                        {customer.appendedProfile.interests && customer.appendedProfile.interests.length > 0 && (
                          <DataField label="Interests" value={customer.appendedProfile.interests.join(', ')} />
                        )}
                        {customer.appendedProfile.lifestyleSignals && customer.appendedProfile.lifestyleSignals.length > 0 && (
                          <DataField label="Lifestyle" value={customer.appendedProfile.lifestyleSignals.join(', ')} />
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-stone-400 italic">No 3P appended data available</p>
                    )}
                  </ProvenanceCard>

                  {/* Observed */}
                  <ProvenanceCard
                    title="Observed (Behavioral)"
                    color="purple"
                    agentRule="Soft — agent can reference patterns ('I noticed you've been looking at...')"
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    }
                  >
                    <DataField label="Orders" value={`${customer.orders.length} total`} />
                    <DataField label="Browse Sessions" value={`${customer.browseSessions.length}`} />
                    {customer.browseSessions.length > 0 && (
                      <>
                        <DataField
                          label="Recent Categories"
                          value={customer.browseSessions[0].categoriesBrowsed.join(', ') || '—'}
                        />
                        <DataField
                          label="Recent Products"
                          value={`${customer.browseSessions[0].productsViewed.length} viewed`}
                        />
                        <DataField
                          label="Last Device"
                          value={customer.browseSessions[0].device}
                        />
                      </>
                    )}
                  </ProvenanceCard>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────

function OrderCard({ order, isExpanded, onToggle }: { order: OrderRecord; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div className="border border-stone-100 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <div className="text-sm font-medium text-stone-900">
              Order #{order.orderNumber || order.orderId.slice(-6)}
            </div>
            <div className="text-xs text-stone-500">{order.orderDate}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || 'bg-stone-100 text-stone-600'}`}>
            {order.status}
          </span>
          <span className="text-sm font-medium text-stone-900">${order.totalAmount.toFixed(2)}</span>
          <svg
            className={`w-4 h-4 text-stone-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-stone-100 bg-stone-50/50">
          <div className="pt-3 space-y-2">
            {order.lineItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-stone-700">
                  {item.productName}
                  {item.quantity > 1 && <span className="text-stone-400"> x{item.quantity}</span>}
                  {item.isGift && <span className="text-rose-400 ml-1 text-xs">(Gift)</span>}
                </span>
                <span className="text-stone-600">${(item.unitPrice * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          {(order.trackingNumber || order.carrier || order.shippingStatus) && (
            <div className="mt-3 pt-3 border-t border-stone-200 text-xs text-stone-500 space-y-1">
              {order.carrier && <p>Carrier: {order.carrier}</p>}
              {order.trackingNumber && <p>Tracking: {order.trackingNumber}</p>}
              {order.shippingStatus && <p>Status: {order.shippingStatus}</p>}
              {order.estimatedDelivery && <p>Est. Delivery: {order.estimatedDelivery}</p>}
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-stone-200 flex justify-between text-xs text-stone-400">
            <span className="capitalize">{order.channel}</span>
            {order.paymentMethod && <span>{order.paymentMethod}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  emerald: { bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
  blue: { bg: 'bg-blue-50/50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100' },
  amber: { bg: 'bg-amber-50/50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
  purple: { bg: 'bg-purple-50/50', border: 'border-purple-200', text: 'text-purple-700', iconBg: 'bg-purple-100' },
};

function ProvenanceCard({
  title,
  color,
  agentRule,
  icon,
  children,
}: {
  title: string;
  color: string;
  agentRule: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.emerald;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-6 h-6 rounded-md ${c.iconBg} flex items-center justify-center ${c.text}`}>
          {icon}
        </div>
        <h3 className="text-xs font-semibold text-stone-800">{title}</h3>
      </div>
      <div className="space-y-1.5 mb-3">
        {children}
      </div>
      <div className={`text-[10px] ${c.text} font-medium border-t ${c.border} pt-2 mt-2`}>
        {agentRule}
      </div>
    </div>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-stone-500">{label}</span>
      <span className="text-stone-700 font-medium text-right max-w-[60%] truncate capitalize">{value}</span>
    </div>
  );
}

function renderCapturedFields(profile: AgentCapturedProfile): React.ReactNode {
  const fields: { label: string; field: CapturedProfileField | CapturedProfileField<string[]> | undefined }[] = [
    { label: 'Birthday', field: profile.birthday },
    { label: 'Anniversary', field: profile.anniversary },
    { label: 'Partner Name', field: profile.partnerName },
    { label: 'Gifts For', field: profile.giftsFor },
    { label: 'Occasions', field: profile.upcomingOccasions },
    { label: 'Morning Routine', field: profile.morningRoutineTime },
    { label: 'Makeup Frequency', field: profile.makeupFrequency },
    { label: 'Exercise', field: profile.exerciseRoutine },
    { label: 'Work Environment', field: profile.workEnvironment },
    { label: 'Beauty Priority', field: profile.beautyPriority },
    { label: 'Price Range', field: profile.priceRange },
    { label: 'Sustainability', field: profile.sustainabilityPref },
    { label: 'Climate', field: profile.climateContext },
    { label: 'Sleep', field: profile.sleepPattern },
  ];

  const populated = fields.filter((f) => f.field?.value);
  if (populated.length === 0) {
    return <p className="text-xs text-stone-400 italic">No conversational data captured yet</p>;
  }

  return (
    <>
      {populated.map((f) => (
        <DataField
          key={f.label}
          label={f.label}
          value={Array.isArray(f.field!.value) ? f.field!.value.join(', ') : String(f.field!.value)}
        />
      ))}
    </>
  );
}
