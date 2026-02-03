import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { CustomerProfile } from '@/types/customer';
import { resolveMerkuryIdentity } from '@/services/merkury/mockTag';
import { getPersonaById, PERSONAS } from '@/mocks/customerPersonas';
import { getDataCloudService } from '@/services/datacloud';

const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

interface CustomerContextValue {
  customer: CustomerProfile | null;
  selectedPersonaId: string | null;
  isLoading: boolean;
  isResolving: boolean;
  error: Error | null;
  selectPersona: (personaId: string) => Promise<void>;
  identifyByEmail: (email: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  resetPersonaSession: (personaId: string) => void;
  /** @internal Used by ConversationContext to detect refresh vs switch. */
  _isRefreshRef: React.MutableRefObject<boolean>;
  /** @internal Register callback for session reset notifications. */
  _onSessionReset: (cb: (personaId: string) => void) => () => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  /** When true, the next customer update is a profile refresh — don't reset conversation. */
  const isRefreshRef = useRef(false);
  /** Callbacks registered by ConversationContext to clear a persona's cached session. */
  const sessionResetCallbacksRef = useRef<Set<(personaId: string) => void>>(new Set());

  /** Register a callback to be notified when a persona session should be reset. */
  const onSessionReset = useCallback((cb: (personaId: string) => void) => {
    sessionResetCallbacksRef.current.add(cb);
    return () => { sessionResetCallbacksRef.current.delete(cb); };
  }, []);

  const selectPersona = useCallback(async (personaId: string) => {
    setSelectedPersonaId(personaId);
    setIsResolving(true);
    setError(null);

    try {
      // Simulate Merkury tag resolution
      const resolution = await resolveMerkuryIdentity(personaId);
      console.log('[merkury] Identity resolved:', resolution.identityTier, 'confidence:', resolution.confidence);

      // Appended-tier: Merkury resolved identity via 3P data only.
      // These people are NOT in Data Cloud — don't look them up there.
      // Build a minimal anonymous-like profile with only appended signals attached.
      if (resolution.identityTier === 'appended') {
        const appendedProfile: CustomerProfile = {
          id: resolution.merkuryId || `appended-${personaId}`,
          name: 'Guest',
          email: '',
          beautyProfile: {} as CustomerProfile['beautyProfile'],
          orders: [],
          purchaseHistory: [],
          chatSummaries: [],
          meaningfulEvents: [],
          browseSessions: [],
          loyalty: null,
          savedPaymentMethods: [],
          shippingAddresses: [],
          recentActivity: [],
          merkuryIdentity: {
            merkuryId: resolution.merkuryId || '',
            identityTier: 'appended',
            confidence: resolution.confidence,
            resolvedAt: new Date().toISOString(),
          },
          appendedProfile: resolution.appendedData,
        };
        console.log('[customer] Appended-tier identity — using minimal profile with 3P signals only');
        setCustomer(appendedProfile);
      } else if (resolution.identityTier === 'anonymous' || !resolution.merkuryId) {
        // Anonymous: Merkury found no match. Stay on the default starting page —
        // no agent session, no welcome, no profile data. Just the baseline experience.
        console.log('[customer] Anonymous — no identity resolved, staying on default experience');
        setCustomer(null);
      } else if (useMockData) {
        // MOCK MODE: Load known profiles from mock personas
        const persona = getPersonaById(personaId);
        if (persona) {
          setCustomer(persona.profile);
        } else {
          setCustomer(null);
        }
      } else {
        // REAL MODE: Fetch known profile from Data Cloud
        setIsLoading(true);
        // Stamp Merkury resolution onto the profile so the UI knows identity tier
        const merkuryIdentity = {
          merkuryId: resolution.merkuryId!,
          identityTier: resolution.identityTier,
          confidence: resolution.confidence,
          resolvedAt: new Date().toISOString(),
        };
        try {
          const dataCloudService = getDataCloudService();
          const profile = await dataCloudService.getCustomerProfile(resolution.merkuryId);
          profile.merkuryIdentity = merkuryIdentity;
          if (resolution.appendedData) profile.appendedProfile = resolution.appendedData;
          setCustomer(profile);
        } catch (dcError) {
          console.error('[datacloud] Profile fetch failed:', dcError);
          console.warn('[datacloud] Falling back to mock persona data');
          const persona = getPersonaById(personaId);
          if (persona) {
            const fallback = { ...persona.profile, merkuryIdentity };
            setCustomer(fallback);
          } else {
            throw new Error('Failed to load customer profile from Data Cloud');
          }
        } finally {
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error('Identity resolution failed:', err);
      setError(err instanceof Error ? err : new Error('Identity resolution failed'));
      setCustomer(null);
    } finally {
      setIsResolving(false);
    }
  }, []);

  // Auto-select anonymous persona on mount so the app starts with a default experience
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      selectPersona('persona-anonymous');
    }
  }, [selectPersona]);

