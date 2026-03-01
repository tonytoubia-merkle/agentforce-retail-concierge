/**
 * Journey Image Generation API
 *
 * Composites product images and uses Firefly Generate Object Composite to
 * create a scene around them. Uses Image Model 4 via the async API.
 *
 * POST /api/generate-journey-image
 * Body: {
 *   products: [{ imageUrl: string, name: string }],
 *   prompt: string,  // Scene description for Firefly composite
 *   eventType?: string  // Optional: travel, birthday, wedding, etc.
 * }
 *
 * Returns: { imageUrl: string, success: boolean }
 */

import https from 'node:https';
import sharp from 'sharp';

// Canvas dimensions
// Composite is larger to fill more of the output and reduce Firefly generation area
const COMPOSITE_SIZE = 600;    // Square product composite canvas
const OUTPUT_WIDTH = 2688;     // Widescreen (16:9) — supported by Firefly Object Composite
const OUTPUT_HEIGHT = 1536;    // Widescreen (16:9)

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
  console.log(`[generate-journey-image] Downloading image: ${resolvedUrl}`);

  const parsedUrl = new URL(resolvedUrl);
  const result = await httpsRequest({
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: { 'User-Agent': 'JourneyImageGenerator/1.0' },
  });

  if (result.statusCode !== 200) {
    console.error(`[generate-journey-image] Image download FAILED: ${resolvedUrl} -> ${result.statusCode}`);
    throw new Error(`Failed to download image from ${resolvedUrl}: ${result.statusCode}`);
  }

  console.log(`[generate-journey-image] Downloaded ${result.body.length} bytes from ${parsedUrl.pathname}`);
  return result.body;
}

/**
 * Composite multiple product images onto a transparent canvas.
 * Products are arranged horizontally with a size/depth hierarchy:
 * - Center product(s) are largest (hero position)
 * - Edge products are smaller and layered behind
 * - Firefly Object Composite generates the scene around the products
 */
