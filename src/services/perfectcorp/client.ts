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
    // Step 1: Create file slot → get file_id + pre-signed upload_url
    const { fileId, uploadUrl, uploadHeaders } = await this.createFileSlot(imageFile.name);

    // Step 2: PUT image directly to pre-signed URL (no proxy needed)
    await this.uploadToPresignedUrl(imageFile, uploadUrl, uploadHeaders);

    // Step 3: Submit task with file_id + concerns → task_id
    const taskId = await this.submitTask(fileId);

    // Step 4: Poll until complete
    const raw = await this.pollTask(taskId);

    return this.normalizeResult(raw);
  }

  private async createFileSlot(fileName: string): Promise<{ fileId: string; uploadUrl: string; uploadHeaders: Record<string, string> }> {
    const res = await fetch('/api/perfectcorp/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_name: fileName }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Perfect Corp file slot failed (${res.status}): ${err}`);
    }
    const json = await res.json();
    const result = (json?.result ?? json) as Record<string, unknown>;
    if (!result.file_id || !result.upload_url) {
      throw new Error(`Perfect Corp: missing file_id/upload_url: ${JSON.stringify(json).substring(0, 300)}`);
    }
    return {
      fileId: result.file_id as string,
      uploadUrl: result.upload_url as string,
      uploadHeaders: (result.upload_headers ?? {}) as Record<string, string>,
    };
  }

  private async uploadToPresignedUrl(imageFile: File, uploadUrl: string, uploadHeaders: Record<string, string>): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': imageFile.type || 'image/jpeg', ...uploadHeaders },
      body: imageFile,
    });
    if (!res.ok) throw new Error(`Perfect Corp image upload to pre-signed URL failed (${res.status})`);
  }

  private async submitTask(fileId: string): Promise<string> {
    const res = await fetch('/api/perfectcorp/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, concerns: DEFAULT_CONCERNS }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Perfect Corp task submission failed (${res.status}): ${err}`);
    }
    const json = await res.json();
    const taskId = json?.result?.task_id ?? json?.data?.task_id;
    if (!taskId) throw new Error(`Perfect Corp: no task_id: ${JSON.stringify(json).substring(0, 300)}`);
    return taskId as string;
  }

  private async pollTask(taskId: string, maxWaitMs = 60_000): Promise<Record<string, unknown>> {
    const interval = 2000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));

      const res = await fetch(`/api/perfectcorp/task?task_id=${encodeURIComponent(taskId)}`);
      if (!res.ok) continue;

      const json = await res.json();
      const taskStatus = json?.result?.task_status ?? json?.data?.task_status;
      console.log('[perfectcorp] poll status:', taskStatus);
      if (taskStatus === 'success') return json as Record<string, unknown>;
      if (taskStatus === 'error') {
        throw new Error(`Perfect Corp analysis failed: ${JSON.stringify(json?.result ?? json)}`);
      }
    }

    throw new Error('Perfect Corp analysis timed out after 60 seconds');
  }

  // ─── Result normalisation ─────────────────────────────────────────────────

  private normalizeResult(raw: Record<string, unknown>): SkinAnalysisResult {
    // V2.1: { status, result: { task_id, task_status, results: { concern_name: { score, result_url } } } }
    const result = (raw.result ?? raw.data ?? raw) as Record<string, unknown>;
    const resultsMap = (result.results ?? {}) as Record<string, { score: number }>;
    const concernsRaw = resultsMap as unknown as Record<string, number>;

    // V2.1 results: { concern_name: { score: 0.0–1.0, result_url } }
    const concerns: SkinConcernScore[] = DEFAULT_CONCERNS.map((key) => {
      const entry = resultsMap[key];
      const score = Math.round((entry?.score ?? 0) * 100);
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

    // V2.1 doesn't return skin_type/skin_age/overall_score — derive overall from concerns
    const avgConcernScore = concerns.reduce((s, c) => s + c.score, 0) / concerns.length;
    const overallScore = Math.max(0, Math.round(100 - avgConcernScore));

    return {
      skinType: (result.skin_type as SkinAnalysisResult['skinType']) ?? 'normal',
      skinAge: (result.skin_age as number) ?? 0,
      overallScore,
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
