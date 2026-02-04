export type ProductCategory =
  | 'moisturizer'
  | 'cleanser'
  | 'serum'
  | 'sunscreen'
  | 'mask'
  | 'toner'
  | 'travel-kit'
  | 'eye-cream'
  | 'foundation'
  | 'lipstick'
  | 'mascara'
  | 'blush'
  | 'fragrance'
  | 'shampoo'
  | 'conditioner'
  | 'hair-treatment'
  | 'spot-treatment';

export interface ProductAttributes {
  skinType?: ('dry' | 'oily' | 'combination' | 'sensitive' | 'normal')[];
  concerns?: string[];
  ingredients?: string[];
  size?: string;
  isTravel?: boolean;
  // Consumer preference flags
  isFragranceFree?: boolean;
  isVegan?: boolean;
  isCrueltyFree?: boolean;
  isParabenFree?: boolean;
  isHypoallergenic?: boolean;
  isDermatologistTested?: boolean;
  // Key ingredients for matching/avoidance
  keyIngredients?: string[];
}

export interface Product {
  id: string;
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
