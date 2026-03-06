import type { Product } from '@/types/product';
import type { CommerceConfig, ProductSearchParams, OrderRequest, OrderResponse } from './types';

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
    return `${this.config.baseUrl}/s/${this.config.siteId}/dw/shop/v24_1`;
  }

  async searchProducts(params: ProductSearchParams): Promise<Product[]> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set('q', params.query);
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
    return (data.hits || []).map(this.mapProduct);
  }

  async getProduct(productId: string): Promise<Product> {
    const response = await fetch(
      `${this.baseUrl}/products/${productId}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Product fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapProduct(data);
  }

  async createOrder(order: OrderRequest): Promise<OrderResponse> {
    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        product_items: order.items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        payment_method_id: order.paymentMethodId,
        shipping_address_id: order.shippingAddressId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Order creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      orderId: data.order_no,
      status: 'confirmed',
      total: data.order_total,
      estimatedDelivery: data.estimated_delivery || new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };
  }

  private mapProduct(raw: any): Product {
    return {
      id: raw.product_id || raw.id,
      name: raw.product_name || raw.name,
      brand: raw.brand || 'Unknown',
      category: raw.primary_category_id || 'moisturizer',
      price: raw.price || 0,
      currency: raw.currency || 'USD',
      description: raw.long_description || raw.description || '',
      shortDescription: raw.short_description || '',
      imageUrl: raw.image?.link || raw.imageUrl || '',
      images: raw.image_groups?.[0]?.images?.map((img: any) => img.link) || [],
      attributes: {
        waterType: raw.c_waterType || [],
        primaryUse: raw.c_primaryUse || [],
        flavor: raw.c_flavor || '',
        size: raw.c_size || '',
        isSubscribable: raw.c_isSubscribable || false,
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
