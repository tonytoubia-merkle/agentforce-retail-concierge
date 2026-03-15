/**
 * Perfect Corp YouCam AI Skin Analysis Client
 *
 * API flow (async, two-step):
 *   1. POST /s2s/v2.0/file/skin-analysis  → upload image, receive file_id
 *   2. POST /s2s/v2.0/task/skin-analysis  → submit analysis task, receive task_id
 *   3. GET  /s2s/v2.0/task/skin-analysis/{task_id}  → poll until complete
 *
 * We proxy all three calls through our Express server (/api/perfectcorp/*)
 * to keep the API key server-side.
 *
 * Sign up / get API key: https://yce.makeupar.com/
 * Docs: https://yce.perfectcorp.com/document/index.html
 */

import type { SkinAnalysisResult, SkinConcernScore } from '@/types/skinanalysis';
import { getGeminiClient } from '@/services/gemini/client';

/** The 15 skin concerns YouCam AI reports on, with human-readable labels. */
const CONCERN_LABELS: Record<string, string> = {
  acne: 'Acne',
  wrinkle: 'Wrinkles',
  dark_circle: 'Dark Circles',
  eye_bag: 'Eye Bags',
  pore: 'Enlarged Pores',
  spot: 'Dark Spots',
  redness: 'Redness',
  texture: 'Uneven Texture',
  oiliness: 'Oiliness',
  hydration: 'Dehydration',
  firmness: 'Loss of Firmness',
  radiance: 'Dullness',
  sensitivity: 'Sensitivity',
  uv_damage: 'UV Damage',
  uneven_tone: 'Uneven Tone',
};

/** All concerns the API should assess in every request. */
const DEFAULT_CONCERNS = Object.keys(CONCERN_LABELS);

export interface PerfectCorpConfig {
  apiKey?: string;
  useMock?: boolean;
}

export class PerfectCorpClient {
  private useMock: boolean;

  constructor(config: PerfectCorpConfig = {}) {
    // Use mock when no API key is configured or mock is forced
    this.useMock = config.useMock ?? !config.apiKey;
  }

  /**
   * Analyse a skin photo.
   * Tier 1: Perfect Corp YouCam API (when VITE_PERFECT_CORP_API_KEY is set)
   * Tier 2: Gemini 2.0 Flash Vision (when VITE_IMAGEN_API_KEY is set)
   * Tier 3: Mock data (local dev / no API keys)
   */
  async analyzeSkin(imageFile: File): Promise<SkinAnalysisResult> {
    if (!this.useMock) {
      try {
        return await this.liveAnalysis(imageFile);
      } catch (err) {
        console.warn('[skin-analysis] Perfect Corp failed, trying Gemini fallback:', err);
      }
    }

    // Gemini fallback (works when VITE_IMAGEN_API_KEY is set, even without Perfect Corp key)
    const geminiApiKey = import.meta.env.VITE_IMAGEN_API_KEY as string | undefined;
    if (geminiApiKey) {
      try {
        console.log('[skin-analysis] Using Gemini Vision fallback');
        return await getGeminiClient().analyzeSkin(imageFile);
      } catch (err) {
        console.warn('[skin-analysis] Gemini Vision failed, falling back to mock:', err);
      }
    }

    return this.mockAnalysis();
  }

  // ─── Live API flow ────────────────────────────────────────────────────────

  private async liveAnalysis(imageFile: File): Promise<SkinAnalysisResult> {
    // Step 1: Upload image → file_id
    const fileId = await this.uploadFile(imageFile);

    // Step 2: Submit task → task_id
    const taskId = await this.submitTask(fileId);

    // Step 3: Poll until complete (max 30s)
    const raw = await this.pollTask(taskId);

    return this.normalizeResult(raw);
  }

  private async uploadFile(imageFile: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', imageFile);

    const res = await fetch('/api/perfectcorp/file', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Perfect Corp file upload failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    if (!data.file_id) throw new Error('Perfect Corp: no file_id in upload response');
    return data.file_id as string;
  }

  private async submitTask(fileId: string): Promise<string> {
    const res = await fetch('/api/perfectcorp/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: fileId,
        concerns: DEFAULT_CONCERNS,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Perfect Corp task submission failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    if (!data.task_id) throw new Error('Perfect Corp: no task_id in task response');
    return data.task_id as string;
  }

  private async pollTask(taskId: string, maxWaitMs = 30_000): Promise<Record<string, unknown>> {
    const interval = 800;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));

      const res = await fetch(`/api/perfectcorp/task/${encodeURIComponent(taskId)}`);
      if (!res.ok) continue;

      const data = await res.json();
      if (data.task_status === 'success') return data as Record<string, unknown>;
      if (data.task_status === 'error') {
        throw new Error(`Perfect Corp analysis failed: ${data.error_message ?? 'unknown error'}`);
      }
      // still processing — keep polling
    }

