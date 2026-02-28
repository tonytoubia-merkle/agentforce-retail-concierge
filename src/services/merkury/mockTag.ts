import type { IdentityTier, AppendedProfile } from '@/types/customer';
import { getPersonaById } from '@/mocks/customerPersonas';
import { getMerkuryArchetypeByMerkuryId } from '@/mocks/merkuryProfiles';
import { pushMerkuryToDataLayer } from './dataLayer';

export interface MerkuryResolution {
  merkuryId: string | null;
  identityTier: IdentityTier;
  confidence: number;
  appendedData?: AppendedProfile;
}

/**
 * Simulates Merkury Identity tag resolution.
 * In production, Merkury's JS snippet fires on page load and resolves identity
 * via cookie/device graph. Here we simulate that with a configurable delay.
 *
 * On resolution, pushes data to window.dataLayer so the SF Personalization
 * web beacon can read it immediately for first-page targeting rules.
 */
export async function resolveMerkuryIdentity(personaId?: string): Promise<MerkuryResolution> {
  // Simulate network latency
  const delay = 200 + Math.random() * 300;
  await new Promise((r) => setTimeout(r, delay));

  if (!personaId || personaId === 'anonymous') {
    pushMerkuryToDataLayer({ identityTier: 'anonymous', confidence: 0 });
    return { merkuryId: null, identityTier: 'anonymous', confidence: 0 };
  }

  const persona = getPersonaById(personaId);
  if (!persona) {
    pushMerkuryToDataLayer({ identityTier: 'anonymous', confidence: 0 });
    return { merkuryId: null, identityTier: 'anonymous', confidence: 0 };
  }

  const identity = persona.profile.merkuryIdentity;
  const appendedData = persona.profile.appendedProfile;

  // Look up Merkury archetype for beauty hints
  const merkuryId = identity?.merkuryId;
  const archetype = merkuryId ? getMerkuryArchetypeByMerkuryId(merkuryId) : undefined;

  // Push to global dataLayer — available to web beacon before React state updates
  pushMerkuryToDataLayer({
    pid: identity?.merkuryPid || merkuryId || undefined,
    hid: identity?.merkuryHid || undefined,
    identityTier: identity?.identityTier || 'anonymous',
    confidence: identity?.confidence || 0,
    interests: appendedData?.interests,
    ageRange: appendedData?.ageRange,
    gender: appendedData?.gender,
    householdIncome: appendedData?.householdIncome,
    lifestyleSignals: appendedData?.lifestyleSignals,
    geoRegion: appendedData?.geoRegion,
    skinType: archetype?.beautyHints?.skinType,
    skinConcerns: archetype?.beautyHints?.concerns,
    preferredBrands: archetype?.beautyHints?.preferredBrands,
  });

  return {
    merkuryId: merkuryId || null,
    identityTier: identity?.identityTier || 'anonymous',
    confidence: identity?.confidence || 0,
    appendedData,
  };
}
