/**
 * Journey Image Generation API
 *
 * Composites product images and uses Firefly Expand to generate a scene around them.
 *
 * POST /api/generate-journey-image
 * Body: {
 *   products: [{ imageUrl: string, name: string }],
 *   prompt: string,  // Scene description for Firefly expand
 *   eventType?: string  // Optional: travel, birthday, wedding, etc.
 * }
 *
 * Returns: { imageUrl: string, success: boolean }
 */

import https from 'node:https';
import sharp from 'sharp';

// Firefly API endpoints
const TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const UPLOAD_URL = 'https://firefly-api.adobe.io/v2/storage/image';
const EXPAND_URL = 'https://firefly-api.adobe.io/v3/images/expand';

// Canvas dimensions
const COMPOSITE_SIZE = 400;  // Size of the product composite canvas
const OUTPUT_WIDTH = 1792;   // Final expanded image width (email banner ratio)
const OUTPUT_HEIGHT = 1024;  // Final expanded image height

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Make an HTTPS request and return { statusCode, headers, body }.
 */
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
    req.setTimeout(60000, () => req.destroy(new Error('Request timeout')));
    if (body) req.end(body);
    else req.end();
  });
}

/**
 * Rewrite demo domain URLs to actual Vercel app URL.
 */
function rewriteImageUrl(url) {
  // Map fake demo domain to real Vercel app
  return url.replace(
    'https://lumiere-beauty.demo.com',
    'https://agentforce-retail-advisor.vercel.app'
  );
}

/**
 * Download an image from URL and return as Buffer.
 */
async function downloadImage(url) {
  const resolvedUrl = rewriteImageUrl(url);
  const parsedUrl = new URL(resolvedUrl);
  const result = await httpsRequest({
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: { 'User-Agent': 'JourneyImageGenerator/1.0' },
  });

  if (result.statusCode !== 200) {
    throw new Error(`Failed to download image from ${resolvedUrl}: ${result.statusCode}`);
  }

  return result.body;
}

/**
 * Composite multiple product images onto a transparent canvas.
 * Products are arranged in an attractive pattern.
 */
