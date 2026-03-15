/**
 * Gemini generateContent client for image editing.
 *
 * Uses Gemini 2.5 Flash which supports image input + text prompt,
 * enabling real image editing (background removal, compositing, etc.)
 * unlike Imagen which only supports text-to-image generation.
 */

import { base64ToBlobUrl, imageUrlToBase64 } from '@/services/imagen/utils';
import type { SceneSetting } from '@/types/scene';
import type { SkinAnalysisResult, SkinConcernScore } from '@/types/skinanalysis';

interface GeminiConfig {
  apiKey: string;
}

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

export class GeminiClient {
  private config: GeminiConfig;

  constructor(config: GeminiConfig) {
    this.config = config;
  }

  /**
   * Send an image + text prompt to Gemini and get back an edited image.
   */
  private async editImage(imageBase64: string, prompt: string, mimeType = 'image/jpeg'): Promise<string> {
    console.log('[gemini] editImage request — prompt:', prompt.substring(0, 80), '...');
    const response = await fetch('/api/gemini/generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini generateContent failed (${response.status}): ${errText}`);
    }

    const data: GeminiResponse = await response.json();
    // Log raw response structure for debugging
    const rawParts = data.candidates?.[0]?.content?.parts;
    console.log('[gemini] response candidates:', data.candidates?.length ?? 0);
    if (rawParts) {
      console.log('[gemini] parts keys:', rawParts.map(p => Object.keys(p)));
    } else {
      console.error('[gemini] Full response:', JSON.stringify(data).substring(0, 1000));
      throw new Error('Gemini returned no content parts');
    }

    // Find the image part — check both inline_data and inlineData (API may use camelCase)
    const imagePart = rawParts.find((p: GeminiPart) =>
      p.inline_data?.data || (p as unknown as Record<string, { data?: string }>).inlineData?.data
    );
    const imageData = (imagePart as GeminiPart)?.inline_data
      || (imagePart as unknown as { inlineData?: { data: string; mime_type?: string; mimeType?: string } })?.inlineData;

    if (!imageData?.data) {
      console.error('[gemini] No image found. Raw parts:', JSON.stringify(rawParts).substring(0, 500));
      throw new Error('Gemini returned no image in response');
    }

    const mimeOut = imageData.mime_type
      || (imageData as unknown as { mimeType?: string }).mimeType
      || 'image/png';

    console.log('[gemini] editImage success — got image part, mime:', mimeOut);
    return base64ToBlobUrl(imageData.data, mimeOut);
  }

  /**
   * Remove the background from a product image, placing it on pure white.
   * This uses the actual product photo — Gemini can see the product and
   * isolate it from its background.
   */
  async removeBackground(productImageUrl: string): Promise<string> {
    const imageBase64 = await imageUrlToBase64(productImageUrl);

    return this.editImage(
      imageBase64,
      'Remove the background from this product image completely. Place the product on a perfectly pure solid white background (#FFFFFF). Keep the product exactly as it is — do not modify, reshape, or recolor the product itself. Only remove the background. The result should look like a professional e-commerce product photo on white.',
    );
  }

  /**
   * Edit a scene background image using a text instruction.
   * Takes a CMS scene image and applies edits (e.g., "add warm candlelight").
   */
  async editSceneBackground(seedImageUrl: string, editPrompt: string): Promise<string> {
    const imageBase64 = await imageUrlToBase64(seedImageUrl);

    return this.editImage(
      imageBase64,
      `${editPrompt}. Keep the overall scene composition. Do not add any products, bottles, or text. Professional interior photography quality.`,
    );
  }

  /**
   * Stage a product into a scene — remove background and prepare for compositing.
   * Returns a white-background product image that CSS mix-blend-mode: multiply
   * will composite onto the scene.
   */
  async stageProductInScene(
    productImageUrl: string,
    _setting: SceneSetting,
    _productName?: string
  ): Promise<string> {
    return this.removeBackground(productImageUrl);
  }

  /**
   * Analyse a skin photo using Gemini 2.0 Flash vision.
   * Returns a structured SkinAnalysisResult parsed from the model's JSON output.
   */
  async analyzeSkin(imageFile: File): Promise<SkinAnalysisResult> {
    const base64 = await fileToBase64(imageFile);
    const mimeType = imageFile.type || 'image/jpeg';

    const prompt = `You are a professional dermatologist AI. Analyze the skin in this photo and return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "skinType": "dry|oily|combination|normal|sensitive",
  "skinAge": <estimated skin age as integer>,
  "overallScore": <0-100 integer, higher is healthier>,
  "concerns": [
    { "concern": "hydration", "label": "Dehydration", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "redness", "label": "Redness", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "pore", "label": "Enlarged Pores", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "texture", "label": "Uneven Texture", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "oiliness", "label": "Oiliness", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "acne", "label": "Acne", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "wrinkle", "label": "Wrinkles", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "dark_circle", "label": "Dark Circles", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "spot", "label": "Dark Spots", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "radiance", "label": "Dullness", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "sensitivity", "label": "Sensitivity", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "uv_damage", "label": "UV Damage", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "firmness", "label": "Loss of Firmness", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "uneven_tone", "label": "Uneven Tone", "score": <0-100>, "severity": "none|mild|moderate|severe" },
    { "concern": "eye_bag", "label": "Eye Bags", "score": <0-100>, "severity": "none|mild|moderate|severe" }
  ]
}
Score each concern 0–100 (0 = not present, 100 = very severe). Set severity based on score: 0–19 = none, 20–39 = mild, 40–64 = moderate, 65+ = severe.`;

    const response = await fetch('/api/gemini/vision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini vision failed (${response.status}): ${errText}`);
    }

    const data: GeminiResponse = await response.json();
    const textPart = data.candidates?.[0]?.content?.parts?.find((p) => p.text);
    if (!textPart?.text) throw new Error('Gemini vision returned no text');

    const jsonText = textPart.text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonText) as {
      skinType: SkinAnalysisResult['skinType'];
      skinAge: number;
      overallScore: number;
      concerns: SkinConcernScore[];
    };

    const primaryConcern = parsed.concerns
      .filter((c) => c.severity !== 'none')
      .sort((a, b) => b.score - a.score)[0]?.label ?? 'None detected';

    return {
      skinType: parsed.skinType,
      skinAge: parsed.skinAge,
      overallScore: parsed.overallScore,
      concerns: parsed.concerns,
      primaryConcern,
      analyzedAt: new Date().toISOString(),
    };
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let geminiClient: GeminiClient | null = null;

export const getGeminiClient = (): GeminiClient => {
  if (!geminiClient) {
    geminiClient = new GeminiClient({
      apiKey: import.meta.env.VITE_IMAGEN_API_KEY || '',
    });
  }
  return geminiClient;
};
