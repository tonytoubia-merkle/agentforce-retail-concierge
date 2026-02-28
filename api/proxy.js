// Vercel Serverless Function — single catch-all API proxy
// Mirrors the logic from server/index.js but as a serverless handler.

import https from 'node:https';

const SF_INSTANCE = process.env.VITE_AGENTFORCE_INSTANCE_URL || 'https://me1769724439764.my.salesforce.com';
const CLIENT_ID = process.env.VITE_AGENTFORCE_CLIENT_ID;
const CLIENT_SECRET = process.env.VITE_AGENTFORCE_CLIENT_SECRET;

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

/** Get a server-side OAuth token using Client Credentials flow */
async function getServerToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;
  const sfUrl = new URL(SF_INSTANCE);
  const body = 'grant_type=client_credentials';
  const result = await httpsRequest({
    hostname: sfUrl.hostname,
    port: 443,
    path: '/services/oauth2/token',
    method: 'POST',
    headers: {
      host: sfUrl.hostname,
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': Buffer.byteLength(body),
      authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      accept: 'application/json',
    },
  }, body);
  try {
    const json = JSON.parse(result.body.toString());
    return json.access_token || null;
  } catch {
    return null;
  }
}

/** Helper to run Salesforce REST API calls */
async function sfFetch(token, method, sfPath, body) {
  const sfUrl = new URL(SF_INSTANCE);
  const bodyStr = body ? JSON.stringify(body) : null;
  const headers = {
    host: sfUrl.hostname,
    authorization: `Bearer ${token}`,
    accept: 'application/json',
  };
  if (bodyStr) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(bodyStr);
  }
  const result = await httpsRequest({
    hostname: sfUrl.hostname,
    port: 443,
    path: sfPath,
    method,
    headers,
  }, bodyStr);
  if (result.statusCode === 204) return { statusCode: 204 };
  try {
    return { statusCode: result.statusCode, data: JSON.parse(result.body.toString()) };
  } catch {
    return { statusCode: result.statusCode, raw: result.body.toString() };
  }
}

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
      const { sobject, fields, token: clientToken } = JSON.parse(body.toString());
      const authToken = clientToken || await getServerToken();
      if (!sobject || !fields || !authToken) {
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
        headers: { host: sfUrl.hostname, 'content-type': 'application/json', 'content-length': Buffer.byteLength(jsonBody), authorization: `Bearer ${authToken}`, accept: 'application/json' },
      }, jsonBody);
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(result.body);
    }

    // --- Update sObject record ---
    if (url.startsWith('/api/sf-record/') && req.method === 'PATCH') {
      const recordId = url.split('/api/sf-record/')[1]?.split('?')[0];
      const body = await readBody(req);
      const { sobject, fields, token: clientToken } = JSON.parse(body.toString());
      const authToken = clientToken || await getServerToken();
      if (!sobject || !recordId || !authToken) {
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
        headers: { host: sfUrl.hostname, 'content-type': 'application/json', 'content-length': Buffer.byteLength(jsonBody), authorization: `Bearer ${authToken}`, accept: 'application/json' },
      }, jsonBody);
      if (result.statusCode === 204) {
        res.writeHead(204, CORS_HEADERS);
        return res.end();
      }
      res.writeHead(result.statusCode, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(result.body);
    }

    // --- Delete sObject record ---
    if (url.startsWith('/api/sf-record/') && req.method === 'DELETE') {
      const recordId = url.split('/api/sf-record/')[1]?.split('?')[0];
      const body = await readBody(req);
      const { sobject, token: clientToken } = JSON.parse(body.toString());
      const authToken = clientToken || await getServerToken();
      if (!sobject || !recordId || !authToken) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing sobject, recordId, or token' }));
      }
      const sfUrl = new URL(SF_INSTANCE);
      const result = await httpsRequest({
        hostname: sfUrl.hostname,
        port: 443,
        path: `/services/data/v60.0/sobjects/${sobject}/${recordId}`,
        method: 'DELETE',
        headers: { host: sfUrl.hostname, authorization: `Bearer ${authToken}`, accept: 'application/json' },
      });
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

    // --- GET /api/demo/contacts — List demo contacts from CRM ---
    if (url.startsWith('/api/demo/contacts') && req.method === 'GET') {
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ contacts: [] }));
      }
      const soql = "SELECT Id, FirstName, LastName, Email, Demo_Profile__c, Merkury_Id__c FROM Contact WHERE Demo_Profile__c != null ORDER BY Demo_Profile__c, LastName";
      const result = await sfFetch(token, 'GET', `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`);
      const contacts = (result.data?.records || []).map(r => ({
        id: r.Id,
        firstName: r.FirstName,
        lastName: r.LastName,
        email: r.Email,
        demoProfile: r.Demo_Profile__c,
        merkuryId: r.Merkury_Id__c || null,
      }));
      const json = JSON.stringify({ contacts });
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
    }

    // --- POST /api/contacts — Create Account + Contact in CRM ---
    if (url === '/api/contacts' && req.method === 'POST') {
      const body = await readBody(req);
      const { firstName, lastName, email, merkuryId, demoProfile, leadSource, beautyFields } = JSON.parse(body.toString());
      if (!email) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing email' }));
      }
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      // Check if contact already exists
      const existingQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, AccountId FROM Contact WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`)}`);
      const existing = existingQ.data?.records?.[0];
      if (existing) {
        const json = JSON.stringify({ success: true, contactId: existing.Id, accountId: existing.AccountId, existing: true });
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(json);
      }
      // Create Account
      const fName = firstName || email.split('@')[0];
      const lName = lastName || 'Customer';
      const accountRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/Account', { Name: `${fName} ${lName} Household` });
      const accountId = accountRes.data?.id;
      if (!accountId) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Failed to create Account', details: accountRes.data }));
      }
      // Create Contact
      const contactFields = {
        FirstName: fName,
        LastName: lName,
        Email: email,
        AccountId: accountId,
        Demo_Profile__c: demoProfile || 'Created',
        LeadSource: leadSource || 'Web',
        ...(merkuryId && { Merkury_Id__c: merkuryId }),
        ...(beautyFields || {}),
      };
      const contactRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/Contact', contactFields);
      const contactId = contactRes.data?.id;
      if (!contactId) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Failed to create Contact', details: contactRes.data }));
      }
      console.log(`[contacts] Created Account ${accountId} + Contact ${contactId} for ${email}`);
      const json = JSON.stringify({ success: true, contactId, accountId });
      res.writeHead(201, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
    }

    // --- POST /api/checkout — Create real Salesforce Order with OrderItems ---
    if (url === '/api/checkout' && req.method === 'POST') {
      const body = await readBody(req);
      const { contactId, accountId: providedAccountId, items, paymentMethod, total } = JSON.parse(body.toString());

      if (!items || !items.length) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing items' }));
      }

      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }

      // 1. Resolve AccountId
      let accountId = providedAccountId;
      if (!accountId && contactId) {
        const contactRes = await sfFetch(token, 'GET',
          `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT AccountId FROM Contact WHERE Id = '${contactId.replace(/'/g, "\\'")}' LIMIT 1`)}`);
        accountId = contactRes.data?.records?.[0]?.AccountId;
      }
      if (!accountId) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Could not resolve AccountId' }));
      }

      // 2. Get Standard Pricebook
      const pbRes = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent("SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1")}`);
      const pricebookId = pbRes.data?.records?.[0]?.Id;
      if (!pricebookId) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Standard Price Book not found' }));
      }

      // 3. Create Order (Draft) with tracking fields
      const today = new Date().toISOString().split('T')[0];
      const estDelivery = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
      const carriers = ['UPS', 'FedEx', 'USPS'];
      const carrier = carriers[Math.floor(Math.random() * carriers.length)];
      const trackingNumber = `1Z${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

      const orderRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/Order', {
        AccountId: accountId,
        Pricebook2Id: pricebookId,
        Status: 'Draft',
        EffectiveDate: today,
        Payment_Method__c: paymentMethod || 'Test Card',
        Shipping_Status__c: 'Processing',
        Tracking_Number__c: trackingNumber,
        Carrier__c: carrier,
        Estimated_Delivery__c: estDelivery,
      });
      if (!orderRes.data?.id) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Failed to create Order', details: orderRes.data }));
      }
      const orderId = orderRes.data.id;
      console.log(`[checkout] Created Order ${orderId}`);

      // 4. Create PricebookEntries (if needed) + OrderItems
      for (const item of items) {
        const pbeCheck = await sfFetch(token, 'GET',
          `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id FROM PricebookEntry WHERE Product2Id = '${item.product2Id}' AND Pricebook2Id = '${pricebookId}' AND IsActive = true LIMIT 1`)}`);
        let pbeId = pbeCheck.data?.records?.[0]?.Id;

        if (!pbeId) {
          const pbeRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/PricebookEntry', {
            Pricebook2Id: pricebookId,
            Product2Id: item.product2Id,
            UnitPrice: item.unitPrice,
            IsActive: true,
          });
          pbeId = pbeRes.data?.id;
        }

        await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/OrderItem', {
          OrderId: orderId,
          PricebookEntryId: pbeId,
          Quantity: item.quantity,
          UnitPrice: item.unitPrice,
        });
      }

      // 5. Activate Order
      await sfFetch(token, 'PATCH', `/services/data/v60.0/sobjects/Order/${orderId}`, { Status: 'Activated' });
      console.log(`[checkout] Activated Order ${orderId}`);

      // 6. Fetch OrderNumber
      const orderQuery = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT OrderNumber FROM Order WHERE Id = '${orderId}' LIMIT 1`)}`);
      const orderNumber = orderQuery.data?.records?.[0]?.OrderNumber;

      // 7. Accrue loyalty points (10% back)
      let pointsEarned = 0;
      if (total > 0) {
        const pts = Math.floor(total * 0.10);
        if (pts >= 1) {
          try {
            const memberQuery = await sfFetch(token, 'GET',
              `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, ProgramId FROM LoyaltyProgramMember WHERE ContactId IN (SELECT Id FROM Contact WHERE AccountId = '${accountId}') AND MemberStatus = 'Active' LIMIT 1`)}`);
            const member = memberQuery.data?.records?.[0];
            if (member) {
              const currencyQuery = await sfFetch(token, 'GET',
                `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id FROM LoyaltyProgramCurrency WHERE LoyaltyProgramId = '${member.ProgramId}' AND IsActive = true LIMIT 1`)}`);
              const currencyId = currencyQuery.data?.records?.[0]?.Id;
              if (currencyId) {
                const ledgerRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/LoyaltyLedger', {
                  LoyaltyProgramMemberId: member.Id,
                  LoyaltyProgramCurrencyId: currencyId,
                  Points: pts,
                  EventType: 'Credit',
                  ActivityDate: new Date().toISOString(),
                });
                if (ledgerRes.data?.id) {
                  pointsEarned = pts;
                  console.log(`[checkout] Accrued ${pts} loyalty points for order ${orderNumber}`);
                }
              }
            }
          } catch (loyaltyErr) {
            console.log(`[checkout] Loyalty points skipped: ${loyaltyErr.message}`);
          }
        }
      }

      const result = JSON.stringify({
        success: true,
        orderId,
        orderNumber,
        trackingNumber,
        carrier,
        estimatedDelivery: estDelivery,
        shippingStatus: 'Processing',
        pointsEarned,
      });
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(result);
    }

    // --- POST /api/order/simulate-shipment — Demo: advance shipping status ---
    if (url === '/api/order/simulate-shipment' && req.method === 'POST') {
      const body = await readBody(req);
      const { orderId, newStatus } = JSON.parse(body.toString());
      if (!orderId || !newStatus) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing orderId or newStatus' }));
      }
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      const fields = { Shipping_Status__c: newStatus };
      if (newStatus === 'Shipped') fields.Shipped_Date__c = new Date().toISOString().split('T')[0];
      if (newStatus === 'Delivered') fields.Delivered_Date__c = new Date().toISOString().split('T')[0];
      await sfFetch(token, 'PATCH', `/services/data/v60.0/sobjects/Order/${orderId}`, fields);
      const json = JSON.stringify({ success: true, orderId, newStatus });
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
    }

    // --- POST /api/loyalty/enroll ---
    if (url === '/api/loyalty/enroll' && req.method === 'POST') {
      const body = await readBody(req);
      const { contactId, accountId: providedAcctId } = JSON.parse(body.toString());
      if (!contactId) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing contactId' }));
      }
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      // Resolve account
      let accountId = providedAcctId;
      if (!accountId) {
        const cRes = await sfFetch(token, 'GET',
          `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT AccountId FROM Contact WHERE Id = '${contactId}' LIMIT 1`)}`);
        accountId = cRes.data?.records?.[0]?.AccountId;
      }
      // Find loyalty program
      const progRes = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent("SELECT Id FROM LoyaltyProgram WHERE Status = 'Active' LIMIT 1")}`);
      const programId = progRes.data?.records?.[0]?.Id;
      if (!programId) {
        res.writeHead(404, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'No active loyalty program found' }));
      }
      // Check existing membership
      const existCheck = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, MembershipNumber FROM LoyaltyProgramMember WHERE ContactId = '${contactId}' AND MemberStatus = 'Active' LIMIT 1`)}`);
      if (existCheck.data?.records?.length > 0) {
        const m = existCheck.data.records[0];
        const json = JSON.stringify({ success: true, memberId: m.Id, membershipNumber: m.MembershipNumber, existing: true });
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(json);
      }
      // Enroll
      const memberRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/LoyaltyProgramMember', {
        ProgramId: programId,
        ContactId: contactId,
        MemberStatus: 'Active',
        EnrollmentDate: new Date().toISOString().split('T')[0],
        MemberType: 'Individual',
      });
      if (!memberRes.data?.id) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Failed to enroll', details: memberRes.data }));
      }
      console.log(`[loyalty] Enrolled ${contactId} → member ${memberRes.data.id}`);
      const json = JSON.stringify({ success: true, memberId: memberRes.data.id });
      res.writeHead(201, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
    }

    // --- GET /api/loyalty/member/:accountId ---
    if (url.startsWith('/api/loyalty/member/') && req.method === 'GET') {
      const accountId = url.split('/api/loyalty/member/')[1]?.split('?')[0];
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      const memberQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, MembershipNumber, EnrollmentDate, MemberStatus FROM LoyaltyProgramMember WHERE ContactId IN (SELECT Id FROM Contact WHERE AccountId = '${accountId}') AND MemberStatus = 'Active' LIMIT 1`)}`);
      const member = memberQ.data?.records?.[0];
      if (!member) {
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ enrolled: false }));
      }
      const json = JSON.stringify({ enrolled: true, memberId: member.Id, membershipNumber: member.MembershipNumber, enrollmentDate: member.EnrollmentDate });
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
    }

    // --- GET /api/loyalty/balance/:accountId ---
    if (url.startsWith('/api/loyalty/balance/') && req.method === 'GET') {
      const accountId = url.split('/api/loyalty/balance/')[1]?.split('?')[0];
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      const memberQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id FROM LoyaltyProgramMember WHERE ContactId IN (SELECT Id FROM Contact WHERE AccountId = '${accountId}') AND MemberStatus = 'Active' LIMIT 1`)}`);
      const memberId = memberQ.data?.records?.[0]?.Id;
      if (!memberId) {
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ pointsBalance: 0, totalAccrued: 0 }));
      }
      const balQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT PointsBalance, TotalPointsAccrued FROM LoyaltyMemberCurrency WHERE LoyaltyMemberId = '${memberId}' LIMIT 1`)}`);
      const bal = balQ.data?.records?.[0];
      const json = JSON.stringify({ pointsBalance: bal?.PointsBalance || 0, totalAccrued: bal?.TotalPointsAccrued || 0 });
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
    }

    // --- POST /api/loyalty/accrue ---
    if (url === '/api/loyalty/accrue' && req.method === 'POST') {
      const body = await readBody(req);
      const { accountId, points, reason } = JSON.parse(body.toString());
      if (!accountId || !points) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing accountId or points' }));
      }
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      const memberQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, ProgramId FROM LoyaltyProgramMember WHERE ContactId IN (SELECT Id FROM Contact WHERE AccountId = '${accountId}') AND MemberStatus = 'Active' LIMIT 1`)}`);
      const member = memberQ.data?.records?.[0];
      if (!member) {
        res.writeHead(404, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'No active loyalty member found' }));
      }
      const currQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id FROM LoyaltyProgramCurrency WHERE LoyaltyProgramId = '${member.ProgramId}' AND IsActive = true LIMIT 1`)}`);
      const currencyId = currQ.data?.records?.[0]?.Id;
      if (!currencyId) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'No active loyalty currency found' }));
      }
      const ledgerRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/LoyaltyLedger', {
        LoyaltyProgramMemberId: member.Id,
        LoyaltyProgramCurrencyId: currencyId,
        Points: points,
        EventType: 'Credit',
        ActivityDate: new Date().toISOString(),
      });
      const json = JSON.stringify({ success: true, pointsAccrued: points, ledgerId: ledgerRes.data?.id });
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
    }

    // --- POST /api/loyalty/redeem ---
    if (url === '/api/loyalty/redeem' && req.method === 'POST') {
      const body = await readBody(req);
      const { accountId, points, reason } = JSON.parse(body.toString());
      if (!accountId || !points) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing accountId or points' }));
      }
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      const memberQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, ProgramId FROM LoyaltyProgramMember WHERE ContactId IN (SELECT Id FROM Contact WHERE AccountId = '${accountId}') AND MemberStatus = 'Active' LIMIT 1`)}`);
      const member = memberQ.data?.records?.[0];
      if (!member) {
        res.writeHead(404, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'No active loyalty member found' }));
      }
      // Check balance
      const balQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, PointsBalance FROM LoyaltyMemberCurrency WHERE LoyaltyMemberId = '${member.Id}' LIMIT 1`)}`);
      const bal = balQ.data?.records?.[0];
      if (!bal || bal.PointsBalance < points) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Insufficient points', available: bal?.PointsBalance || 0 }));
      }
      const currQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id FROM LoyaltyProgramCurrency WHERE LoyaltyProgramId = '${member.ProgramId}' AND IsActive = true LIMIT 1`)}`);
      const currencyId = currQ.data?.records?.[0]?.Id;
      const ledgerRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/LoyaltyLedger', {
        LoyaltyProgramMemberId: member.Id,
        LoyaltyProgramCurrencyId: currencyId,
        Points: -points,
        EventType: 'Debit',
        ActivityDate: new Date().toISOString(),
      });
      const json = JSON.stringify({ success: true, pointsRedeemed: points, ledgerId: ledgerRes.data?.id });
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
    }

    // --- POST /api/appointments — Book an in-store appointment ---
    if (url === '/api/appointments' && req.method === 'POST') {
      const body = await readBody(req);
      const { contactId, storeLocation, appointmentDateTime, appointmentType, customerNotes } = JSON.parse(body.toString());
      if (!contactId || !storeLocation || !appointmentDateTime || !appointmentType) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing required fields: contactId, storeLocation, appointmentDateTime, appointmentType' }));
      }
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      // Determine identity tier
      let identityTier = 'Anonymous';
      const contactQ = await sfFetch(token, 'GET',
        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Demo_Profile__c, Email FROM Contact WHERE Id = '${contactId}' LIMIT 1`)}`);
      const contact = contactQ.data?.records?.[0];
      if (contact) {
        if (contact.Demo_Profile__c === 'Merkury') identityTier = 'Appended';
        else if (contact.Email) identityTier = 'Known';
      }
      const apptRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/Store_Appointment__c', {
        Contact__c: contactId,
        Store_Location__c: storeLocation,
        Appointment_DateTime__c: appointmentDateTime,
        Type__c: appointmentType,
        Status__c: 'Booked',
        Channel__c: 'Online',
        Customer_Notes__c: customerNotes || null,
        Identity_Tier__c: identityTier,
      });
      if (!apptRes.data?.id) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Failed to create appointment', details: apptRes.data }));
      }
      console.log(`[appointments] Created Store_Appointment__c ${apptRes.data.id} for ${contactId}`);
      const json = JSON.stringify({ success: true, appointmentId: apptRes.data.id });
      res.writeHead(201, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
    }

    // --- GET /api/appointments?contactId=xxx — Get customer's appointments ---
    if (url.startsWith('/api/appointments') && req.method === 'GET') {
      const urlObj = new URL(url, 'http://localhost');
      const contactId = urlObj.searchParams.get('contactId');
      if (!contactId) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Missing contactId query parameter' }));
      }
      const authHeader = req.headers.authorization;
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : await getServerToken();
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        return res.end(JSON.stringify({ error: 'Unauthorized' }));
      }
      const soql = `SELECT Id, Name, Store_Location__c, Appointment_DateTime__c, Type__c, Status__c, Channel__c, Customer_Notes__c FROM Store_Appointment__c WHERE Contact__c = '${contactId.replace(/'/g, "\\'")}' AND Status__c NOT IN ('Cancelled') ORDER BY Appointment_DateTime__c DESC LIMIT 10`;
      const result = await sfFetch(token, 'GET', `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`);
      const appointments = (result.data?.records || []).map(r => ({
        id: r.Id,
        name: r.Name,
        storeLocation: r.Store_Location__c,
        appointmentDateTime: r.Appointment_DateTime__c,
        type: r.Type__c,
        status: r.Status__c,
        channel: r.Channel__c,
        customerNotes: r.Customer_Notes__c,
      }));
      const json = JSON.stringify({ appointments });
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(json);
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
    const forwardHeaders = ['content-type', 'content-length', 'authorization', 'x-goog-api-key', 'x-api-key', 'x-model-version', 'accept'];
    for (const h of forwardHeaders) {
      if (req.headers[h]) headers[h] = req.headers[h];
    }
    if (!headers.accept || headers.accept.includes('text/html')) {
      headers.accept = 'application/json';
    }
    // For Salesforce routes, auto-fetch a server-side token if none provided
    if (!headers.authorization && route.target === SF_INSTANCE) {
      const token = await getServerToken();
      if (token) headers.authorization = `Bearer ${token}`;
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
