export interface CommerceConfig {
  webstoreId: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
}

export interface ProductSearchParams {
  query?: string;
  category?: string;
  skinType?: string;
  concerns?: string[];
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
