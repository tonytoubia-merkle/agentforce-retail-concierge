import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomer } from '@/contexts/CustomerContext';

export const EmailSignup: React.FC = () => {
  const { createGuestContact } = useCustomer();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      await createGuestContact({
        email,
        leadSource: 'Newsletter',
      } as any);
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="py-16 bg-gradient-to-br from-stone-100 to-rose-50">
      <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
        <h3 className="text-2xl font-medium text-stone-900 mb-2">
          Stay in the know
        </h3>
        <p className="text-stone-500 mb-6">
          Get beauty tips, new arrivals, and exclusive offers delivered to your inbox.
        </p>

        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full py-3 px-6"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">You're subscribed!</span>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              className="flex gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="flex-1 px-4 py-3 border border-stone-200 rounded-full focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white text-sm"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-3 bg-stone-900 text-white text-sm font-medium rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {status === 'error' && (
          <p className="text-sm text-red-600 mt-3">
            Something went wrong. Please try again.
          </p>
        )}

        <p className="text-xs text-stone-400 mt-4">
          By subscribing, you agree to receive marketing emails. Unsubscribe anytime.
        </p>
      </div>
    </section>
  );
};
