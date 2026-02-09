import { motion } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { useCart } from '@/contexts/CartContext';
import { ProductImage } from './ProductImage';
import type { Product } from '@/types/product';

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  products: Product[];
  showViewAll?: boolean;
  onViewAll?: () => void;
}

export const ProductSection: React.FC<ProductSectionProps> = ({
  title,
  subtitle,
  products,
  showViewAll = false,
  onViewAll,
}) => {
  const { navigateToProduct } = useStore();
  const { addItem, isInCart } = useCart();

  if (products.length === 0) return null;

  return (
    <section className="py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-medium text-stone-900">{title}</h2>
            {subtitle && (
              <p className="text-stone-500 mt-1">{subtitle}</p>
            )}
          </div>
          {showViewAll && onViewAll && (
            <button
              onClick={onViewAll}
              className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors flex items-center gap-1"
            >
              View All
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              onClick={() => navigateToProduct(product)}
              onAddToCart={() => addItem(product)}
              inCart={isInCart(product.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

interface ProductCardProps {
  product: Product;
  index: number;
  onClick: () => void;
  onAddToCart: () => void;
  inCart: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  index,
  onClick,
  onAddToCart,
  inCart,
}) => {
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group"
    >
      <div
        onClick={onClick}
        className="relative bg-stone-50 rounded-2xl overflow-hidden cursor-pointer aspect-square mb-3 hover:bg-stone-100 transition-colors"
      >
        {/* Product image */}
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-contain p-6 group-hover:scale-105 transition-transform duration-300"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {product.attributes?.isTravel && (
            <span className="px-2 py-0.5 bg-sky-500 text-white text-[10px] font-medium rounded-full">
              Travel Size
            </span>
          )}
          {product.personalizationScore && product.personalizationScore > 0.9 && (
            <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-medium rounded-full">
              Top Pick
            </span>
          )}
        </div>

        {/* Quick add button */}
        <button
          onClick={handleAddToCart}
          className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            inCart
              ? 'bg-rose-500 text-white'
              : 'bg-white text-stone-700 opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white shadow-lg'
          }`}
        >
          {inCart ? (
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

      {/* Product info */}
      <div onClick={onClick} className="cursor-pointer">
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
  );
};
