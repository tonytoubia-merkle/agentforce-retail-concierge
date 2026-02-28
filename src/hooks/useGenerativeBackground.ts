import { useCallback, useRef } from 'react';
import type { SceneSetting, KnownSceneSetting } from '@/types/scene';
import type { Product } from '@/types/product';

const KNOWN_GRADIENTS: Record<KnownSceneSetting, string> = {
  neutral: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  bathroom: 'linear-gradient(135deg, #e8d5c4 0%, #c9b8a8 40%, #a89080 100%)',
  travel: 'linear-gradient(135deg, #2d6a4f 0%, #40916c 40%, #74c69d 100%)',
  outdoor: 'linear-gradient(135deg, #588157 0%, #a3b18a 50%, #dad7cd 100%)',
  lifestyle: 'linear-gradient(135deg, #5e548e 0%, #9f86c0 50%, #e0b1cb 100%)',
  bedroom: 'linear-gradient(135deg, #2d2040 0%, #4a3560 50%, #6b4f80 100%)',
  vanity: 'linear-gradient(135deg, #d4a5a5 0%, #c48b9f 50%, #9e6b8a 100%)',
  gym: 'linear-gradient(135deg, #2c3e50 0%, #4a6572 50%, #6a8ea0 100%)',
  office: 'linear-gradient(135deg, #e8e8e0 0%, #c8c8c0 50%, #a8a8a0 100%)',
};

/** Get fallback gradient for a setting. Unknown/dynamic settings fall back to neutral. */
export function getFallbackGradient(setting: SceneSetting): string {
  return KNOWN_GRADIENTS[setting as KnownSceneSetting] || KNOWN_GRADIENTS.neutral;
}

/** @deprecated Use getFallbackGradient instead */
export const FALLBACK_GRADIENTS = KNOWN_GRADIENTS as Record<string, string>;

type ImageProvider = 'imagen' | 'firefly' | 'cms-only' | 'none';

function getProvider(): ImageProvider {
  return (import.meta.env.VITE_IMAGE_PROVIDER as ImageProvider) || 'none';
}

// Known scene settings — prompts matching these are "standard" and don't need generation
const KNOWN_SETTINGS = new Set<string>([
  'neutral', 'bathroom', 'travel', 'outdoor', 'lifestyle',
  'bedroom', 'vanity', 'gym', 'office',
]);

// Generic phrases that DON'T warrant generation — standard beauty-scene boilerplate.
// If the prompt contains ONLY words like these, it's not novel.
const GENERIC_PHRASES = /^[\w\s,.-]*(luxurious|elegant|soft lighting|high-end|beauty|skincare|cosmetic|product|showcase|atmosphere|setting|perfect for)[\w\s,.-]*$/i;

/**
 * Determine if a background prompt describes a novel scene that warrants
 * dynamic image generation, vs a standard beauty scene that can use static assets.
 *
 * The logic is simple: if the agent provided any meaningful scene description
 * (theme, mood, context) that goes beyond generic beauty-scene boilerplate,
 * treat it as novel and generate. The agent is the best judge of what's novel —
 * we don't try to enumerate every possible location or keyword.
 */
function isNovelPrompt(prompt: string, setting: SceneSetting): boolean {
  // If the setting itself is not one of our known preseeded settings, it's novel
  if (!KNOWN_SETTINGS.has(setting)) return true;

  // If the prompt is just generic beauty-scene boilerplate, skip generation
  if (!prompt || GENERIC_PHRASES.test(prompt)) return false;

  // The agent provided something specific — trust it
  console.log('[bg] Novel prompt detected:', prompt.substring(0, 80));
  return true;
}

export interface BackgroundOptions {
  cmsAssetId?: string;
  cmsTag?: string;
  editMode?: boolean;
  editPrompt?: string;
  /** Rich scene description from agent — primary driver for generation. */
  backgroundPrompt?: string;
  sceneAssetId?: string;
  imageUrl?: string;
  mood?: string;
  customerContext?: string;
  sceneType?: string;
  /** If set, use this existing background instead of generating a new one. */
  existingBackground?: string;
}

