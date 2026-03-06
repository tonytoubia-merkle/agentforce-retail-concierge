import type { AppendedProfile } from '@/types/customer';

export interface MerkuryArchetype {
  id: string;
  /** @deprecated Use merkuryPid instead */
  merkuryId: string;
  /** Merkury Personal ID — individual-level identifier */
  merkuryPid: string;
  /** Merkury Household ID — shared across household members */
  merkuryHid: string;
  label: string;
  archetype: string;
  appendedProfile: AppendedProfile;
  /** Partial hydration hints written to Contact custom fields during CRM seeding */
  hydrationHints: {
    primaryUse?: string;
    waterPreferences?: string[];
    preferredBrands?: string[];
    hydrationPriority?: string;
  };
}

// Household IDs — some profiles share the same HID for demo purposes
// HID-H001: Urban couple (Active Fitness Enthusiast + Commuter Minimalist)
// HID-H002: Suburban family (Family Mom + Eco Dad — partners)
// HID-H003: Wellness household (Wellness Professional + Premium Retiree — siblings)
// Others: Individual households

export const MERKURY_ARCHETYPES: MerkuryArchetype[] = [
  {
    id: 'merkury-fitness-enthusiast',
    merkuryId: 'MRK-FE-20001',
    merkuryPid: 'PID-FE-20001',
    merkuryHid: 'HID-H001',
    label: 'Active Fitness Enthusiast',
    archetype: 'M/F 25-40 · $80-130k · Urban',
    appendedProfile: {
      ageRange: '25-40',
      gender: 'male',
      householdIncome: '$80k-$130k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: "bachelor's",
      interests: ['running', 'triathlon', 'cycling', 'hydration optimization', 'wellness tech'],
      lifestyleSignals: ['high-activity', 'performance-focused', 'health-conscious'],
      geoRegion: 'Chicago Metro',
    },
    hydrationHints: {
      primaryUse: 'fitness',
      waterPreferences: ['still', 'sparkling'],
      preferredBrands: ['Primo Sparkling'],
      hydrationPriority: 'High volume, performance hydration, post-workout recovery',
    },
  },
  {
    id: 'merkury-family-home',
    merkuryId: 'MRK-FH-20002',
    merkuryPid: 'PID-FH-20002',
    merkuryHid: 'HID-H002',
    label: 'Family Home Manager',
    archetype: 'F 32-48 · $90-150k · Suburban',
    appendedProfile: {
      ageRange: '32-48',
      gender: 'female',
      householdIncome: '$90k-$150k',
      hasChildren: true,
      homeOwnership: 'own',
      educationLevel: "bachelor's",
      interests: ['family wellness', 'healthy living', 'organic food', 'kids health', 'sustainability'],
      lifestyleSignals: ['family-focused parent', 'health-conscious', 'sustainability-minded'],
      geoRegion: 'Austin, TX',
    },
    hydrationHints: {
      primaryUse: 'home',
      waterPreferences: ['still', 'flavored'],
      preferredBrands: ['Primo Water', 'Pure Life'],
      hydrationPriority: 'Family-safe, convenient delivery, kids hydration solutions',
    },
  },
  {
    id: 'merkury-office-professional',
    merkuryId: 'MRK-OP-20003',
    merkuryPid: 'PID-OP-20003',
    merkuryHid: 'HID-H004',
    label: 'Office Professional',
    archetype: 'M 30-50 · $100-175k · Metro',
    appendedProfile: {
      ageRange: '30-50',
      gender: 'male',
      householdIncome: '$100k-$175k',
      hasChildren: true,
      homeOwnership: 'own',
      educationLevel: "master's",
      interests: ['workplace productivity', 'corporate wellness', 'team culture', 'efficiency'],
      lifestyleSignals: ['career-driven', 'team-oriented', 'process-focused'],
      geoRegion: 'San Jose, CA',
    },
    hydrationHints: {
      primaryUse: 'office',
      waterPreferences: ['still', 'sparkling'],
      preferredBrands: ['Primo Water'],
      hydrationPriority: 'Bulk office supply, dispenser solutions, cost efficiency',
    },
  },
  {
    id: 'merkury-wellness-seeker',
    merkuryId: 'MRK-WS-20004',
    merkuryPid: 'PID-WS-20004',
    merkuryHid: 'HID-H003',
    label: 'Wellness Seeker',
    archetype: 'F 25-40 · $70-110k · Pacific NW',
    appendedProfile: {
      ageRange: '25-40',
      gender: 'female',
      householdIncome: '$70k-$110k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: "master's",
      interests: ['wellness', 'clean hydration', 'sustainability', 'yoga', 'mindfulness', 'organic living'],
      lifestyleSignals: ['wellness-focused', 'eco-conscious', 'intentional consumer'],
      geoRegion: 'Portland, OR',
    },
    hydrationHints: {
      primaryUse: 'home',
      waterPreferences: ['still', 'flavored', 'mineral'],
      preferredBrands: ['Primo Sparkling'],
      hydrationPriority: 'Clean sourcing, sustainability, unique wellness-oriented flavors',
    },
  },
  {
    id: 'merkury-eco-homeowner',
    merkuryId: 'MRK-EH-20005',
    merkuryPid: 'PID-EH-20005',
    merkuryHid: 'HID-H005',
    label: 'Eco-Conscious Homeowner',
    archetype: 'M/F 28-45 · $65-100k · Sun Belt',
    appendedProfile: {
      ageRange: '28-45',
      gender: 'male',
      householdIncome: '$65k-$100k',
      hasChildren: false,
      homeOwnership: 'own',
      educationLevel: "bachelor's",
      interests: ['zero-waste living', 'sustainability', 'water quality', 'home improvement'],
      lifestyleSignals: ['eco-conscious', 'DIY-minded', 'environmental advocacy'],
      geoRegion: 'Phoenix, AZ',
    },
    hydrationHints: {
      primaryUse: 'home',
      waterPreferences: ['still'],
      preferredBrands: ['Primo Water'],
      hydrationPriority: 'Reduce plastic waste, filter/refill solutions, water quality awareness',
    },
  },
  {
    id: 'merkury-premium-lifestyle',
    merkuryId: 'MRK-PL-20006',
    merkuryPid: 'PID-PL-20006',
    merkuryHid: 'HID-H006',
    label: 'Premium Lifestyle',
    archetype: 'F 38-58 · $200k+ · Coastal',
    appendedProfile: {
      ageRange: '38-58',
      gender: 'female',
      householdIncome: '$200k+',
      hasChildren: false,
      homeOwnership: 'own',
      educationLevel: "bachelor's",
      interests: ['premium wellness', 'spa experiences', 'gourmet food & drink', 'travel', 'health optimization'],
      lifestyleSignals: ['affluent lifestyle', 'brand-conscious', 'wellness-invested'],
      geoRegion: 'Miami, FL',
    },
    hydrationHints: {
      primaryUse: 'home',
      waterPreferences: ['sparkling', 'flavored'],
      preferredBrands: ['Primo Sparkling'],
      hydrationPriority: 'Premium sparkling experience, unique flavors, status-brand alignment',
    },
  },
  {
    id: 'merkury-commuter-minimalist',
    merkuryId: 'MRK-CM-20007',
    merkuryPid: 'PID-CM-20007',
    merkuryHid: 'HID-H001',
    label: 'Commuter Minimalist',
    archetype: 'M 28-42 · $75-120k · Urban',
    appendedProfile: {
      ageRange: '28-42',
      gender: 'male',
      householdIncome: '$75k-$120k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: "bachelor's",
      interests: ['on-the-go hydration', 'reusable bottles', 'convenience', 'clean living'],
      lifestyleSignals: ['urban commuter', 'convenience-oriented', 'sustainability-aware'],
      geoRegion: 'New York Metro',
    },
    hydrationHints: {
      primaryUse: 'travel',
      waterPreferences: ['still', 'sparkling'],
      preferredBrands: ['Primo Water'],
      hydrationPriority: 'Portable, convenient, reusable bottle solutions',
    },
  },
  {
    id: 'merkury-budget-family',
    merkuryId: 'MRK-BF-20008',
    merkuryPid: 'PID-BF-20008',
    merkuryHid: 'HID-H007',
    label: 'Budget-Conscious Family',
    archetype: 'F/M 25-40 · $40-65k · Suburban',
    appendedProfile: {
      ageRange: '25-40',
      gender: 'female',
      householdIncome: '$40k-$65k',
      hasChildren: true,
      homeOwnership: 'rent',
      educationLevel: 'some college',
      interests: ['value deals', 'family savings', 'basic hydration', 'grocery savings'],
      lifestyleSignals: ['budget-focused', 'family-oriented', 'value-seeker'],
      geoRegion: 'Dallas, TX',
    },
    hydrationHints: {
      primaryUse: 'home',
      waterPreferences: ['still'],
      preferredBrands: ['Pure Life'],
      hydrationPriority: 'Affordable, accessible, bulk value',
    },
  },
  {
    id: 'merkury-outdoor-adventurer',
    merkuryId: 'MRK-OA-20009',
    merkuryPid: 'PID-OA-20009',
    merkuryHid: 'HID-H008',
    label: 'Outdoor Adventurer',
    archetype: 'M 22-38 · $55-85k · Mountain West',
    appendedProfile: {
      ageRange: '22-38',
      gender: 'male',
      householdIncome: '$55k-$85k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: "bachelor's",
      interests: ['hiking', 'trail running', 'camping', 'outdoor sports', 'hydration on trail'],
      lifestyleSignals: ['outdoor enthusiast', 'adventure-seeking', 'environmentally aware'],
      geoRegion: 'Denver, CO',
    },
    hydrationHints: {
      primaryUse: 'outdoor',
      waterPreferences: ['still'],
      preferredBrands: ['Pure Life', 'Primo Water'],
      hydrationPriority: 'Portable, durable bottles, trail-ready hydration',
    },
  },
  {
    id: 'merkury-senior-wellness',
    merkuryId: 'MRK-SW-20010',
    merkuryPid: 'PID-SW-20010',
    merkuryHid: 'HID-H003',
    label: 'Senior Wellness-Focused',
    archetype: 'F 55-70 · $120-200k · Retirement Community',
    appendedProfile: {
      ageRange: '55-70',
      gender: 'female',
      householdIncome: '$120k-$200k',
      hasChildren: true,
      homeOwnership: 'own',
      educationLevel: "master's",
      interests: ['healthy aging', 'hydration health', 'doctor recommendations', 'wellness routines'],
      lifestyleSignals: ['health-focused retiree', 'routine-driven', 'quality-conscious'],
      geoRegion: 'Scottsdale, AZ',
    },
    hydrationHints: {
      primaryUse: 'home',
      waterPreferences: ['still', 'mineral'],
      preferredBrands: ['Pure Life', 'Primo Water'],
      hydrationPriority: 'Doctor-recommended hydration, mineral content, easy delivery',
    },
  },
];

export const NO_MERKURY_MATCH = {
  id: 'no-match',
  label: 'No Match (~30%)',
  archetype: 'Merkury found no identity signal for this visitor',
} as const;

export function getMerkuryArchetypeById(id: string): MerkuryArchetype | undefined {
  return MERKURY_ARCHETYPES.find((a) => a.id === id);
}

export function getMerkuryArchetypeByMerkuryId(merkuryId: string): MerkuryArchetype | undefined {
  return MERKURY_ARCHETYPES.find((a) => a.merkuryId === merkuryId);
}
