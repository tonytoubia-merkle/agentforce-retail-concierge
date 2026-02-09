/**
 * Process -removebg-preview images:
 *   1. Crop to remove whitespace/transparent edges
 *   2. Compress without sacrificing quality
 *   3. Rename to remove -removebg-preview suffix
 *
 * Usage:
 *   node scripts/process-removebg-images.cjs
 *   node scripts/process-removebg-images.cjs --dry-run  # preview without changes
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, '..', 'public', 'assets', 'products');
const DRY_RUN = process.argv.includes('--dry-run');
const SUFFIX = '-removebg-preview';

async function processImage(filePath) {
  const filename = path.basename(filePath);
  const newFilename = filename.replace(SUFFIX, '');
  const newFilePath = path.join(PRODUCTS_DIR, newFilename);

  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    const originalSize = fs.statSync(filePath).size;

    // Step 1: Crop/trim transparent and near-white edges
    const trimmed = await image
      .trim({
        threshold: 10,
        lineArt: false
      })
      .toBuffer({ resolveWithObject: true });

    const trimmedWidth = trimmed.info.width;
    const trimmedHeight = trimmed.info.height;

    // Step 2: Compress with high quality PNG settings
    const compressed = await sharp(trimmed.data)
      .png({
        compressionLevel: 9,
        palette: true,  // Use palette for smaller file size
        quality: 90,    // High quality
        effort: 10      // Maximum compression effort
      })
      .toBuffer();

    const newSize = compressed.length;
    const sizeSaved = originalSize - newSize;
    const sizePercent = ((sizeSaved / originalSize) * 100).toFixed(1);

    if (!DRY_RUN) {
      // Step 3: Save with new name (removing suffix)
      fs.writeFileSync(newFilePath, compressed);

      // Delete the original -removebg-preview file
      fs.unlinkSync(filePath);
    }

    return {
      filename,
      newFilename,
      status: 'success',
      original: `${originalWidth}x${originalHeight}`,
      trimmed: `${trimmedWidth}x${trimmedHeight}`,
      originalSize: (originalSize / 1024).toFixed(0),
      newSize: (newSize / 1024).toFixed(0),
      saved: sizePercent
    };
  } catch (err) {
    return { filename, status: 'error', error: err.message };
  }
}

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  Process -removebg-preview Images                        ║`);
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (will modify files)'}                        ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  // Find all -removebg-preview files
  const files = fs.readdirSync(PRODUCTS_DIR)
    .filter(f => f.includes(SUFFIX) && f.endsWith('.png'))
    .map(f => path.join(PRODUCTS_DIR, f));

  console.log(`Found ${files.length} images with "${SUFFIX}" suffix\n`);
  console.log(`─────────────────────────────────────────────────────────────`);

  if (files.length === 0) {
    console.log('No files to process!');
    return;
  }

  let success = 0;
  let errors = 0;
  let totalSaved = 0;

  for (const file of files) {
    const result = await processImage(file);

    if (result.status === 'success') {
      console.log(`✓ ${result.filename}`);
      console.log(`  → ${result.newFilename}`);
      console.log(`  Size: ${result.originalSize}KB → ${result.newSize}KB (-${result.saved}%)`);
      console.log(`  Dims: ${result.original} → ${result.trimmed}`);
      success++;
      totalSaved += parseInt(result.originalSize) - parseInt(result.newSize);
    } else {
      console.log(`✗ ${result.filename}: ${result.error}`);
      errors++;
    }
  }

  console.log(`\n─────────────────────────────────────────────────────────────`);
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  Complete!                                               ║`);
  console.log(`║  Processed: ${String(success).padEnd(3)} | Errors: ${String(errors).padEnd(3)} | Saved: ${String(totalSaved).padEnd(5)}KB     ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);

  if (DRY_RUN) {
    console.log(`(Dry run - no files were modified)\n`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
