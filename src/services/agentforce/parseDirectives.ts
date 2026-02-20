import type { UIDirective, UIAction } from '@/types/agent';
import type { Product } from '@/types/product';
import type { RawAgentResponse } from './types';

/**
 * Strip invisible/control characters that Agentforce sometimes injects,
 * keeping only standard whitespace (\n, \r, \t, space) intact.
 */
function sanitize(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\uFEFF]/g, '').trim();
}

/** Ensure every product has an `id` — agent responses may use different field names. */
function normalizeProducts(products: unknown[]): Product[] {
  return products.map((p, i) => {
    const raw = p as Record<string, unknown>;
    if (!raw.id) {
      raw.id = raw.productId || raw.sku || raw.productCode || `product-${i}`;
    }
    return raw as unknown as Product;
  });
}

/**
 * Infer the uiDirective action from the shape of the payload when the agent
 * omits the explicit `action` field.
 */
function inferAction(d: Record<string, unknown>): UIAction | undefined {
  // Explicit action — use as-is
  if (d.action && typeof d.action === 'string') return d.action as UIAction;

  const payload = (d.payload || {}) as Record<string, unknown>;
  const carousel = d.productCarousel as Record<string, unknown> | undefined;

  // Has products (or items mapped to products, or productCarousel.products) → SHOW_PRODUCTS
  if (
    Array.isArray(payload.products) ||
    Array.isArray(d.products) ||
    Array.isArray(d.items) ||
    (carousel && Array.isArray(carousel.products))
  ) {
    return 'SHOW_PRODUCTS' as UIAction;
  }

  // Has welcomeMessage → WELCOME_SCENE
  if (payload.welcomeMessage || d.welcomeMessage) return 'WELCOME_SCENE' as UIAction;

  // Has a single product → SHOW_PRODUCT
  if (payload.product || d.product) return 'SHOW_PRODUCT' as UIAction;

  // Has sceneContext/scene but no products → CHANGE_SCENE
  if (payload.sceneContext || d.sceneContext || d.scene || d.setting || d.backgroundPrompt) {
    return 'CHANGE_SCENE' as UIAction;
  }

  // Has only captures (no products, no scene) — treat as a no-op directive
  // so the frontend can still display capture notifications
  if (Array.isArray(payload.captures) || Array.isArray(d.captures)) {
    return 'CAPTURE_ONLY' as UIAction;
  }

  return undefined;
}

/**
 * Normalize an agent response where the payload shape doesn't match the
 * expected `{ action, payload: { products, sceneContext, ... } }` structure.
 * The agent sometimes puts fields directly on the uiDirective root or uses
 * `items` instead of `products`.
 */
function normalizePayload(
  d: Record<string, unknown>,
  action: UIAction,
): UIDirective['payload'] {
  const existing = (d.payload || {}) as Record<string, unknown>;

  // Map `items` → `products` (agent sometimes uses wrong key)
  if (!existing.products && (d.items || existing.items)) {
    existing.products = d.items || existing.items;
    console.warn('[parseDirectives] Normalized "items" → "products"');
  }

  // Map `d.products` (flat on uiDirective root) into payload
  if (!existing.products && d.products) {
    existing.products = d.products;
    console.warn('[parseDirectives] Moved root-level "products" into payload');
  }

  // Map `d.productCarousel.products` → `products` (agent sometimes nests in carousel)
  const carousel = d.productCarousel as Record<string, unknown> | undefined;
  if (!existing.products && carousel && Array.isArray(carousel.products)) {
    existing.products = carousel.products;
    console.warn('[parseDirectives] Normalized "productCarousel.products" → "products"');
  }

  // Map `d.scene` → `sceneContext` (agent sometimes uses "scene" instead of "sceneContext")
  if (!existing.sceneContext && d.scene) {
    existing.sceneContext = d.scene;
    console.warn('[parseDirectives] Normalized "scene" → "sceneContext"');
  }

  // Map welcome fields from root into payload
  if (!existing.welcomeMessage && d.welcomeMessage) {
    existing.welcomeMessage = d.welcomeMessage;
  }
  if (!existing.welcomeSubtext && d.welcomeSubtext) {
    existing.welcomeSubtext = d.welcomeSubtext;
  }

  // Map sceneContext from root into payload
  if (!existing.sceneContext && d.sceneContext) {
    existing.sceneContext = d.sceneContext;
  }

  // Map captures from root into payload
  if (!existing.captures && d.captures) {
    existing.captures = d.captures;
  }

  return existing as UIDirective['payload'];
}

