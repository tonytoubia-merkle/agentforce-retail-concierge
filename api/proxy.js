// Vercel Serverless Function — single catch-all API proxy
// Mirrors the logic from server/index.js but as a serverless handler.

import https from 'node:https';

const SF_INSTANCE = process.env.VITE_AGENTFORCE_INSTANCE_URL || 'https://me1769724439764.my.salesforce.com';

const routes = [
  { prefix: '/api/oauth/token',            target: SF_INSTANCE,                                 rewrite: '/services/oauth2/token' },
  { prefix: '/api/agentforce',             target: 'https://api.salesforce.com',                rewrite: '/einstein/ai-agent/v1' },
  { prefix: '/api/cms-media',              target: SF_INSTANCE,                                 rewrite: '/cms/delivery/media' },
  { prefix: '/api/cms',                    target: SF_INSTANCE,                                 rewrite: '/services/data/v60.0/connect/cms' },
  { prefix: '/api/imagen/generate',        target: 'https://generativelanguage.googleapis.com', rewrite: '/v1beta/models/imagen-4.0-generate-001:predict' },
  { prefix: '/api/gemini/generateContent', target: 'https://generativelanguage.googleapis.com', rewrite: '/v1beta/models/gemini-2.5-flash-image:generateContent' },
  { prefix: '/api/firefly/token',          target: 'https://ims-na1.adobelogin.com',            rewrite: '/ims/token/v3' },
  { prefix: '/api/firefly/generate',       target: 'https://firefly-api.adobe.io',              rewrite: '/v3/images/generate' },
  { prefix: '/api/datacloud',             target: SF_INSTANCE,                                 rewrite: '/services/data/v60.0' },
];

function findRoute(url) {
  const path = url.split('?')[0];
  for (const route of routes) {
    if (path === route.prefix || path.startsWith(route.prefix + '/')) {
      return route;
    }
  }
  return null;
}

/** Read the full request body as a Buffer. */
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/** Make an HTTPS request and return { statusCode, headers, body }. */
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(115000, () => req.destroy(new Error('Request timeout')));
    if (body) req.end(body);
    else req.end();
  });
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-goog-api-key, x-api-key',
};

