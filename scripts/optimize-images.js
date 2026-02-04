/**
 * Optimize product images in public/assets/products/
 *
 * Compresses PNG files in-place using sharp.
 * Large PNGs are resized to max 800px width and compressed.
 *
 * Usage:
 *   node scripts/optimize-images.js
 */

import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCTS_DIR = join(__dirname, '..', 'public', 'assets', 'products');
const MAX_WIDTH = 800;
const PNG_QUALITY = 80; // 0-100, lower = smaller

async function main() {
  const files = readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.png'));
  console.log(`Found ${files.length} PNG files in ${PRODUCTS_DIR}\n`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const filePath = join(PRODUCTS_DIR, file);
    const beforeSize = statSync(filePath).size;
    totalBefore += beforeSize;

    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();

      let pipeline = sharp(filePath);

      // Resize if wider than MAX_WIDTH
      if (metadata.width > MAX_WIDTH) {
        pipeline = pipeline.resize(MAX_WIDTH, null, { withoutEnlargement: true });
      }

      // Compress PNG
      const buffer = await pipeline
        .png({ quality: PNG_QUALITY, compressionLevel: 9, effort: 10 })
        .toBuffer();

      // Only write if actually smaller
      if (buffer.length < beforeSize) {
        await sharp(buffer).toFile(filePath);
        const afterSize = statSync(filePath).size;
        totalAfter += afterSize;
        const saved = ((1 - afterSize / beforeSize) * 100).toFixed(0);
        console.log(`  ✓ ${file}: ${fmt(beforeSize)} → ${fmt(afterSize)} (${saved}% saved)`);
      } else {
        totalAfter += beforeSize;
        console.log(`  ⊘ ${file}: ${fmt(beforeSize)} (already optimal)`);
      }
    } catch (err) {
      totalAfter += beforeSize;
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`Total before: ${fmt(totalBefore)}`);
  console.log(`Total after:  ${fmt(totalAfter)}`);
  console.log(`Saved:        ${fmt(totalBefore - totalAfter)} (${((1 - totalAfter / totalBefore) * 100).toFixed(0)}%)`);
  console.log(`══════════════════════════════════════`);
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