function extractDirective(obj: unknown): UIDirective | undefined {
  if (obj && typeof obj === 'object' && 'uiDirective' in (obj as Record<string, unknown>)) {
    const d = (obj as Record<string, unknown>).uiDirective as Record<string, unknown>;
    if (!d) return undefined;

    const action = inferAction(d);
    if (!action) {
      console.warn('[parseDirectives] Could not infer action from uiDirective:', Object.keys(d));
      return undefined;
    }

    if (!d.action) {
      console.warn(`[parseDirectives] Inferred missing action: "${action}"`);
    }

    const payload = normalizePayload(d, action);

    if (payload.products && Array.isArray(payload.products)) {
      payload.products = normalizeProducts(payload.products);
    }
    if (payload.checkoutData?.products && Array.isArray(payload.checkoutData.products)) {
      payload.checkoutData.products = normalizeProducts(payload.checkoutData.products);
    }
    return { action, payload };
  }
  return undefined;
}

function tryParseJSON(text: string): unknown | undefined {
  const clean = sanitize(text);

  // Direct parse
  try {
    return JSON.parse(clean);
  } catch { /* continue */ }

  // Extract substring from first '{' to last '}'
  const start = clean.indexOf('{');
  if (start === -1) return undefined;
  const end = clean.lastIndexOf('}');

  // If we have both opening and closing braces, try a clean parse first
  let candidate: string;
  if (end > start) {
    candidate = clean.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch { /* continue */ }
  } else {
    // No closing brace at all — fully truncated JSON. Use everything from
    // the first '{' and fall through to the repair logic below.
    candidate = clean.slice(start);
  }

  // Agentforce sometimes returns truncated JSON — missing closing braces,
  // brackets, or even cut mid-string. Attempt progressive repair.
  let depth = 0;
  let bracketDepth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
  }

  if (depth > 0 || bracketDepth > 0 || inStr) {
    let repaired = candidate;

    // If truncated inside a string literal, close it and trim the
    // incomplete value before the string's content gets mangled.
    if (inStr) {
      // Trim trailing whitespace/partial words inside the string, then close
      repaired = repaired.replace(/\s+$/, '') + '"';
    }

    // We may be mid-key/value in an object or between array elements.
    // Trim trailing comma, colon, or whitespace that would make JSON invalid.
    repaired = repaired.replace(/[,:\s]+$/, '');

    repaired += ']'.repeat(Math.max(0, bracketDepth)) + '}'.repeat(Math.max(0, depth));

    try {
      console.warn(
        `[parseDirectives] Repaired truncated JSON: closedString=${inStr}, brackets=${bracketDepth}, braces=${depth}`
      );
      return JSON.parse(repaired);
    } catch { /* continue */ }

    // If the simple repair failed, try trimming back to the last complete
    // array element (useful when cut mid-object inside an array).
    const lastCompleteItem = repaired.lastIndexOf('},');
    if (lastCompleteItem > 0) {
      const trimmed = repaired.slice(0, lastCompleteItem + 1) +
        ']'.repeat(Math.max(0, bracketDepth)) +
        '}'.repeat(Math.max(0, depth));
      try {
        console.warn('[parseDirectives] Repaired by trimming to last complete array element');
        return JSON.parse(trimmed);
      } catch { /* continue */ }
    }
  }

  return undefined;
}

export function parseUIDirective(response: RawAgentResponse): UIDirective | undefined {
  if (response.metadata?.uiDirective) {
    return extractDirective({ uiDirective: response.metadata.uiDirective });
  }

  const text = response.message || response.rawText || '';
  const parsed = tryParseJSON(text);
  if (parsed) {
    return extractDirective(parsed);
  }

  return undefined;
}
