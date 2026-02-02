/**
 * One-time script to generate static background images via Imagen 4.
 * Run: node scripts/generate-backgrounds.js
 *
 * Generates 3 variants per scene setting and saves to public/assets/backgrounds/.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'public/assets/backgrounds');

// Load API key from .env.local
function loadApiKey() {
  const envPath = resolve(ROOT, '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_IMAGEN_API_KEY=')) {
      return trimmed.slice('VITE_IMAGEN_API_KEY='.length);
    }
  }
  throw new Error('VITE_IMAGEN_API_KEY not found in .env.local');
}

const API_KEY = loadApiKey();
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${API_KEY}`;

const SETTINGS = {
  neutral: 'Elegant minimalist empty surface with soft bokeh lights in the background, sophisticated neutral tones, studio lighting, clean uncluttered space',
  bathroom: 'Luxurious modern bathroom counter with white marble surface, soft natural light, potted eucalyptus plant, high-end spa aesthetic, empty counter',
  travel: 'Stylish hotel room with a leather carry-on suitcase on a bed, warm golden hour light, wanderlust travel aesthetic',
  outdoor: 'Fresh outdoor wooden table with lush green foliage, dappled sunlight, healthy active lifestyle setting, empty table surface',
  lifestyle: 'Sophisticated vanity dresser with round mirror, soft pink and cream tones, natural daylight from a large window, clean empty surface',
  bedroom: 'Cozy bedroom nightstand with warm amber lamp light, soft linen textures, dark moody evening atmosphere, a small empty tray',
  vanity: 'Glamorous makeup vanity station with Hollywood mirror lights, velvet blush-pink seat, clean marble countertop, warm flattering light',
  gym: 'Modern gym locker room shelf, clean concrete and brushed metal surfaces, bright even overhead lighting, a folded white towel nearby',
  office: 'Minimalist modern office desk near a large window, natural daylight, clean white surface with a small plant, calm productive atmosphere',
};

const VARIANTS = [
  { suffix: '1', mod: 'Soft warm morning golden hour light, fresh and inviting atmosphere.' },
  { suffix: '2', mod: 'Cool neutral daylight, clean and modern feel, subtle blue tones.' },
  { suffix: '3', mod: 'Warm evening ambient lighting, candles or warm lamps, cozy intimate mood.' },
];

const NO_PRODUCTS = ' Empty background scene only, no products, no bottles, no cosmetics, no text or labels. Professional interior photography, elegant and luxurious atmosphere, soft diffused shadows, ultra high quality, photorealistic.';

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(text)); } catch { reject(new Error(text.slice(0, 500))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateImage(prompt) {
  const body = {
    instances: [{ prompt }],
    parameters: { sampleCount: 1, aspectRatio: '16:9', personGeneration: 'dont_allow' },
  };
  const data = await postJSON(API_URL, body);
  const base64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!base64) {
    const reason = data.predictions?.[0]?.raiFilteredReason || JSON.stringify(data).slice(0, 300);
    throw new Error(`No image: ${reason}`);
  }
  return Buffer.from(base64, 'base64');
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const entries = Object.entries(SETTINGS);
  let total = entries.length * VARIANTS.length;
  let done = 0;

  for (const [setting, basePrompt] of entries) {
    for (const variant of VARIANTS) {
      const filename = `${setting}-${variant.suffix}.jpg`;
      const filepath = resolve(OUT_DIR, filename);

      if (existsSync(filepath)) {
        console.log(`[skip] ${filename} already exists`);
        done++;
        continue;
      }

      const prompt = `${basePrompt}. ${variant.mod}${NO_PRODUCTS}`;
      console.log(`[${++done}/${total}] Generating ${filename}...`);

      try {
        const buf = await generateImage(prompt);
        writeFileSync(filepath, buf);
        console.log(`  ✓ Saved ${filename} (${(buf.length / 1024).toFixed(0)} KB)`);
      } catch (err) {
        console.error(`  ✗ Failed ${filename}: ${err.message}`);
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\nDone! Images saved to public/assets/backgrounds/');
}

main().catch(console.error);
