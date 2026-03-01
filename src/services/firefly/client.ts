import { SCENE_PROMPTS, buildScenePrompt } from './prompts';
import type { SceneSetting } from '@/types/scene';
import type { Product } from '@/types/product';
import type { FireflyConfig, GenerationOptions } from './types';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // 60s max wait

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

  /**
   * Poll for an async job result.
   * The generate-async endpoint returns a jobId; poll /status/{jobId} until done.
   */
  private async pollForResult(jobId: string, token: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const statusRes = await fetch(`/api/firefly/status/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-api-key': this.config.clientId,
        },
      });

      if (!statusRes.ok) {
        console.warn(`[firefly] Status poll ${attempt + 1} returned ${statusRes.status}`);
        continue;
      }

      const status = await statusRes.json();
      console.log(`[firefly] Job ${jobId} status: ${status.status}`);

      if (status.status === 'succeeded') {
        const imageUrl = status.result?.outputs?.[0]?.image?.presignedUrl
          || status.result?.outputs?.[0]?.image?.url
          || status.outputs?.[0]?.image?.presignedUrl
          || status.outputs?.[0]?.image?.url
          || status.result?.images?.[0]?.url;

        if (!imageUrl) {
          console.error('[firefly] Job succeeded but no image URL in result:', status);
          throw new Error('Firefly job succeeded but returned no image URL');
        }
        return imageUrl;
      }

      if (status.status === 'failed' || status.status === 'cancelled') {
        throw new Error(`Firefly job ${status.status}: ${status.message || status.error_code || 'unknown error'}`);
      }

      // status === 'running' or 'cancel_pending' — keep polling
    }

    throw new Error(`Firefly job timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
  }

  /**
   * Submit an async generate request and poll for the result.
   * Uses Firefly Image Model 4 via the generate-async endpoint.
   */
  private async generateAsync(prompt: string, width: number, height: number): Promise<string> {
    const token = await this.getAccessToken();

    // Submit async generation job
    const response = await fetch('/api/firefly/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': this.config.clientId,
        'x-model-version': 'image4_standard',
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
      throw new Error(`Firefly generate-async failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log('[firefly] Async job submitted:', data);

    const jobId = data.jobId;
    if (!jobId) {
      // Fallback: if API returned a synchronous response (image3 compat)
      const imageUrl = data.outputs?.[0]?.image?.presignedUrl
        || data.outputs?.[0]?.image?.url
        || data.images?.[0]?.url;
      if (imageUrl) return imageUrl;
      throw new Error('Firefly returned no jobId or image URL');
    }

    // Poll for result
    return this.pollForResult(jobId, token);
  }

  async generateSceneBackground(
    setting: SceneSetting,
    products: Product[],
    options: GenerationOptions = {}
  ): Promise<string> {
    const {
      width = 2688,
      height = 1536,
    } = options;

    const prompt = buildScenePrompt(setting);
    return this.generateAsync(prompt, width, height);
  }

  /** Generate from a raw prompt string (no setting mapping). */
  async generateFromPrompt(prompt: string): Promise<string> {
    return this.generateAsync(prompt, 2688, 1536);
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
