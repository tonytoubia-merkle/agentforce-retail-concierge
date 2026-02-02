import type { SceneSetting } from '@/types/scene';

export interface PreseededAsset {
  setting: SceneSetting;
  variant: string;
  path: string;
  tags: string[];
}

/**
 * Pre-seeded background images shipped in the repo for instant load.
 * Each setting has 3 variants for variety. Images live in public/assets/backgrounds/.
 */
export const PRESEEDED_BACKGROUNDS: PreseededAsset[] = [
  // Neutral
  { setting: 'neutral', variant: '1', path: '/assets/backgrounds/neutral-1.jpg', tags: ['scene-neutral'] },
  { setting: 'neutral', variant: '2', path: '/assets/backgrounds/neutral-2.jpg', tags: ['scene-neutral'] },
  { setting: 'neutral', variant: '3', path: '/assets/backgrounds/neutral-3.jpg', tags: ['scene-neutral'] },

  // Bathroom
  { setting: 'bathroom', variant: '1', path: '/assets/backgrounds/bathroom-1.jpg', tags: ['scene-bathroom'] },
  { setting: 'bathroom', variant: '2', path: '/assets/backgrounds/bathroom-2.jpg', tags: ['scene-bathroom'] },
  { setting: 'bathroom', variant: '3', path: '/assets/backgrounds/bathroom-3.jpg', tags: ['scene-bathroom'] },

  // Travel
  { setting: 'travel', variant: '1', path: '/assets/backgrounds/travel-1.jpg', tags: ['scene-travel'] },
  { setting: 'travel', variant: '2', path: '/assets/backgrounds/travel-2.jpg', tags: ['scene-travel'] },
  { setting: 'travel', variant: '3', path: '/assets/backgrounds/travel-3.jpg', tags: ['scene-travel'] },

  // Outdoor
  { setting: 'outdoor', variant: '1', path: '/assets/backgrounds/outdoor-1.jpg', tags: ['scene-outdoor'] },
  { setting: 'outdoor', variant: '2', path: '/assets/backgrounds/outdoor-2.jpg', tags: ['scene-outdoor'] },
  { setting: 'outdoor', variant: '3', path: '/assets/backgrounds/outdoor-3.jpg', tags: ['scene-outdoor'] },

  // Lifestyle
  { setting: 'lifestyle', variant: '2', path: '/assets/backgrounds/lifestyle-2.jpg', tags: ['scene-lifestyle'] },
  { setting: 'lifestyle', variant: '3', path: '/assets/backgrounds/lifestyle-3.jpg', tags: ['scene-lifestyle'] },

  // Bedroom
  { setting: 'bedroom', variant: '1', path: '/assets/backgrounds/bedroom-1.jpg', tags: ['scene-bedroom'] },
  { setting: 'bedroom', variant: '2', path: '/assets/backgrounds/bedroom-2.jpg', tags: ['scene-bedroom'] },
  { setting: 'bedroom', variant: '3', path: '/assets/backgrounds/bedroom-3.jpg', tags: ['scene-bedroom'] },

  // Vanity
  { setting: 'vanity', variant: '1', path: '/assets/backgrounds/vanity-1.jpg', tags: ['scene-vanity'] },
  { setting: 'vanity', variant: '2', path: '/assets/backgrounds/vanity-2.jpg', tags: ['scene-vanity'] },
  { setting: 'vanity', variant: '3', path: '/assets/backgrounds/vanity-3.jpg', tags: ['scene-vanity'] },

  // Gym
  { setting: 'gym', variant: '1', path: '/assets/backgrounds/gym-1.jpg', tags: ['scene-gym'] },
  { setting: 'gym', variant: '3', path: '/assets/backgrounds/gym-3.jpg', tags: ['scene-gym'] },

  // Office
  { setting: 'office', variant: '3', path: '/assets/backgrounds/office-3.jpg', tags: ['scene-office'] },
];

/** Track last used variant per setting to avoid repeats. */
const lastUsed: Record<string, string> = {};

/**
 * Pick a random pre-seeded background for a setting, avoiding the last-used variant.
 */
export function pickRandom(setting: SceneSetting): PreseededAsset | null {
  const candidates = PRESEEDED_BACKGROUNDS.filter((a) => a.setting === setting);
  if (candidates.length === 0) return null;

  // Filter out last-used variant if we have multiple options
  const last = lastUsed[setting];
  const pool = candidates.length > 1
    ? candidates.filter((a) => a.variant !== last)
    : candidates;

  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastUsed[setting] = pick.variant;
  return pick;
}

/**
 * Find a specific pre-seeded background by setting and variant.
 * Without a variant, picks randomly with rotation.
 */
export function findPreseeded(setting: SceneSetting, variant?: string): PreseededAsset | null {
  if (!variant) return pickRandom(setting);
  return PRESEEDED_BACKGROUNDS.find(
    (a) => a.setting === setting && a.variant === variant
  ) || null;
}

/** Check if a pre-seeded image file actually exists (async HEAD request). */
export async function preseededExists(asset: PreseededAsset): Promise<boolean> {
  try {
    const resp = await fetch(asset.path, { method: 'HEAD' });
    if (!resp.ok) return false;
    const ct = resp.headers.get('content-type') || '';
    return ct.startsWith('image/');
  } catch {
    return false;
  }
}
