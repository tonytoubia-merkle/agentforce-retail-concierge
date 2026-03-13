// One-time script to configure Beaute Commerce catalog categories and assign products
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
const CATALOG_ID = '0ZSKa000000EN1gOAG';       // Beaute Commerce Catalog
const ROOT_CATEGORY_ID = '0ZGKa000000VAjcOAG'; // 'Products' root category
const WEBSTORE_ID = '0ZEKa000000Qg5YOAS';

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

// Category definitions with keyword matchers (order matters — first match wins)
const CATEGORIES = [
  { name: 'Sunscreen & SPF',   keys: ['spf', 'sunscreen', 'mineral spf', 'shield spf', 'defense spf', 'defense moisturizer spf'] },
  { name: 'Acne Care',         keys: ['acne', 'blemish', 'benzoyl', 'salicylic', 'sulfur', 'blackhead', 'pore refine', 'oil control zinc', 'oil-free moisturizer', 'clear start', 'sos blemish', 'pore blur'] },
  { name: 'Eye Care',          keys: ['eye cream', 'eye serum', 'under eye', 'caffeine cream', 'bright eyes'] },
  { name: 'Masks',             keys: ['mask', 'peel pad', 'detox'] },
  { name: 'Toners',            keys: ['toner', 'tonic', 'facial mist', 'essence', 'cooling mist'] },
  { name: 'Serums',            keys: ['serum', 'treatment', 'retinoid', 'niacinamide', 'vitamin c', 'azelaic', 'peptide', 'hyaluronic', 'glycolic', 'aha', 'redness relief', 'scar fading', 'repair serum'] },
  { name: 'Cleansers',         keys: ['cleanser', 'wash', 'cleansing', 'micellar'] },
  { name: 'Moisturizers',      keys: ['moisturizer', 'barrier cream', 'hydra gel', 'hydration cream', 'face cream', 'face lotion', 'cloud cream', 'rich cream', 'calm cream'] },
  { name: 'Makeup',            keys: ['foundation', 'concealer', 'primer', 'blush', 'contour', 'bronzer', 'lipstick', 'lip gloss', 'lip liner', 'mascara', 'eyeliner', 'eyeshadow', 'palette', 'highlighter', 'setting powder', 'setting spray', 'bb cream', 'tinted', 'brow gel', 'brow pencil', 'brow', 'lash'] },
  { name: 'Fragrance',         keys: ['eau de parfum', 'eau de toilette', 'cologne', 'parfum', 'perfume', 'oud', 'citrus garden', 'mer bleue', 'bois sauvage', 'jardin'] },
  { name: 'Hair Care',         keys: ['shampoo', 'conditioner', 'hair', 'scalp', 'curl', 'bond repair', 'thermal', 'heat protectant'] },
  { name: 'Body Care',         keys: ['body lotion', 'body scrub', 'body oil', 'hand cream', 'foot cream', 'body wash', 'body butter'] },
  { name: 'Travel Size',       keys: ['travel', 'discovery set', 'mini', '10ml', '15ml', 'blotting'] },
];

function classify(name) {
  const n = name.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keys.some(k => n.includes(k))) return cat.name;
  }
  return 'Skincare';
}

