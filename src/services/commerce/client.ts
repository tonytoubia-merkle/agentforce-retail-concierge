import type { Product } from '@/types/product';
import type { CommerceConfig, ProductSearchParams, OrderResponse } from './types';

/** SFCC Shopper API product hit from product_search. */
interface SfccProductHit {
  product_id?: string;
  id?: string;
  product_name?: string;
  name?: string;
  brand?: string;
  primary_category_id?: string;
  price?: number;
  currency?: string;
  long_description?: string;
  description?: string;
  short_description?: string;
  image?: { link?: string };
  imageUrl?: string;
  image_groups?: Array<{ images?: Array<{ link: string }> }>;
  inventory?: { orderable?: boolean };
  c_skinType?: string[];
  c_concerns?: string[];
  c_ingredients?: string[];
  c_size?: string;
  c_isTravel?: boolean;
  c_rating?: number;
  c_reviewCount?: number;
  c_personalizationScore?: number;
  salesforceId?: string;
}

/** Basket item for SFCC Shopper Baskets API. */
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

  constructor(config: CommerceConfig) {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private get baseUrl(): string {
    return `/api/commerce`;
  }

  // ─── Product Catalog ──────────────────────────────────────────

  async searchProducts(params: ProductSearchParams): Promise<Product[]> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set('q', params.query);
    if (params.category) searchParams.set('refine_1', `cgid=${params.category}`);
    if (params.limit) searchParams.set('count', String(params.limit));
    if (params.offset) searchParams.set('start', String(params.offset));

    const response = await fetch(
      `${this.baseUrl}/product_search?${searchParams.toString()}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Product search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.hits || []).map((hit: SfccProductHit) => this.mapProduct(hit));
  }

  async getProduct(productId: string): Promise<Product> {
    const response = await fetch(
      `${this.baseUrl}/products/${encodeURIComponent(productId)}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Product fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapProduct(data);
  }

  // ─── Shopper Baskets API ──────────────────────────────────────

  /** Create a new basket (shopping cart) on SFCC. */
  async createBasket(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/baskets`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Create basket failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.basket_id;
  }

  /** Add items to an existing basket. */
  async addItemsToBasket(basketId: string, items: BasketItem[]): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/baskets/${encodeURIComponent(basketId)}/items`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        }))),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Add items to basket failed (${response.status}): ${errText}`);
    }
  }

  /** Set shipping address on the basket. */
  async setShippingAddress(basketId: string, address: ShippingAddress): Promise<void> {
    // SFCC requires setting the shipment's shipping address
    const response = await fetch(
      `${this.baseUrl}/baskets/${encodeURIComponent(basketId)}/shipments/me/shipping_address`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({
          first_name: address.firstName,
          last_name: address.lastName,
          address1: address.address1,
          city: address.city,
          state_code: address.stateCode,
          postal_code: address.postalCode,
          country_code: address.countryCode,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Set shipping address failed (${response.status}): ${errText}`);
    }
  }

  /** Set shipping method on the basket. */
  async setShippingMethod(basketId: string, methodId = 'standard'): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/baskets/${encodeURIComponent(basketId)}/shipments/me/shipping_method`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({ id: methodId }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Set shipping method failed (${response.status}): ${errText}`);
    }
  }

  /** Set billing address on the basket. */
  async setBillingAddress(basketId: string, address: ShippingAddress): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/baskets/${encodeURIComponent(basketId)}/billing_address`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({
          first_name: address.firstName,
          last_name: address.lastName,
          address1: address.address1,
          city: address.city,
          state_code: address.stateCode,
          postal_code: address.postalCode,
          country_code: address.countryCode,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Set billing address failed (${response.status}): ${errText}`);
    }
  }

  /** Add a payment instrument to the basket. */
  async addPaymentInstrument(basketId: string, payment: PaymentInfo): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/baskets/${encodeURIComponent(basketId)}/payment_instruments`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          payment_method_id: payment.methodId,
          amount: 0, // SFCC auto-fills from basket total
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Add payment instrument failed (${response.status}): ${errText}`);
    }
  }

  /** Set customer email on the basket. */
  async setCustomerInfo(basketId: string, email: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/baskets/${encodeURIComponent(basketId)}/customer`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Set customer info failed (${response.status}): ${errText}`);
    }
  }

  // ─── Shopper Orders API ───────────────────────────────────────

  /** Create an order from a basket. This is the final checkout step. */
  async createOrder(basketId: string): Promise<OrderResponse> {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ basket_id: basketId }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Order creation failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
      orderId: data.order_no || data.order_id,
      status: 'confirmed',
      total: data.order_total || data.product_total || 0,
      estimatedDelivery: data.estimated_delivery || new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };
  }

  /**
   * Full checkout flow: create basket → add items → set addresses → create order.
   * Orchestrates the multi-step SFCC checkout in a single call.
   */
  async checkout(params: {
    items: BasketItem[];
    email: string;
    shippingAddress: ShippingAddress;
    paymentMethodId?: string;
  }): Promise<OrderResponse> {
    // 1. Create basket
    const basketId = await this.createBasket();

    // 2. Add items
    await this.addItemsToBasket(basketId, params.items);

    // 3. Set customer email
    await this.setCustomerInfo(basketId, params.email);

    // 4. Set shipping address + method
    await this.setShippingAddress(basketId, params.shippingAddress);
    await this.setShippingMethod(basketId);

    // 5. Set billing address (same as shipping for simplicity)
    await this.setBillingAddress(basketId, params.shippingAddress);

    // 6. Add payment instrument
    await this.addPaymentInstrument(basketId, {
      methodId: params.paymentMethodId || 'CREDIT_CARD',
    });

    // 7. Create order
    return this.createOrder(basketId);
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private mapProduct(raw: SfccProductHit): Product {
    return {
      id: raw.product_id || raw.id || '',
      salesforceId: raw.salesforceId,
      name: raw.product_name || raw.name || '',
      brand: raw.brand || 'Unknown',
      category: raw.primary_category_id || 'moisturizer',
      price: raw.price || 0,
      currency: raw.currency || 'USD',
      description: raw.long_description || raw.description || '',
      shortDescription: raw.short_description || '',
      imageUrl: raw.image?.link || raw.imageUrl || '',
      images: raw.image_groups?.[0]?.images?.map((img) => img.link) || [],
      attributes: {
        skinType: raw.c_skinType || [],
        concerns: raw.c_concerns || [],
        ingredients: raw.c_ingredients || [],
        size: raw.c_size || '',
        isTravel: raw.c_isTravel || false,
      },
      rating: raw.c_rating || 0,
      reviewCount: raw.c_reviewCount || 0,
      inStock: raw.inventory?.orderable ?? true,
      personalizationScore: raw.c_personalizationScore,
    };
  }
}

let commerceClient: CommerceClient | null = null;

export const getCommerceClient = (): CommerceClient => {
  if (!commerceClient) {
    commerceClient = new CommerceClient({
      baseUrl: import.meta.env.VITE_COMMERCE_BASE_URL || '',
      clientId: import.meta.env.VITE_COMMERCE_CLIENT_ID || '',
      siteId: import.meta.env.VITE_COMMERCE_SITE_ID || '',
      accessToken: import.meta.env.VITE_COMMERCE_ACCESS_TOKEN || '',
    });
  }
  return commerceClient;
};
