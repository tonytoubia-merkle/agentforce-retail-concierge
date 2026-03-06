export type ProductCategory =
  | 'dispenser'
  | 'delivery'
  | 'sparkling'
  | 'flavored'
  | 'still'
  | 'bottle'
  | 'filter'
  | 'subscription'
  | 'accessory';

export interface ProductAttributes {
  primaryUse?: ('home' | 'office' | 'fitness' | 'travel' | 'outdoor')[];
  waterType?: ('still' | 'sparkling' | 'flavored' | 'mineral' | 'purified' | 'spring')[];
  flavor?: string;
  size?: string;
  capacity?: string;
  material?: string;
  isSubscribable?: boolean;
  isExchangeProgram?: boolean;
  deliveryIncluded?: boolean;
  isBPAfree?: boolean;
  isRecyclable?: boolean;
  isSustainable?: boolean;
  servingsPerContainer?: number;
}

export interface Product {
  id: string;
  /** Salesforce Product2 record ID for Data Cloud integration */
  salesforceId?: string;
  name: string;
  brand: string;
  category: ProductCategory;
  price: number;
  currency: string;
  description: string;
  shortDescription: string;
  imageUrl: string;
  images: string[];
  attributes: ProductAttributes;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  personalizationScore?: number;
}
