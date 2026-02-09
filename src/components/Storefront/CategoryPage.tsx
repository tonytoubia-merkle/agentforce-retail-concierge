import { motion } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { useCart } from '@/contexts/CartContext';
import { ProductImage } from './ProductImage';
import type { Product, ProductCategory } from '@/types/product';

const CATEGORY_INFO: Record<ProductCategory, { name: string; description: string }> = {
  moisturizer: { name: 'Moisturizers', description: 'Hydrating formulas for every skin type' },
  cleanser: { name: 'Cleansers', description: 'Gentle yet effective cleansing solutions' },
  serum: { name: 'Serums', description: 'Concentrated treatments for targeted concerns' },
  sunscreen: { name: 'Sun Protection', description: 'Shield your skin from harmful UV rays' },
  mask: { name: 'Masks', description: 'Weekly treatments for radiant skin' },
  toner: { name: 'Toners', description: 'Balance and prep your skin' },
  'travel-kit': { name: 'Travel Essentials', description: 'Your skincare routine, anywhere you go' },
  'eye-cream': { name: 'Eye Care', description: 'Targeted care for the delicate eye area' },
  foundation: { name: 'Foundation', description: 'Flawless coverage for every skin tone' },
  lipstick: { name: 'Lipstick', description: 'Bold and beautiful lip colors' },
  mascara: { name: 'Mascara', description: 'Lashes that make a statement' },
  blush: { name: 'Blush', description: 'A healthy flush of color' },
  fragrance: { name: 'Fragrance', description: 'Signature scents for every occasion' },
  shampoo: { name: 'Shampoo', description: 'Clean, healthy hair starts here' },
  conditioner: { name: 'Conditioner', description: 'Silky smooth, hydrated hair' },
  'hair-treatment': { name: 'Hair Treatments', description: 'Intensive care for damaged hair' },
  'spot-treatment': { name: 'Spot Treatments', description: 'Targeted solutions for blemishes' },
};

interface CategoryPageProps {
  category: ProductCategory;
  products: Product[];
}

export const CategoryPage: React.FC<CategoryPageProps> = ({ category, products }) => {
  const { navigateToProduct, goBack } = useStore();
  const { addItem, isInCart } = useCart();

  const categoryInfo = CATEGORY_INFO[category] || { name: category, description: '' };
  const filteredProducts = products.filter((p) => p.category === category);

  return (
    <div className="min-h-screen bg-white">
      {/* Category header */}
      <div className="bg-gradient-to-br from-stone-50 to-rose-50 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors mb-6"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl sm:text-4xl font-medium text-stone-900 mb-2">
              {categoryInfo.name}
            </h1>
            <p className="text-stone-600">
              {categoryInfo.description}
            </p>
            <p className="text-sm text-stone-500 mt-4">
              {filteredProducts.length} products
            </p>
          </motion.div>
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-500">No products found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="group"
              >
                <div
                  onClick={() => navigateToProduct(product)}
                  className="relative bg-stone-50 rounded-2xl overflow-hidden cursor-pointer aspect-square mb-3 hover:bg-stone-100 transition-colors"
                >
                  <ProductImage
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-300"
                  />

                  {product.attributes?.isTravel && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 bg-sky-500 text-white text-[10px] font-medium rounded-full">
                      Travel Size
                    </span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addItem(product);
                    }}
                    className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isInCart(product.id)
                        ? 'bg-rose-500 text-white'
                        : 'bg-white text-stone-700 opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white shadow-lg'
                    }`}
                  >
                    {isInCart(product.id) ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                </div>

                <div onClick={() => navigateToProduct(product)} className="cursor-pointer">
                  <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                    {product.brand}
                  </p>
                  <h3 className="font-medium text-stone-900 line-clamp-2 mb-2 group-hover:text-rose-600 transition-colors">
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-900">
                      ${product.price.toFixed(2)}
                    </span>
                    {product.rating > 0 && (
                      <div className="flex items-center gap-1 text-sm text-stone-500">
                        <svg className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                        </svg>
                        {product.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
