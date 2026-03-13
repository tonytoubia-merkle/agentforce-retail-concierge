// Cleanup legacy products + add descriptions + add images to Product2 records
const https = require('https');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const content = fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq !== -1) env[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return env;
}
const ENV = loadEnv();
const SF = new URL(ENV.VITE_AGENTFORCE_INSTANCE_URL || 'https://me1769724439764.my.salesforce.com').hostname;
const CLIENT_ID = ENV.VITE_AGENTFORCE_CLIENT_ID;
const CLIENT_SECRET = ENV.VITE_AGENTFORCE_CLIENT_SECRET;
const VERCEL_BASE = 'https://agentforce-retail-advisor.vercel.app';

function req(opts, body) {
  return new Promise((res, rej) => {
    const r = https.request(opts, (resp) => {
      const chunks = [];
      resp.on('data', c => chunks.push(c));
      resp.on('end', () => res({ status: resp.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    r.on('error', rej);
    r.setTimeout(30000, () => r.destroy(new Error('timeout')));
    if (body) r.end(body); else r.end();
  });
}
function sfGet(token, path) {
  return req({ hostname: SF, port: 443, path, method: 'GET',
    headers: { authorization: 'Bearer ' + token, accept: 'application/json' } });
}
function sfPost(token, path, data) {
  const b = JSON.stringify(data);
  return req({ hostname: SF, port: 443, path, method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json',
      'content-length': Buffer.byteLength(b), accept: 'application/json' } }, b);
}
function sfPatch(token, path, data) {
  const b = JSON.stringify(data);
  return req({ hostname: SF, port: 443, path, method: 'PATCH',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json',
      'content-length': Buffer.byteLength(b), accept: 'application/json' } }, b);
}
function sfDelete(token, path) {
  return req({ hostname: SF, port: 443, path, method: 'DELETE',
    headers: { authorization: 'Bearer ' + token, accept: 'application/json' } });
}

// Parse mock products.ts to extract { salesforceId, description, imageUrl, name, price, brand }
function parseMockProducts() {
  const content = fs.readFileSync('src/mocks/products.ts', 'utf-8');
  const products = [];
  // Split by top-level object blocks
  const blocks = content.split(/\{\s*\n\s*id:/);
  for (const block of blocks.slice(1)) {
    const sfIdMatch = block.match(/salesforceId:\s*'([^']+)'/);
    const nameMatch = block.match(/name:\s*'([^']+)'/);
    const descMatch = block.match(/description:\s*'([^']+)'/);
    const imgMatch = block.match(/imageUrl:\s*'(\/assets\/[^']+)'/);
    const priceMatch = block.match(/price:\s*([\d.]+)/);
    const brandMatch = block.match(/brand:\s*'([^']+)'/);
    if (sfIdMatch && nameMatch) {
      products.push({
        salesforceId: sfIdMatch[1],
        name: nameMatch[1],
        description: descMatch ? descMatch[1] : null,
        imageUrl: imgMatch ? imgMatch[1] : null,
        price: priceMatch ? parseFloat(priceMatch[1]) : null,
        brand: brandMatch ? brandMatch[1] : null,
      });
    }
  }
  return products;
}

