import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';
import { useStore } from '@/contexts/StoreContext';
import { getDataCloudWriteService, type HydrationPreferencesUpdate, type CommunicationPreferencesUpdate } from '@/services/datacloud/writeProfile';
import type { OrderRecord, AgentCapturedProfile, CapturedProfileField, ProfilePreferences } from '@/types/customer';

const TIER_THRESHOLDS: Record<string, { next: string; points: number }> = {
  hydrated: { next: 'Active', points: 1000 },
  active: { next: 'Elite', points: 2500 },
  elite: { next: 'Champion', points: 5000 },
  champion: { next: 'Champion', points: 999999 },
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  shipped: 'bg-blue-100 text-blue-700',
  returned: 'bg-amber-100 text-amber-700',
};

// ─── Constants for preference options ────────────────────────────
const PRIMARY_USE_OPTIONS: ProfilePreferences['primaryUse'][] = ['home', 'office', 'fitness', 'travel', 'mixed'];
const WATER_PREF_OPTIONS = ['still', 'sparkling', 'flavored', 'mineral'];
const DELIVERY_FREQ_OPTIONS: ProfilePreferences['deliveryFrequency'][] = ['weekly', 'biweekly', 'monthly', 'on-demand'];

export const AccountPage: React.FC = () => {
  const { customer, isAuthenticated, refreshProfile } = useCustomer();
  const { goBack, navigateHome } = useStore();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [showDataSources, setShowDataSources] = useState(false);

  // ─── Preference editing state ───────────────────────────────────
  const [isEditingPrefs, setIsEditingPrefs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable form state
  const [editPrimaryUse, setEditPrimaryUse] = useState<ProfilePreferences['primaryUse']>('home');
  const [editWaterPrefs, setEditWaterPrefs] = useState<string[]>([]);
  const [editDeliveryFreq, setEditDeliveryFreq] = useState<ProfilePreferences['deliveryFrequency']>('biweekly');

  // Communication preferences
  const [emailOptIn, setEmailOptIn] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [pushOptIn, setPushOptIn] = useState(false);

  // Initialize form state from customer profile
  useEffect(() => {
    if (customer?.hydrationProfile) {
      const hp = customer.hydrationProfile;
      setEditPrimaryUse(hp.primaryUse || 'home');
      setEditWaterPrefs(hp.waterPreferences || []);
      setEditDeliveryFreq(hp.deliveryFrequency || 'biweekly');
      setEmailOptIn(hp.communicationPrefs?.email ?? true);
      setSmsOptIn(hp.communicationPrefs?.sms ?? false);
      setPushOptIn(hp.communicationPrefs?.push ?? false);
    }
  }, [customer]);

  // Reset success message after delay
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

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
  const hp = customer.hydrationProfile;
  const tierInfo = loyalty ? TIER_THRESHOLDS[loyalty.tier] : null;
  const tierProgress = loyalty && tierInfo
    ? Math.min(100, (loyalty.lifetimePoints / tierInfo.points) * 100)
    : 0;

  // Check if this is a Salesforce Contact (ID starts with 003)
  const isSalesforceContact = customer.id?.startsWith('003');

  // ─── Save preferences handler ────────────────────────────────────
  const handleSavePreferences = async () => {
    if (!isSalesforceContact) {
      setSaveError('Profile updates require a linked Salesforce account.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const writeService = getDataCloudWriteService();

      // Update hydration preferences
      const hydrationUpdate: HydrationPreferencesUpdate = {
        primaryUse: editPrimaryUse,
        waterPreferences: editWaterPrefs,
        deliveryFrequency: editDeliveryFreq,
      };
      await writeService.updateHydrationPreferences(customer.id, hydrationUpdate);

      // Update communication preferences
      const commUpdate: CommunicationPreferencesUpdate = {
        emailOptIn,
        smsOptIn,
        pushOptIn,
      };
      await writeService.updateCommunicationPreferences(customer.id, commUpdate);

      // Refresh profile to get updated data
      await refreshProfile();

      setIsEditingPrefs(false);
      setSaveSuccess(true);
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset to original values
    if (customer?.hydrationProfile) {
      const hp = customer.hydrationProfile;
      setEditPrimaryUse(hp.primaryUse || 'home');
      setEditWaterPrefs(hp.waterPreferences || []);
      setEditDeliveryFreq(hp.deliveryFrequency || 'biweekly');
      setEmailOptIn(hp.communicationPrefs?.email ?? true);
      setSmsOptIn(hp.communicationPrefs?.sms ?? false);
      setPushOptIn(hp.communicationPrefs?.push ?? false);
    }
    setIsEditingPrefs(false);
    setSaveError(null);
  };

  const toggleWaterPref = (pref: string) => {
    setEditWaterPrefs(prev =>
      prev.includes(pref)
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    );
  };

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
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white text-2xl font-medium flex-shrink-0">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-medium text-stone-900">{customer.name}</h1>
              <p className="text-stone-500 text-sm">{customer.email}</p>
              {loyalty && (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    loyalty.tier === 'champion' ? 'bg-purple-100 text-purple-700'
                    : loyalty.tier === 'elite' ? 'bg-blue-100 text-blue-700'
                    : loyalty.tier === 'active' ? 'bg-cyan-100 text-cyan-700'
                    : 'bg-teal-100 text-teal-700'
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
          {/* ─── HYDRATION PREFERENCES (Editable) ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium text-stone-900">Hydration Preferences</h2>
                <p className="text-xs text-stone-500 mt-0.5">Your hydration profile helps us personalize product recommendations</p>
              </div>
              {!isEditingPrefs && (
                <button
                  onClick={() => setIsEditingPrefs(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Success message */}
            <AnimatePresence>
              {saveSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700"
                >
                  Preferences saved successfully!
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error message */}
            {saveError && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {saveError}
              </div>
            )}

            {isEditingPrefs ? (
              /* ─── EDIT MODE ─── */
              <div className="space-y-6">
                {/* Primary Use */}
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wider block mb-2">
                    Primary Use
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRIMARY_USE_OPTIONS.map(use => (
                      <button
                        key={use}
                        onClick={() => setEditPrimaryUse(use)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          editPrimaryUse === use
                            ? 'bg-blue-500 text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {use!.charAt(0).toUpperCase() + use!.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Water Preferences */}
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wider block mb-2">
                    Water Preferences <span className="text-stone-400 font-normal">(select all that apply)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WATER_PREF_OPTIONS.map(pref => (
                      <button
                        key={pref}
                        onClick={() => toggleWaterPref(pref)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                          editWaterPrefs.includes(pref)
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                            : 'bg-stone-50 text-stone-600 border border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {pref}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delivery Frequency */}
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wider block mb-2">
                    Delivery Frequency
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DELIVERY_FREQ_OPTIONS.map(freq => (
                      <button
                        key={freq}
                        onClick={() => setEditDeliveryFreq(freq)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          editDeliveryFreq === freq
                            ? 'bg-blue-500 text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {freq!.charAt(0).toUpperCase() + freq!.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Communication Preferences */}
                <div className="pt-4 border-t border-stone-100">
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wider block mb-3">
                    Communication Preferences
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-stone-700">Email updates & offers</span>
                      <button
                        onClick={() => setEmailOptIn(!emailOptIn)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          emailOptIn ? 'bg-blue-500' : 'bg-stone-300'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          emailOptIn ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-stone-700">SMS notifications</span>
                      <button
                        onClick={() => setSmsOptIn(!smsOptIn)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          smsOptIn ? 'bg-blue-500' : 'bg-stone-300'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          smsOptIn ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-stone-700">Push notifications</span>
                      <button
                        onClick={() => setPushOptIn(!pushOptIn)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          pushOptIn ? 'bg-blue-500' : 'bg-stone-300'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          pushOptIn ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </label>
                  </div>
                </div>

                {/* Save/Cancel buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSavePreferences}
                    disabled={isSaving}
                    className="flex-1 px-6 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-stone-100 text-stone-600 text-sm font-medium rounded-full hover:bg-stone-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ─── VIEW MODE ─── */
              <div className="space-y-4">
                {hp?.primaryUse && (
                  <div>
                    <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Primary Use</span>
                    <p className="text-sm text-stone-900 mt-0.5 capitalize">{hp.primaryUse}</p>
                  </div>
                )}

                {hp?.waterPreferences && hp.waterPreferences.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Water Preferences</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {hp.waterPreferences.map((p) => (
                        <span key={p} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {hp?.deliveryFrequency && (
                  <div>
                    <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Delivery Frequency</span>
                    <p className="text-sm text-stone-900 mt-0.5 capitalize">{hp.deliveryFrequency}</p>
                  </div>
                )}

                {/* Communication preferences display */}
                <div className="pt-3 border-t border-stone-100">
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Communication</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${hp?.communicationPrefs?.email !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                      {hp?.communicationPrefs?.email !== false ? '✓' : '✗'} Email
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${hp?.communicationPrefs?.sms ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                      {hp?.communicationPrefs?.sms ? '✓' : '✗'} SMS
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${hp?.communicationPrefs?.push ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                      {hp?.communicationPrefs?.push ? '✓' : '✗'} Push
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* ─── INFERRED PREFERENCES (Read-only) ─── */}
          {(hp?.preferredBrands?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="bg-gradient-to-br from-purple-50 to-rose-50 rounded-2xl p-6 border border-purple-100"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-stone-900">Brand Affinities</h3>
                  <p className="text-xs text-stone-500 mt-0.5 mb-3">
                    Based on your purchase history and browsing behavior
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(hp?.preferredBrands || []).map((b) => (
                      <span key={b} className="text-xs bg-white/80 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">{b}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

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
                {tierInfo && loyalty.tier !== 'champion' && (
                  <div>
                    <div className="flex justify-between text-xs text-stone-500 mb-1">
                      <span className="capitalize">{loyalty.tier}</span>
                      <span>{tierInfo.next}</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-400 to-cyan-500 h-2 rounded-full transition-all"
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
                    <DataField label="Primary Use" value={hp?.primaryUse || '—'} />
                    <DataField label="Water Prefs" value={hp?.waterPreferences?.join(', ') || '—'} />
                    <DataField label="Delivery" value={hp?.deliveryFrequency || '—'} />
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
                    <DataField label="Preferred Brands" value={bp.preferredBrands.join(', ') || '—'} />
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
