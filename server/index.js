import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const env = {};
  try {
    const content = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  } catch { /* .env.local not found */ }
  return env;
}

const env = loadEnv();
const SF_INSTANCE = env.VITE_AGENTFORCE_INSTANCE_URL || 'https://me1769724439764.my.salesforce.com';
const CLIENT_ID = env.VITE_AGENTFORCE_CLIENT_ID || process.env.VITE_AGENTFORCE_CLIENT_ID;
const CLIENT_SECRET = env.VITE_AGENTFORCE_CLIENT_SECRET || process.env.VITE_AGENTFORCE_CLIENT_SECRET;
const BASE_URL = env.VITE_AGENTFORCE_BASE_URL || process.env.VITE_AGENTFORCE_BASE_URL;
const PORT = process.env.API_PORT || 3001;

const routes = [
  { prefix: '/api/oauth/token',            target: SF_INSTANCE,                                 rewrite: '/services/oauth2/token' },
  { prefix: '/api/agentforce',             target: 'https://api.salesforce.com',                rewrite: '/einstein/ai-agent/v1' },
  { prefix: '/api/cms-media',              target: SF_INSTANCE,                                 rewrite: '/cms/delivery/media' },
  { prefix: '/api/cms',                    target: SF_INSTANCE,                                 rewrite: '/services/data/v60.0/connect/cms' },
  { prefix: '/api/imagen/generate',        target: 'https://generativelanguage.googleapis.com', rewrite: '/v1beta/models/imagen-4.0-generate-001:predict' },
  { prefix: '/api/gemini/generateContent', target: 'https://generativelanguage.googleapis.com', rewrite: '/v1beta/models/gemini-2.5-flash-image:generateContent' },
  { prefix: '/api/firefly/token',          target: 'https://ims-na1.adobelogin.com',            rewrite: '/ims/token/v3' },
  { prefix: '/api/firefly/generate',       target: 'https://firefly-api.adobe.io',              rewrite: '/v3/images/generate' },
  { prefix: '/api/datacloud',              target: SF_INSTANCE,                                 rewrite: '/services/data/v60.0' },
  // GraphQL endpoint (org-dependent) will be proxied via custom handlers below rather than static proxy
];

function findRoute(url) {
  for (const route of routes) {
    if (url === route.prefix || url.startsWith(route.prefix + '/') || url.startsWith(route.prefix + '?')) {
      return route;
    }
  }
  return null;
}

