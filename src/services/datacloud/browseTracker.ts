import type { BrowseSession } from '@/types/customer';
import { getDataCloudWriteService } from './writeProfile';

function detectDevice(): BrowseSession['device'] {
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod/.test(ua)) return 'mobile';
  if (/tablet|ipad/.test(ua)) return 'tablet';
  return 'desktop';
}

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class BrowseSessionTracker {
  private customerId: string | null = null;
  private startedAt = 0;
  private categoriesSeen = new Set<string>();
  private productsSeen = new Set<string>();
  private device: BrowseSession['device'];
  private isFlushing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.device = detectDevice();
    this.startPeriodicFlush();
  }

  private startPeriodicFlush() {
    this.intervalId = setInterval(() => {
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private hasData(): boolean {
    return this.categoriesSeen.size > 0 || this.productsSeen.size > 0;
  }

  setCustomer(id: string | null) {
    if (id === this.customerId) return;
    // Flush previous customer's session before switching
    this.flush();
    this.customerId = id;
    this.reset();
  }

  trackProductView(productId: string, category?: string) {
    if (!this.customerId) return;
    if (this.startedAt === 0) this.startedAt = Date.now();
    this.productsSeen.add(productId);
    if (category) this.categoriesSeen.add(category);
  }

  trackCategoryView(category: string) {
    if (!this.customerId) return;
    if (this.startedAt === 0) this.startedAt = Date.now();
    this.categoriesSeen.add(category);
  }

  flush() {
    if (!this.customerId || !this.hasData() || this.isFlushing) return;

    // Snapshot and reset immediately so new events during write aren't lost
    const snapshot = {
      customerId: this.customerId,
      categories: Array.from(this.categoriesSeen),
      products: Array.from(this.productsSeen),
      startedAt: this.startedAt,
    };
    this.reset();

    this.isFlushing = true;
    const durationMinutes = Math.max(1, Math.round((Date.now() - snapshot.startedAt) / 60_000));

    const session: BrowseSession = {
      sessionDate: new Date().toISOString().split('T')[0],
      categoriesBrowsed: snapshot.categories,
      productsViewed: snapshot.products,
      durationMinutes,
      device: this.device,
    };

    getDataCloudWriteService()
      .writeBrowseSession(snapshot.customerId, session)
      .then(() => {
        console.log('[browse-tracker] Flushed session:', snapshot.products.length, 'products,', snapshot.categories.length, 'categories');
      })
      .catch((err) => {
        console.warn('[browse-tracker] Failed to flush session:', err);
      })
      .finally(() => {
        this.isFlushing = false;
      });
  }

  private reset() {
    this.categoriesSeen.clear();
    this.productsSeen.clear();
    this.startedAt = 0;
  }

  destroy() {
    this.flush();
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

let tracker: BrowseSessionTracker | null = null;

export function getBrowseTracker(): BrowseSessionTracker {
  if (!tracker) {
    tracker = new BrowseSessionTracker();
  }
  return tracker;
}
