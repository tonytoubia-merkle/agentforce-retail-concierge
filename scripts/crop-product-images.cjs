/**
 * Crop all product images to remove blank/transparent space around edges.
 * Uses sharp to detect and trim transparent or near-white edges.
 *
 * Usage:
 *   node scripts/crop-product-images.cjs
 *   node scripts/crop-product-images.cjs --dry-run  # preview without saving
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, '..', 'public', 'assets', 'products');
const DRY_RUN = process.argv.includes('--dry-run');

async function cropImage(filePath) {
  const filename = path.basename(filePath);

  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    // Skip non-PNG files
    if (metadata.format !== 'png') {
      return { filename, status: 'skipped', reason: 'not PNG' };
    }

    // Skip no-image.png placeholder
    if (filename === 'no-image.png') {
      return { filename, status: 'skipped', reason: 'placeholder' };
    }

    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    // Use sharp's trim function to detect and remove edges
    // threshold: color difference threshold for trimming (0-255)
    const trimmed = await image
      .trim({
        threshold: 10,  // tolerance for edge detection
        lineArt: false  // not line art mode
      })
      .toBuffer({ resolveWithObject: true });

    const newWidth = trimmed.info.width;
    const newHeight = trimmed.info.height;

    // Calculate how much was trimmed
    const widthReduction = originalWidth - newWidth;
    const heightReduction = originalHeight - newHeight;

    // Only save if significant trimming occurred (at least 5px on any side)
    if (widthReduction < 10 && heightReduction < 10) {
      return {
        filename,
        status: 'unchanged',
        original: `${originalWidth}x${originalHeight}`,
        trimmed: `${newWidth}x${newHeight}`
      };
    }

    if (!DRY_RUN) {
      // Save the trimmed image
      await sharp(trimmed.data)
        .png({ compressionLevel: 9 })
        .toFile(filePath);
    }

    return {
      filename,
      status: 'cropped',
      original: `${originalWidth}x${originalHeight}`,
      trimmed: `${newWidth}x${newHeight}`,
      saved: widthReduction + heightReduction
    };
  } catch (err) {
    return { filename, status: 'error', error: err.message };
  }
}

async function main() {
  console.log(`Product Image Cropper`);
  console.log(`═════════════════════`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'LIVE (will modify files)'}\n`);

  const files = fs.readdirSync(PRODUCTS_DIR)
    .filter(f => f.endsWith('.png'))
    .map(f => path.join(PRODUCTS_DIR, f));

  console.log(`Found ${files.length} PNG files\n`);

  let cropped = 0;
  let unchanged = 0;
  let errors = 0;
  let skipped = 0;

  for (const file of files) {
    const result = await cropImage(file);

    if (result.status === 'cropped') {
      console.log(`✓ ${result.filename}: ${result.original} → ${result.trimmed} (saved ${result.saved}px)`);
      cropped++;
    } else if (result.status === 'unchanged') {
      console.log(`- ${result.filename}: ${result.original} (no trim needed)`);
      unchanged++;
    } else if (result.status === 'skipped') {
      console.log(`⊘ ${result.filename}: ${result.reason}`);
      skipped++;
    } else {
      console.log(`✗ ${result.filename}: ${result.error}`);
      errors++;
    }
  }

  console.log(`\n═════════════════════`);
  console.log(`Cropped: ${cropped}  Unchanged: ${unchanged}  Skipped: ${skipped}  Errors: ${errors}`);
  if (DRY_RUN) console.log(`(Dry run - no files modified)`);
  console.log(`═════════════════════`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
