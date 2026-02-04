/**
 * Generate missing product images using Google Imagen 4 + background removal.
 *
 * Pipeline:
 *   1. Imagen generates product on pure white, no shadows
 *   2. Sharp converts white background → transparent alpha channel
 *   3. Saves as PNG with transparency
 *
 * Usage:
 *   # Generate first 2 test images:
 *   node scripts/generate-product-images.js --test
 *
 *   # Generate all missing images:
 *   node scripts/generate-product-images.js
 *
 *   # Generate a specific product by filename:
 *   node scripts/generate-product-images.js --only lipstick-satin.png
 *
 *   # Regenerate even if file exists:
 *   node scripts/generate-product-images.js --force --only lipstick-satin.png
 *
 *   # Skip background removal (keep white bg):
 *   node scripts/generate-product-images.js --no-remove-bg
 *
 * Prerequisites:
 *   - VITE_IMAGEN_API_KEY in .env.local (Google AI API key)
 *   - sharp (npm install --save-dev sharp)
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PRODUCTS_DIR = join(ROOT, 'public', 'assets', 'products');
const PRODUCT_JSON = join(ROOT, 'data', 'Product2.json');

const IMAGEN_MODEL = 'imagen-4.0-generate-001';
const IMAGEN_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`;

// ─── Load env ───────────────────────────────────────────────────
function loadEnv() {
  const env = { ...process.env };
  try {
    const content = readFileSync(join(ROOT, '.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      if (!env[key]) env[key] = trimmed.slice(eqIdx + 1);
    }
  } catch { /* .env.local not found */ }
  return env;
}

const env = loadEnv();
const API_KEY = env.VITE_IMAGEN_API_KEY;

// ─── CLI args ───────────────────────────────────────────────────
const TEST_MODE = process.argv.includes('--test');
const FORCE = process.argv.includes('--force');
const NO_REMOVE_BG = process.argv.includes('--no-remove-bg');
const ONLY_IDX = process.argv.indexOf('--only');
const ONLY_FILE = ONLY_IDX !== -1 ? process.argv[ONLY_IDX + 1] : null;

// ─── Prompt builder ─────────────────────────────────────────────
function buildPrompt(product) {
  const { Name, Category__c, Description__c, Brand__c } = product;

  const categoryHints = {
    Moisturizer: 'a sleek jar or pump bottle of face moisturizer cream',
    Cleanser: 'a minimalist bottle of facial cleanser',
    Serum: 'an elegant glass dropper bottle of facial serum',
    Sunscreen: 'a modern tube or bottle of sunscreen',
    Toner: 'a slim bottle of facial toner',
    Mask: 'a jar or packet of facial mask',
    'Eye Care': 'a small elegant tube or jar of eye cream',
    Lipstick: 'a luxury lipstick or lip product',
    Foundation: 'a bottle or compact of foundation makeup',
    Mascara: 'a mascara tube with wand',
    Blush: 'a compact of blush or cheek color',
    Fragrance: 'an elegant perfume or cologne bottle',
    Shampoo: 'a bottle of premium shampoo',
    Conditioner: 'a bottle of premium hair conditioner',
    Exfoliant: 'a jar or tube of facial exfoliant',
    'Spot Treatment': 'a small tube or bottle of spot treatment',
    Tool: 'a luxury beauty travel kit or pouch with beauty products',
  };

  const productType = categoryHints[Category__c] || 'a premium beauty product';
  const descSnippet = (Description__c || '').slice(0, 100);

  return [
    `Product-only cutout photograph of ${productType}.`,
    `Product: "${Name}" by ${Brand__c || 'a luxury brand'}.`,
    descSnippet ? `${descSnippet}.` : '',
    `Isolated on a perfectly flat, uniform, pure white (#FFFFFF) background.`,
    `Absolutely no shadows, no reflections, no gradients, no floor plane, no surface.`,
    `The product floats in pure white emptiness with even, flat, diffused lighting.`,
    `Clean centered composition. Single product only.`,
    `No text, no labels, no watermarks, no decorations.`,
  ].filter(Boolean).join(' ');
}