// Static product catalog for WPM (Web Personalization Manager) catalog browser
// These IDs match the Salesforce Product2 records created for Data Cloud integration
const PRODUCTS_CATALOG = [
  { id: 'moisturizer-sensitive', salesforceId: '01tKa0000098Y4wIAE', name: 'Hydra-Calm Sensitive Moisturizer', brand: 'SERENE', category: 'moisturizer', price: 58.00 },
  { id: 'sunscreen-lightweight', salesforceId: '01tKa0000098Y4xIAE', name: 'Invisible Shield SPF 50', brand: 'SERENE', category: 'sunscreen', price: 42.00 },
  { id: 'mist-refreshing', salesforceId: '01tKa0000098Y4yIAE', name: 'Cooling Facial Mist', brand: 'SERENE', category: 'toner', price: 28.00 },
  { id: 'blotting-sheets', salesforceId: '01tKa0000098Y4zIAE', name: 'Oil Control Blotting Papers', brand: 'SERENE', category: 'travel-kit', price: 12.00 },
  { id: 'cleanser-gentle', salesforceId: '01tKa0000098Y50IAE', name: 'Cloud Cream Cleanser', brand: 'SERENE', category: 'cleanser', price: 36.00 },
  { id: 'mask-hydrating', salesforceId: '01tKa0000098Y51IAE', name: 'Deep Dew Hydrating Mask', brand: 'SERENE', category: 'mask', price: 45.00 },
  { id: 'toner-aha', salesforceId: '01tKa0000098Y52IAE', name: 'Glow Tonic AHA Toner', brand: 'SERENE', category: 'toner', price: 34.00 },
  { id: 'eye-cream', salesforceId: '01tKa0000098Y53IAE', name: 'Bright Eyes Caffeine Cream', brand: 'SERENE', category: 'eye-cream', price: 48.00 },
  { id: 'moisturizer-oil-free', salesforceId: '01tKa0000098Y54IAE', name: 'Oil-Free Hydra Gel', brand: 'SERENE', category: 'moisturizer', price: 48.00 },
  { id: 'moisturizer-rich', salesforceId: '01tKa0000098Y55IAE', name: 'Ultra Rich Barrier Cream', brand: 'SERENE', category: 'moisturizer', price: 64.00 },
  { id: 'moisturizer-spf', salesforceId: '01tKa0000098Y56IAE', name: 'Daily Defense Moisturizer SPF 30', brand: 'SERENE', category: 'moisturizer', price: 52.00 },
  { id: 'serum-vitamin-c', salesforceId: '01tKa0000098Y5PIAU', name: 'Glow Boost Vitamin C Serum', brand: 'LUMIERE', category: 'serum', price: 72.00 },
  { id: 'serum-retinol', salesforceId: '01tKa0000098Y5QIAU', name: 'Midnight Renewal Retinol Serum', brand: 'LUMIERE', category: 'serum', price: 68.00 },
  { id: 'serum-anti-aging', salesforceId: '01tKa0000098Y5RIAU', name: 'Peptide Lift Pro Serum', brand: 'LUMIERE', category: 'serum', price: 95.00 },
  { id: 'foundation-dewy', salesforceId: '01tKa0000098Y5SIAU', name: 'Skin Glow Serum Foundation', brand: 'LUMIERE', category: 'foundation', price: 52.00 },
  { id: 'lipstick-velvet', salesforceId: '01tKa0000098Y5TIAU', name: 'Velvet Matte Lip Color', brand: 'LUMIERE', category: 'lipstick', price: 34.00 },
  { id: 'mascara-volume', salesforceId: '01tKa0000098Y5UIAU', name: 'Lash Drama Volume Mascara', brand: 'LUMIERE', category: 'mascara', price: 28.00 },
  { id: 'blush-silk', salesforceId: '01tKa0000098Y5VIAU', name: 'Silk Petal Blush', brand: 'LUMIERE', category: 'blush', price: 38.00 },
  { id: 'cleanser-acne', salesforceId: '01tKa0000098Y5zIAE', name: 'Clear Start Salicylic Cleanser', brand: 'DERMAFIX', category: 'cleanser', price: 32.00 },
  { id: 'serum-niacinamide', salesforceId: '01tKa0000098Y60IAE', name: 'Pore Refine Niacinamide Serum', brand: 'DERMAFIX', category: 'serum', price: 38.00 },
  { id: 'spot-treatment', salesforceId: '01tKa0000098Y61IAE', name: 'SOS Blemish Patch', brand: 'DERMAFIX', category: 'spot-treatment', price: 18.00 },
  { id: 'sunscreen-mineral', salesforceId: '01tKa0000098Y62IAE', name: 'Barrier Shield Mineral SPF 40', brand: 'DERMAFIX', category: 'sunscreen', price: 36.00 },
  { id: 'fragrance-floral', salesforceId: '01tKa0000098Y6GIAU', name: 'Jardin de Nuit Eau de Parfum', brand: 'MAISON', category: 'fragrance', price: 125.00 },
  { id: 'fragrance-woody', salesforceId: '01tKa0000098Y6HIAU', name: 'Bois Sauvage Eau de Toilette', brand: 'MAISON', category: 'fragrance', price: 98.00 },
  { id: 'shampoo-repair', salesforceId: '01tKa0000098Y6IIAU', name: 'Bond Repair Shampoo', brand: 'MAISON', category: 'shampoo', price: 32.00 },
  { id: 'conditioner-hydrating', salesforceId: '01tKa0000098Y6JIAU', name: 'Silk Hydration Conditioner', brand: 'MAISON', category: 'conditioner', price: 34.00 },
];

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' });
    return res.end();
  }

  // Vercel rewrites /api/foo → /api/proxy?path=foo, so reconstruct the original URL.
  // Also check x-matched-path header as a fallback.
  let url = req.url;
  if (url.startsWith('/api/proxy')) {
    const parsed = new URL(url, 'http://localhost');
    const pathParam = parsed.searchParams.get('path');
    if (pathParam) {
      // Remove 'path' from query params and reconstruct
      parsed.searchParams.delete('path');
      const remaining = parsed.searchParams.toString();
      url = `/api/${pathParam}${remaining ? '?' + remaining : ''}`;
    }
  }

  // Health check
  if (url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  // Products catalog endpoint for WPM (Web Personalization Manager)
  if (url.startsWith('/api/products')) {
    const urlObj = new URL(url, 'http://localhost');
    const limit = Math.min(parseInt(urlObj.searchParams.get('limit') || '100', 10), 200);
    const offset = Math.max(parseInt(urlObj.searchParams.get('offset') || '0', 10), 0);
    const q = urlObj.searchParams.get('q') || '';

    let filtered = PRODUCTS_CATALOG;
    if (q) {
      const search = q.toLowerCase();
      filtered = PRODUCTS_CATALOG.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.brand.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search)
      );
    }

    const paged = filtered.slice(offset, offset + limit);
    const result = JSON.stringify({
      products: paged,
      total: filtered.length,
      offset,
      limit,
      source: 'static-catalog'
    });

    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    return res.end(result);
  }

  try {
    // --- SOQL query proxy ---
    if (url === '/api/sf-query' && req.method === 'POST') {
      const body = await readBody(req);
      const { soql, token } = JSON.parse(body.toString());
      if (!soql || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing soql or token' }));
      }
      const sfUrl = new URL(SF_INSTANCE);
      const result = await httpsRequest({
        hostname: sfUrl.hostname,
        port: 443,
        path: `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
        method: 'GET',
        headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
      });
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(result.body);
    }

    // --- Create sObject record ---
    if (url === '/api/sf-record' && req.method === 'POST') {
      const body = await readBody(req);
      const { sobject, fields, token } = JSON.parse(body.toString());
      if (!sobject || !fields || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing sobject, fields, or token' }));
      }
      const jsonBody = JSON.stringify(fields);
      const sfUrl = new URL(SF_INSTANCE);
      const result = await httpsRequest({
        hostname: sfUrl.hostname,
        port: 443,
        path: `/services/data/v60.0/sobjects/${sobject}`,
        method: 'POST',
        headers: { host: sfUrl.hostname, 'content-type': 'application/json', 'content-length': Buffer.byteLength(jsonBody), authorization: `Bearer ${token}`, accept: 'application/json' },
      }, jsonBody);
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(result.body);
    }

    // --- Update sObject record ---
    if (url.startsWith('/api/sf-record/') && req.method === 'PATCH') {
      const recordId = url.split('/api/sf-record/')[1]?.split('?')[0];
      const body = await readBody(req);
      const { sobject, fields, token } = JSON.parse(body.toString());
      if (!sobject || !recordId || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing sobject, recordId, or token' }));
      }
      const jsonBody = JSON.stringify(fields);
      const sfUrl = new URL(SF_INSTANCE);
      const result = await httpsRequest({
        hostname: sfUrl.hostname,
        port: 443,
        path: `/services/data/v60.0/sobjects/${sobject}/${recordId}`,
        method: 'PATCH',
        headers: { host: sfUrl.hostname, 'content-type': 'application/json', 'content-length': Buffer.byteLength(jsonBody), authorization: `Bearer ${token}`, accept: 'application/json' },
      }, jsonBody);
      if (result.statusCode === 204) {
        res.writeHead(204, CORS_HEADERS);
        return res.end();
      }
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(result.body);
    }

    // --- CMS Upload via ContentVersion ---
    if (url === '/api/cms-upload' && req.method === 'POST') {
      const body = await readBody(req);
      const { imageBase64, fileName, title, tags, token } = JSON.parse(body.toString());
      const contentVersionBody = JSON.stringify({
        Title: title || fileName,
        PathOnClient: fileName,
        Description: (tags || []).join(', '),
        VersionData: imageBase64,
      });
      const sfUrl = new URL(SF_INSTANCE);
      const result = await httpsRequest({
        hostname: sfUrl.hostname,
        port: 443,
        path: '/services/data/v60.0/sobjects/ContentVersion',
        method: 'POST',
        headers: { host: sfUrl.hostname, 'content-type': 'application/json', 'content-length': Buffer.byteLength(contentVersionBody), authorization: `Bearer ${token}`, accept: 'application/json' },
      }, contentVersionBody);

      if (result.statusCode === 201) {
        try {
          const { id: versionId } = JSON.parse(result.body.toString());
          // Query ContentDocumentId
          const queryResult = await httpsRequest({
            hostname: sfUrl.hostname,
            port: 443,
            path: `/services/data/v60.0/sobjects/ContentVersion/${versionId}?fields=ContentDocumentId`,
            method: 'GET',
            headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
          });
          const qData = JSON.parse(queryResult.body.toString());
          const responseBody = JSON.stringify({ id: versionId, contentDocumentId: qData.ContentDocumentId, imageUrl: `/api/sf-file/${versionId}` });
          res.writeHead(201, { 'Content-Type': 'application/json', ...CORS_HEADERS });
          return res.end(responseBody);
        } catch {
          const { id: versionId } = JSON.parse(result.body.toString());
          const responseBody = JSON.stringify({ id: versionId, imageUrl: `/api/sf-file/${versionId}` });
          res.writeHead(201, { 'Content-Type': 'application/json', ...CORS_HEADERS });
          return res.end(responseBody);
        }
      }
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(result.body);
    }

    // --- Serve ContentVersion file data ---
    if (url.startsWith('/api/sf-file/') && req.method === 'GET') {
      const versionId = url.split('/api/sf-file/')[1]?.split('?')[0];
      const authHeader = req.headers.authorization;
      if (!versionId || !authHeader) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing version ID or authorization' }));
      }
      const sfUrl = new URL(SF_INSTANCE);
      const result = await httpsRequest({
        hostname: sfUrl.hostname,
        port: 443,
        path: `/services/data/v60.0/sobjects/ContentVersion/${versionId}/VersionData`,
        method: 'GET',
        headers: { host: sfUrl.hostname, authorization: authHeader, accept: '*/*' },
      });
      const resHeaders = { ...CORS_HEADERS };
      if (result.headers['content-type']) resHeaders['Content-Type'] = result.headers['content-type'];
      res.writeHead(result.statusCode, resHeaders);
      return res.end(result.body);
    }

    // --- Generic route-based proxy ---
    const route = findRoute(url);
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: 'Not found' }));
    }

    const targetUrl = new URL(route.target);
    const remotePath = route.rewrite + url.slice(route.prefix.length);

    const headers = { host: targetUrl.hostname };
    const forwardHeaders = ['content-type', 'content-length', 'authorization', 'x-goog-api-key', 'x-api-key', 'accept'];
    for (const h of forwardHeaders) {
      if (req.headers[h]) headers[h] = req.headers[h];
    }
    if (!headers.accept || headers.accept.includes('text/html')) {
      headers.accept = 'application/json';
    }

    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : null;
    if (body) {
      headers['content-length'] = body.length;
      delete headers['transfer-encoding'];
    }

    const result = await httpsRequest({
      hostname: targetUrl.hostname,
      port: 443,
      path: remotePath,
      method: req.method,
      headers,
    }, body);

    const resHeaders = { ...CORS_HEADERS };
    if (result.headers['content-type']) resHeaders['Content-Type'] = result.headers['content-type'];
    res.writeHead(result.statusCode, resHeaders);
    return res.end(result.body);

  } catch (err) {
    console.error('[api/proxy] Error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    }
  }
}