// Catch unhandled errors to prevent server crash
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err.message, err.stack?.split('\n')[1]);
});
process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection:', err);
});

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-goog-api-key, x-api-key',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // --- OAuth 2.0 Client Credentials token using Agentforce Connected App ---
  // POST /api/sf/token  -> { access_token, instance_url }
  if (req.url === '/api/sf/token' && req.method === 'POST') {
    try {
      if (!CLIENT_ID || !CLIENT_SECRET || !SF_INSTANCE) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Missing CLIENT_ID/CLIENT_SECRET/SF_INSTANCE' }));
        return;
      }
      const body = 'grant_type=client_credentials';
      const sfUrl = new URL(SF_INSTANCE);
      const opts = {
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
      };
      const tokenReq = https.request(opts, (tokenRes) => {
        const chunks = [];
        tokenRes.on('data', (c) => chunks.push(c));
        tokenRes.on('end', () => {
          const buf = Buffer.concat(chunks);
          res.writeHead(tokenRes.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': buf.length });
          res.end(buf);
        });
      });
      tokenReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      tokenReq.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Token request failed' }));
    }
    return;
  }

  // --- Salesforce GraphQL Product endpoints (Node BFF) ---
  // POST /api/sf-graphql — generic passthrough for GraphQL queries (server-to-server)
  if (req.url === '/api/sf-graphql' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const { query, variables, token } = JSON.parse(Buffer.concat(chunks).toString());
        if (!query || !token) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing query or token' }));
          return;
        }
        const sfUrl = new URL(SF_INSTANCE);
        const gPath = '/services/data/v60.0/graphql';
        const body = JSON.stringify({ query, variables: variables || {} });
        const opts = {
          hostname: sfUrl.hostname,
          port: 443,
          path: gPath,
          method: 'POST',
          headers: {
            host: sfUrl.hostname,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
            authorization: `Bearer ${token}`,
            accept: 'application/json',
          },
        };
        const proxyReq = https.request(opts, (proxyRes) => {
          const resChunks = [];
          proxyRes.on('data', (c) => resChunks.push(c));
          proxyRes.on('end', () => {
            const bodyBuf = Buffer.concat(resChunks);
            res.writeHead(proxyRes.statusCode, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'content-length': bodyBuf.length });
            res.end(bodyBuf);
          });
        });
        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        proxyReq.end(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // Helper: obtain server-side token via Client Credentials if Authorization not supplied
  function withServerToken(authHeader, cb) {
    if (authHeader) {
      cb(authHeader.replace(/^Bearer\s+/i, ''));
      return;
    }
    if (!CLIENT_ID || !CLIENT_SECRET) {
      cb(null);
      return;
    }
    const sfUrl = new URL(SF_INSTANCE);
    const body = 'grant_type=client_credentials';
    const opts = {
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
    };
    const tReq = https.request(opts, (tRes) => {
      const chunks = [];
      tRes.on('data', (c) => chunks.push(c));
      tRes.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString());
          const tok = json.access_token;
          cb(tok || null);
        } catch {
          cb(null);
        }
      });
    });
    tReq.on('error', () => cb(null));
    tReq.end(body);
  }

  // GET /api/products — headless storefront product list sourced from Product2 + PricebookEntry
  if (req.url.startsWith('/api/products') && req.method === 'GET') {
    // Parse query params
    const urlObj = new URL(req.url, 'http://localhost');
    const q = urlObj.searchParams.get('q') || '';
    const limit = Math.min(parseInt(urlObj.searchParams.get('limit') || '24', 10), 200);
    const offset = Math.max(parseInt(urlObj.searchParams.get('offset') || '0', 10), 0);
    const pricebookName = urlObj.searchParams.get('pricebook') || 'Standard Price Book';

    const authHeader = req.headers.authorization;

    // Try to use provided Authorization; else, fetch a server-side token via Client Credentials
    return withServerToken(authHeader, (token) => {
      if (!token) {
        // No token available — return empty set so UI falls back to mocks
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ products: [], total: 0, offset, limit, source: 'fallback' }));
        return;
      }

    // GraphQL to fetch Product2s with pricing from PricebookEntry via pricebook name
    const query = `
      query ProductList($q: String, $limit: Int, $offset: Int, $pricebookName: String!) {
        uiapi {
          query {
            Pricebook2(where: { Name: { eq: $pricebookName } }, first: 1) {
              edges { node { Id } }
            }
            Product2(
              where: {
                ${/* simple name/description contains */''}
                OR: [
                  { Name: { like: $q } },
                  { Description: { like: $q } }
                ]
              },
              first: $limit,
              offset: $offset,
              orderBy: { Name: { order: ASC } }
            ) {
              totalCount
              edges {
                node {
                  Id
                  Name
                  ProductCode
                  Description
                  Family
                  Fields {
                    Id { value }
                  }
                  // image field optional if you have custom field mapping
                }
              }
            }
            // Pricebook entries by product
          }
        }
      }
    `;

    // For simplicity in this first pass, we'll call REST SOQL for price linkage after GraphQL returns
    const chunks = [];
    const sfUrl = new URL(SF_INSTANCE);

    // First: GraphQL request to get products and pricebook id
    const gqlBody = JSON.stringify({
      query,
      variables: {
        q: q ? `%${q}%` : null,
        limit,
        offset,
        pricebookName,
      },
    });
    const gqlOpts = {
      hostname: sfUrl.hostname,
      port: 443,
      path: '/services/data/v60.0/graphql',
      method: 'POST',
      headers: {
        host: sfUrl.hostname,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(gqlBody),
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    };

    const gqlReq = https.request(gqlOpts, (gqlRes) => {
      const gqlChunks = [];
      gqlRes.on('data', (c) => gqlChunks.push(c));
      gqlRes.on('end', () => {
        try {
          const gqlData = JSON.parse(Buffer.concat(gqlChunks).toString());
          const ui = gqlData.data?.uiapi;
          const productsEdges = ui?.query?.Product2?.edges || [];
          const total = ui?.query?.Product2?.totalCount || 0;

          // Collect product Ids
          const productIds = productsEdges.map((e) => e.node?.Id).filter(Boolean);
          if (productIds.length === 0) {
            const result = JSON.stringify({ products: [], total, offset, limit, source: 'salesforce-graph' });
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(result) });
            res.end(result);
            return;
          }

          // Fetch Standard Pricebook Id
          const soqlPb = `SELECT Id FROM Pricebook2 WHERE Name = '${pricebookName.replace(/'/g, "\\'")}' LIMIT 1`;
          const pbOpts = {
            hostname: sfUrl.hostname,
            port: 443,
            path: `/services/data/v60.0/query?q=${encodeURIComponent(soqlPb)}`,
            method: 'GET',
            headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
          };
          const pbReq = https.request(pbOpts, (pbRes) => {
            const pbChunks = [];
            pbRes.on('data', (c) => pbChunks.push(c));
            pbRes.on('end', () => {
              try {
                const pbData = JSON.parse(Buffer.concat(pbChunks).toString());
                const pricebookId = pbData.records?.[0]?.Id;

                // Fetch price entries for these products
                const soql = `SELECT Id, UnitPrice, CurrencyIsoCode, Product2Id FROM PricebookEntry WHERE Pricebook2Id = '${pricebookId}' AND Product2Id IN (${productIds.map((id) => `'${id}'`).join(',')}) AND IsActive = true`;
                const opts = {
                  hostname: sfUrl.hostname,
                  port: 443,
                  path: `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
                  method: 'GET',
                  headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
                };
                const pReq = https.request(opts, (pRes) => {
                  const pChunks = [];
                  pRes.on('data', (c) => pChunks.push(c));
                  pRes.on('end', () => {
                    try {
                      const pData = JSON.parse(Buffer.concat(pChunks).toString());
                      const pricesByProduct = {};
                      for (const rec of pData.records || []) {
                        pricesByProduct[rec.Product2Id] = { price: rec.UnitPrice, currency: rec.CurrencyIsoCode || 'USD' };
                      }

                      // Map to UI product shape minimal for now
                      const mapped = productsEdges.map((e) => {
                        const n = e.node;
                        const priceInfo = pricesByProduct[n.Id] || { price: 0, currency: 'USD' };
                        return {
                          id: n.Id,
                          name: n.Name,
                          brand: 'Unknown',
                          category: n.Family || 'uncategorized',
                          price: priceInfo.price || 0,
                          currency: priceInfo.currency || 'USD',
                          description: n.Description || '',
                          shortDescription: '',
                          imageUrl: '',
                          images: [],
                          attributes: {},
                          rating: 0,
                          reviewCount: 0,
                          inStock: true,
                        };
                      });

                      const result = JSON.stringify({ products: mapped, total, offset, limit, source: 'salesforce' });
                      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(result) });
                      res.end(result);
                    } catch (e) {
                      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                      res.end(JSON.stringify({ error: 'Failed to parse price response' }));
                    }
                  });
                });
                pReq.on('error', (err) => {
                  if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: err.message }));
                  }
                });
                pReq.end();
              } catch {
                res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Failed to resolve pricebook' }));
              }
            });
          });
          pbReq.on('error', (err) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          pbReq.end();
        } catch {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Failed to parse GraphQL response' }));
        }
      });
    });
    gqlReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    gqlReq.end(gqlBody);
    });
    return;
  }

  // GET /api/product/:id — headless storefront product detail
  if (req.url.startsWith('/api/product/') && req.method === 'GET') {
    const productId = req.url.split('/api/product/')[1]?.split('?')[0];
    if (!productId) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing productId' }));
      return;
    }
    const authHeader = req.headers.authorization;

    return withServerToken(authHeader, (token) => {
      if (!token) {
        res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
    const sfUrl = new URL(SF_INSTANCE);

    // GraphQL product fields
    const query = `
      query ProductDetail($id: ID!, $pricebookName: String!) {
        uiapi {
          query {
            Pricebook2(where: { Name: { eq: $pricebookName } }, first: 1) { edges { node { Id } } }
            Product2(where: { Id: { eq: $id } }, first: 1) {
              edges {
                node {
                  Id
                  Name
                  ProductCode
                  Description
                  Family
                }
              }
            }
          }
        }
      }
    `;
    const pricebookName = 'Standard Price Book';
    const gqlBody = JSON.stringify({ query, variables: { id: productId, pricebookName } });
    const gqlOpts = {
      hostname: sfUrl.hostname,
      port: 443,
      path: '/services/data/v60.0/graphql',
      method: 'POST',
      headers: {
        host: sfUrl.hostname,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(gqlBody),
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      },
    };
    const gqlReq = https.request(gqlOpts, (gqlRes) => {
      const gqlChunks = [];
      gqlRes.on('data', (c) => gqlChunks.push(c));
      gqlRes.on('end', () => {
        try {
          const gqlData = JSON.parse(Buffer.concat(gqlChunks).toString());
          const node = gqlData.data?.uiapi?.query?.Product2?.edges?.[0]?.node;
          if (!node) {
            res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Product not found' }));
            return;
          }
          // Fetch price by SOQL
          const soql = `SELECT UnitPrice, CurrencyIsoCode FROM PricebookEntry WHERE Pricebook2.Name = '${pricebookName.replace(/'/g, "\\'")}' AND Product2Id = '${productId}' AND IsActive = true LIMIT 1`;
          const priceOpts = {
            hostname: sfUrl.hostname,
            port: 443,
            path: `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
            method: 'GET',
            headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
          };
          const pReq = https.request(priceOpts, (pRes) => {
            const pChunks = [];
            pRes.on('data', (c) => pChunks.push(c));
            pRes.on('end', () => {
              try {
                const pData = JSON.parse(Buffer.concat(pChunks).toString());
                const rec = pData.records?.[0] || {};
                const resultObj = {
                  id: node.Id,
                  name: node.Name,
                  brand: 'Unknown',
                  category: node.Family || 'uncategorized',
                  price: rec.UnitPrice || 0,
                  currency: rec.CurrencyIsoCode || 'USD',
                  description: node.Description || '',
                  shortDescription: '',
                  imageUrl: '',
                  images: [],
                  attributes: {},
                  rating: 0,
                  reviewCount: 0,
                  inStock: true,
                };
                const result = JSON.stringify(resultObj);
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(result) });
                res.end(result);
              } catch {
                res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Failed to parse price response' }));
              }
            });
          });
          pReq.on('error', (err) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          pReq.end();
        } catch {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Failed to parse GraphQL response' }));
        }
      });
    });
    gqlReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    gqlReq.end(gqlBody);
    });
    return;
  }

  // --- SOQL query proxy (used by ContentVersion read path) ---
  if (req.url === '/api/sf-query' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const { soql, token } = JSON.parse(Buffer.concat(chunks).toString());
        if (!soql || !token) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing soql or token' }));
          return;
        }
        const sfUrl = new URL(SF_INSTANCE);
        const queryPath = `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`;
        const opts = {
          hostname: sfUrl.hostname,
          port: 443,
          path: queryPath,
          method: 'GET',
          headers: {
            host: sfUrl.hostname,
            authorization: `Bearer ${token}`,
            accept: 'application/json',
          },
        };
        console.log(`[sf-query] ${soql.substring(0, 120)}`);
        const proxyReq = https.request(opts, (proxyRes) => {
          const resChunks = [];
          proxyRes.on('data', (c) => resChunks.push(c));
          proxyRes.on('end', () => {
            const body = Buffer.concat(resChunks);
            res.writeHead(proxyRes.statusCode, {
              'content-type': 'application/json',
              'access-control-allow-origin': '*',
              'content-length': body.length,
            });
            res.end(body);
          });
        });
        proxyReq.on('error', (err) => {
          console.error('[sf-query] Error:', err.message);
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        proxyReq.end();
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // --- Create/Update Salesforce sObject records (Scene_Asset__c, etc.) ---
  if (req.url === '/api/sf-record' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const { sobject, fields, token } = JSON.parse(Buffer.concat(chunks).toString());
        if (!sobject || !fields || !token) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing sobject, fields, or token' }));
          return;
        }
        const body = JSON.stringify(fields);
        const sfUrl = new URL(SF_INSTANCE);
        const opts = {
          hostname: sfUrl.hostname,
          port: 443,
          path: `/services/data/v60.0/sobjects/${sobject}`,
          method: 'POST',
          headers: {
            host: sfUrl.hostname,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
            authorization: `Bearer ${token}`,
            accept: 'application/json',
          },
        };
        console.log(`[sf-record] Creating ${sobject}`);
        const proxyReq = https.request(opts, (proxyRes) => {
          const resChunks = [];
          proxyRes.on('data', (c) => resChunks.push(c));
          proxyRes.on('end', () => {
            const resBody = Buffer.concat(resChunks);
            res.writeHead(proxyRes.statusCode, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'content-length': resBody.length });
            res.end(resBody);
          });
        });
        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        proxyReq.end(body);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // PATCH /api/sf-record/{id} — update an existing record
  if (req.url.startsWith('/api/sf-record/') && req.method === 'PATCH') {
    const parts = req.url.split('/api/sf-record/')[1]?.split('?');
    const recordId = parts?.[0];
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const { sobject, fields, token } = JSON.parse(Buffer.concat(chunks).toString());
        if (!sobject || !recordId || !token) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing sobject, recordId, or token' }));
          return;
        }
        const body = JSON.stringify(fields);
        const sfUrl = new URL(SF_INSTANCE);
        const opts = {
          hostname: sfUrl.hostname,
          port: 443,
          path: `/services/data/v60.0/sobjects/${sobject}/${recordId}`,
          method: 'PATCH',
          headers: {
            host: sfUrl.hostname,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
            authorization: `Bearer ${token}`,
            accept: 'application/json',
          },
        };
        console.log(`[sf-record] Updating ${sobject}/${recordId}`);
        const proxyReq = https.request(opts, (proxyRes) => {
          const resChunks = [];
          proxyRes.on('data', (c) => resChunks.push(c));
          proxyRes.on('end', () => {
            const resBody = Buffer.concat(resChunks);
            // PATCH returns 204 No Content on success
            if (proxyRes.statusCode === 204) {
              res.writeHead(204, { 'access-control-allow-origin': '*' });
              res.end();
            } else {
              res.writeHead(proxyRes.statusCode, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'content-length': resBody.length });
              res.end(resBody);
            }
          });
        });
        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        proxyReq.end(body);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // --- Upload image via Salesforce ContentVersion API (works with any org) ---
  if (req.url === '/api/cms-upload' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const { imageBase64, fileName, title, tags, token } = JSON.parse(Buffer.concat(chunks).toString());
        const imageBuffer = Buffer.from(imageBase64, 'base64');

        // Use ContentVersion REST API — universally available, no CMS 2.0 required
        const contentVersionBody = JSON.stringify({
          Title: title || fileName,
          PathOnClient: fileName,
          Description: (tags || []).join(', '),
          VersionData: imageBase64,
        });

        const sfUrl = new URL(SF_INSTANCE);
        const options = {
          hostname: sfUrl.hostname,
          port: 443,
          path: '/services/data/v60.0/sobjects/ContentVersion',
          method: 'POST',
          headers: {
            host: sfUrl.hostname,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(contentVersionBody),
            authorization: `Bearer ${token}`,
            accept: 'application/json',
          },
        };

        console.log(`[cms-upload] Uploading ${fileName} via ContentVersion (${imageBuffer.length} bytes)`);

        const proxyReq = https.request(options, (proxyRes) => {
          const resChunks = [];
          proxyRes.on('data', (c) => resChunks.push(c));
          proxyRes.on('end', () => {
            const resBody = Buffer.concat(resChunks);
            const resText = resBody.toString();
            console.log(`[cms-upload] Salesforce responded ${proxyRes.statusCode}:`, resText.substring(0, 500));

            // If successful, fetch the ContentDocumentId so we can build a download URL
            if (proxyRes.statusCode === 201) {
              try {
                const { id: versionId } = JSON.parse(resText);
                // Query ContentDocumentId from the new ContentVersion
                const queryPath = `/services/data/v60.0/sobjects/ContentVersion/${versionId}?fields=ContentDocumentId`;
                const queryOpts = {
                  hostname: sfUrl.hostname,
                  port: 443,
                  path: queryPath,
                  method: 'GET',
                  headers: {
                    host: sfUrl.hostname,
                    authorization: `Bearer ${token}`,
                    accept: 'application/json',
                  },
                };
                const queryReq = https.request(queryOpts, (queryRes) => {
                  const qChunks = [];
                  queryRes.on('data', (c) => qChunks.push(c));
                  queryRes.on('end', () => {
                    try {
                      const qData = JSON.parse(Buffer.concat(qChunks).toString());
                      const docId = qData.ContentDocumentId;
                      const imageUrl = `/api/sf-file/${versionId}`;
                      const result = JSON.stringify({ id: versionId, contentDocumentId: docId, imageUrl });
                      res.writeHead(201, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(result) });
                      res.end(result);
                    } catch {
                      const result = JSON.stringify({ id: versionId, imageUrl: `/api/sf-file/${versionId}` });
                      res.writeHead(201, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(result) });
                      res.end(result);
                    }
                  });
                });
                queryReq.on('error', () => {
                  const result = JSON.stringify({ id: versionId, imageUrl: `/api/sf-file/${versionId}` });
                  res.writeHead(201, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(result) });
                  res.end(result);
                });
                queryReq.end();
                return;
              } catch { /* fall through to raw response */ }
            }

            const resHeaders = { 'access-control-allow-origin': '*', 'content-type': 'application/json', 'content-length': resBody.length };
            res.writeHead(proxyRes.statusCode, resHeaders);
            res.end(resBody);
          });
        });
        proxyReq.on('error', (err) => {
          console.error('[cms-upload] Error:', err.message);
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        proxyReq.end(contentVersionBody);
      } catch (err) {
        console.error('[cms-upload] Parse error:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // --- Serve ContentVersion file data (proxy to Salesforce) ---
  if (req.url.startsWith('/api/sf-file/') && req.method === 'GET') {
    const versionId = req.url.split('/api/sf-file/')[1]?.split('?')[0];
    if (!versionId) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing version ID' }));
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing authorization' }));
      return;
    }
    const sfUrl = new URL(SF_INSTANCE);
    const filePath = `/services/data/v60.0/sobjects/ContentVersion/${versionId}/VersionData`;
    const fileOpts = {
      hostname: sfUrl.hostname,
      port: 443,
      path: filePath,
      method: 'GET',
      headers: { host: sfUrl.hostname, authorization: authHeader, accept: '*/*' },
    };
    const fileReq = https.request(fileOpts, (fileRes) => {
      const resHeaders = { 'access-control-allow-origin': '*' };
      if (fileRes.headers['content-type']) resHeaders['content-type'] = fileRes.headers['content-type'];
      if (fileRes.headers['content-length']) resHeaders['content-length'] = fileRes.headers['content-length'];
      res.writeHead(fileRes.statusCode, resHeaders);
      fileRes.pipe(res);
    });
    fileReq.on('error', (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    fileReq.end();
    return;
  }

  // --- Helper: promisified Salesforce REST request (avoids callback hell) ---
  function sfFetch(token, method, sfPath, body) {
    return new Promise((resolve, reject) => {
      const sfUrl = new URL(SF_INSTANCE);
      const bodyStr = body ? JSON.stringify(body) : null;
      const opts = {
        hostname: sfUrl.hostname,
        port: 443,
        path: sfPath,
        method,
        headers: {
          host: sfUrl.hostname,
          authorization: `Bearer ${token}`,
          accept: 'application/json',
        },
      };
      if (bodyStr) {
        opts.headers['content-type'] = 'application/json';
        opts.headers['content-length'] = Buffer.byteLength(bodyStr);
      }
      const sfReq = https.request(opts, (sfRes) => {
        const chunks = [];
        sfRes.on('data', (c) => chunks.push(c));
        sfRes.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          if (sfRes.statusCode === 204) { resolve({ statusCode: 204 }); return; }
          try { resolve({ statusCode: sfRes.statusCode, data: JSON.parse(raw) }); }
          catch { resolve({ statusCode: sfRes.statusCode, raw }); }
        });
      });
      sfReq.on('error', reject);
      if (bodyStr) sfReq.end(bodyStr); else sfReq.end();
    });
  }

  // --- GET /api/demo/contacts — List demo contacts from CRM ---
  if (req.url.startsWith('/api/demo/contacts') && req.method === 'GET') {
    withServerToken(req.headers.authorization, (token) => {
      if (!token) {
        const json = JSON.stringify({ contacts: [] });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(json) });
        res.end(json);
        return;
      }
      (async () => {
        try {
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
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(json) });
          res.end(json);
        } catch (err) {
          console.error('[demo/contacts] Error:', err);
          const json = JSON.stringify({ contacts: [], error: err.message });
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(json) });
          res.end(json);
        }
      })();
    });
    return;
  }

  // --- POST /api/contacts — Create Account + Contact in CRM ---
  if (req.url === '/api/contacts' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const { firstName, lastName, email, merkuryId, demoProfile, leadSource, beautyFields } = body;

        if (!email) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing email' }));
          return;
        }

        withServerToken(req.headers.authorization, (token) => {
          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          (async () => {
            try {
              // Check if contact already exists
              const existingQ = await sfFetch(token, 'GET',
                `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, AccountId FROM Contact WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`)}`);
              const existing = existingQ.data?.records?.[0];

              if (existing) {
                // Return existing contact
                const json = JSON.stringify({ success: true, contactId: existing.Id, accountId: existing.AccountId, existing: true });
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(json) });
                res.end(json);
                return;
              }

              // 1. Create Account
              const fName = firstName || email.split('@')[0];
              const lName = lastName || 'Customer';
              const accountRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/Account', {
                Name: `${fName} ${lName} Household`,
              });
              const accountId = accountRes.data?.id;
              if (!accountId) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Failed to create Account', details: accountRes.data }));
                return;
              }

              // 2. Create Contact
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
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Failed to create Contact', details: contactRes.data }));
                return;
              }

              console.log(`[contacts] Created Account ${accountId} + Contact ${contactId} for ${email}`);
              // MC Advanced: Welcome journey is triggered by a Record-Triggered Flow
              // on Contact creation — no API call needed from the server.

              const json = JSON.stringify({ success: true, contactId, accountId });
              res.writeHead(201, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(json) });
              res.end(json);
            } catch (err) {
              console.error('[contacts] Error:', err);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: err.message || 'Contact creation failed' }));
              }
            }
          })();
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // --- POST /api/checkout — Create real Salesforce Order with OrderItems ---
  if (req.url === '/api/checkout' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const { contactId, accountId: providedAccountId, items, paymentMethod, total } = body;

        if (!items || !items.length) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing items' }));
          return;
        }

        withServerToken(req.headers.authorization, (token) => {
          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          (async () => {
            try {
              // 1. Resolve AccountId
              let accountId = providedAccountId;
              if (!accountId && contactId) {
                const contactRes = await sfFetch(token, 'GET',
                  `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT AccountId FROM Contact WHERE Id = '${contactId.replace(/'/g, "\\'")}' LIMIT 1`)}`);
                accountId = contactRes.data?.records?.[0]?.AccountId;
              }
              if (!accountId) {
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Could not resolve AccountId' }));
                return;
              }

              // 2. Get Standard Pricebook
              const pbRes = await sfFetch(token, 'GET',
                `/services/data/v60.0/query?q=${encodeURIComponent("SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1")}`);
              const pricebookId = pbRes.data?.records?.[0]?.Id;
              if (!pricebookId) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Standard Price Book not found' }));
                return;
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
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Failed to create Order', details: orderRes.data }));
                return;
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

              // 7. Accrue loyalty points via Salesforce Loyalty Management
              // Earning rate: 10 points per $100 spent (10% back)
              // Note: This org's TransactionJournal doesn't have LoyaltyProgramMemberId
              // We create LoyaltyLedger entries directly to credit points
              let pointsEarned = 0;
              if (total > 0) {
                const POINTS_RATE = 0.10; // 10% back in points
                const pts = Math.floor(total * POINTS_RATE);
                if (pts >= 1) {
                  try {
                    // Find loyalty member by Contact
                    const memberQuery = await sfFetch(token, 'GET',
                      `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, ProgramId FROM LoyaltyProgramMember WHERE ContactId IN (SELECT Id FROM Contact WHERE AccountId = '${accountId}') AND MemberStatus = 'Active' LIMIT 1`)}`);
                    const member = memberQuery.data?.records?.[0];

                    if (member) {
                      // Get program currency
                      const currencyQuery = await sfFetch(token, 'GET',
                        `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id FROM LoyaltyProgramCurrency WHERE LoyaltyProgramId = '${member.ProgramId}' AND IsActive = true LIMIT 1`)}`);
                      const currencyId = currencyQuery.data?.records?.[0]?.Id;

                      if (currencyId) {
                        // Create LoyaltyLedger entry directly to credit points
                        const ledgerRes = await sfFetch(token, 'POST', '/services/data/v60.0/sobjects/LoyaltyLedger', {
                          LoyaltyProgramMemberId: member.Id,
                          LoyaltyProgramCurrencyId: currencyId,
                          Points: pts,
                          EventType: 'Credit',
                          ActivityDate: new Date().toISOString()
                        });

                        if (ledgerRes.data?.id) {
                          pointsEarned = pts;
                          console.log(`[checkout] Accrued ${pts} loyalty points for order ${orderNumber} via LoyaltyLedger ${ledgerRes.data.id}`);
                        }
                      }
                    }
                  } catch (loyaltyErr) {
                    console.log(`[checkout] Loyalty points skipped: ${loyaltyErr.message}`);
                  }
                }
              }

              // MC Advanced: Post-purchase journey is triggered by a Record-Triggered Flow
              // on Order activation (Status = 'Activated') — no API call needed.

              // 8. Return result
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
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(result) });
              res.end(result);
            } catch (err) {
              console.error('[checkout] Error:', err);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: err.message || 'Checkout failed' }));
              }
            }
          })();
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // --- POST /api/order/simulate-shipment — Demo: advance shipping status ---
  if (req.url === '/api/order/simulate-shipment' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const { orderId, newStatus } = JSON.parse(Buffer.concat(chunks).toString());
        if (!orderId || !newStatus) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing orderId or newStatus' }));
          return;
        }

        withServerToken(req.headers.authorization, (token) => {
          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          (async () => {
            try {
              const today = new Date().toISOString().split('T')[0];
              const updateFields = { Shipping_Status__c: newStatus };
              if (newStatus === 'Shipped') updateFields.Shipped_Date__c = today;
              if (newStatus === 'Delivered') updateFields.Delivered_Date__c = today;

              await sfFetch(token, 'PATCH', `/services/data/v60.0/sobjects/Order/${orderId}`, updateFields);
              // MC Advanced: Ship confirmation / delivery notification journeys are
              // triggered by Record-Triggered Flows on Order.Shipping_Status__c changes.
              // The PATCH above writes to Core — the Flow fires automatically.

              const result = JSON.stringify({ success: true, orderId, newStatus });
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Content-Length': Buffer.byteLength(result) });
              res.end(result);
            } catch (err) {
              console.error('[simulate-shipment] Error:', err);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: err.message }));
              }
            }
          })();
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // --- Loyalty Management Endpoints ---
  // POST /api/loyalty/enroll - Enroll a customer in a loyalty program
  if (req.url === '/api/loyalty/enroll' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const { accountId, programName } = JSON.parse(Buffer.concat(chunks).toString());
        if (!accountId || !programName) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing accountId or programName' }));
          return;
        }
        
        // Get server token for Salesforce operations
        withServerToken(req.headers.authorization, (token) => {
          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }
          
          // First, find the program by name
          const soqlProgram = `SELECT Id FROM LoyaltyProgram__c WHERE Name__c = '${programName.replace(/'/g, "\\'")}' LIMIT 1`;
          const sfUrl = new URL(SF_INSTANCE);
          const programOpts = {
            hostname: sfUrl.hostname,
            port: 443,
            path: `/services/data/v60.0/query?q=${encodeURIComponent(soqlProgram)}`,
            method: 'GET',
            headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
          };
          
          const programReq = https.request(programOpts, (programRes) => {
            const programChunks = [];
            programRes.on('data', (c) => programChunks.push(c));
            programRes.on('end', () => {
              try {
                const programData = JSON.parse(Buffer.concat(programChunks).toString());
                const programId = programData.records?.[0]?.Id;
                
                if (!programId) {
                  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify({ error: 'Program not found' }));
                  return;
                }
                
                // Create the loyalty member record
                const memberFields = {
                  AccountId__c: accountId,
                  PointsBalance__c: 0,
                  Program__c: programId,
                  Enrolled__c: true
                };
                
                const memberBody = JSON.stringify(memberFields);
                const memberOpts = {
                  hostname: sfUrl.hostname,
                  port: 443,
                  path: '/services/data/v60.0/sobjects/LoyaltyMember__c',
                  method: 'POST',
                  headers: {
                    host: sfUrl.hostname,
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(memberBody),
                    authorization: `Bearer ${token}`,
                    accept: 'application/json',
                  },
                };
                
                const memberReq = https.request(memberOpts, (memberRes) => {
                  const memberChunks = [];
                  memberRes.on('data', (c) => memberChunks.push(c));
                  memberRes.on('end', () => {
                    const memberBody = Buffer.concat(memberChunks);
                    res.writeHead(memberRes.statusCode, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'content-length': memberBody.length });
                    res.end(memberBody);
                  });
                });
                
                memberReq.on('error', (err) => {
                  if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: err.message }));
                  }
                });
                
                memberReq.end(memberBody);
              } catch (e) {
                res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Failed to process program lookup' }));
              }
            });
          });
          
          programReq.on('error', (err) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          
          programReq.end();
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // GET /api/loyalty/member/:accountId - Get loyalty member info by account ID
  if (req.url.startsWith('/api/loyalty/member/') && req.method === 'GET') {
    const accountId = req.url.split('/api/loyalty/member/')[1]?.split('?')[0];
    if (!accountId) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing accountId' }));
      return;
    }
    
    // Get server token for Salesforce operations
    withServerToken(req.headers.authorization, (token) => {
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      
      const soql = `SELECT Id, AccountId__c, PointsBalance__c, Tier__c, Program__c, Enrolled__c FROM LoyaltyMember__c WHERE AccountId__c = '${accountId.replace(/'/g, "\\'")}' LIMIT 1`;
      const sfUrl = new URL(SF_INSTANCE);
      const opts = {
        hostname: sfUrl.hostname,
        port: 443,
        path: `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
        method: 'GET',
        headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
      };
      
      const proxyReq = https.request(opts, (proxyRes) => {
        const resChunks = [];
        proxyRes.on('data', (c) => resChunks.push(c));
        proxyRes.on('end', () => {
          const body = Buffer.concat(resChunks);
          res.writeHead(proxyRes.statusCode, {
            'content-type': 'application/json',
            'access-control-allow-origin': '*',
            'content-length': body.length,
          });
          res.end(body);
        });
      });
      
      proxyReq.on('error', (err) => {
        console.error('[loyalty-member] Error:', err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      
      proxyReq.end();
    });
    return;
  }

  // GET /api/loyalty/balance/:accountId - Get loyalty points balance
  if (req.url.startsWith('/api/loyalty/balance/') && req.method === 'GET') {
    const accountId = req.url.split('/api/loyalty/balance/')[1]?.split('?')[0];
    if (!accountId) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Missing accountId' }));
      return;
    }
    
    // Get server token for Salesforce operations
    withServerToken(req.headers.authorization, (token) => {
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      
      const soql = `SELECT PointsBalance__c FROM LoyaltyMember__c WHERE AccountId__c = '${accountId.replace(/'/g, "\\'")}' LIMIT 1`;
      const sfUrl = new URL(SF_INSTANCE);
      const opts = {
        hostname: sfUrl.hostname,
        port: 443,
        path: `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
        method: 'GET',
        headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
      };
      
      const proxyReq = https.request(opts, (proxyRes) => {
        const resChunks = [];
        proxyRes.on('data', (c) => resChunks.push(c));
        proxyRes.on('end', () => {
          const body = Buffer.concat(resChunks);
          res.writeHead(proxyRes.statusCode, {
            'content-type': 'application/json',
            'access-control-allow-origin': '*',
            'content-length': body.length,
          });
          res.end(body);
        });
      });
      
      proxyReq.on('error', (err) => {
        console.error('[loyalty-balance] Error:', err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      
      proxyReq.end();
    });
    return;
  }

  // POST /api/loyalty/accrue - Accrue points for a purchase
  if (req.url === '/api/loyalty/accrue' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const { accountId, points } = JSON.parse(Buffer.concat(chunks).toString());
        if (!accountId || !points) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing accountId or points' }));
          return;
        }
        
        // Get server token for Salesforce operations
        withServerToken(req.headers.authorization, (token) => {
          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }
          
          // Update the loyalty member's points balance
          const soql = `SELECT Id, PointsBalance__c FROM LoyaltyMember__c WHERE AccountId__c = '${accountId.replace(/'/g, "\\'")}' LIMIT 1`;
          const sfUrl = new URL(SF_INSTANCE);
          const queryOpts = {
            hostname: sfUrl.hostname,
            port: 443,
            path: `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
            method: 'GET',
            headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
          };
          
          const queryReq = https.request(queryOpts, (queryRes) => {
            const queryChunks = [];
            queryRes.on('data', (c) => queryChunks.push(c));
            queryRes.on('end', () => {
              try {
                const queryData = JSON.parse(Buffer.concat(queryChunks).toString());
                const memberId = queryData.records?.[0]?.Id;
                const currentPoints = queryData.records?.[0]?.PointsBalance__c || 0;
                
                if (!memberId) {
                  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify({ error: 'Member not found' }));
                  return;
                }
                
                const newPoints = currentPoints + points;
                const updateFields = { PointsBalance__c: newPoints };
                const updateBody = JSON.stringify(updateFields);
                const updateOpts = {
                  hostname: sfUrl.hostname,
                  port: 443,
                  path: `/services/data/v60.0/sobjects/LoyaltyMember__c/${memberId}`,
                  method: 'PATCH',
                  headers: {
                    host: sfUrl.hostname,
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(updateBody),
                    authorization: `Bearer ${token}`,
                    accept: 'application/json',
                  },
                };
                
                const updateReq = https.request(updateOpts, (updateRes) => {
                  const updateChunks = [];
                  updateRes.on('data', (c) => updateChunks.push(c));
                  updateRes.on('end', () => {
                    const updateBody = Buffer.concat(updateChunks);
                    res.writeHead(updateRes.statusCode, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'content-length': updateBody.length });
                    res.end(updateBody);
                  });
                });
                
                updateReq.on('error', (err) => {
                  if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: err.message }));
                  }
                });
                
                updateReq.end(updateBody);
              } catch (e) {
                res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Failed to process points accrual' }));
              }
            });
          });
          
          queryReq.on('error', (err) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          
          queryReq.end();
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  // POST /api/loyalty/redeem - Redeem points for a discount
  if (req.url === '/api/loyalty/redeem' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const { accountId, points } = JSON.parse(Buffer.concat(chunks).toString());
        if (!accountId || !points) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing accountId or points' }));
          return;
        }
        
        // Get server token for Salesforce operations
        withServerToken(req.headers.authorization, (token) => {
          if (!token) {
            res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }
          
          // Update the loyalty member's points balance
          const soql = `SELECT Id, PointsBalance__c FROM LoyaltyMember__c WHERE AccountId__c = '${accountId.replace(/'/g, "\\'")}' LIMIT 1`;
          const sfUrl = new URL(SF_INSTANCE);
          const queryOpts = {
            hostname: sfUrl.hostname,
            port: 443,
            path: `/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
            method: 'GET',
            headers: { host: sfUrl.hostname, authorization: `Bearer ${token}`, accept: 'application/json' },
          };
          
          const queryReq = https.request(queryOpts, (queryRes) => {
            const queryChunks = [];
            queryRes.on('data', (c) => queryChunks.push(c));
            queryRes.on('end', () => {
              try {
                const queryData = JSON.parse(Buffer.concat(queryChunks).toString());
                const memberId = queryData.records?.[0]?.Id;
                const currentPoints = queryData.records?.[0]?.PointsBalance__c || 0;
                
                if (!memberId) {
                  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify({ error: 'Member not found' }));
                  return;
                }
                
                if (currentPoints < points) {
                  res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                  res.end(JSON.stringify({ error: 'Insufficient points' }));
                  return;
                }
                
                const newPoints = currentPoints - points;
                const updateFields = { PointsBalance__c: newPoints };
                const updateBody = JSON.stringify(updateFields);
                const updateOpts = {
                  hostname: sfUrl.hostname,
                  port: 443,
                  path: `/services/data/v60.0/sobjects/LoyaltyMember__c/${memberId}`,
                  method: 'PATCH',
                  headers: {
                    host: sfUrl.hostname,
                    'content-type': 'application/json',
                    'content-length': Buffer.byteLength(updateBody),
                    authorization: `Bearer ${token}`,
                    accept: 'application/json',
                  },
                };
                
                const updateReq = https.request(updateOpts, (updateRes) => {
                  const updateChunks = [];
                  updateRes.on('data', (c) => updateChunks.push(c));
                  updateRes.on('end', () => {
                    const updateBody = Buffer.concat(updateChunks);
                    res.writeHead(updateRes.statusCode, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'content-length': updateBody.length });
                    res.end(updateBody);
                  });
                });
                
                updateReq.on('error', (err) => {
                  if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    res.end(JSON.stringify({ error: err.message }));
                  }
                });
                
                updateReq.end(updateBody);
              } catch (e) {
                res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Failed to process points redemption' }));
              }
            });
          });
          
          queryReq.on('error', (err) => {
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          
          queryReq.end();
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'Invalid request body' }));
      }
    });
    return;
  }

  const route = findRoute(req.url);
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const targetUrl = new URL(route.target);
  const remotePath = route.rewrite + req.url.slice(route.prefix.length);
  const isHttps = targetUrl.protocol === 'https:';

  console.log(`[proxy] ${req.method} ${req.url} → ${targetUrl.host}${remotePath}`);
  if (req.url.startsWith('/api/cms/contents')) {
    console.log('[proxy] CMS upload headers:', JSON.stringify({
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      'transfer-encoding': req.headers['transfer-encoding'],
    }));
  }

  // Only forward headers that the target API needs — avoid browser headers
  // that make Salesforce return a login page instead of a JSON response
  const headers = { host: targetUrl.hostname };
  const forwardHeaders = [
    'content-type', 'content-length', 'authorization',
    'x-goog-api-key', 'x-api-key', 'accept', 'transfer-encoding',
  ];
  for (const h of forwardHeaders) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }
  if (!headers.accept || headers.accept.includes('text/html')) {
    headers.accept = 'application/json';
  }
  // CMS uploads will be buffered — don't forward transfer-encoding
  if (req.url.startsWith('/api/cms/contents') && req.method === 'POST') {
    delete headers['transfer-encoding'];
    delete headers['content-length']; // will be set after buffering
  }

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: remotePath,
    method: req.method,
    headers,
  };

  const proxyReq = (isHttps ? https : http).request(options, (proxyRes) => {
    const resHeaders = { ...proxyRes.headers, 'access-control-allow-origin': '*' };
    res.writeHead(proxyRes.statusCode, resHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[proxy] Error proxying ${req.url}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    }
  });

  // For CMS uploads: buffer the body so we can set content-length
  // (Salesforce rejects chunked transfer-encoding for multipart uploads)
  const needsBuffering = req.url.startsWith('/api/cms/contents') && req.method === 'POST';
  if (needsBuffering) {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      proxyReq.setHeader('content-length', body.length);
      proxyReq.removeHeader('transfer-encoding');
      console.log(`[proxy] CMS upload buffered: ${body.length} bytes`);
      proxyReq.end(body);
    });
  } else {
    req.pipe(proxyReq);
  }
});

// Allow large uploads and long-running proxy requests
server.timeout = 120000;
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;
server.requestTimeout = 120000;

server.listen(PORT, () => {
  console.log(`[server] API proxy running on http://localhost:${PORT}`);
  console.log(`[server] Salesforce instance: ${SF_INSTANCE}`);
});
