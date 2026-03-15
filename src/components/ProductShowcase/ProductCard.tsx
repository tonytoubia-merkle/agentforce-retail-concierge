import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useScene } from '@/contexts/SceneContext';
import { Badge } from '@/components/ui/Badge';
import type { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { openCheckout, openRetailerHandoff } = useScene();
  const location = useLocation();
  const isSkinConcierge = location.pathname.includes('skin-concierge');

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.03 }}
      transition={{ duration: 0.2 }}
      className="w-36 flex-shrink-0 rounded-xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10 cursor-pointer"
      onClick={isSkinConcierge ? () => openRetailerHandoff([product]) : undefined}
    >
      <div className="relative w-full h-28">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-contain product-blend p-2"
        />
        {product.attributes?.isTravel && (
          <Badge className="absolute top-1.5 left-1.5 bg-blue-500 text-[9px] px-1.5 py-0.5">
            Travel
          </Badge>
        )}
      </div>

      <div className="px-2.5 pb-2.5 pt-1 text-white">
        <span className="text-white/50 text-[9px] uppercase tracking-wider block truncate">
          {product.brand}
        </span>
        <h3 className="font-medium text-[11px] mt-0.5 line-clamp-2 leading-tight min-h-[2.25rem]">
          {product.name}
        </h3>

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs font-medium">
            ${(product.price ?? 0).toFixed(2)}
          </span>
          {isSkinConcierge ? (
            <span className="text-[9px] text-white/40 flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              Where to buy
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); openCheckout(); }}
              className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-full text-[10px] transition-colors"
            >
              Add
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