async function run() {
  const tokenBody = 'grant_type=client_credentials';
  const tok = await req({ hostname: SF, port: 443, path: '/services/oauth2/token', method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': tokenBody.length,
      authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64') }
  }, tokenBody);
  const token = JSON.parse(tok.body).access_token;
  console.log('Token:', token ? 'OK' : 'FAILED');

  // ─── Step 1: Remove legacy products from catalog ─────────────────────────
  console.log('\n--- Step 1: Remove legacy products (created 1/29/2026) from catalog ---');

  // Get all legacy Product2 IDs
  let legacyIds = [];
  let nextUrl = '/services/data/v60.0/query?q=' + encodeURIComponent(
    'SELECT Id FROM Product2 WHERE CreatedDate >= 2026-01-29T00:00:00Z AND CreatedDate < 2026-01-30T00:00:00Z'
  );
  while (nextUrl) {
    const r = await sfGet(token, nextUrl);
    const d = JSON.parse(r.body);
    legacyIds = legacyIds.concat((d.records || []).map(r => r.Id));
    nextUrl = d.nextRecordsUrl || null;
  }
  console.log('Legacy product IDs found:', legacyIds.length);

  // Find their ProductCategoryProduct records and delete them
  let pcpToDelete = [];
  for (let i = 0; i < legacyIds.length; i += 100) {
    const batch = legacyIds.slice(i, i + 100);
    const inClause = batch.map(id => "'" + id + "'").join(',');
    const r = await sfGet(token, '/services/data/v60.0/query?q=' + encodeURIComponent(
      'SELECT Id FROM ProductCategoryProduct WHERE ProductId IN (' + inClause + ')'
    ));
    pcpToDelete = pcpToDelete.concat((JSON.parse(r.body).records || []).map(r => r.Id));
  }
  console.log('ProductCategoryProduct records to delete:', pcpToDelete.length);

  // Delete via composite batch (200 at a time)
  let deleted = 0;
  for (let i = 0; i < pcpToDelete.length; i += 200) {
    const batch = pcpToDelete.slice(i, i + 200);
    const ids = batch.join(',');
    const r = await req({ hostname: SF, port: 443,
      path: '/services/data/v60.0/composite/sobjects?ids=' + ids + '&allOrNone=false',
      method: 'DELETE',
      headers: { authorization: 'Bearer ' + token, accept: 'application/json' }
    });
    const results = JSON.parse(r.body);
    if (Array.isArray(results)) deleted += results.filter(r => r.success).length;
    process.stdout.write('.');
  }
  console.log('\nDeleted from catalog:', deleted);

  // ─── Step 2: Update Product2 descriptions ────────────────────────────────
  console.log('\n--- Step 2: Push descriptions to Product2 ---');

  const mockProducts = parseMockProducts();
  console.log('Mock products parsed:', mockProducts.length);

  const toUpdate = mockProducts.filter(p => p.description);
  console.log('Products with descriptions to push:', toUpdate.length);

  let descUpdated = 0, descErrors = 0;
  for (let i = 0; i < toUpdate.length; i += 200) {
    const batch = toUpdate.slice(i, i + 200);
    const records = batch.map(p => ({
      attributes: { type: 'Product2' },
      Id: p.salesforceId,
      Description: p.description,
    }));
    const r = await sfPatch(token, '/services/data/v60.0/composite/sobjects', { allOrNone: false, records });
    const results = JSON.parse(r.body);
    if (Array.isArray(results)) {
      results.forEach(res => { if (res.success) descUpdated++; else descErrors++; });
    } else {
      console.log('Patch response:', JSON.stringify(r.body).substring(0, 200));
    }
    process.stdout.write('.');
  }
  console.log('\nDescriptions updated:', descUpdated, '| errors:', descErrors);

  // ─── Step 3: Set up ProductMedia with Vercel image URLs ──────────────────
  console.log('\n--- Step 3: Create ProductMedia image records ---');

  const toImage = mockProducts.filter(p => p.imageUrl);
  console.log('Products with images to add:', toImage.length);

  // Check if ProductMedia/ElectronicMedia exist
  const pmSchema = await sfGet(token, '/services/data/v60.0/sobjects/ProductMedia');
  if (pmSchema.status !== 200) {
    console.log('ProductMedia not available in this org, skipping image setup.');
    console.log('Response:', pmSchema.body.substring(0, 200));
    return finalize();
  }

  // Check for existing ProductMedia
  const existingPM = await sfGet(token, '/services/data/v60.0/query?q=' + encodeURIComponent(
    'SELECT COUNT() FROM ProductMedia'
  ));
  console.log('Existing ProductMedia records:', JSON.parse(existingPM.body).totalSize);

  // Create ProductMedia records (Commerce on Core uses ElectronicMediaGroup + ProductMedia)
  // First check if we need an ElectronicMediaGroup
  const emg = await sfGet(token, '/services/data/v60.0/query?q=' + encodeURIComponent(
    'SELECT Id, Name FROM ElectronicMediaGroup LIMIT 5'
  ));
  console.log('ElectronicMediaGroup:', emg.body.substring(0, 300));

  let mediaAdded = 0, mediaErrors = 0;

  // For each product, create ElectronicMedia + ProductMedia
  for (const p of toImage) {
    const fullImageUrl = VERCEL_BASE + p.imageUrl;

    // Create ElectronicMedia with the image URL
    const emR = await sfPost(token, '/services/data/v60.0/sobjects/ElectronicMedia', {
      Name: p.name + ' - Main Image',
      Url: fullImageUrl,
    });
    const emData = JSON.parse(emR.body);
    if (!emData.success || !emData.id) {
      // Try alternative: just use ProductMedia with URL directly if schema allows
      mediaErrors++;
      continue;
    }

    // Create ProductMedia linking product to electronic media
    const pmR = await sfPost(token, '/services/data/v60.0/sobjects/ProductMedia', {
      ProductId: p.salesforceId,
      ElectronicMediaId: emData.id,
      MediaType: 'Product_Image',
      SortOrder: 1,
    });
    const pmData = JSON.parse(pmR.body);
    if (pmData.success) mediaAdded++;
    else mediaErrors++;

    if ((mediaAdded + mediaErrors) % 10 === 0) process.stdout.write('.');
  }
  console.log('\nProductMedia created:', mediaAdded, '| errors:', mediaErrors);

  finalize();
}

function finalize() {
  console.log('\n=== Done! ===');
  console.log('Next step: Rebuild the search index in Commerce → Beaute store → Search → Rebuild Index');
}

run().catch(e => console.error('Fatal:', e.message));