async function run() {
  // Get token
  const tokenBody = 'grant_type=client_credentials';
  const tok = await req({ hostname: SF, port: 443, path: '/services/oauth2/token', method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': tokenBody.length,
      authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64') }
  }, tokenBody);
  const token = JSON.parse(tok.body).access_token;
  console.log('Token:', token ? 'OK' : 'FAILED');

  // Step 1: Create subcategories
  console.log('\n--- Creating subcategories ---');
  const allCatNames = [...CATEGORIES.map(c => c.name), 'Skincare'];
  const catIdMap = {};

  for (const catName of allCatNames) {
    const r = await sfPost(token, '/services/data/v60.0/sobjects/ProductCategory', {
      Name: catName,
      CatalogId: CATALOG_ID,
      ParentCategoryId: ROOT_CATEGORY_ID,
    });
    const d = JSON.parse(r.body);
    if (d.success && d.id) {
      catIdMap[catName] = d.id;
      console.log('  Created:', catName, '->', d.id);
    } else {
      console.log('  Skipped (already exists?):', catName, JSON.stringify(d).substring(0, 100));
    }
  }

  // Fetch all existing subcategories to fill in any that already existed
  const existingCats = await sfGet(token, '/services/data/v60.0/query?q=' +
    encodeURIComponent('SELECT Id, Name FROM ProductCategory WHERE CatalogId = \'' + CATALOG_ID +
      '\' AND ParentCategoryId = \'' + ROOT_CATEGORY_ID + '\''));
  JSON.parse(existingCats.body).records.forEach(c => { catIdMap[c.Name] = c.Id; });
  console.log('Category map:', catIdMap);

  // Step 2: Get all active products
  console.log('\n--- Loading products ---');
  let allProducts = [];
  let nextUrl = '/services/data/v60.0/query?q=' +
    encodeURIComponent('SELECT Id, Name FROM Product2 WHERE IsActive = true ORDER BY Name');
  while (nextUrl) {
    const r = await sfGet(token, nextUrl);
    const d = JSON.parse(r.body);
    allProducts = allProducts.concat(d.records || []);
    nextUrl = d.nextRecordsUrl || null;
  }
  console.log('Total products:', allProducts.length);

  // Step 3: Bucket products by category
  const buckets = {};
  allProducts.forEach(p => {
    const cat = classify(p.Name);
    if (!buckets[cat]) buckets[cat] = [];
    buckets[cat].push(p);
  });
  console.log('\nClassification:');
  Object.entries(buckets).forEach(([k, v]) => console.log(' ', k + ':', v.length));

  // Step 4: Assign to subcategories
  console.log('\n--- Assigning products to subcategories ---');
  let catAdded = 0, catDupes = 0, catErrors = 0;
  for (const [catName, products] of Object.entries(buckets)) {
    const catId = catIdMap[catName];
    if (!catId) { console.log('  No ID for:', catName); continue; }
    for (let i = 0; i < products.length; i += 200) {
      const batch = products.slice(i, i + 200);
      const records = batch.map(p => ({
        attributes: { type: 'ProductCategoryProduct' },
        ProductCategoryId: catId,
        ProductId: p.Id,
        IsPrimaryCategory: false,
      }));
      const r = await sfPost(token, '/services/data/v60.0/composite/sobjects', { allOrNone: false, records });
      const results = JSON.parse(r.body);
      if (Array.isArray(results)) {
        results.forEach(res => {
          if (res.success) catAdded++;
          else if (res.errors?.[0]?.statusCode === 'DUPLICATE_VALUE') catDupes++;
          else catErrors++;
        });
      }
    }
    process.stdout.write('.');
  }
  console.log('\nSubcategory assignments — added:', catAdded, '| dupes:', catDupes, '| errors:', catErrors);

  // Step 5: Rebuild search index via Tooling API executeAnonymous
  console.log('\n--- Triggering search index rebuild ---');
  const apex = "CommerceSearch.SearchIndex.rebuild('" + WEBSTORE_ID + "');";
  const rebuildR = await sfGet(token, '/services/data/v60.0/tooling/executeAnonymous?anonymousBody=' +
    encodeURIComponent(apex));
  const rb = JSON.parse(rebuildR.body);
  console.log('Rebuild status:', rebuildR.status);
  console.log('Success:', rb.success, '| Compiled:', rb.compiled);
  if (rb.exceptionMessage) console.log('Exception:', rb.exceptionMessage);
  if (!rb.success) console.log('Full response:', JSON.stringify(rb).substring(0, 400));

  console.log('\nDone! Go to the Commerce store and check the search index status.');
}

run().catch(e => console.error('Fatal:', e.message));
