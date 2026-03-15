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

import { unzipSync } from 'fflate';
import type { SkinAnalysisResult, SkinConcernScore } from '@/types/skinanalysis';
import { getGeminiClient } from '@/services/gemini/client';

/** HD dst_actions to request — all HD (cannot mix HD + SD). */
const HD_ACTIONS = [
  'hd_wrinkle', 'hd_pore', 'hd_texture', 'hd_acne', 'hd_oiliness',
  'hd_radiance', 'hd_eye_bag', 'hd_age_spot', 'hd_dark_circle',
  'hd_firmness', 'hd_moisture', 'hd_redness', 'hd_skin_type',
];

/** Maps Perfect Corp HD action result keys → our internal concern keys + labels. */
const HD_CONCERN_MAP: Record<string, { key: string; label: string }> = {
  hd_acne:        { key: 'acne',        label: 'Acne' },
  hd_wrinkle:     { key: 'wrinkle',     label: 'Wrinkles' },
  hd_dark_circle: { key: 'dark_circle', label: 'Dark Circles' },
  hd_eye_bag:     { key: 'eye_bag',     label: 'Eye Bags' },
  hd_pore:        { key: 'pore',        label: 'Enlarged Pores' },
  hd_age_spot:    { key: 'spot',        label: 'Dark Spots' },
  hd_redness:     { key: 'redness',     label: 'Redness' },
  hd_texture:     { key: 'texture',     label: 'Uneven Texture' },
  hd_oiliness:    { key: 'oiliness',    label: 'Oiliness' },
  hd_moisture:    { key: 'hydration',   label: 'Dehydration' },
  hd_firmness:    { key: 'firmness',    label: 'Loss of Firmness' },
  hd_radiance:    { key: 'radiance',    label: 'Dullness' },
  hd_skin_type:   { key: 'skin_type',   label: 'Skin Type' },
};

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
    const { fileId, uploadUrl, uploadHeaders } = await this.createFileSlot(imageFile);

    // Step 2: PUT image directly to pre-signed URL (no proxy needed)
    await this.uploadToPresignedUrl(imageFile, uploadUrl, uploadHeaders);

    // Step 3: Submit task with file_id + concerns → task_id
    const taskId = await this.submitTask(fileId);

    // Step 4: Poll until complete
    const raw = await this.pollTask(taskId);

    return this.normalizeResult(raw);
  }

  private async createFileSlot(imageFile: File): Promise<{ fileId: string; uploadUrl: string; uploadHeaders: Record<string, string> }> {
    const res = await fetch('/api/perfectcorp/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [{ file_name: imageFile.name, content_type: imageFile.type || 'image/jpeg', file_size: imageFile.size }] }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Perfect Corp file slot failed (${res.status}): ${err}`);
    }
    const json = await res.json();
    // Response: { status, data: { files: [{ file_id, requests: [{ method, url }] }] } }
    const fileEntry = json?.data?.files?.[0] as Record<string, unknown> | undefined;
    const uploadUrl = (fileEntry?.requests as Array<{ url: string }>)?.[0]?.url;
    if (!fileEntry?.file_id || !uploadUrl) {
      throw new Error(`Perfect Corp: missing file_id/upload_url: ${JSON.stringify(json).substring(0, 300)}`);
    }
    return {
      fileId: fileEntry.file_id as string,
      uploadUrl,
      uploadHeaders: {},
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
    const taskBody = { src_file_id: fileId, dst_actions: HD_ACTIONS };
    console.log('[perfectcorp] submitTask body:', JSON.stringify(taskBody));
    const res = await fetch('/api/perfectcorp/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskBody),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Perfect Corp task submission failed (${res.status}): ${err}`);
    }
    const json = await res.json();
    // Response: { status, task_id, polling_interval }
    const taskId = json?.task_id ?? json?.data?.task_id ?? json?.result?.task_id;
    if (!taskId) throw new Error(`Perfect Corp: no task_id: ${JSON.stringify(json).substring(0, 300)}`);
    return taskId as string;
  }

  private async pollTask(taskId: string, maxWaitMs = 60_000): Promise<Record<string, unknown>> {
    const interval = 2000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));

      const res = await fetch('/api/perfectcorp/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!res.ok) continue;

      const json = await res.json();
      const taskStatus = json?.task_status ?? json?.data?.task_status ?? json?.result?.task_status;
      console.log('[perfectcorp] poll status:', taskStatus);
      if (taskStatus === 'success') {
        // Results come as a ZIP URL — fetch and extract client-side
        const zipUrl = json?.data?.results?.url ?? json?.results?.url;
        if (zipUrl) {
          console.log('[perfectcorp] fetching results ZIP...');
          const zipRes = await fetch(zipUrl);
          const zipBuf = new Uint8Array(await zipRes.arrayBuffer());
          const files = unzipSync(zipBuf);
          console.log('[perfectcorp] ZIP entries:', Object.keys(files).join(', '));
          const jsonKey = Object.keys(files).find((k) => k.endsWith('.json'));
          if (!jsonKey) throw new Error(`No JSON entry in ZIP: ${Object.keys(files).join(', ')}`);
          console.log('[perfectcorp] ZIP JSON entry:', jsonKey);
          const scores = JSON.parse(new TextDecoder().decode(files[jsonKey]));
          console.log('[perfectcorp] scores keys:', Object.keys(scores).join(', '));
          // Merge scores into the results block
          if (json?.data?.results) json.data.results = { ...json.data.results, ...scores };
          else if (json?.results) json.results = { ...json.results, ...scores };
        }
        return json as Record<string, unknown>;
      }
      if (taskStatus === 'error') {
        throw new Error(`Perfect Corp analysis failed: ${JSON.stringify(json)}`);
      }
    }

    throw new Error('Perfect Corp analysis timed out after 60 seconds');
  }

  // ─── Result normalisation ─────────────────────────────────────────────────

  private normalizeResult(raw: Record<string, unknown>): SkinAnalysisResult {
    // V2.0 poll response: { status, task_status, results: { url, hd_acne: {score}, ... } }
    // or results may only contain { url } pointing to a JSON file with the actual scores
    console.log('[perfectcorp] raw poll response:', JSON.stringify(raw).substring(0, 800));
    const resultsBlock = (raw.results ?? (raw.data as Record<string, unknown>)?.results ?? {}) as Record<string, unknown>;
    console.log('[perfectcorp] results keys:', Object.keys(resultsBlock).join(', '));

    const concerns: SkinConcernScore[] = HD_ACTIONS.map((action) => {
      const mapping = HD_CONCERN_MAP[action];
      const resultEntry = resultsBlock[action] as Record<string, unknown> | undefined;
      // score may be a float 0-1 or an object with a score property
      const raw_score = typeof resultEntry === 'number'
        ? resultEntry
        : (resultEntry?.score as number) ?? 0;
      const score = Math.round(raw_score * 100);
      return {
        concern: mapping?.key ?? action,
        label: mapping?.label ?? action,
        score,
        severity: scoreToseverity(score),
      };
    });

    const topConcern = concerns
      .filter((c) => c.severity !== 'none')
      .sort((a, b) => b.score - a.score)[0];

    const avgConcernScore = concerns.reduce((s, c) => s + c.score, 0) / concerns.length;
    const overallScore = Math.max(0, Math.round(100 - avgConcernScore));

    // hd_skin_type result is a string, not a score
    const skinTypeEntry = resultsBlock.hd_skin_type as Record<string, unknown> | string | undefined;
    const skinTypeRaw = typeof skinTypeEntry === 'string' ? skinTypeEntry : (skinTypeEntry?.skin_type as string) ?? 'normal';

    return {
      skinType: skinTypeRaw as SkinAnalysisResult['skinType'],
      skinAge: (resultsBlock.skin_age as number) ?? 0,
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