async function compositeProducts(products) {
  // Create canvas with fully transparent background
  // Firefly Object Composite will generate the scene around the product images
  const canvas = sharp({
    create: {
      width: COMPOSITE_SIZE,
      height: COMPOSITE_SIZE,
      channels: 4,
      // Fully transparent - let Firefly generate the entire background
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  // Get positions with z-index for layering (center products on top)
  const positions = getProductPositions(products.length);

  // Download and prepare all product images first
  const productData = [];
  for (let i = 0; i < products.length && i < positions.length; i++) {
    try {
      const imageBuffer = await downloadImage(products[i].imageUrl);
      const pos = positions[i];

      // Resize product image
      const resizedImage = await sharp(imageBuffer)
        .resize(pos.size, pos.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

      // Soften edges for better blending
      const edgeSoftened = await softProductEdges(resizedImage, pos.size);

      productData.push({
        input: edgeSoftened,
        left: pos.x,
        top: pos.y,
        zIndex: pos.zIndex,
        productName: products[i].name,
        size: pos.size
      });
    } catch (err) {
      console.error(`[generate-journey-image] Failed to process product ${i}:`, err.message);
    }
  }

  if (productData.length === 0) {
    throw new Error('No product images could be processed');
  }

  // Sort by z-index: lower z-index first (background), higher z-index last (foreground)
  // This ensures edge products are rendered behind center/hero products
  productData.sort((a, b) => a.zIndex - b.zIndex);

  // Extract composites in sorted order for Sharp
  const composites = productData.map(p => ({
    input: p.input,
    left: p.left,
    top: p.top
  }));

  // Composite all products onto canvas
  const compositeBuffer = await canvas
    .composite(composites)
    .png()
    .toBuffer();

  console.log(`[generate-journey-image] Composite: ${COMPOSITE_SIZE}x${COMPOSITE_SIZE}, ${productData.length} products`);
  console.log('[generate-journey-image] Layer order (back to front):');
  productData.forEach((p, i) => {
    console.log(`  [${i}] z:${p.zIndex} size:${p.size}px pos:(${p.left},${p.top}) "${p.productName}"`);
  });

  return { buffer: compositeBuffer, compositedCount: productData.length };
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
 * Get positions for products in a horizontal row with depth hierarchy.
 *
 * Layout strategy:
 * - Products arranged horizontally in lower portion of canvas
 * - Center product(s) are largest (hero position, highest z-index)
 * - Edge products are progressively smaller (lower z-index, appear behind)
 * - Tight overlap creates visual depth and cohesion
 * - Lower positioning leaves upper area clear for text overlay
 *
 * Returns array of { x, y, size, zIndex, originalIndex } for each product.
 */
function getProductPositions(count) {
  if (count === 0) return [];

  const cw = COMPOSITE_SIZE;
  const ch = COMPOSITE_SIZE;

  // Size configuration - MUCH BIGGER products with heavy overlap
  // Product images have transparent padding, so they can overlap significantly
  const heroSize = Math.floor(cw * 1.0);       // Center/hero product = full canvas width
  const minSize = Math.floor(cw * 0.70);       // Edge products = 70% of canvas
  const overlapFactor = 0.55;                   // Heavy overlap (products have transparent edges)

  // Vertical positioning: place products in lower 60% of canvas
  // This leaves upper 40% clear for text overlay
  const verticalCenter = Math.floor(ch * 0.6); // Products centered at 60% down

  // For single product, center horizontally but in lower portion
  if (count === 1) {
    return [{
      x: Math.floor((cw - heroSize) / 2),
      y: Math.floor(verticalCenter - heroSize / 2),
      size: heroSize,
      zIndex: 1,
      originalIndex: 0
    }];
  }

  const positions = [];
  const centerIndex = (count - 1) / 2;  // Can be fractional for even counts

  // Calculate sizes based on distance from center
  // Center = heroSize, edges = minSize, interpolate between
  const maxDistance = Math.floor(count / 2);

  for (let i = 0; i < count; i++) {
    const distanceFromCenter = Math.abs(i - centerIndex);
    const normalizedDistance = maxDistance > 0 ? distanceFromCenter / maxDistance : 0;

    // Interpolate size: center is largest, edges are smallest
    const size = Math.floor(heroSize - (heroSize - minSize) * normalizedDistance);

    // Z-index: higher for center products (will be composited last = on top)
    // Use inverse of distance, scaled to be positive integers
    const zIndex = Math.floor((1 - normalizedDistance) * 100);

    positions.push({
      size,
      zIndex,
      originalIndex: i
    });
  }

  // Calculate X positions with overlap
  const centerX = cw / 2;

  // Calculate total width needed (accounting for overlap)
  let totalWidth = 0;
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      totalWidth += positions[i].size;
    } else {
      // Each subsequent product overlaps the previous by overlapFactor
      totalWidth += positions[i].size * (1 - overlapFactor);
    }
  }

  // Starting X position (left edge of first product)
  let currentX = Math.floor(centerX - totalWidth / 2);

  for (let i = 0; i < count; i++) {
    const pos = positions[i];
    pos.x = Math.round(currentX);

    // Position in lower portion, with slight upward shift for smaller products (depth illusion)
    const distanceFromCenter = Math.abs(i - centerIndex);
    const normalizedDistance = maxDistance > 0 ? distanceFromCenter / maxDistance : 0;
    const verticalOffset = Math.floor(normalizedDistance * 20); // Smaller products slightly higher
    pos.y = Math.round(verticalCenter - pos.size / 2 - verticalOffset);

    // Move X for next product (with overlap)
    if (i < count - 1) {
      const nextSize = positions[i + 1].size;
      const overlap = Math.min(pos.size, nextSize) * overlapFactor;
      currentX += pos.size - overlap;
    }
  }

  return positions;
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
 * Sleep helper for retry delays.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Firefly Generate Object Composite API (async).
 * Creates a scene around the product composite using Image Model 4.
 * Products are placed in the lower center to leave the top clear for text overlay.
 *
 * This is the preferred approach over Expand — it's purpose-built for
 * compositing objects (like products) into AI-generated scenes.
 */
async function generateObjectComposite(uploadId, prompt, token, clientId) {
  const requestBody = JSON.stringify({
    contentClass: 'photo',
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
        vertical: 'bottom',
      },
    },
  });

  console.log('[generate-journey-image] Calling Firefly Generate Object Composite (async)...');

  const result = await httpsRequest({
    hostname: 'firefly-api.adobe.io',
    port: 443,
    path: '/v3/images/generate-object-composite-async',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-api-key': clientId,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
    },
  }, requestBody);

  if (result.statusCode !== 202 && result.statusCode !== 200) {
    const bodyStr = result.body.toString();
    throw new Error(`Firefly object composite failed: ${result.statusCode} - ${bodyStr}`);
  }

  const data = JSON.parse(result.body.toString());

  // Async response — poll for result
  if (data.jobId) {
    console.log(`[generate-journey-image] Object composite job submitted: ${data.jobId}`);
    return pollFireflyJob(data.jobId, token, clientId);
  }

  // Synchronous fallback (unlikely for async endpoint)
  const imageUrl = data.outputs?.[0]?.image?.url
    || data.outputs?.[0]?.image?.presignedUrl
    || data.images?.[0]?.url;
  if (imageUrl) return imageUrl;

  throw new Error('Firefly object composite returned no jobId or image URL');
}

/**
 * Poll for an async Firefly job result.
 * The generate-async endpoint returns a jobId; poll /v3/status/{jobId} until complete.
 */
async function pollFireflyJob(jobId, token, clientId) {
  const maxAttempts = 30;  // 60s max
  const pollInterval = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);

    const result = await httpsRequest({
      hostname: 'firefly-api.adobe.io',
      port: 443,
      path: `/v3/status/${jobId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-api-key': clientId,
        'Accept': 'application/json',
      },
    });

    if (result.statusCode !== 200) {
      console.warn(`[generate-journey-image] Status poll ${attempt + 1} returned ${result.statusCode}`);
      continue;
    }

    const status = JSON.parse(result.body.toString());
    console.log(`[generate-journey-image] Job ${jobId} status: ${status.status}`);

    if (status.status === 'succeeded') {
      const imageUrl = status.result?.outputs?.[0]?.image?.presignedUrl
        || status.result?.outputs?.[0]?.image?.url
        || status.outputs?.[0]?.image?.presignedUrl
        || status.outputs?.[0]?.image?.url
        || status.result?.images?.[0]?.url;

      if (!imageUrl) {
        throw new Error('Firefly job succeeded but returned no image URL');
      }
      return imageUrl;
    }

    if (status.status === 'failed' || status.status === 'cancelled') {
      throw new Error(`Firefly job ${status.status}: ${status.message || status.error_code || 'unknown'}`);
    }
  }

  throw new Error(`Firefly job timed out after ${maxAttempts * pollInterval / 1000}s`);
}

/**
 * Fallback: Call Firefly Generate Async API (text-to-image) without product compositing.
 * Uses Image Model 4 via the async endpoint, then polls for the result.
 * Used when Expand API fails consistently.
 */
async function generateImageFallback(prompt, token, clientId) {
  console.log('[generate-journey-image] Using Generate Async API fallback (image4)...');

  const requestBody = JSON.stringify({
    prompt: prompt,
    contentClass: 'photo',
    size: {
      width: 2048,
      height: 2048
    },
    numVariations: 1
  });

  const result = await httpsRequest({
    hostname: 'firefly-api.adobe.io',
    port: 443,
    path: '/v3/images/generate-async',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-api-key': clientId,
      'x-model-version': 'image4_standard',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
    },
  }, requestBody);

  if (result.statusCode !== 202 && result.statusCode !== 200) {
    throw new Error(`Firefly generate-async failed: ${result.statusCode} - ${result.body.toString()}`);
  }

  const data = JSON.parse(result.body.toString());
  console.log('[generate-journey-image] Async job submitted:', data.jobId);

  // If the API returned a synchronous result (backward compat)
  if (!data.jobId) {
    const imageUrl = data.outputs?.[0]?.image?.url
      || data.outputs?.[0]?.image?.presignedUrl
      || data.images?.[0]?.url;
    if (imageUrl) return imageUrl;
    throw new Error('Firefly returned no jobId or image URL');
  }

  return pollFireflyJob(data.jobId, token, clientId);
}

/**
 * Build an enhanced prompt with brand guidelines.
 * IMPORTANT: Firefly has a 1024 character limit, so keep this concise!
 */
function buildEnhancedPrompt(basePrompt, eventType) {
  // Truncate base prompt if too long (leave room for style additions)
  const maxBaseLength = 600;
  const truncatedBase = basePrompt.length > maxBaseLength
    ? basePrompt.substring(0, maxBaseLength)
    : basePrompt;

  // Concise brand/style context - products in lower portion, upper area clear for text
  const style = 'Luxury beauty editorial, soft natural light, muted pastels, products in lower half, clean minimal upper area for text';

  // Event-specific context (~50-80 chars)
  let eventHint = '';
  if (eventType === 'travel') {
    eventHint = 'travel lifestyle scene, soft blurred background';
  } else if (eventType === 'birthday') {
    eventHint = 'celebratory atmosphere, bokeh lights';
  } else if (eventType === 'wedding') {
    eventHint = 'romantic bridal scene, white florals';
  }

  const fullPrompt = eventHint
    ? `${truncatedBase}. ${eventHint}, ${style}`
    : `${truncatedBase}. ${style}`;

  // Final safety check - Firefly limit is 1024
  return fullPrompt.length > 1000 ? fullPrompt.substring(0, 1000) : fullPrompt;
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
    const { products, prompt, eventType, debugComposite } = JSON.parse(body.toString());

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
    console.log('[generate-journey-image] Products:');
    products.forEach((p, i) => {
      console.log(`  [${i}] ${p.name}: ${p.imageUrl}`);
    });

    // Get Firefly token first
    console.log('[generate-journey-image] Getting Firefly token...');
    const token = await getFireflyToken(clientId, clientSecret);

    const enhancedPrompt = buildEnhancedPrompt(prompt, eventType);
    let imageUrl;
    let usedFallback = false;

    // Create the product composite
    console.log('[generate-journey-image] Compositing products...');
    const { buffer: compositeBuffer, compositedCount } = await compositeProducts(products);
    console.log(`[generate-journey-image] Composite created: ${compositeBuffer.length} bytes, ${compositedCount}/${products.length} products`);

    // Debug mode: return the composite as base64 without calling Firefly
    if (debugComposite) {
      console.log('[generate-journey-image] DEBUG MODE: Returning composite image only');
      const compositeBase64 = compositeBuffer.toString('base64');
      const result = JSON.stringify({
        success: true,
        debug: true,
        compositeDataUrl: `data:image/png;base64,${compositeBase64}`,
        productCount: compositedCount,
      });
      res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      return res.end(result);
    }

    try {
      // Upload product composite then generate scene around it
      console.log('[generate-journey-image] Uploading to Firefly...');
      const uploadId = await uploadToFirefly(compositeBuffer, token, clientId);
      console.log(`[generate-journey-image] Upload ID: ${uploadId}`);

      console.log('[generate-journey-image] Enhanced prompt:', enhancedPrompt);
      imageUrl = await generateObjectComposite(uploadId, enhancedPrompt, token, clientId);
      console.log('[generate-journey-image] Object Composite SUCCEEDED - products should be in the output');
    } catch (compositeErr) {
      // Fallback to Generate API if Object Composite fails
      console.log(`[generate-journey-image] ⚠️ OBJECT COMPOSITE FAILED: ${compositeErr.message}`);
      console.log('[generate-journey-image] ⚠️ Falling back to Generate API - PRODUCTS WILL NOT BE IN OUTPUT');
      imageUrl = await generateImageFallback(enhancedPrompt, token, clientId);
      usedFallback = true;
    }

    console.log(`[generate-journey-image] Generated image URL: ${imageUrl.substring(0, 100)}...`);

    // Return success
    const result = JSON.stringify({
      success: true,
      imageUrl: imageUrl,
      productCount: compositedCount,
      usedFallback: usedFallback,
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