  /** Identify an anonymous user by email — find existing profile or create a new one.
   *  Uses isRefreshRef so the conversation is NOT reset. */
  const identifyByEmail = useCallback(async (email: string): Promise<boolean> => {
    setIsResolving(true);
    setError(null);

    try {
      let profile: CustomerProfile | null = null;

      if (useMockData) {
        // Search mock personas by email
        const match = PERSONAS.find(
          (p) => p.profile.email.toLowerCase() === email.toLowerCase()
        );
        if (match) {
          profile = match.profile;
          console.log('[identity] Matched existing mock persona:', match.label);
        } else {
          // Create minimal new profile for unknown email
          const firstName = email.split('@')[0].split('.')[0];
          const name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
          profile = {
            id: `customer-${Date.now()}`,
            name,
            email,
            beautyProfile: { skinType: 'normal', concerns: [], allergies: [], preferredBrands: [] },
            orders: [],
            chatSummaries: [],
            meaningfulEvents: [],
            browseSessions: [],
            loyalty: null,
            purchaseHistory: [],
            savedPaymentMethods: [],
            shippingAddresses: [],
            recentActivity: [],
            merkuryIdentity: {
              merkuryId: `MRK-${Date.now()}`,
              identityTier: 'known',
              confidence: 0.85,
              resolvedAt: new Date().toISOString(),
            },
          };
          console.log('[identity] Created new mock profile for:', email);
        }
      } else {
        // Real mode: query Data Cloud by email
        try {
          const dataCloudService = getDataCloudService();
          profile = await dataCloudService.getCustomerProfileByEmail(email);
          profile.merkuryIdentity = {
            merkuryId: profile.id,
            identityTier: 'known',
            confidence: 0.9,
            resolvedAt: new Date().toISOString(),
          };
          console.log('[identity] Found existing profile in Data Cloud for:', email);
        } catch {
          console.warn('[identity] Email not found in Data Cloud:', email);
          // The Agentforce agent should have already called CreateSalesContactRecord,
          // so try again after a short delay to allow SF to process
          return false;
        }
      }

      // Mark as refresh so conversation is NOT reset
      isRefreshRef.current = true;
      setCustomer(profile);
      // Reset refresh flag on next tick
      setTimeout(() => { isRefreshRef.current = false; }, 0);
      return true;
    } catch (err) {
      console.error('[identity] Email identification failed:', err);
      setError(err instanceof Error ? err : new Error('Email identification failed'));
      return false;
    } finally {
      setIsResolving(false);
    }
  }, []);

  /** Re-fetch the current persona's profile without resetting the conversation. */
  const refreshProfile = useCallback(async () => {
    if (!selectedPersonaId) return;
    isRefreshRef.current = true;
    await selectPersona(selectedPersonaId);
    isRefreshRef.current = false;
  }, [selectedPersonaId, selectPersona]);

  /** Clear a persona's cached session so their next switch re-fires welcome. */
  const resetPersonaSession = useCallback((personaId: string) => {
    for (const cb of sessionResetCallbacksRef.current) cb(personaId);
    // If resetting the active persona, re-select to trigger fresh welcome
    if (personaId === selectedPersonaId) {
      selectPersona(personaId);
    }
  }, [selectedPersonaId, selectPersona]);

  return (
    <CustomerContext.Provider value={{
      customer, selectedPersonaId, isLoading, isResolving, error,
      selectPersona, identifyByEmail, refreshProfile, resetPersonaSession,
      _isRefreshRef: isRefreshRef, _onSessionReset: onSessionReset,
    }}>
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = (): CustomerContextValue => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within CustomerProvider');
  }
  return context;
};
