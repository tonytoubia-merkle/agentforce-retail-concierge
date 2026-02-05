import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MERKURY_ARCHETYPES, NO_MERKURY_MATCH, getMerkuryArchetypeById } from '@/mocks/merkuryProfiles';
import { fetchDemoContacts } from '@/services/demo/contacts';
import { useCustomer } from '@/contexts/CustomerContext';
import type { DemoContact } from '@/types/customer';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

interface MerkuryProfilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a profile is selected and registered */
  onComplete?: () => void;
}

interface DisplayProfile {
  id: string;
  contactId?: string;
  label: string;
  archetype: string;
  interests: string[];
}

export const MerkuryProfilePicker: React.FC<MerkuryProfilePickerProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { registerContact, createGuestContact, isResolving } = useCustomer();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DisplayProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'register'>('select');
  const [regEmail, setRegEmail] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [registering, setRegistering] = useState(false);

  // Build display profiles — from CRM in real mode, from mock data in mock mode
  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(null);
    setStep('select');
    setRegEmail('');
    setRegFirstName('');
    setRegLastName('');

    if (useMockData) {
      setProfiles(
        MERKURY_ARCHETYPES.map((a) => ({
          id: a.id,
          label: a.label,
          archetype: a.archetype,
          interests: (a.appendedProfile.interests || []).slice(0, 3),
        }))
      );
      return;
    }

    // Real mode: fetch CRM contacts with demoProfile='Merkury'
    setLoading(true);
    fetchDemoContacts()
      .then((contacts: DemoContact[]) => {
        const merkuryContacts = contacts.filter((c) => c.demoProfile === 'Merkury');
        const mapped: DisplayProfile[] = merkuryContacts.map((c) => {
          const archetype = c.merkuryId
            ? MERKURY_ARCHETYPES.find((a) => a.merkuryId === c.merkuryId)
            : undefined;
          return {
            id: archetype?.id || c.id,
            contactId: c.id,
            label: archetype?.label || `${c.firstName} ${c.lastName}`,
            archetype: archetype?.archetype || c.email,
            interests: (archetype?.appendedProfile.interests || []).slice(0, 3),
          };
        });
        setProfiles(
          mapped.length > 0
            ? mapped
            : MERKURY_ARCHETYPES.map((a) => ({
                id: a.id,
                label: a.label,
                archetype: a.archetype,
                interests: (a.appendedProfile.interests || []).slice(0, 3),
              }))
        );
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleContinue = () => {
    if (!selectedId) return;

    if (selectedId === 'no-match') {
      onClose();
      return;
    }

    // Transition to registration form
    const profile = profiles.find((p) => p.id === selectedId);
    const archetype = getMerkuryArchetypeById(selectedId);
    // Pre-fill from archetype label (e.g., "Clean Beauty Urbanite" → first: "Clean", last: "Beauty Urbanite")
    // Or use a more natural name pattern
    const labelParts = (profile?.label || '').split(' ');
    setRegFirstName(labelParts[0] || '');
    setRegLastName(labelParts.slice(1).join(' ') || '');
    setRegEmail(archetype ? `${selectedId.replace('merkury-', '')}@example.com` : '');
    setStep('register');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    setRegistering(true);
    try {
      const profile = profiles.find((p) => p.id === selectedId);
      const archetype = getMerkuryArchetypeById(selectedId);

      if (useMockData) {
        // Mock mode: use registerContact with archetype ID
        await registerContact(selectedId);
      } else {
        // Real mode: the contact already exists in CRM — just select it
        const registrationId = profile?.contactId || selectedId;
        await registerContact(registrationId);
      }

      onComplete?.();
      onClose();
    } finally {
      setRegistering(false);
    }
  };

  const selectedProfile = selectedId ? profiles.find((p) => p.id === selectedId) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-stone-900">
                    {step === 'select' ? 'Select Your Identity Profile' : 'Create Your Account'}
                  </h2>
                  <p className="text-sm text-stone-500 mt-1">
                    {step === 'select'
                      ? 'Merkury resolves visitor identity via cookie/device graph. Select a profile to simulate this resolution.'
                      : 'Complete your registration to access personalized recommendations and rewards.'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {step === 'select' && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wider bg-stone-100 px-2 py-0.5 rounded">
                    Demo
                  </span>
                  <span className="text-xs text-stone-400">
                    This simulates Merkury identity resolution at the browser level
                  </span>
                </div>
              )}
            </div>

            {step === 'select' ? (
              <>
                {/* Profile list */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                      <span className="ml-3 text-sm text-stone-500">Loading profiles...</span>
                    </div>
                  ) : (
                    <>
                      {profiles.map((profile) => (
                        <button
                          key={profile.id}
                          onClick={() => setSelectedId(profile.id)}
                          className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                            selectedId === profile.id
                              ? 'border-rose-300 bg-rose-50/50 shadow-sm'
                              : 'border-gray-100 hover:border-gray-200 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              selectedId === profile.id
                                ? 'border-rose-500'
                                : 'border-stone-300'
                            }`}>
                              {selectedId === profile.id && (
                                <div className="w-2 h-2 rounded-full bg-rose-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-stone-900">
                                {profile.label}
                              </div>
                              <div className="text-xs text-stone-500 mt-0.5">
                                {profile.archetype}
                              </div>
                              {profile.interests.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {profile.interests.map((interest) => (
                                    <span
                                      key={interest}
                                      className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded"
                                    >
                                      {interest}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}

                      {/* No Match option */}
                      <button
                        onClick={() => setSelectedId('no-match')}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          selectedId === 'no-match'
                            ? 'border-stone-400 bg-stone-50 shadow-sm'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                            selectedId === 'no-match'
                              ? 'border-stone-500'
                              : 'border-stone-300'
                          }`}>
                            {selectedId === 'no-match' && (
                              <div className="w-2 h-2 rounded-full bg-stone-500" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-stone-900">
                              {NO_MERKURY_MATCH.label}
                            </div>
                            <div className="text-xs text-stone-500 mt-0.5">
                              {NO_MERKURY_MATCH.archetype}
                            </div>
                          </div>
                        </div>
                      </button>
                    </>
                  )}
                </div>

                {/* Footer — select step */}
                <div className="px-6 py-4 border-t border-gray-100 bg-stone-50/50 rounded-b-2xl">
                  <button
                    onClick={handleContinue}
                    disabled={!selectedId || isResolving}
                    className={`w-full py-2.5 text-sm font-medium rounded-xl transition-all ${
                      selectedId && !isResolving
                        ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    {selectedId === 'no-match' ? 'Continue as Anonymous' : 'Continue'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Registration form — step 2 */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  {/* Selected profile context */}
                  {selectedProfile && (
                    <div className="mb-6 p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-medium">
                          {selectedProfile.label.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-stone-900">{selectedProfile.label}</div>
                          <div className="text-xs text-stone-500">{selectedProfile.archetype}</div>
                        </div>
                      </div>
                      {selectedProfile.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {selectedProfile.interests.map((interest) => (
                            <span key={interest} className="text-[10px] bg-white text-stone-500 px-1.5 py-0.5 rounded border border-rose-100">
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <form id="register-form" onSubmit={handleRegisterSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">Email Address</label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                        placeholder="your@email.com"
                        className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">First Name</label>
                        <input
                          type="text"
                          value={regFirstName}
                          onChange={(e) => setRegFirstName(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">Last Name</label>
                        <input
                          type="text"
                          value={regLastName}
                          onChange={(e) => setRegLastName(e.target.value)}
                          required
                          className="w-full px-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-stone-400">
                      By creating an account, you agree to our terms and will receive personalized recommendations.
                    </p>
                  </form>
                </div>

                {/* Footer — register step */}
                <div className="px-6 py-4 border-t border-gray-100 bg-stone-50/50 rounded-b-2xl flex gap-3">
                  <button
                    onClick={() => setStep('select')}
                    className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    form="register-form"
                    disabled={registering || isResolving}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all ${
                      !registering && !isResolving
                        ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    {registering || isResolving ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating Account...
                      </span>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
