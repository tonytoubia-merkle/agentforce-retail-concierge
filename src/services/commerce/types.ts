export interface CommerceConfig {
  baseUrl: string;
  clientId: string;
  siteId: string;
  accessToken?: string;
}

export interface ProductSearchParams {
  query?: string;
  category?: string;
  primaryUse?: string;
  waterType?: string[];
  priceRange?: { min?: number; max?: number };
  limit?: number;
  offset?: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface OrderRequest {
  items: CartItem[];
  paymentMethodId: string;
  shippingAddressId: string;
}

export interface OrderResponse {
  orderId: string;
  status: 'confirmed' | 'processing' | 'failed';
  total: number;
  estimatedDelivery: string;
}
