/**
 * Migrate product images to Supabase Storage.
 *
 * Uploads all images from public/assets/products/ to a Supabase Storage bucket,
 * then optionally updates Product2.json Image_URL__c to point to the Supabase
 * public URLs.
 *
 * Usage:
 *   # 1. Set environment variables (or add to .env.local):
 *   #    SUPABASE_URL=https://your-project.supabase.co
 *   #    SUPABASE_SERVICE_KEY=your-service-role-key
 *
 *   # 2. Run:
 *   node scripts/migrate-images-to-supabase.js
 *
 *   # 3. To also update Product2.json with Supabase URLs:
 *   node scripts/migrate-images-to-supabase.js --update-urls
 *
 * Prerequisites:
 *   - A Supabase project (free tier works fine)
 *   - The service role key (Settings → API → service_role key)
 *   - Images should already be optimized (run optimize-images.js first)
 *
 * What it does:
 *   1. Creates a "product-images" storage bucket (public, with caching)
 *   2. Uploads all PNG files from public/assets/products/
 *   3. Optionally rewrites Image_URL__c in data/Product2.json to Supabase URLs
 *   4. Prints the base URL for manual configuration
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PRODUCTS_DIR = join(ROOT, 'public', 'assets', 'products');
const PRODUCT_JSON = join(ROOT, 'data', 'Product2.json');
const BUCKET_NAME = 'product-images';
const STORAGE_PATH = 'products'; // folder inside the bucket

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
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
const UPDATE_URLS = process.argv.includes('--update-urls');

// ─── Supabase Storage helpers ───────────────────────────────────
async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/storage/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...options.headers,
    },
  });
  return res;
}

async function createBucket() {
  console.log(`\nCreating bucket "${BUCKET_NAME}"...`);
  const res = await supabaseRequest('/bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: BUCKET_NAME,
      name: BUCKET_NAME,
      public: true, // publicly accessible without auth
      file_size_limit: 10485760, // 10MB
      allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    }),
  });

  if (res.ok) {
    console.log(`  ✓ Bucket created`);
    return true;
  }

  const body = await res.json();
  if (body.error === 'Duplicate' || body.message?.includes('already exists')) {
    console.log(`  ⊘ Bucket already exists`);
    return true;
  }

  console.error(`  ✗ Failed to create bucket:`, body);
  return false;
}

async function uploadFile(filePath, storagePath) {
  const fileBuffer = readFileSync(filePath);
  const res = await supabaseRequest(`/object/${BUCKET_NAME}/${storagePath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'x-upsert': 'true', // overwrite if exists
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: fileBuffer,
  });

  return res.ok;
}

function getPublicUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  // Validate config
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required environment variables:');
    if (!SUPABASE_URL) console.error('  - SUPABASE_URL (e.g. https://your-project.supabase.co)');
    if (!SUPABASE_KEY) console.error('  - SUPABASE_SERVICE_KEY (service_role key from Supabase dashboard)');
    console.error('\nSet them in .env.local or as environment variables.');
    process.exit(1);
  }

  console.log('Supabase Image Migration');
  console.log('════════════════════════════════════');
  console.log(`  URL:    ${SUPABASE_URL}`);
  console.log(`  Bucket: ${BUCKET_NAME}`);
  console.log(`  Mode:   ${UPDATE_URLS ? 'Upload + Update URLs' : 'Upload only'}`);

  // Create bucket
  const bucketOk = await createBucket();
  if (!bucketOk) process.exit(1);

  // Get image files
  const files = readdirSync(PRODUCTS_DIR).filter(f =>
    f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')
  );
  console.log(`\nUploading ${files.length} images...\n`);

  let uploaded = 0;
  let failed = 0;
  const urlMap = {}; // local path → Supabase URL

  for (const file of files) {
    const filePath = join(PRODUCTS_DIR, file);
    const size = statSync(filePath).size;
    const storagePath = `${STORAGE_PATH}/${file}`;

    const ok = await uploadFile(filePath, storagePath);
    if (ok) {
      const publicUrl = getPublicUrl(storagePath);
      urlMap[`/assets/products/${file}`] = publicUrl;
      console.log(`  ✓ ${file} (${fmt(size)}) → ${publicUrl}`);
      uploaded++;
    } else {
      console.error(`  ✗ ${file} failed`);
      failed++;
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`Uploaded: ${uploaded}  Failed: ${failed}`);
  console.log(`══════════════════════════════════════`);

  // Optionally update Product2.json
  if (UPDATE_URLS && uploaded > 0) {
    console.log(`\nUpdating Image_URL__c in ${PRODUCT_JSON}...`);
    const data = JSON.parse(readFileSync(PRODUCT_JSON, 'utf-8'));
    let updatedCount = 0;

    for (const record of data.records) {
      const localUrl = record.Image_URL__c;
      if (localUrl && urlMap[localUrl]) {
        record.Image_URL__c = urlMap[localUrl];
        updatedCount++;
      }
    }

    writeFileSync(PRODUCT_JSON, JSON.stringify(data, null, 2) + '\n');
    console.log(`  ✓ Updated ${updatedCount} product image URLs`);
    console.log(`\nNext steps:`);
    console.log(`  1. Re-run: node scripts/seed-products.js`);
    console.log(`     (to push updated URLs to Salesforce)`);
    console.log(`  2. Delete local images: rm -rf public/assets/products/`);
    console.log(`  3. Add to .gitignore: public/assets/products/`);
  } else if (!UPDATE_URLS) {
    console.log(`\nImages uploaded! To also update Product2.json URLs, run:`);
    console.log(`  node scripts/migrate-images-to-supabase.js --update-urls`);
  }

  console.log(`\nPublic base URL:`);
  console.log(`  ${getPublicUrl(STORAGE_PATH)}/`);
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
