// Set StockKeepingUnit on Product2 records using our mock product IDs
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
function sfPatch(token, path, data) {
  const b = JSON.stringify(data);
  return req({ hostname: SF, port: 443, path, method: 'PATCH',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json',
      'content-length': Buffer.byteLength(b), accept: 'application/json' } }, b);
}

// Parse salesforceId + local id (used as SKU) + price + brand from mock products
function parseMockProducts() {
  const content = fs.readFileSync('src/mocks/products.ts', 'utf-8');
  const products = [];
  const blocks = content.split(/\{\s*\n\s*id:/);
  for (const block of blocks.slice(1)) {
    const idMatch = block.match(/^\s*'([^']+)'/);
    const sfIdMatch = block.match(/salesforceId:\s*'([^']+)'/);
    const nameMatch = block.match(/name:\s*'([^']+)'/);
    const priceMatch = block.match(/price:\s*([\d.]+)/);
    const brandMatch = block.match(/brand:\s*'([^']+)'/);
    if (sfIdMatch && idMatch) {
      products.push({
        sku: idMatch[1],          // local id becomes the SKU
        salesforceId: sfIdMatch[1],
        name: nameMatch ? nameMatch[1] : '',
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

  const products = parseMockProducts();
  console.log('Products to update:', products.length);

  // Update StockKeepingUnit + Family (brand) in batches of 200
  let updated = 0, errors = 0;
  for (let i = 0; i < products.length; i += 200) {
    const batch = products.slice(i, i + 200);
    const records = batch.map(p => ({
      attributes: { type: 'Product2' },
      Id: p.salesforceId,
      StockKeepingUnit: p.sku,
      Family: p.brand || 'SERENE',
    }));
    const r = await sfPatch(token, '/services/data/v60.0/composite/sobjects', { allOrNone: false, records });
    const results = JSON.parse(r.body);
    if (Array.isArray(results)) {
      results.forEach(res => { if (res.success) updated++; else { errors++; if (errors <= 3) console.log('ERR:', JSON.stringify(res.errors)); } });
    } else {
      console.log('Unexpected:', JSON.stringify(r.body).substring(0, 200));
    }
    process.stdout.write('.');
  }
  console.log('\nUpdated:', updated, '| errors:', errors);
  console.log('\nSKU samples:');
  products.slice(0, 5).forEach(p => console.log(' ', p.salesforceId, '->', p.sku));
}

run().catch(e => console.error('Fatal:', e.message));