export function useGenerativeBackground() {
  const cacheRef = useRef<Record<string, string>>({});

  const generateBackground = useCallback(
    async (setting: SceneSetting, products: Product[], options?: BackgroundOptions): Promise<string> => {
      const enabled = import.meta.env.VITE_ENABLE_GENERATIVE_BACKGROUNDS === 'true';

      // Build cache key — backgroundPrompt is the primary key when present
      const prompt = options?.backgroundPrompt || options?.editPrompt;
      const cacheKey = prompt
        ? `${setting}-prompt-${prompt.substring(0, 60)}`
        : options?.cmsAssetId || options?.cmsTag || setting;

      // Whether the agent provided a rich scene description
      const hasPrompt = !!options?.backgroundPrompt;
      // Whether the prompt describes something truly novel (not a standard beauty scene)
      const isNovel = hasPrompt && isNovelPrompt(options!.backgroundPrompt!, setting);

      if (cacheRef.current[cacheKey]) {
        return cacheRef.current[cacheKey];
      }

      // 0. Preserve existing background if provided (avoids regeneration on product updates)
      if (options?.existingBackground) {
        console.log('[bg] Preserving existing background for', setting);
        return options.existingBackground;
      }

      // 0a. Agent-provided imageUrl — skip everything
      if (options?.imageUrl) {
        console.log('[bg] Using agent-provided imageUrl for', setting);
        cacheRef.current[cacheKey] = options.imageUrl;
        return options.imageUrl;
      }

      // 0b. Agent-provided sceneAssetId — fetch from registry
      if (options?.sceneAssetId) {
        try {
          const { recordSceneUsage } = await import('@/services/sceneRegistry/client');
          const { getAgentforceClient } = await import('@/services/agentforce/client');
          const token = await getAgentforceClient().getAccessToken();
          await recordSceneUsage(options.sceneAssetId, token);
        } catch { /* usage tracking is best-effort */ }
      }

      // 1. Try scene registry lookup (Scene_Asset__c)
      if (!options?.editMode) {
        try {
          const { findSceneAsset } = await import('@/services/sceneRegistry/client');
          const { getAgentforceClient } = await import('@/services/agentforce/client');
          const token = await getAgentforceClient().getAccessToken();
          const match = await findSceneAsset(
            { setting, mood: options?.mood, customerContext: options?.customerContext, sceneType: options?.sceneType },
            token
          );
          if (match?.imageUrl) {
            const isReal = match.imageUrl.startsWith('http') || match.imageUrl.startsWith('blob:');
            if (isReal) {
              console.log('[bg] Using scene registry match for', setting, '→', match.id);
              cacheRef.current[cacheKey] = match.imageUrl;
              await import('@/services/sceneRegistry/client').then(m => m.recordSceneUsage(match.id, token)).catch(() => {});
              return match.imageUrl;
            }
            console.log('[bg] Scene registry match has placeholder URL, skipping:', match.imageUrl);
          }
        } catch (err) {
          console.warn('[bg] Scene registry lookup failed:', err);
        }
      }

      // 2. Try pre-seeded local background (instant, no network)
      //    Use static images for standard scenes — even when agent provides a backgroundPrompt,
      //    unless the prompt is truly novel (specific location, weather, etc.)
      if (!options?.editMode && !isNovel) {
        const { findPreseeded, preseededExists } = await import('@/data/preseededBackgrounds');
        const preseeded = findPreseeded(setting);
        if (preseeded) {
          const exists = await preseededExists(preseeded);
          if (exists) {
            console.log('[bg] Using pre-seeded image for', setting, '→', preseeded.path);
            cacheRef.current[cacheKey] = preseeded.path;
            return preseeded.path;
          }
        }
      }

      // If generative backgrounds are disabled AND prompt isn't novel, fallback
      if (!enabled && !isNovel) {
        return getFallbackGradient(setting);
      }

      const provider = getProvider();
      let cmsImageUrl: string | null = null;

      // 3. Try Salesforce CMS + ContentVersion fallback
      //    Skip when prompt is novel — we want fresh generation for those
      if (isNovel) {
        console.log('[bg] Novel prompt — skipping CMS, will generate for:', setting);
      }
      if (!isNovel) try {
        const { fetchCmsBackgroundEnhanced } = await import('@/services/cms/backgroundAssets');
        const { getAgentforceClient } = await import('@/services/agentforce/client');
        const token = await getAgentforceClient().getAccessToken();
        cmsImageUrl = await fetchCmsBackgroundEnhanced(
          { assetId: options?.cmsAssetId, tag: options?.cmsTag, setting },
          token
        );

        if (cmsImageUrl && !options?.editMode) {
          console.log('[bg] Using CMS/ContentVersion image for', setting, '→', cmsImageUrl);
          cacheRef.current[cacheKey] = cmsImageUrl;
          return cmsImageUrl;
        }
        if (!cmsImageUrl) {
          console.log('[bg] CMS returned null for', setting, '— will generate');
        }
      } catch (err) {
        console.warn('CMS background lookup failed:', err);
      }

      // 4. If provider is cms-only or none, skip generation
      if (provider === 'cms-only' || provider === 'none') {
        return cmsImageUrl || getFallbackGradient(setting);
      }

      // 5. Try image generation/editing — only for novel prompts or edit mode
      try {
        let imageUrl: string;

        // For edit mode, find a seed image (CMS result or pre-seeded local asset)
        let seedImage = cmsImageUrl;
        if (options?.editMode && !seedImage) {
          const { findPreseeded, preseededExists } = await import('@/data/preseededBackgrounds');
          const preseeded = findPreseeded(setting);
          if (preseeded && await preseededExists(preseeded)) {
            seedImage = preseeded.path;
          }
        }

        const rawPrompt = options?.backgroundPrompt || options?.editPrompt;
        let generationPrompt: string | undefined;
        if (rawPrompt) {
          const { wrapAgentPrompt } = await import('@/services/firefly/prompts');
          generationPrompt = wrapAgentPrompt(rawPrompt);
        }

        if (provider === 'imagen') {
          const { getImagenClient } = await import('@/services/imagen/client');
          const client = getImagenClient();

          if (options?.editMode && seedImage && generationPrompt) {
            imageUrl = await client.editSceneBackground(seedImage, generationPrompt);
          } else if (generationPrompt) {
            imageUrl = await client.generateFromPrompt(generationPrompt);
          } else {
            imageUrl = await client.generateSceneBackground(setting, products);
          }
        } else if (provider === 'firefly') {
          const { getFireflyClient } = await import('@/services/firefly/client');
          if (generationPrompt) {
            imageUrl = await getFireflyClient().generateFromPrompt(generationPrompt);
          } else {
            imageUrl = await getFireflyClient().generateSceneBackground(setting, products);
          }
        } else {
          return getFallbackGradient(setting);
        }

        cacheRef.current[cacheKey] = imageUrl;

        // Persist to CMS + Scene Registry in background (fire-and-forget)
        (async () => {
          try {
            const { getAgentforceClient } = await import('@/services/agentforce/client');
            const tok = await getAgentforceClient().getAccessToken();

            if (import.meta.env.VITE_CMS_CHANNEL_ID) {
              const { uploadImageToCmsAsync } = await import('@/services/cms/uploadAsset');
              const cmsTags = [`scene-${setting}`];
              if (options?.editMode) cmsTags.push('edited');
              const cmsTitle = options?.editMode ? `Scene ${setting} (edited)` : `Scene ${setting}`;
              uploadImageToCmsAsync(imageUrl, cmsTitle, cmsTags, tok);
            }

            const { registerGeneratedScene } = await import('@/services/sceneRegistry/client');
            await registerGeneratedScene({
              setting,
              mood: options?.mood,
              customerContext: options?.customerContext,
              sceneType: options?.sceneType || 'product',
              prompt: options?.backgroundPrompt || options?.editPrompt || `Scene for ${setting}`,
              imageUrl,
              isEdited: !!options?.editMode,
            }, tok);
          } catch { /* write-back is best-effort */ }
        })();

        return imageUrl;
      } catch (error) {
        console.error(`Background generation failed (${provider}):`, error);
        return cmsImageUrl || getFallbackGradient(setting);
      }
    },
    []
  );

  return { generateBackground };
}