// ─── Imagen API ─────────────────────────────────────────────────
async function generateImage(prompt) {
  const res = await fetch(`${IMAGEN_ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '1:1',
        personGeneration: 'dont_allow',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Imagen API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const base64 = data.predictions?.[0]?.bytesBase64Encoded;

  if (!base64) {
    const reason = data.predictions?.[0]?.raiFilteredReason || 'unknown';
    throw new Error(`No image generated: ${reason}`);
  }

  return Buffer.from(base64, 'base64');
}

// ─── Background removal ────────────────────────────────────────
/**
 * Convert near-white pixels to transparent using sharp raw pixel access.
 *
 * Strategy:
 *   1. Get raw RGBA pixel data
 *   2. For each pixel, compute distance from white (255,255,255)
 *   3. If within threshold → fully transparent
 *   4. Soft edge: gradual transparency for pixels near the boundary
 *   5. Recompose as PNG with alpha
 */
async function removeWhiteBackground(imageBuffer) {
  const image = sharp(imageBuffer).ensureAlpha();
  const { data: rawData, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const pixels = Buffer.from(rawData); // mutable copy

  // Thresholds
  const HARD_THRESHOLD = 240;  // pixels with R,G,B all >= this → fully transparent
  const SOFT_THRESHOLD = 220;  // pixels in soft zone get partial transparency
  const EDGE_FEATHER = HARD_THRESHOLD - SOFT_THRESHOLD; // gradient range

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Check if pixel is near-white
    const minChannel = Math.min(r, g, b);

    if (minChannel >= HARD_THRESHOLD) {
      // Pure white zone → fully transparent
      pixels[i + 3] = 0;
    } else if (minChannel >= SOFT_THRESHOLD) {
      // Soft edge zone → gradual transparency
      const opacity = Math.round(((HARD_THRESHOLD - minChannel) / EDGE_FEATHER) * 255);
      pixels[i + 3] = Math.min(pixels[i + 3], opacity);
    }
    // else: keep original alpha (fully opaque)
  }

  return sharp(pixels, { raw: { width, height, channels } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error('Missing VITE_IMAGEN_API_KEY in .env.local');
    process.exit(1);
  }

  // Load product data
  const data = JSON.parse(readFileSync(PRODUCT_JSON, 'utf-8'));
  const existing = new Set(readdirSync(PRODUCTS_DIR));

  // Find products that need images
  let queue = data.records.filter(r => {
    if (!r.Image_URL__c) return false;
    const file = r.Image_URL__c.replace('/assets/products/', '');
    if (ONLY_FILE) return file === ONLY_FILE;
    if (!FORCE && existing.has(file)) return false;
    return true;
  });

  if (ONLY_FILE && FORCE) {
    // Allow regenerating specific file even if it exists
  } else if (ONLY_FILE) {
    queue = queue.filter(r => !existing.has(r.Image_URL__c.replace('/assets/products/', '')));
  }

  if (TEST_MODE) {
    queue = queue.slice(0, 2);
    console.log('TEST MODE — generating 2 images only\n');
  }

  console.log(`Product Image Generator (Imagen 4 + BG Removal)`);
  console.log(`══════════════════════════════════════`);
  console.log(`  Total products:  ${data.records.length}`);
  console.log(`  Existing images: ${existing.size}`);
  console.log(`  To generate:     ${queue.length}`);
  console.log(`  Remove BG:       ${NO_REMOVE_BG ? 'No' : 'Yes'}`);
  console.log(`══════════════════════════════════════\n`);

  if (queue.length === 0) {
    console.log('Nothing to generate!');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const product = queue[i];
    const file = product.Image_URL__c.replace('/assets/products/', '');
    const outPath = join(PRODUCTS_DIR, file);

    console.log(`[${i + 1}/${queue.length}] ${product.Name}`);

    const prompt = buildPrompt(product);
    console.log(`  Prompt: ${prompt.slice(0, 120)}...`);

    try {
      // Step 1: Generate with Imagen
      console.log(`  Generating...`);
      const rawImage = await generateImage(prompt);
      const rawSizeKB = (rawImage.length / 1024).toFixed(0);

      if (NO_REMOVE_BG) {
        writeFileSync(outPath, rawImage);
        console.log(`  ✓ Saved: ${file} (${rawSizeKB} KB, white bg)\n`);
      } else {
        // Step 2: Remove white background
        console.log(`  Removing background...`);
        const transparentImage = await removeWhiteBackground(rawImage);
        const finalSizeKB = (transparentImage.length / 1024).toFixed(0);
        writeFileSync(outPath, transparentImage);
        console.log(`  ✓ Saved: ${file} (${rawSizeKB} KB → ${finalSizeKB} KB transparent)\n`);
      }

      success++;

      // Rate limit: ~10 req/min for free tier
      if (i < queue.length - 1) {
        console.log(`  ⏳ Waiting 7s (API rate limit)...`);
        await new Promise(r => setTimeout(r, 7000));
      }
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}\n`);
      failed++;

      // Wait longer on errors (might be rate limited)
      if (i < queue.length - 1) {
        await new Promise(r => setTimeout(r, 15000));
      }
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`Done! Generated: ${success}  Failed: ${failed}`);
  console.log(`══════════════════════════════════════`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
