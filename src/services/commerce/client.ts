import type { Product } from '@/types/product';
import type { CommerceConfig, ProductSearchParams, OrderResponse } from './types';

// ─── Commerce on Core Connect API response shapes ─────────────────────────

interface ConnectProduct {
  id?: string;
  name?: string;
  sku?: string;
  description?: string;
  defaultImage?: { url?: string; alternateText?: string };
  primaryProductCategory?: { id?: string; name?: string };
  prices?: { unitPrice?: number; listPrice?: number; currencyIsoCode?: string };
  // Custom fields on the Product2 object surfaced via Connect API
  fields?: Record<string, unknown>;
}

interface ConnectProductSearchResponse {
  productsPage?: {
    count?: number;
    total?: number;
    products?: ConnectProduct[];
  };
}

/** Basket item for checkout. */
export interface BasketItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  salesforceId?: string;
}

/** Shipping address for checkout. */
export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  stateCode: string;
  postalCode: string;
  countryCode: string;
}

/** Payment details for checkout. */
export interface PaymentInfo {
  methodId: string;
  cardNumber?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export class CommerceClient {
  private config: CommerceConfig;
  private accessToken: string | null;
  private tokenExpiresAt = 0;

  constructor(config: CommerceConfig) {
    this.config = config;
    this.accessToken = config.accessToken || null;
  }

  // ─── OAuth Token Management ─────────────────────────────────────────────
  // Reuses the same Agentforce client credentials — Commerce on Core is the
  // same Salesforce org, so the same token works for both.

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    if (this.accessToken && !this.config.clientId) {
      return this.accessToken;
    }

    const response = await fetch('/api/sf/token', { method: 'POST' });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Commerce OAuth failed (${response.status}): ${errText}`);
    }

    const data = await response.json() as { access_token: string; expires_in?: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 7200_000) - 300_000;
    return this.accessToken!;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private get baseUrl(): string {
    return '/api/commerce';
  }

  // ─── Product Catalog ────────────────────────────────────────────────────

  async searchProducts(params: ProductSearchParams): Promise<Product[]> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set('searchTerm', params.query);
    if (params.limit) searchParams.set('pageSize', String(params.limit));

    const response = await fetch(
      `${this.baseUrl}/search/product-search?${searchParams.toString()}`,
      { headers: await this.authHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Product search failed: ${response.statusText}`);
    }

    const data = await response.json() as ConnectProductSearchResponse;
    return (data.productsPage?.products || []).map((p) => this.mapProduct(p));
  }

  async getProduct(productId: string): Promise<Product> {
    const response = await fetch(
      `${this.baseUrl}/products/${encodeURIComponent(productId)}`,
      { headers: await this.authHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Product fetch failed: ${response.statusText}`);
    }

    const data = await response.json() as ConnectProduct;
    return this.mapProduct(data);
  }

  // ─── Cart API (Commerce on Core) ────────────────────────────────────────

  /** Create a new cart. Returns the cartId. */
  async createCart(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/carts`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Create cart failed: ${response.statusText}`);
    }

    const data = await response.json() as { cartId?: string };
    return data.cartId || '';
  }

  /** Add items to an existing cart. */
  async addItemsToCart(cartId: string, items: BasketItem[]): Promise<void> {
    for (const item of items) {
      const response = await fetch(
        `${this.baseUrl}/carts/${encodeURIComponent(cartId)}/cart-items`,
        {
          method: 'POST',
          headers: await this.authHeaders(),
          body: JSON.stringify({
            productId: item.productId,
            quantity: item.quantity,
            type: 'Product',
          }),
        }
      );
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Add item to cart failed (${response.status}): ${errText}`);
      }
    }
  }

  /** Create a checkout from the cart and return a simple order summary. */
  async createCheckout(cartId: string): Promise<OrderResponse> {
    const response = await fetch(`${this.baseUrl}/checkouts`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify({ cartId }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Checkout failed (${response.status}): ${errText}`);
    }

    const data = await response.json() as { checkoutId?: string; orderReferenceNumber?: string; status?: string };
    return {
      orderId: data.orderReferenceNumber || data.checkoutId || '',
      status: 'confirmed',
      total: 0, // Connect API checkout doesn't return total inline
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Full checkout flow: create cart → add items → create checkout.
   */
  async checkout(params: {
    items: BasketItem[];
    email: string;
    shippingAddress: ShippingAddress;
    paymentMethodId?: string;
  }): Promise<OrderResponse> {
    const cartId = await this.createCart();
    await this.addItemsToCart(cartId, params.items);
    return this.createCheckout(cartId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private mapProduct(raw: ConnectProduct): Product {
    const category = raw.primaryProductCategory?.name?.toLowerCase().replace(/\s+/g, '-') || 'moisturizer';
    return {
      id: raw.id || '',
      name: raw.name || '',
      brand: (raw.fields?.['Brand__c'] as string) || 'Beaute',
      category: category as import('@/types/product').ProductCategory,
      price: raw.prices?.unitPrice || raw.prices?.listPrice || 0,
      currency: raw.prices?.currencyIsoCode || 'USD',
      description: raw.description || '',
      shortDescription: raw.description?.substring(0, 120) || '',
      imageUrl: raw.defaultImage?.url || '',
      images: raw.defaultImage?.url ? [raw.defaultImage.url] : [],
      attributes: {
        skinType: [] as ('dry' | 'oily' | 'combination' | 'sensitive' | 'normal')[],
        concerns: [],
        ingredients: [],
        size: (raw.fields?.['Size__c'] as string) || '',
        isTravel: false,
      },
      rating: (raw.fields?.['Average_Rating__c'] as number) || 0,
      reviewCount: (raw.fields?.['Review_Count__c'] as number) || 0,
      inStock: true,
    };
  }
}

let commerceClient: CommerceClient | null = null;

export const getCommerceClient = (): CommerceClient => {
  if (!commerceClient) {
    commerceClient = new CommerceClient({
      webstoreId: import.meta.env.VITE_COMMERCE_SITE_ID || '',
      // Reuse Agentforce OAuth credentials — same org
      clientId: import.meta.env.VITE_AGENTFORCE_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_AGENTFORCE_CLIENT_SECRET || '',
    });
  }
  return commerceClient;
};
