import fs from 'fs';

// Read Salesforce products (source of truth for IDs)
const sfProducts = JSON.parse(fs.readFileSync('./scripts/all_products.json', 'utf8')).records;

// Read current products.ts
const productsFile = fs.readFileSync('./src/mocks/products.ts', 'utf8');

// Build name→sfProduct map (lowercase name → SF record)
const sfByName = new Map();
for (const p of sfProducts) {
  sfByName.set(p.Name.toLowerCase(), p);
}

// Build imageUrl→sfProduct map (for fallback matching)
const sfByImage = new Map();
for (const p of sfProducts) {
  if (p.Image_URL__c) sfByImage.set(p.Image_URL__c, p);
}

// --- Step 1: Fix all salesforceId values in existing products ---
let updated = productsFile;
let fixCount = 0;
let addedSfIdCount = 0;

// Find all existing salesforceId entries and update them
const sfIdPattern = /salesforceId:\s*'([^']+)'/g;
let match;
const existingSfIds = new Set();

// First pass: collect all existing name→sfId mappings we need to fix
const productBlocks = productsFile.split(/(?=\n\s*\{[\s\n]*id:)/);

// Match by name - find each product's name and update its salesforceId
for (const sfProd of sfProducts) {
  const nameEscaped = sfProd.Name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "\\'");
  const nameRegex = new RegExp(`name:\\s*'${nameEscaped}'`, 'i');

  if (nameRegex.test(updated)) {
    // Product exists in MOCK_PRODUCTS - check if salesforceId needs updating
    const sfIdAfterName = new RegExp(
      `(salesforceId:\\s*')([^']*)(')([\\s\\S]*?name:\\s*'${nameEscaped}')|(name:\\s*'${nameEscaped}')[\\s\\S]*?(salesforceId:\\s*')([^']*)(')`,
      'i'
    );

    // Simpler approach: find the block containing this product name
    const blockStart = updated.search(nameRegex);
    if (blockStart === -1) continue;

    // Find the enclosing product block (previous '{' to next '},')
    let braceStart = updated.lastIndexOf('{', blockStart);
    let depth = 1;
    let pos = braceStart + 1;
    while (pos < updated.length && depth > 0) {
      if (updated[pos] === '{') depth++;
      else if (updated[pos] === '}') depth--;
      pos++;
    }
    const blockEnd = pos;
    const block = updated.slice(braceStart, blockEnd);

    // Check if block has salesforceId
    const sfIdInBlock = block.match(/salesforceId:\s*'([^']*)'/);
    if (sfIdInBlock) {
      if (sfIdInBlock[1] !== sfProd.Id) {
        // Update the salesforceId
        const newBlock = block.replace(
          /salesforceId:\s*'[^']*'/,
          `salesforceId: '${sfProd.Id}'`
        );
        updated = updated.slice(0, braceStart) + newBlock + updated.slice(blockEnd);
        fixCount++;
      }
    } else {
      // No salesforceId - add one after the id field
      const idMatch = block.match(/(id:\s*'[^']*',?\n)/);
      if (idMatch) {
        const insertPos = block.indexOf(idMatch[0]) + idMatch[0].length;
        const indent = idMatch[0].match(/^\s*/)?.[0] || '    ';
        const newBlock = block.slice(0, insertPos) +
          `${indent}salesforceId: '${sfProd.Id}',\n` +
          block.slice(insertPos);
        updated = updated.slice(0, braceStart) + newBlock + updated.slice(blockEnd);
        addedSfIdCount++;
      }
    }
    existingSfIds.add(sfProd.Id);
  }
}

console.log(`Fixed ${fixCount} salesforceId values`);
console.log(`Added ${addedSfIdCount} missing salesforceId fields`);

// --- Step 2: Find SF products NOT in MOCK_PRODUCTS (by name) ---
const missing = sfProducts.filter(p => !existingSfIds.has(p.Id));
console.log(`\nMissing products (${missing.length}):`);
for (const p of missing) {
  console.log(`  ${p.Name} (${p.Category__c}) → ${p.Image_URL__c || 'NO IMAGE'}`);
}

// --- Step 3: Generate entries for missing products ---
if (missing.length > 0) {
  const idFromImage = (img) => {
    if (!img) return null;
    // /assets/products/foo-bar.png → foo-bar
    const m = img.match(/\/assets\/products\/(.+)\.png$/);
    return m ? m[1] : null;
  };

  const categoryMap = {
    'Cleanser': 'cleanser',
    'Toner': 'toner',
    'Serum': 'serum',
    'Moisturizer': 'moisturizer',
    'Sunscreen': 'sunscreen',
    'Mask': 'mask',
    'Exfoliant': 'exfoliant',
    'Eye Care': 'eye-care',
    'Tool': 'tool',
    'Foundation': 'foundation',
    'Lipstick': 'lipstick',
    'Mascara': 'mascara',
    'Blush': 'blush',
    'Fragrance': 'fragrance',
    'Shampoo': 'shampoo',
    'Conditioner': 'conditioner',
    'Spot Treatment': 'spot-treatment',
  };

  let newEntries = '\n  // ─── Auto-synced from Salesforce ──────────────────────────────\n';
  for (const p of missing) {
    const localId = idFromImage(p.Image_URL__c) || p.Name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const cat = categoryMap[p.Category__c] || p.Category__c?.toLowerCase() || 'other';
    const imgUrl = p.Image_URL__c || '/assets/products/no-image.png';

    newEntries += `  {
    id: '${localId}',
    salesforceId: '${p.Id}',
    name: '${p.Name.replace(/'/g, "\\'")}',
    brand: '${p.Brand__c || 'BEAUTÉ'}',
    category: '${cat}',
    price: ${p.Price__c || 0},
    currency: 'USD',
    description: '',
    shortDescription: '',
    imageUrl: '${imgUrl}',
    images: ['${imgUrl}'],
    attributes: {},
    rating: 4.5,
    reviewCount: 0,
    inStock: true,
    personalizationScore: 0.7,
  },\n`;
  }

  // Insert before the closing ];
  const closingBracket = updated.lastIndexOf('];');
  if (closingBracket !== -1) {
    updated = updated.slice(0, closingBracket) + newEntries + updated.slice(closingBracket);
  }
  console.log(`\nGenerated ${missing.length} new product entries`);
}

// Write updated file
fs.writeFileSync('./src/mocks/products.ts', updated, 'utf8');
console.log('\nDone! Updated src/mocks/products.ts');
