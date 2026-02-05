import type { AppendedProfile } from '@/types/customer';

export interface MerkuryArchetype {
  id: string;
  merkuryId: string;
  label: string;
  archetype: string;
  appendedProfile: AppendedProfile;
  /** Partial beauty fields written to Contact custom fields during CRM seeding */
  beautyHints: {
    skinType?: string;
    concerns?: string[];
    preferredBrands?: string[];
    beautyPriority?: string;
  };
}

export const MERKURY_ARCHETYPES: MerkuryArchetype[] = [
  {
    id: 'merkury-urban-clean',
    merkuryId: 'MRK-UC-20001',
    label: 'Clean Beauty Urbanite',
    archetype: 'F 28-35 · $80-120k · SF Bay Area',
    appendedProfile: {
      ageRange: '28-35',
      gender: 'female',
      householdIncome: '$80k-$120k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: "bachelor's",
      interests: ['clean beauty', 'sustainability', 'yoga', 'organic food'],
      lifestyleSignals: ['urban professional', 'eco-conscious', 'fitness-active'],
      geoRegion: 'San Francisco Bay Area',
    },
    beautyHints: {
      skinType: 'Combination',
      concerns: ['hydration', 'brightening'],
      preferredBrands: ['SERENE'],
      beautyPriority: 'Clean ingredients, sustainability-focused',
    },
  },
  {
    id: 'merkury-luxury-parent',
    merkuryId: 'MRK-LP-20002',
    label: 'Luxury Suburban Parent',
    archetype: 'F 40-50 · $150-250k · Dallas Metro',
    appendedProfile: {
      ageRange: '40-50',
      gender: 'female',
      householdIncome: '$150k-$250k',
      hasChildren: true,
      homeOwnership: 'own',
      educationLevel: "master's",
      interests: ['luxury beauty', 'anti-aging', 'spa treatments', 'fine dining'],
      lifestyleSignals: ['affluent suburban', 'self-care focused', 'frequent spa-goer'],
      geoRegion: 'Dallas-Fort Worth',
    },
    beautyHints: {
      skinType: 'Normal',
      concerns: ['anti-aging', 'firmness'],
      preferredBrands: ['LUMIERE', 'MAISON'],
      beautyPriority: 'Premium anti-aging, results-driven',
    },
  },
  {
    id: 'merkury-kbeauty-pro',
    merkuryId: 'MRK-KB-20003',
    label: 'K-Beauty Professional',
    archetype: 'F 22-28 · $60-80k · Los Angeles',
    appendedProfile: {
      ageRange: '22-28',
      gender: 'female',
      householdIncome: '$60k-$80k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: "bachelor's",
      interests: ['K-beauty', 'skincare layering', 'sheet masks', 'glass skin'],
      lifestyleSignals: ['beauty enthusiast', 'social media active', 'early adopter'],
      geoRegion: 'Los Angeles Metro',
    },
    beautyHints: {
      skinType: 'Normal',
      concerns: ['brightening', 'glow', 'pores'],
      preferredBrands: ['LUMIERE'],
      beautyPriority: 'Multi-step routine, glass skin aesthetic',
    },
  },
  {
    id: 'merkury-premium-retiree',
    merkuryId: 'MRK-PR-20004',
    label: 'Premium Retiree',
    archetype: 'F 55-65 · $200k+ · Palm Beach',
    appendedProfile: {
      ageRange: '55-65',
      gender: 'female',
      householdIncome: '$200k+',
      hasChildren: true,
      homeOwnership: 'own',
      educationLevel: "master's",
      interests: ['premium skincare', 'dermatologist-recommended', 'anti-aging', 'wellness retreats'],
      lifestyleSignals: ['affluent retiree', 'health-conscious', 'luxury lifestyle'],
      geoRegion: 'Palm Beach, FL',
    },
    beautyHints: {
      skinType: 'Mature',
      concerns: ['anti-aging', 'hydration', 'firmness'],
      preferredBrands: ['LUMIERE', 'MAISON'],
      beautyPriority: 'Dermatologist-grade, proven ingredients',
    },
  },
  {
    id: 'merkury-budget-student',
    merkuryId: 'MRK-BS-20005',
    label: 'Budget-Conscious Student',
    archetype: 'F 18-22 · <$30k · College Town',
    appendedProfile: {
      ageRange: '18-22',
      gender: 'female',
      householdIncome: '<$30k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: 'some college',
      interests: ['drugstore beauty', 'TikTok skincare', 'dupes', 'affordable routines'],
      lifestyleSignals: ['college student', 'budget-conscious', 'social media native'],
      geoRegion: 'Austin, TX',
    },
    beautyHints: {
      skinType: 'Oily',
      concerns: ['acne', 'oil control'],
      preferredBrands: ['DERMAFIX'],
      beautyPriority: 'Affordable, effective basics',
    },
  },
  {
    id: 'merkury-male-minimal',
    merkuryId: 'MRK-MM-20006',
    label: 'Male Grooming Minimalist',
    archetype: 'M 30-40 · $100-150k · Chicago',
    appendedProfile: {
      ageRange: '30-40',
      gender: 'male',
      householdIncome: '$100k-$150k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: "bachelor's",
      interests: ['minimal grooming', 'beard care', 'SPF', 'fitness'],
      lifestyleSignals: ['urban professional', 'fitness-focused', 'minimalist'],
      geoRegion: 'Chicago Metro',
    },
    beautyHints: {
      skinType: 'Combination',
      concerns: ['oil control', 'razor irritation'],
      preferredBrands: ['DERMAFIX'],
      beautyPriority: 'Simple, no-fuss routine',
    },
  },
  {
    id: 'merkury-wellness-mom',
    merkuryId: 'MRK-WM-20007',
    label: 'Wellness Mom',
    archetype: 'F 35-45 · $120-180k · Suburban',
    appendedProfile: {
      ageRange: '35-45',
      gender: 'female',
      householdIncome: '$120k-$180k',
      hasChildren: true,
      homeOwnership: 'own',
      educationLevel: "bachelor's",
      interests: ['natural beauty', 'organic skincare', 'wellness', 'yoga', 'clean living'],
      lifestyleSignals: ['wellness-focused parent', 'organic lifestyle', 'community-active'],
      geoRegion: 'Portland, OR',
    },
    beautyHints: {
      skinType: 'Sensitive',
      concerns: ['hydration', 'redness'],
      preferredBrands: ['SERENE'],
      beautyPriority: 'Natural/organic, safe for sensitive skin',
    },
  },
  {
    id: 'merkury-genz-social',
    merkuryId: 'MRK-GZ-20008',
    label: 'Gen Z Social Beauty',
    archetype: 'NB 18-25 · $30-50k · NYC',
    appendedProfile: {
      ageRange: '18-25',
      gender: 'non-binary',
      householdIncome: '$30k-$50k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: "bachelor's",
      interests: ['trending beauty', 'bold color', 'indie brands', 'gender-neutral beauty'],
      lifestyleSignals: ['social media creator', 'trend-forward', 'inclusivity advocate'],
      geoRegion: 'New York City',
    },
    beautyHints: {
      skinType: 'Normal',
      concerns: ['brightening', 'glow'],
      preferredBrands: ['LUMIERE'],
      beautyPriority: 'Trend-forward, bold self-expression',
    },
  },
  {
    id: 'merkury-antiaging-pro',
    merkuryId: 'MRK-AP-20009',
    label: 'Anti-Aging Professional',
    archetype: 'F 45-55 · $150-200k · Boston',
    appendedProfile: {
      ageRange: '45-55',
      gender: 'female',
      householdIncome: '$150k-$200k',
      hasChildren: true,
      homeOwnership: 'own',
      educationLevel: 'doctorate',
      interests: ['anti-aging', 'premium skincare', 'retinol', 'clinical beauty'],
      lifestyleSignals: ['career-driven', 'results-oriented', 'science-minded'],
      geoRegion: 'Boston Metro',
    },
    beautyHints: {
      skinType: 'Combination',
      concerns: ['anti-aging', 'texture', 'dark spots'],
      preferredBrands: ['LUMIERE', 'DERMAFIX'],
      beautyPriority: 'Clinically proven, results-driven ingredients',
    },
  },
  {
    id: 'merkury-active-outdoor',
    merkuryId: 'MRK-AO-20010',
    label: 'Active Outdoors SPF',
    archetype: 'M 25-35 · $70-100k · Denver',
    appendedProfile: {
      ageRange: '25-35',
      gender: 'male',
      householdIncome: '$70k-$100k',
      hasChildren: false,
      homeOwnership: 'rent',
      educationLevel: "bachelor's",
      interests: ['outdoor sports', 'SPF protection', 'hiking', 'skiing', 'minimal skincare'],
      lifestyleSignals: ['outdoor enthusiast', 'active lifestyle', 'environmentally aware'],
      geoRegion: 'Denver Metro',
    },
    beautyHints: {
      skinType: 'Normal',
      concerns: ['sun protection', 'hydration'],
      preferredBrands: ['SERENE'],
      beautyPriority: 'SPF protection, outdoor-ready',
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