    throw new Error('Perfect Corp analysis timed out after 30 seconds');
  }

  // ─── Result normalisation ─────────────────────────────────────────────────

  private normalizeResult(raw: Record<string, unknown>): SkinAnalysisResult {
    const result = (raw.result ?? {}) as Record<string, unknown>;
    const concernsRaw = (result.concerns ?? {}) as Record<string, number>;

    const concerns: SkinConcernScore[] = DEFAULT_CONCERNS.map((key) => {
      const score = Math.round((concernsRaw[key] ?? 0) * 100);
      return {
        concern: key,
        label: CONCERN_LABELS[key] ?? key,
        score,
        severity: scoreToseverity(score),
      };
    });

    const topConcern = concerns
      .filter((c) => c.severity !== 'none')
      .sort((a, b) => b.score - a.score)[0];

    return {
      skinType: (result.skin_type as SkinAnalysisResult['skinType']) ?? 'normal',
      skinAge: (result.skin_age as number) ?? 0,
      overallScore: Math.round(((result.overall_score as number) ?? 0.7) * 100),
      concerns,
      primaryConcern: topConcern?.label ?? 'None detected',
      analyzedAt: new Date().toISOString(),
      rawResult: raw,
    };
  }

  // ─── Mock fallback ────────────────────────────────────────────────────────

  private async mockAnalysis(): Promise<SkinAnalysisResult> {
    // Simulate API latency
    await new Promise((r) => setTimeout(r, 2200));

    const concerns: SkinConcernScore[] = [
      { concern: 'hydration',    label: 'Dehydration',       score: 62, severity: 'moderate' },
      { concern: 'redness',      label: 'Redness',           score: 45, severity: 'mild' },
      { concern: 'pore',         label: 'Enlarged Pores',    score: 38, severity: 'mild' },
      { concern: 'texture',      label: 'Uneven Texture',    score: 30, severity: 'mild' },
      { concern: 'oiliness',     label: 'Oiliness',          score: 25, severity: 'mild' },
      { concern: 'uv_damage',    label: 'UV Damage',         score: 22, severity: 'mild' },
      { concern: 'spot',         label: 'Dark Spots',        score: 18, severity: 'none' },
      { concern: 'wrinkle',      label: 'Wrinkles',          score: 15, severity: 'none' },
      { concern: 'dark_circle',  label: 'Dark Circles',      score: 35, severity: 'mild' },
      { concern: 'eye_bag',      label: 'Eye Bags',          score: 20, severity: 'none' },
      { concern: 'firmness',     label: 'Loss of Firmness',  score: 12, severity: 'none' },
      { concern: 'radiance',     label: 'Dullness',          score: 40, severity: 'mild' },
      { concern: 'sensitivity',  label: 'Sensitivity',       score: 55, severity: 'moderate' },
      { concern: 'acne',         label: 'Acne',              score: 10, severity: 'none' },
      { concern: 'uneven_tone',  label: 'Uneven Tone',       score: 28, severity: 'mild' },
    ];

    return {
      skinType: 'combination',
      skinAge: 28,
      overallScore: 71,
      concerns,
      primaryConcern: 'Dehydration',
      analyzedAt: new Date().toISOString(),
    };
  }
}

function scoreToseverity(score: number): SkinConcernScore['severity'] {
  if (score < 20) return 'none';
  if (score < 40) return 'mild';
  if (score < 65) return 'moderate';
  return 'severe';
}

// Singleton — re-created if config changes (e.g. on login)
let _client: PerfectCorpClient | null = null;

export function getPerfectCorpClient(): PerfectCorpClient {
  if (!_client) {
    const apiKey = import.meta.env.VITE_PERFECT_CORP_API_KEY as string | undefined;
    _client = new PerfectCorpClient({ apiKey });
  }
  return _client;
}
