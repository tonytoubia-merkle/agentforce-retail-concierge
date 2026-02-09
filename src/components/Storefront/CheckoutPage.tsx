import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/contexts/StoreContext';
import { useCart } from '@/contexts/CartContext';
import { useCustomer } from '@/contexts/CustomerContext';
import { ProductImage } from './ProductImage';
import { MerkuryProfilePicker } from './MerkuryProfilePicker';

const API_BASE = '';

export const CheckoutPage: React.FC = () => {
  const { navigateToOrderConfirmation, goBack } = useStore();
  const { items, subtotal, clearCart } = useCart();
  const { customer, isAuthenticated, signIn, createGuestContact } = useCustomer();

  const [step, setStep] = useState<'info' | 'shipping' | 'payment' | 'processing'>('info');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: customer?.email || '',
    firstName: customer?.name?.split(' ')[0] || '',
    lastName: customer?.name?.split(' ').slice(1).join(' ') || '',
    address: customer?.shippingAddresses?.[0]?.line1 || '',
    city: customer?.shippingAddresses?.[0]?.city || '',
    state: customer?.shippingAddresses?.[0]?.state || '',
    zip: customer?.shippingAddresses?.[0]?.postalCode || '',
    cardNumber: customer?.savedPaymentMethods?.[0] ? `•••• •••• •••• ${customer.savedPaymentMethods[0].last4}` : '',
    expiry: '',
    cvv: '',
  });

  const shipping = subtotal >= 50 ? 0 : 5.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const fillTestCard = () => {
    setFormData((prev) => ({
      ...prev,
      cardNumber: '4242 4242 4242 4242',
      expiry: '12/28',
      cvv: '123',
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'info') {
      setStep('shipping');
    } else if (step === 'shipping') {
      setStep('payment');
    } else if (step === 'payment') {
      setStep('processing');
      setCheckoutError(null);

      const useMock = import.meta.env.VITE_USE_MOCK_DATA !== 'false';
      if (useMock) {
        setTimeout(() => {
          const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
          clearCart();
          navigateToOrderConfirmation(orderId);
        }, 2000);
        return;
      }

      // Real Salesforce checkout — require valid customer ID
      if (!customer?.id) {
        setCheckoutError('Please sign in to complete your purchase.');
        setStep('payment');
        return;
      }
      const last4 = formData.cardNumber.replace(/\s/g, '').slice(-4);
      const paymentMethod = `Visa ending in ${last4}`;
      const payload = {
        contactId: customer?.id || undefined,
        items: items.map((item) => ({
          product2Id: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
        })),
        paymentMethod,
        subtotal,
        shipping,
        tax,
        total,
      };

      fetch(`${API_BASE}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            clearCart();
            navigateToOrderConfirmation(result.orderNumber || result.orderId, result);
          } else {
            setCheckoutError(result.error || 'Checkout failed');
            setStep('payment');
          }
        })
        .catch((err) => {
          console.error('[checkout] Error:', err);
          setCheckoutError(err.message || 'Network error');
          setStep('payment');
        });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const firstName = customer?.name?.split(' ')[0];
  const isKnown = customer?.merkuryIdentity?.identityTier === 'known';
  const loyaltyPoints = customer?.loyalty ? Math.floor(total) : 0;

  if (items.length === 0 && step !== 'processing') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-500">Your cart is empty.</p>
        </div>
      </div>
    );
  }

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestLoading(true);
    try {
      await createGuestContact({
        email: guestEmail,
        firstName: guestFirstName,
        lastName: guestLastName,
      });
      setFormData((prev) => ({
        ...prev,
        email: guestEmail,
        firstName: guestFirstName,
        lastName: guestLastName,
      }));
      setGuestMode(true);
      setShowGuestForm(false);
    } finally {
      setGuestLoading(false);
    }
  };

  if (!isAuthenticated && !guestMode) {
    return (
      <>
      <div className="min-h-screen bg-stone-50 flex items-center justify-center py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full mx-4"
        >
          <div className="bg-white rounded-3xl p-8 shadow-xl text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-rose-100 to-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-stone-900 mb-2">
              {isKnown && firstName ? `Almost there, ${firstName}!` : 'How would you like to checkout?'}
            </h2>
            <p className="text-stone-500 mb-6">
              {isKnown && firstName
                ? 'Sign in to earn rewards, or continue as a guest.'
                : 'Sign in, create an account, or checkout as a guest.'}
            </p>

            {/* Option 1: Sign In */}
            <button
              onClick={signIn}
              className="w-full px-6 py-3 bg-stone-900 text-white font-medium rounded-full hover:bg-stone-800 transition-colors mb-3"
            >
              Sign In
            </button>

            {/* Option 2: Create Account */}
            <button
              onClick={() => setShowCreateAccount(true)}
              className="w-full px-6 py-3 border border-stone-300 text-stone-700 font-medium rounded-full hover:bg-stone-50 transition-colors mb-3"
            >
              Create Account
            </button>

            {/* Option 3: Guest Checkout */}
            {!showGuestForm ? (
              <button
                onClick={() => setShowGuestForm(true)}
                className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
              >
                Continue as Guest
              </button>
            ) : (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                onSubmit={handleGuestSubmit}
                className="mt-4 pt-4 border-t border-stone-100 text-left space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">First Name</label>
                    <input
                      type="text"
                      value={guestFirstName}
                      onChange={(e) => setGuestFirstName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={guestLastName}
                      onChange={(e) => setGuestLastName(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={guestLoading}
                  className="w-full px-4 py-2.5 text-sm bg-stone-700 text-white font-medium rounded-full hover:bg-stone-600 transition-colors disabled:opacity-50"
                >
                  {guestLoading ? 'Setting up...' : 'Continue to Checkout'}
                </button>
              </motion.form>
            )}

            <div className="mt-4">
              <button
                onClick={goBack}
                className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
              >
                Back to cart
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Create Account → Merkury Picker */}
      <MerkuryProfilePicker
        isOpen={showCreateAccount}
        onClose={() => setShowCreateAccount(false)}
      />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Cart
          </button>
          <h1 className="text-2xl font-medium text-stone-900">Checkout</h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {['info', 'shipping', 'payment'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-stone-900 text-white'
                    : ['info', 'shipping', 'payment'].indexOf(step) > i
                      ? 'bg-rose-500 text-white'
                      : 'bg-stone-200 text-stone-500'
                }`}
              >
                {['info', 'shipping', 'payment'].indexOf(step) > i ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div
                  className={`w-16 h-0.5 mx-2 ${
                    ['info', 'shipping', 'payment'].indexOf(step) > i
                      ? 'bg-rose-500'
                      : 'bg-stone-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 'processing' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 mx-auto mb-6">
              <svg className="animate-spin w-full h-full text-rose-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-stone-900 mb-2">Processing your order...</h2>
            <p className="text-stone-500">Please don't close this page.</p>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Form */}
            <div className="lg:col-span-3">
              <form onSubmit={handleSubmit}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-2xl p-6 shadow-sm"
                >
                  {step === 'info' && (
                    <>
                      <h2 className="text-lg font-medium text-stone-900 mb-6">Contact Information</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                            placeholder="your@email.com"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">
                              First Name
                            </label>
                            <input
                              type="text"
                              name="firstName"
                              value={formData.firstName}
                              onChange={handleInputChange}
                              required
                              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">
                              Last Name
                            </label>
                            <input
                              type="text"
                              name="lastName"
                              value={formData.lastName}
                              onChange={handleInputChange}
                              required
                              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {step === 'shipping' && (
                    <>
                      <h2 className="text-lg font-medium text-stone-900 mb-6">Shipping Address</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">
                            Street Address
                          </label>
                          <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">
                              City
                            </label>
                            <input
                              type="text"
                              name="city"
                              value={formData.city}
                              onChange={handleInputChange}
                              required
                              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">
                              State
                            </label>
                            <input
                              type="text"
                              name="state"
                              value={formData.state}
                              onChange={handleInputChange}
                              required
                              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div className="w-1/2">
                          <label className="block text-sm font-medium text-stone-700 mb-1">
                            ZIP Code
                          </label>
                          <input
                            type="text"
                            name="zip"
                            value={formData.zip}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {step === 'payment' && (
                    <>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-medium text-stone-900">Payment Method</h2>
                        <button
                          type="button"
                          onClick={fillTestCard}
                          className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full hover:bg-amber-200 transition-colors"
                        >
                          Use Test Card
                        </button>
                      </div>
                      {checkoutError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                          {checkoutError}
                        </div>
                      )}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">
                            Card Number
                          </label>
                          <input
                            type="text"
                            name="cardNumber"
                            value={formData.cardNumber}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                            placeholder="1234 5678 9012 3456"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">
                              Expiry Date
                            </label>
                            <input
                              type="text"
                              name="expiry"
                              value={formData.expiry}
                              onChange={handleInputChange}
                              required
                              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                              placeholder="MM/YY"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">
                              CVV
                            </label>
                            <input
                              type="text"
                              name="cvv"
                              value={formData.cvv}
                              onChange={handleInputChange}
                              required
                              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                              placeholder="123"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    className="w-full mt-8 px-6 py-4 bg-stone-900 text-white font-medium rounded-full hover:bg-stone-800 transition-colors"
                  >
                    {step === 'payment' ? `Pay $${total.toFixed(2)}` : 'Continue'}
                  </button>
                </motion.div>
              </form>
            </div>

            {/* Order summary */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
                <h2 className="text-lg font-medium text-stone-900 mb-4">Order Summary</h2>

                {/* Items */}
                <div className="space-y-4 mb-6">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex gap-3">
                      <div className="w-16 h-16 bg-stone-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ProductImage
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="max-w-full max-h-full object-contain p-1"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 line-clamp-1">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-stone-500">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-sm font-medium text-stone-900">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t border-stone-100 pt-4 space-y-2 text-sm">
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
                  <div className="flex justify-between">
                    <span className="text-stone-600">Tax</span>
                    <span className="text-stone-900">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-stone-100 text-base font-medium">
                    <span className="text-stone-900">Total</span>
                    <span className="text-stone-900">${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Loyalty points preview */}
                {customer?.loyalty && loyaltyPoints > 0 && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-amber-700 font-medium">
                        Earn ~{loyaltyPoints} points
                      </span>
                      <span className="text-amber-600">with this purchase</span>
                    </div>
                    <p className="text-xs text-amber-600 mt-0.5 capitalize">
                      {customer.loyalty.tier} Member · {customer.loyalty.pointsBalance?.toLocaleString()} pts balance
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
