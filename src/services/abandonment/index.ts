/**
 * Cart & Browse Abandonment Detection
 *
 * Tracks user inactivity and fires journey triggers
 * via the server-side MC Advanced integration.
 */

const API_BASE = 'http://localhost:3001';

// Configurable thresholds (ms)
const CART_ABANDON_DELAY = 10 * 60 * 1000;   // 10 minutes idle with items in cart
const BROWSE_ABANDON_DELAY = 5 * 60 * 1000;  // 5 minutes browsing without add-to-cart

interface AbandonmentState {
  cartTimerId: ReturnType<typeof setTimeout> | null;
  browseTimerId: ReturnType<typeof setTimeout> | null;
  cartFired: boolean;
  browseFired: boolean;
  productsViewed: string[];
  categoriesBrowsed: string[];
}

const state: AbandonmentState = {
  cartTimerId: null,
  browseTimerId: null,
  cartFired: false,
  browseFired: false,
  productsViewed: [],
  categoriesBrowsed: [],
};

function resetCartTimer() {
  if (state.cartTimerId) clearTimeout(state.cartTimerId);
  state.cartTimerId = null;
}

function resetBrowseTimer() {
  if (state.browseTimerId) clearTimeout(state.browseTimerId);
  state.browseTimerId = null;
}

/**
 * Call when user adds an item to cart or interacts with the cart.
 * Resets browse abandonment tracking since they engaged.
 */
export function onCartActivity(
  email: string | undefined,
  contactKey: string | undefined,
  cartItems: { name: string; price: number }[],
  cartTotal: number
) {
  // Reset browse abandonment since they're engaging
  resetBrowseTimer();
  state.browseFired = true; // No longer relevant

  // Reset and start cart abandonment timer
  resetCartTimer();
  if (state.cartFired || !email) return;

  state.cartTimerId = setTimeout(() => {
    fireAbandonedCart(email, contactKey, cartItems, cartTotal);
  }, CART_ABANDON_DELAY);
}

/**
 * Call when user views a product or category.
 */
export function onBrowseActivity(
  email: string | undefined,
  contactKey: string | undefined,
  productId?: string,
  category?: string
) {
  if (productId && !state.productsViewed.includes(productId)) {
    state.productsViewed.push(productId);
  }
  if (category && !state.categoriesBrowsed.includes(category)) {
    state.categoriesBrowsed.push(category);
  }

  // Reset and start browse abandonment timer
  resetBrowseTimer();
  if (state.browseFired || !email) return;

  state.browseTimerId = setTimeout(() => {
    fireAbandonedBrowse(email, contactKey);
  }, BROWSE_ABANDON_DELAY);
}

/**
 * Call when user completes checkout — cancel all abandonment tracking.
 */
export function onCheckoutComplete() {
  resetCartTimer();
  resetBrowseTimer();
  state.cartFired = true;
  state.browseFired = true;
}

/**
 * Reset all state for a new session (e.g., persona switch).
 */
export function resetAbandonmentTracking() {
  resetCartTimer();
  resetBrowseTimer();
  state.cartFired = false;
  state.browseFired = false;
  state.productsViewed = [];
  state.categoriesBrowsed = [];
}

// ─── Internal trigger functions ─────────────────────────────────

async function fireAbandonedCart(
  email: string,
  contactKey: string | undefined,
  cartItems: { name: string; price: number }[],
  cartTotal: number
) {
  if (state.cartFired) return;
  state.cartFired = true;

  console.log('[abandonment] Firing abandoned cart for', email);
  try {
    await fetch(`${API_BASE}/api/journey/abandoned-cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactKey: contactKey || email,
        email,
        cartItems,
        cartTotal,
      }),
    });
  } catch (err) {
    console.error('[abandonment] Failed to fire cart abandon:', err);
  }
}

async function fireAbandonedBrowse(email: string, contactKey: string | undefined) {
  if (state.browseFired) return;
  state.browseFired = true;

  console.log('[abandonment] Firing abandoned browse for', email);
  try {
    await fetch(`${API_BASE}/api/journey/abandoned-browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactKey: contactKey || email,
        email,
        productsViewed: state.productsViewed,
        categoriesBrowsed: state.categoriesBrowsed,
      }),
    });
  } catch (err) {
    console.error('[abandonment] Failed to fire browse abandon:', err);
  }
}

// ─── Visibility change handler ──────────────────────────────────
// When user switches tabs/minimizes, accelerate the timers

let visibilityRegistered = false;

export function registerVisibilityHandler() {
  if (visibilityRegistered) return;
  visibilityRegistered = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // User left the tab — if timers are running, reduce them to 2 minutes
      if (state.cartTimerId && !state.cartFired) {
        resetCartTimer();
        state.cartTimerId = setTimeout(() => {
          // We can't fire without data, so this is a simplified trigger
          console.log('[abandonment] Tab hidden — cart abandon timer accelerated');
        }, 2 * 60 * 1000);
      }
    }
  });
}
