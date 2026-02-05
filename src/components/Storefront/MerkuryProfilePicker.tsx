import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MERKURY_ARCHETYPES, NO_MERKURY_MATCH, type MerkuryArchetype } from '@/mocks/merkuryProfiles';
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
  const { registerContact, isResolving } = useCustomer();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DisplayProfile[]>([]);
  const [loading, setLoading] = useState(false);

  // Build display profiles — from CRM in real mode, from mock data in mock mode
  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(null);

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
          // Cross-reference with local archetype data for rich display
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
        // Fallback to local archetypes if no CRM contacts found
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

  const handleContinue = async () => {
    if (!selectedId) return;

    if (selectedId === 'no-match') {
      onClose();
      return;
    }

    const profile = profiles.find((p) => p.id === selectedId);
    // In real mode, use the Salesforce Contact ID; in mock mode, use the archetype ID
    const registrationId = profile?.contactId || selectedId;
    await registerContact(registrationId);
    onComplete?.();
    onClose();
  };

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
                    Select Your Identity Profile
                  </h2>
                  <p className="text-sm text-stone-500 mt-1">
                    Merkury resolves visitor identity via cookie/device graph.
                    Select a profile to simulate this resolution.
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
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wider bg-stone-100 px-2 py-0.5 rounded">
                  Demo
                </span>
                <span className="text-xs text-stone-400">
                  This simulates Merkury identity resolution at the browser level
                </span>
              </div>
            </div>

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

            {/* Footer */}
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
                {isResolving ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Resolving Identity...
                  </span>
                ) : selectedId === 'no-match' ? (
                  'Continue as Anonymous'
                ) : (
                  'Continue as Selected Profile'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
