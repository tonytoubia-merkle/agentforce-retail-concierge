import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/cn';

interface RememberMeButtonProps {
  onSubmit: (message: string) => void;
}

export const RememberMeButton: React.FC<RememberMeButtonProps> = ({ onSubmit }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);

    // Build a natural message to inject to the agent
    const namePart = name.trim() ? ` and my name is ${name.trim()}` : '';
    const message = `I'd like to save my profile for better recommendations. My email is ${email.trim()}${namePart}.`;

    onSubmit(message);
    setIsModalOpen(false);
    setEmail('');
    setName('');
    setIsSubmitting(false);
  }, [email, name, onSubmit]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setEmail('');
    setName('');
  }, []);

  return (
    <>
      {/* Subtle trigger button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
          'text-xs text-white/60 hover:text-white/90',
          'bg-white/5 hover:bg-white/10',
          'border border-white/10 hover:border-white/20',
          'transition-all duration-200'
        )}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <span>Save my preferences</span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-medium text-white">Save your preferences</h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-white/40 hover:text-white/80 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Description */}
                <p className="text-white/60 text-sm mb-5">
                  Share your email and I'll remember your skin type, preferences, and recommendations for next time. No spam — just personalized beauty advice.
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="remember-email" className="block text-sm text-white/70 mb-1.5">
                      Email address <span className="text-purple-400">*</span>
                    </label>
                    <input
                      id="remember-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className={cn(
                        'w-full px-4 py-2.5 rounded-lg',
                        'bg-white/5 border border-white/10',
                        'text-white placeholder-white/30',
                        'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50',
                        'transition-all duration-200'
                      )}
                    />
                  </div>

                  <div>
                    <label htmlFor="remember-name" className="block text-sm text-white/70 mb-1.5">
                      What should I call you?
                    </label>
                    <input
                      id="remember-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name (optional)"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-lg',
                        'bg-white/5 border border-white/10',
                        'text-white placeholder-white/30',
                        'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50',
                        'transition-all duration-200'
                      )}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className={cn(
                        'flex-1 px-4 py-2.5 rounded-lg',
                        'bg-white/5 hover:bg-white/10',
                        'text-white/70 hover:text-white',
                        'border border-white/10',
                        'transition-all duration-200'
                      )}
                    >
                      Maybe later
                    </button>
                    <button
                      type="submit"
                      disabled={!email.trim() || isSubmitting}
                      className={cn(
                        'flex-1 px-4 py-2.5 rounded-lg',
                        'bg-purple-600 hover:bg-purple-500',
                        'text-white font-medium',
                        'transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      {isSubmitting ? 'Saving...' : 'Save my profile'}
                    </button>
                  </div>
                </form>

                {/* Privacy note */}
                <p className="text-white/30 text-xs mt-4 text-center">
                  Your data is stored securely and never shared with third parties.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
