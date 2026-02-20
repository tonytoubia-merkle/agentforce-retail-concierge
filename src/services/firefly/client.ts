import { SCENE_PROMPTS, buildScenePrompt } from './prompts';
import type { SceneSetting } from '@/types/scene';
import type { Product } from '@/types/product';
import type { FireflyConfig, GenerationOptions } from './types';

export class FireflyClient {
  private config: FireflyConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: FireflyConfig) {
    this.config = config;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const response = await fetch('/api/firefly/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'openid,AdobeID,firefly_api,ff_apis',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Adobe OAuth failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Expire 5 minutes early
    this.tokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 86400_000) - 300_000;
    return this.accessToken!;
  }

  async generateSceneBackground(
    setting: SceneSetting,
    products: Product[],
    options: GenerationOptions = {}
  ): Promise<string> {
    // Firefly supported sizes: 2688x1536, 1344x768, 2048x2048, 1024x1024, etc.
    // Use 2688x1536 for wide hero banners (closest to 2:1 aspect ratio)
    const {
      width = 2688,
      height = 1536,
    } = options;

    const token = await this.getAccessToken();
    const prompt = buildScenePrompt(setting);

    const response = await fetch('/api/firefly/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': this.config.clientId,
        // Switch to 'image4_ultra' once API credentials are provisioned for Image Model 4
        // 'x-model-version': 'image4_ultra',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        contentClass: 'photo',
        size: { width, height },
        numVariations: 1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Firefly generation failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log('[firefly] Scene API response:', JSON.stringify(data).substring(0, 500));

    const imageUrl = data.outputs?.[0]?.image?.presignedUrl
      || data.outputs?.[0]?.image?.url
      || data.images?.[0]?.url
      || data.result?.images?.[0]?.url;

    if (!imageUrl) {
      console.error('[firefly] Could not find image URL in response:', data);
      throw new Error('Firefly returned no image URL');
    }

    return imageUrl;
  }

  /** Generate from a raw prompt string (no setting mapping). */
  async generateFromPrompt(prompt: string): Promise<string> {
    const token = await this.getAccessToken();

    const response = await fetch('/api/firefly/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': this.config.clientId,
        // Switch to 'image4_ultra' once API credentials are provisioned for Image Model 4
        // 'x-model-version': 'image4_ultra',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        contentClass: 'photo',
        size: { width: 2688, height: 1536 },
        numVariations: 1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Firefly generation failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log('[firefly] API response:', JSON.stringify(data).substring(0, 500));

    // Handle different response structures from Firefly API
    const imageUrl = data.outputs?.[0]?.image?.presignedUrl
      || data.outputs?.[0]?.image?.url
      || data.images?.[0]?.url
      || data.result?.images?.[0]?.url;

    if (!imageUrl) {
      console.error('[firefly] Could not find image URL in response:', data);
      throw new Error('Firefly returned no image URL');
    }

    return imageUrl;
  }
}

let fireflyClient: FireflyClient | null = null;

export const getFireflyClient = (): FireflyClient => {
  if (!fireflyClient) {
    fireflyClient = new FireflyClient({
      clientId: import.meta.env.VITE_FIREFLY_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_FIREFLY_CLIENT_SECRET || '',
    });
  }
  return fireflyClient;
};
