import { motion } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { useCart } from '@/contexts/CartContext';
import { ProductImage } from './ProductImage';

interface CartPageProps {
  onContinueShopping: () => void;
}

export const CartPage: React.FC<CartPageProps> = ({ onContinueShopping }) => {
  const { navigateToCheckout, navigateToProduct } = useStore();
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  const shipping = subtotal >= 50 ? 0 : 5.99;
  const total = subtotal + shipping;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-medium text-stone-900 mb-8">Your Bag</h1>

          {items.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto bg-stone-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-stone-900 mb-2">Your bag is empty</h2>
              <p className="text-stone-500 mb-8">Looks like you haven't added anything yet.</p>
              <button
                onClick={onContinueShopping}
                className="px-8 py-3 bg-stone-900 text-white font-medium rounded-full hover:bg-stone-800 transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Cart items */}
              <div className="lg:col-span-2 space-y-4">
                {items.map((item, index) => (
                  <motion.div
                    key={item.product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm"
                  >
                    <div className="flex gap-4">
                      {/* Product image */}
                      <button
                        onClick={() => navigateToProduct(item.product)}
                        className="w-24 h-24 sm:w-32 sm:h-32 bg-stone-50 rounded-xl flex-shrink-0 flex items-center justify-center hover:bg-stone-100 transition-colors"
                      >
                        <ProductImage
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="max-w-full max-h-full object-contain p-2"
                        />
                      </button>

                      {/* Product details */}
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => navigateToProduct(item.product)}
                          className="text-left hover:text-rose-600 transition-colors"
                        >
                          <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                            {item.product.brand}
                          </p>
                          <h3 className="font-medium text-stone-900 line-clamp-2">
                            {item.product.name}
                          </h3>
                        </button>

                        {item.product.attributes?.size && (
                          <p className="text-sm text-stone-500 mt-1">
                            {item.product.attributes.size}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-4">
                          {/* Quantity selector */}
                          <div className="flex items-center border border-stone-200 rounded-full">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors"
                            >
                              +
                            </button>
                          </div>

                          {/* Price */}
                          <span className="font-semibold text-stone-900">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </span>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="text-sm text-stone-500 hover:text-rose-600 transition-colors mt-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Continue shopping link */}
                <button
                  onClick={onContinueShopping}
                  className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors mt-4"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Continue Shopping
                </button>
              </div>

              {/* Order summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
                  <h2 className="text-lg font-medium text-stone-900 mb-4">Order Summary</h2>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-600">Subtotal</span>
                      <span className="text-stone-900">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Shipping</span>
                      <span className="text-stone-900">
                        {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                      </span>
                    </div>
                    {shipping > 0 && (
                      <p className="text-xs text-rose-600">
                        Add ${(50 - subtotal).toFixed(2)} more for free shipping
                      </p>
                    )}
                    <div className="border-t border-stone-200 pt-3 mt-3">
                      <div className="flex justify-between text-base font-medium">
                        <span className="text-stone-900">Total</span>
                        <span className="text-stone-900">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={navigateToCheckout}
                    className="w-full mt-6 px-6 py-4 bg-stone-900 text-white font-medium rounded-full hover:bg-stone-800 transition-colors"
                  >
                    Checkout
                  </button>

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-stone-100">
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Secure
                    </div>
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Quality
                    </div>
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Returns
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
