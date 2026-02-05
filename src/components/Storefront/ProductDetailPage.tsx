import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { useCart } from '@/contexts/CartContext';
import { isPersonalizationConfigured, trackAddToCart } from '@/services/personalization';
import type { Product } from '@/types/product';

interface ProductDetailPageProps {
  product: Product;
  onBeautyAdvisor: () => void;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ product, onBeautyAdvisor }) => {
  const { goBack, navigateToCart } = useStore();
  const { addItem, isInCart, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'ingredients' | 'reviews'>('details');

  const cartItem = items.find((item) => item.product.id === product.id);
  const inCart = !!cartItem;

  const handleAddToCart = () => {
    addItem(product, quantity);
    // SF Personalization / Data Cloud: track add-to-cart event
    if (isPersonalizationConfigured()) {
      trackAddToCart(product.id, product.name, product.price);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Product Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="sticky top-24 bg-gradient-to-br from-stone-50 to-rose-50/50 rounded-3xl p-8 aspect-square flex items-center justify-center">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="max-w-full max-h-full object-contain drop-shadow-xl"
              />

              {/* Badges */}
              <div className="absolute top-6 left-6 flex flex-col gap-2">
                {product.attributes?.isTravel && (
                  <span className="px-3 py-1 bg-sky-500 text-white text-sm font-medium rounded-full">
                    Travel Size
                  </span>
                )}
                {product.personalizationScore && product.personalizationScore > 0.9 && (
                  <span className="px-3 py-1 bg-rose-500 text-white text-sm font-medium rounded-full">
                    Recommended for You
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="py-8"
          >
            {/* Brand & Name */}
            <p className="text-sm text-stone-500 uppercase tracking-wider mb-2">
              {product.brand}
            </p>
            <h1 className="text-3xl sm:text-4xl font-medium text-stone-900 mb-4">
              {product.name}
            </h1>

            {/* Rating */}
            {product.rating > 0 && (
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(product.rating)
                          ? 'text-amber-400 fill-current'
                          : 'text-stone-200 fill-current'
                      }`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <span className="text-stone-600">
                  {product.rating.toFixed(1)} ({product.reviewCount.toLocaleString()} reviews)
                </span>
              </div>
            )}

            {/* Price */}
            <div className="text-3xl font-semibold text-stone-900 mb-6">
              ${product.price.toFixed(2)}
            </div>

            {/* Short description */}
            <p className="text-stone-600 text-lg mb-8">
              {product.shortDescription || product.description}
            </p>

            {/* Size */}
            {product.attributes?.size && (
              <div className="mb-6">
                <span className="text-sm font-medium text-stone-900">Size: </span>
                <span className="text-sm text-stone-600">{product.attributes.size}</span>
              </div>
            )}

            {/* Quantity selector */}
            <div className="flex items-center gap-4 mb-6">
              <span className="text-sm font-medium text-stone-900">Quantity:</span>
              <div className="flex items-center border border-stone-200 rounded-full">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors"
                >
                  -
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to cart / Go to cart */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              {inCart ? (
                <button
                  onClick={navigateToCart}
                  className="flex-1 px-8 py-4 bg-stone-900 text-white font-medium rounded-full hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  In Cart - View Bag
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  className="flex-1 px-8 py-4 bg-stone-900 text-white font-medium rounded-full hover:bg-stone-800 transition-colors"
                >
                  Add to Bag
                </button>
              )}
              <button className="px-8 py-4 border border-stone-200 text-stone-700 font-medium rounded-full hover:bg-stone-50 transition-colors flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Save
              </button>
            </div>

            {/* Beauty Advisor CTA */}
            <button
              onClick={onBeautyAdvisor}
              className="w-full px-6 py-4 bg-gradient-to-r from-rose-50 to-purple-50 border border-rose-200 rounded-2xl hover:border-rose-300 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-stone-900 group-hover:text-rose-600 transition-colors">
                    Ask our Beauty Advisor
                  </p>
                  <p className="text-sm text-stone-500">
                    Get personalized advice about this product
                  </p>
                </div>
                <svg className="w-5 h-5 text-stone-400 group-hover:text-rose-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Tabs */}
            <div className="mt-12 border-t border-stone-200 pt-8">
              <div className="flex gap-8 border-b border-stone-200">
                {(['details', 'ingredients', 'reviews'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-sm font-medium transition-colors relative ${
                      activeTab === tab
                        ? 'text-stone-900'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {activeTab === tab && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900"
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="py-6">
                {activeTab === 'details' && (
                  <div className="prose prose-stone max-w-none">
                    <p className="text-stone-600 leading-relaxed">{product.description}</p>

                    {product.attributes?.skinType && (
                      <div className="mt-6">
                        <h4 className="font-medium text-stone-900 mb-2">Suitable for</h4>
                        <div className="flex flex-wrap gap-2">
                          {product.attributes.skinType.map((type) => (
                            <span
                              key={type}
                              className="px-3 py-1 bg-stone-100 text-stone-600 text-sm rounded-full capitalize"
                            >
                              {type} skin
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {product.attributes?.concerns && (
                      <div className="mt-6">
                        <h4 className="font-medium text-stone-900 mb-2">Addresses</h4>
                        <div className="flex flex-wrap gap-2">
                          {product.attributes.concerns.map((concern) => (
                            <span
                              key={concern}
                              className="px-3 py-1 bg-rose-50 text-rose-600 text-sm rounded-full capitalize"
                            >
                              {concern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'ingredients' && (
                  <div>
                    {product.attributes?.ingredients ? (
                      <div className="flex flex-wrap gap-2">
                        {product.attributes.ingredients.map((ingredient) => (
                          <span
                            key={ingredient}
                            className="px-3 py-1.5 bg-stone-100 text-stone-700 text-sm rounded-lg"
                          >
                            {ingredient}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-stone-500">Ingredient information coming soon.</p>
                    )}
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div className="text-center py-8">
                    <p className="text-stone-500">
                      {product.reviewCount} reviews available.
                    </p>
                    <p className="text-sm text-stone-400 mt-1">
                      Review details coming soon.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
