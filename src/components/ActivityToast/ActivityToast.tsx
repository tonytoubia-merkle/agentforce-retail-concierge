import { motion, AnimatePresence } from 'framer-motion';
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { CaptureNotification } from '@/types/agent';

// ─── Icons ──────────────────────────────────────────────────────

const icons: Record<CaptureNotification['type'], React.ReactNode> = {
  contact_created: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  meaningful_event: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  profile_enrichment: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
};

const accentColors: Record<CaptureNotification['type'], string> = {
  contact_created: 'from-emerald-500/20 to-emerald-500/5',
  meaningful_event: 'from-amber-500/20 to-amber-500/5',
  profile_enrichment: 'from-sky-500/20 to-sky-500/5',
};

const iconColors: Record<CaptureNotification['type'], string> = {
  contact_created: 'text-emerald-400',
  meaningful_event: 'text-amber-400',
  profile_enrichment: 'text-sky-400',
};

// ─── Toast Item ─────────────────────────────────────────────────

interface ToastItem {
  id: string;
  type: CaptureNotification['type'];
  label: string;
}

const Toast: React.FC<{ item: ToastItem }> = ({ item }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 30, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -40, scale: 0.95, transition: { duration: 0.5, ease: 'easeIn' } }}
    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    className={`
      flex items-center gap-2 px-3.5 py-2 rounded-full
      bg-gradient-to-r ${accentColors[item.type]}
      backdrop-blur-xl border border-white/10
      shadow-lg shadow-black/20
      pointer-events-none select-none
    `}
  >
    <span className={iconColors[item.type]}>{icons[item.type]}</span>
    <span className="text-xs font-medium text-white/80 whitespace-nowrap">{item.label}</span>
  </motion.div>
);

// ─── Context ────────────────────────────────────────────────────

interface ActivityToastContextValue {
  showCapture: (notification: CaptureNotification) => void;
}

const ActivityToastContext = createContext<ActivityToastContextValue | null>(null);

export const useActivityToast = (): ActivityToastContextValue => {
  const ctx = useContext(ActivityToastContext);
  if (!ctx) throw new Error('useActivityToast must be used within ActivityToastProvider');
  return ctx;
};

// ─── Provider + Renderer ────────────────────────────────────────

export const ActivityToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);

  const showCapture = useCallback((notification: CaptureNotification) => {
    const id = `toast-${++idCounter.current}`;
    setToasts((prev) => [...prev, { id, ...notification }]);

    // Auto-dismiss after 3s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ActivityToastContext.Provider value={{ showCapture }}>
      {children}
      {/* Toast container — fixed bottom-center, above content */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <Toast key={t.id} item={t} />
          ))}
        </AnimatePresence>
      </div>
    </ActivityToastContext.Provider>
  );
};
