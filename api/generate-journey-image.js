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

// Canvas dimensions
const COMPOSITE_WIDTH = 600;   // Width of the product composite canvas
const COMPOSITE_HEIGHT = 400;  // Height of the product composite canvas (shorter to leave room for text)
const OUTPUT_WIDTH = 1792;     // Final expanded image width (email banner ratio)
const OUTPUT_HEIGHT = 1024;    // Final expanded image height

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
 * Products are arranged in the lower portion to leave space for text overlay.
 * Edges are softened for better blending with generated backgrounds.
 */
async function compositeProducts(products) {
  // Create transparent canvas (wider than tall to position products in lower center)
  const canvas = sharp({
    create: {
      width: COMPOSITE_WIDTH,
      height: COMPOSITE_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  // Define positions based on product count
  const positions = getProductPositions(products.length);

  // Download and prepare product images with softened edges
  const composites = [];
  for (let i = 0; i < products.length && i < positions.length; i++) {
    try {
      const imageBuffer = await downloadImage(products[i].imageUrl);
      const pos = positions[i];

      // Resize product image with soft edges
      // Apply a subtle shadow/glow effect to help blend edges
      const resizedImage = await sharp(imageBuffer)
        .resize(pos.size, pos.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

      // Create a slightly blurred version for edge softening
      const edgeSoftened = await softProductEdges(resizedImage, pos.size);

      composites.push({
        input: edgeSoftened,
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
 * Soften the edges of a product image using alpha channel manipulation.
 * Creates a more natural blend when composited onto generated backgrounds.
 * @param {Buffer} imageBuffer - The product image buffer
 * @param {number} _size - The target size (reserved for future edge scaling)
 */
async function softProductEdges(imageBuffer, _size) {
  // Get the image and its alpha channel
  const image = sharp(imageBuffer);

  // Extract raw pixel data
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create a copy of the data to modify
  const pixels = Buffer.from(data);
  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  // Apply edge detection and softening to alpha channel
  // For each pixel near an edge (where alpha transitions), soften the transition
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = pixels[idx + 3];

      // Skip fully transparent or pixels far from edges
      if (alpha === 0) continue;
      if (alpha === 255) {
        // Check if this is an edge pixel (has transparent neighbor)
        let isEdge = false;
        for (let dy = -1; dy <= 1 && !isEdge; dy++) {
          for (let dx = -1; dx <= 1 && !isEdge; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = (ny * width + nx) * channels;
              if (pixels[nidx + 3] < 200) {
                isEdge = true;
              }
            }
          }
        }
        // Slightly soften edge pixels
        if (isEdge) {
          pixels[idx + 3] = 230; // Reduce alpha slightly at edges
        }
      } else if (alpha > 0 && alpha < 255) {
        // Semi-transparent pixels - make transition smoother
        // Apply a slight reduction to create softer falloff
        const softened = Math.floor(alpha * 0.85);
        pixels[idx + 3] = softened;
      }
    }
  }

  // Reconstruct the image with modified alpha
  return sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  })
    .png()
    .toBuffer();
}

/**
 * Get positions for products based on count.
 * Products are arranged in the center of the canvas for optimal Firefly expansion.
 * Returns array of { x, y, size } for each product.
 */
function getProductPositions(count) {
  const positions = [];
  const cw = COMPOSITE_WIDTH;
  const ch = COMPOSITE_HEIGHT;

  // Products are sized relative to the smaller dimension
  const baseSize = Math.min(cw, ch);

  if (count === 1) {
    // Single product centered
    const size = Math.floor(baseSize * 0.5);
    positions.push({ x: Math.floor((cw - size) / 2), y: Math.floor((ch - size) / 2), size });
  } else if (count === 2) {
    // Side by side, centered vertically
    const size = Math.floor(baseSize * 0.4);
    const spacing = Math.floor(cw * 0.1);
    const totalWidth = size * 2 + spacing;
    const startX = Math.floor((cw - totalWidth) / 2);
    const yPos = Math.floor((ch - size) / 2);
    positions.push({ x: startX, y: yPos, size });
    positions.push({ x: startX + size + spacing, y: yPos, size });
  } else if (count === 3) {
    // Horizontal row, evenly spaced
    const size = Math.floor(baseSize * 0.35);
    const spacing = Math.floor((cw - size * 3) / 4);
    const yPos = Math.floor((ch - size) / 2);
    positions.push({ x: spacing, y: yPos, size });
    positions.push({ x: spacing * 2 + size, y: yPos, size });
    positions.push({ x: spacing * 3 + size * 2, y: yPos, size });
  } else if (count === 4) {
    // 2x2 grid centered
    const size = Math.floor(baseSize * 0.3);
    const hSpacing = Math.floor((cw - size * 2) / 3);
    const vSpacing = Math.floor((ch - size * 2) / 3);
    positions.push({ x: hSpacing, y: vSpacing, size });
    positions.push({ x: hSpacing * 2 + size, y: vSpacing, size });
    positions.push({ x: hSpacing, y: vSpacing * 2 + size, size });
    positions.push({ x: hSpacing * 2 + size, y: vSpacing * 2 + size, size });
  } else {
    // 5+ products: center larger, corners smaller
    const centerSize = Math.floor(baseSize * 0.35);
    const cornerSize = Math.floor(baseSize * 0.22);
    const margin = 15;
    // Center product
    positions.push({
      x: Math.floor((cw - centerSize) / 2),
      y: Math.floor((ch - centerSize) / 2),
      size: centerSize
    });
    // Corner products
    positions.push({ x: margin, y: margin, size: cornerSize });
    positions.push({ x: cw - cornerSize - margin, y: margin, size: cornerSize });
    positions.push({ x: margin, y: ch - cornerSize - margin, size: cornerSize });
    positions.push({ x: cw - cornerSize - margin, y: ch - cornerSize - margin, size: cornerSize });
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
 * Products are placed in the lower center to leave the top clear for text overlay.
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
      // Position products in lower-center area, leaving top for text overlay
      alignment: {
        horizontal: 'center',
        vertical: 'bottom',
      },
      // Inset from bottom edge to avoid products being cut off
      inset: {
        bottom: 80,
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
 * Includes composition guidance for text overlay area in the top portion.
 */
function buildEnhancedPrompt(basePrompt, eventType) {
  const brandContext = 'Luxury beauty brand aesthetic. Soft, elegant, aspirational mood. ' +
    'Color palette: muted pastels, warm neutrals, soft rose gold accents. ' +
    'Lighting: soft diffused natural light, gentle highlights, no harsh shadows. ' +
    'Style: high-end editorial photography, magazine-quality, sophisticated.';

  // Composition guidance that ensures clear space for text overlay
  const compositionGuidance = 'Professional product photography, photorealistic, ' +
    'elegant lifestyle scene surrounding the beauty products. ' +
    'IMPORTANT COMPOSITION: The upper third of the image should have a soft, ' +
    'clean, uncluttered background with gentle gradients or subtle bokeh - ' +
    'suitable for white or dark text overlay. Avoid busy patterns, sharp details, ' +
    'or high-contrast elements in the top portion. Products and detailed scene ' +
    'elements should be concentrated in the lower two-thirds of the image.';

  let eventContext = '';
  if (eventType === 'travel') {
    eventContext = 'Travel-inspired scene with luggage, maps, or destination elements in the lower area. Soft sky or blurred background in upper portion. ';
  } else if (eventType === 'birthday') {
    eventContext = 'Celebratory atmosphere with subtle gift elements, flowers, or festive touches. Soft gradient or bokeh in upper area for text. ';
  } else if (eventType === 'wedding') {
    eventContext = 'Romantic bridal atmosphere with white florals, soft fabrics, champagne tones. Dreamy soft-focus upper area ideal for elegant text. ';
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