async function compositeProducts(products) {
  // Create transparent canvas
  const canvas = sharp({
    create: {
      width: COMPOSITE_SIZE,
      height: COMPOSITE_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  // Define positions based on product count
  const positions = getProductPositions(products.length);

  // Download and prepare product images
  const composites = [];
  for (let i = 0; i < products.length && i < positions.length; i++) {
    try {
      const imageBuffer = await downloadImage(products[i].imageUrl);
      const pos = positions[i];

      // Resize product image
      const resizedImage = await sharp(imageBuffer)
        .resize(pos.size, pos.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      composites.push({
        input: resizedImage,
        left: pos.x,
        top: pos.y,
      });
    } catch (err) {
      console.error(`[generate-journey-image] Failed to process product ${i}:`, err.message);
    }
  }

  if (composites.length === 0) {
    throw new Error('No product images could be processed');
  }

  // Composite all products onto canvas
  const compositeBuffer = await canvas
    .composite(composites)
    .png()
    .toBuffer();

  return compositeBuffer;
}

/**
 * Get positions for products based on count.
 * Returns array of { x, y, size } for each product.
 */
function getProductPositions(count) {
  const positions = [];
  const cs = COMPOSITE_SIZE;

  if (count === 1) {
    // Center, large
    positions.push({ x: cs/4, y: cs/4, size: cs/2 });
  } else if (count === 2) {
    // Side by side
    positions.push({ x: 20, y: cs/4, size: cs/3 });
    positions.push({ x: cs - cs/3 - 20, y: cs/4, size: cs/3 });
  } else if (count === 3) {
    // Triangle pattern
    positions.push({ x: cs/3, y: 20, size: cs/3 });           // Top center
    positions.push({ x: 20, y: cs/2, size: cs/3 });           // Bottom left
    positions.push({ x: cs - cs/3 - 20, y: cs/2, size: cs/3 }); // Bottom right
  } else if (count === 4) {
    // 2x2 grid
    const size = cs/3;
    const margin = (cs - 2*size) / 3;
    positions.push({ x: margin, y: margin, size });
    positions.push({ x: margin*2 + size, y: margin, size });
    positions.push({ x: margin, y: margin*2 + size, size });
    positions.push({ x: margin*2 + size, y: margin*2 + size, size });
  } else {
    // 5+ products: pentagon-ish pattern with center
    const size = cs/4;
    positions.push({ x: cs/2 - size/2, y: cs/2 - size/2, size: size*1.2 }); // Center (larger)
    positions.push({ x: 20, y: 20, size });                    // Top left
    positions.push({ x: cs - size - 20, y: 20, size });        // Top right
    positions.push({ x: 20, y: cs - size - 20, size });        // Bottom left
    positions.push({ x: cs - size - 20, y: cs - size - 20, size }); // Bottom right
  }

  return positions.map(p => ({
    x: Math.round(p.x),
    y: Math.round(p.y),
    size: Math.round(p.size)
  }));
}

/**
 * Get Firefly OAuth access token.
 */
async function getFireflyToken(clientId, clientSecret) {
  const body = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=${encodeURIComponent('openid,AdobeID,firefly_api,ff_apis')}`;

  const result = await httpsRequest({
    hostname: 'ims-na1.adobelogin.com',
    port: 443,
    path: '/ims/token/v3',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (result.statusCode !== 200) {
    throw new Error(`Firefly OAuth failed: ${result.statusCode} - ${result.body.toString()}`);
  }

  const data = JSON.parse(result.body.toString());
  return data.access_token;
}

/**
 * Upload image to Firefly storage.
 * Returns the uploadId for use in subsequent API calls.
 */
async function uploadToFirefly(imageBuffer, token, clientId) {
  const result = await httpsRequest({
    hostname: 'firefly-api.adobe.io',
    port: 443,
    path: '/v2/storage/image',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-api-key': clientId,
      'Content-Type': 'image/png',
      'Accept': 'application/json',
      'Content-Length': imageBuffer.length,
    },
  }, imageBuffer);

  if (result.statusCode !== 200 && result.statusCode !== 201) {
    throw new Error(`Firefly upload failed: ${result.statusCode} - ${result.body.toString()}`);
  }

  const data = JSON.parse(result.body.toString());
  return data.images?.[0]?.id || data.id;
}

/**
 * Call Firefly Expand Image API.
 * Expands the composite image with AI-generated scene content.
 */
async function expandImage(uploadId, prompt, token, clientId) {
  const requestBody = JSON.stringify({
    numVariations: 1,
    size: {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
    },
    image: {
      source: {
        uploadId: uploadId,
      },
    },
    prompt: prompt,
    placement: {
      alignment: {
        horizontal: 'center',
        vertical: 'center',
      },
    },
  });

  const result = await httpsRequest({
    hostname: 'firefly-api.adobe.io',
    port: 443,
    path: '/v3/images/expand',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-api-key': clientId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
    },
  }, requestBody);

  if (result.statusCode !== 200) {
    throw new Error(`Firefly expand failed: ${result.statusCode} - ${result.body.toString()}`);
  }

  const data = JSON.parse(result.body.toString());

  // Extract image URL from response
  const imageUrl = data.outputs?.[0]?.image?.url ||
                   data.outputs?.[0]?.image?.presignedUrl ||
                   data.images?.[0]?.url;

  if (!imageUrl) {
    throw new Error('Firefly returned no image URL');
  }

  return imageUrl;
}

/**
 * Build an enhanced prompt with brand guidelines.
 */
function buildEnhancedPrompt(basePrompt, eventType) {
  const brandContext = 'Luxury beauty brand aesthetic. Soft, elegant, aspirational mood. ' +
    'Color palette: muted pastels, warm neutrals, soft rose gold accents. ' +
    'Lighting: soft diffused natural light, gentle highlights, no harsh shadows. ' +
    'Style: high-end editorial photography, magazine-quality, sophisticated.';

  const compositionGuidance = 'Professional product photography, photorealistic, ' +
    'elegant lifestyle scene surrounding the beauty products.';

  let eventContext = '';
  if (eventType === 'travel') {
    eventContext = 'Travel-inspired scene with luggage, maps, or destination elements. ';
  } else if (eventType === 'birthday') {
    eventContext = 'Celebratory atmosphere with subtle gift elements, flowers, or festive touches. ';
  } else if (eventType === 'wedding') {
    eventContext = 'Romantic bridal atmosphere with white florals, soft fabrics, champagne tones. ';
  }

  return `${basePrompt}. ${eventContext}${brandContext} ${compositionGuidance}`;
}

/**
 * Read request body as Buffer.
 */
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' });
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  try {
    const body = await readBody(req);
    const { products, prompt, eventType } = JSON.parse(body.toString());

    // Validate input
    if (!products || !Array.isArray(products) || products.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: 'Missing or empty products array' }));
    }

    if (!prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: 'Missing prompt' }));
    }

    // Get Firefly credentials from environment
    const clientId = process.env.FIREFLY_CLIENT_ID;
    const clientSecret = process.env.FIREFLY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(JSON.stringify({ error: 'Firefly credentials not configured' }));
    }

    console.log(`[generate-journey-image] Starting with ${products.length} products`);

    // Step 1: Composite product images
    console.log('[generate-journey-image] Compositing products...');
    const compositeBuffer = await compositeProducts(products);
    console.log(`[generate-journey-image] Composite created: ${compositeBuffer.length} bytes`);

    // Step 2: Get Firefly token
    console.log('[generate-journey-image] Getting Firefly token...');
    const token = await getFireflyToken(clientId, clientSecret);

    // Step 3: Upload composite to Firefly
    console.log('[generate-journey-image] Uploading to Firefly...');
    const uploadId = await uploadToFirefly(compositeBuffer, token, clientId);
    console.log(`[generate-journey-image] Upload ID: ${uploadId}`);

    // Step 4: Call Firefly Expand
    const enhancedPrompt = buildEnhancedPrompt(prompt, eventType);
    console.log('[generate-journey-image] Calling Firefly Expand...');
    const imageUrl = await expandImage(uploadId, enhancedPrompt, token, clientId);
    console.log(`[generate-journey-image] Generated image URL: ${imageUrl.substring(0, 100)}...`);

    // Return success
    const result = JSON.stringify({
      success: true,
      imageUrl: imageUrl,
      compositeSize: compositeBuffer.length,
      productCount: products.length,
    });

    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    return res.end(result);

  } catch (err) {
    console.error('[generate-journey-image] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    return res.end(JSON.stringify({
      success: false,
      error: err.message
    }));
  }
}
