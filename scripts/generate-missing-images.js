/**
 * Generate images for products currently using no-image.png placeholder.
 *
 * This script:
 *   1. Parses products.ts to find products with no-image.png
 *   2. Generates product images using Google Imagen 4
 *   3. Saves with white background (NO background removal)
 *   4. Updates products.ts to reference the new images
 *
 * Usage:
 *   # Preview what will be generated (dry run):
 *   node scripts/generate-missing-images.js --dry-run
 *
 *   # Generate first 2 as test:
 *   node scripts/generate-missing-images.js --test
 *
 *   # Generate all missing images:
 *   node scripts/generate-missing-images.js
 *
 *   # Generate specific product by ID:
 *   node scripts/generate-missing-images.js --only cleanser-gentle
 *
 * Prerequisites:
 *   - VITE_IMAGEN_API_KEY in .env.local (Google AI API key)
 *
 * Note: Imagen has a daily quota (~50-70 requests). If you hit the limit,
 * wait until midnight PT for it to reset.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PRODUCTS_DIR = join(ROOT, 'public', 'assets', 'products');
const PRODUCTS_TS = join(ROOT, 'src', 'mocks', 'products.ts');

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
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const ONLY_IDX = process.argv.indexOf('--only');
const ONLY_ID = ONLY_IDX !== -1 ? process.argv[ONLY_IDX + 1] : null;

// ─── Brand styling ──────────────────────────────────────────────
const brandStyles = {
  SERENE: {
    aesthetic: 'calm, spa-like, zen, minimalist',
    colors: 'soft sage green, cream white, muted earth tones, pale mint',
    materials: 'frosted glass, matte ceramic, natural textures, soft-touch plastic',
    vibe: 'clean Korean skincare aesthetic, minimalist Japanese design, soothing'
  },
  LUMIERE: {
    aesthetic: 'luxurious, radiant, sophisticated, glamorous',
    colors: 'rose gold, champagne, soft pink, pearl white, blush',
    materials: 'glossy glass, metallic gold accents, reflective surfaces, crystal',
    vibe: 'high-end French beauty, elegant Parisian, luminous glow'
  },
  DERMAFIX: {
    aesthetic: 'clinical, professional, scientific, medical-grade',
    colors: 'clean white, medical blue, sterile silver, pharmaceutical green',
    materials: 'pharmaceutical-grade packaging, medical tubes, clinical bottles, lab-style',
    vibe: 'dermatologist-recommended, science-backed, no-frills efficacy'
  },
  MAISON: {
    aesthetic: 'artisanal, boutique, refined, heritage',
    colors: 'deep amber, rich burgundy, warm gold, cream, mahogany',
    materials: 'heavy glass, wooden accents, artisan crafted, vintage brass',
    vibe: 'niche perfumery, handcrafted luxury, European heritage, old-world charm'
  }
};

// ─── Category hints ─────────────────────────────────────────────
const categoryHints = {
  moisturizer: 'a sleek jar or pump bottle of face moisturizer cream',
  cleanser: 'a minimalist bottle or tube of facial cleanser',
  serum: 'an elegant glass dropper bottle of facial serum',
  sunscreen: 'a modern tube or bottle of sunscreen with SPF',
  toner: 'a slim bottle of facial toner or essence',
  mask: 'a jar or tube of facial mask treatment',
  'eye-cream': 'a small elegant jar or tube of eye cream',
  lipstick: 'a luxury lipstick tube',
  foundation: 'a bottle or compact of foundation makeup',
  mascara: 'a mascara tube with wand applicator',
  blush: 'a compact of powder blush or cheek color',
  fragrance: 'an elegant perfume or cologne bottle with cap',
  shampoo: 'a bottle of premium shampoo',
  conditioner: 'a bottle of premium hair conditioner',
  'hair-treatment': 'a bottle or tube of hair treatment product',
  'travel-kit': 'a travel-sized beauty product',
  'spot-treatment': 'a small tube or bottle of spot treatment',
  exfoliant: 'a jar or tube of facial exfoliant',
  powder: 'a compact of setting powder or face powder',
  'brow-gel': 'a brow gel tube with spoolie applicator',
};

// ─── Parse products.ts ──────────────────────────────────────────
function parseProductsTs() {
  const content = readFileSync(PRODUCTS_TS, 'utf-8');
  const products = [];

  // Match each product object
  const productRegex = /\{\s*id:\s*['"]([^'"]+)['"][^}]*?name:\s*['"]([^'"]+)['"][^}]*?brand:\s*['"]([^'"]+)['"][^}]*?category:\s*['"]([^'"]+)['"][^}]*?description:\s*['"]([^'"]+)['"][^}]*?imageUrl:\s*['"]([^'"]+)['"][^}]*?\}/gs;

  let match;
  while ((match = productRegex.exec(content)) !== null) {
    products.push({
      id: match[1],
      name: match[2],
      brand: match[3],
      category: match[4],
      description: match[5],
      imageUrl: match[6],
    });
  }

  return products;
}

// ─── Build prompt ───────────────────────────────────────────────
function buildPrompt(product) {
  const { name, brand, category, description } = product;

  const productType = categoryHints[category] || 'a premium beauty product';
  const descSnippet = (description || '').slice(0, 120);

  const brandStyle = brandStyles[brand] || {
    aesthetic: 'premium, modern, clean',
    colors: 'neutral tones, white, silver, soft pastels',
    materials: 'high-quality packaging, sleek design',
    vibe: 'luxury beauty brand, sophisticated'
  };

  return [
    `Product photography of ${productType}.`,
    `Product name: "${name}" by ${brand}.`,
    descSnippet ? `Product description: ${descSnippet}.` : '',
    `Brand aesthetic: ${brandStyle.aesthetic}.`,
    `Brand colors: ${brandStyle.colors}.`,
    `Packaging materials: ${brandStyle.materials}.`,
    `Overall vibe: ${brandStyle.vibe}.`,
    `The product packaging should have a visible label showing the product name and brand.`,
    '',
    `CRITICAL BACKGROUND REQUIREMENTS:`,
    `- Pure white (#FFFFFF) background`,
    `- ZERO shadows of any kind`,
    `- ZERO drop shadows`,
    `- ZERO cast shadows`,
    `- ZERO ambient occlusion`,
    `- ZERO reflections`,
    `- ZERO gradients`,
    `- NO floor, NO surface, NO ground plane`,
    `- Product floating in infinite white void`,
    `- Even, flat, shadowless studio lighting from all directions`,
    `- Clean centered composition`,
    `- Single product only`,
    `- No props, no decorations, no text overlays, no watermarks`,
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

// ─── Update products.ts ─────────────────────────────────────────
function updateProductsTs(productId, newImageFile) {
  let content = readFileSync(PRODUCTS_TS, 'utf-8');

  // Find and replace the imageUrl for this product
  // This is a bit tricky because we need to find the right product block
  const oldUrl = '/assets/products/no-image.png';
  const newUrl = `/assets/products/${newImageFile}`;

  // Find the product by id and replace its imageUrl
  const idPattern = new RegExp(`(id:\\s*['"]${productId}['"][^}]*?imageUrl:\\s*['"])${oldUrl.replace(/\//g, '\\/')}(['"])`, 's');
  content = content.replace(idPattern, `$1${newUrl}$2`);

  // Also update the images array
  const imagesPattern = new RegExp(`(id:\\s*['"]${productId}['"][^}]*?images:\\s*\\[['"])${oldUrl.replace(/\//g, '\\/')}(['"]\\])`, 's');
  content = content.replace(imagesPattern, `$1${newUrl}$2`);

  writeFileSync(PRODUCTS_TS, content);
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  Missing Product Image Generator (Imagen 4)              ║`);
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (will generate images)'}                       ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  if (!DRY_RUN && !API_KEY) {
    console.error('❌ Missing VITE_IMAGEN_API_KEY in .env.local');
    process.exit(1);
  }

  // Parse products.ts
  const allProducts = parseProductsTs();
  console.log(`📦 Found ${allProducts.length} products in products.ts\n`);

  // Filter to products using no-image.png
  let queue = allProducts.filter(p => p.imageUrl.includes('no-image.png'));

  if (ONLY_ID) {
    queue = queue.filter(p => p.id === ONLY_ID);
    if (queue.length === 0) {
      console.log(`❌ Product "${ONLY_ID}" not found or doesn't use no-image.png`);
      process.exit(1);
    }
  }

  if (TEST_MODE) {
    queue = queue.slice(0, 2);
    console.log(`🧪 TEST MODE — generating 2 images only\n`);
  }

  console.log(`📋 Products needing images: ${queue.length}`);
  console.log(`─────────────────────────────────────────────────────────────`);
  queue.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.id} → ${p.id}.png`);
    console.log(`      "${p.name}" (${p.brand})`);
  });
  console.log(`─────────────────────────────────────────────────────────────\n`);

  if (DRY_RUN) {
    console.log(`\n✋ Dry run complete. Run without --dry-run to generate images.`);
    return;
  }

  if (queue.length === 0) {
    console.log('✅ Nothing to generate — all products have images!');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const product = queue[i];
    const outputFile = `${product.id}.png`;
    const outputPath = join(PRODUCTS_DIR, outputFile);

    console.log(`\n[${i + 1}/${queue.length}] ${product.name}`);
    console.log(`   Brand: ${product.brand} | Category: ${product.category}`);

    const prompt = buildPrompt(product);
    console.log(`   Prompt: ${prompt.slice(0, 100)}...`);

    try {
      console.log(`   ⏳ Generating with Imagen 4...`);
      const imageBuffer = await generateImage(prompt);
      const sizeKB = (imageBuffer.length / 1024).toFixed(0);

      // Save the image
      writeFileSync(outputPath, imageBuffer);
      console.log(`   ✅ Saved: ${outputFile} (${sizeKB} KB)`);

      // Update products.ts
      updateProductsTs(product.id, outputFile);
      console.log(`   ✅ Updated products.ts`);

      success++;

      // Rate limit: ~10 req/min for free tier
      if (i < queue.length - 1) {
        console.log(`   ⏳ Waiting 7s (API rate limit)...`);
        await new Promise(r => setTimeout(r, 7000));
      }
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
      failed++;

      // Check if quota exhausted
      if (err.message.includes('429') || err.message.includes('quota')) {
        console.error(`\n⚠️  API quota likely exhausted. Try again after midnight PT.`);
        console.log(`   Generated: ${success}  Failed: ${failed}  Remaining: ${queue.length - i - 1}`);
        break;
      }

      // Wait longer on errors
      if (i < queue.length - 1) {
        await new Promise(r => setTimeout(r, 15000));
      }
    }
  }

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  Complete!                                               ║`);
  console.log(`║  Generated: ${String(success).padEnd(3)} | Failed: ${String(failed).padEnd(3)} | Total: ${String(queue.length).padEnd(3)}            ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  if (success > 0) {
    console.log(`📝 Don't forget to run the compression script after:\n`);
    console.log(`   node scripts/compress-product-images.cjs\n`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
