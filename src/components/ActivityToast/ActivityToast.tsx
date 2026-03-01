import { motion, AnimatePresence } from 'framer-motion';
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { CaptureNotification } from '@/types/agent';

// ─── Icons ──────────────────────────────────────────────────────

const icons: Record<CaptureNotification['type'], React.ReactNode> = {
  contact_created: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  meaningful_event: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  profile_enrichment: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
};

const accentColors: Record<CaptureNotification['type'], string> = {
  contact_created: 'from-emerald-500/30 to-emerald-500/10',
  meaningful_event: 'from-amber-500/30 to-amber-500/10',
  profile_enrichment: 'from-sky-500/30 to-sky-500/10',
};

const iconColors: Record<CaptureNotification['type'], string> = {
  contact_created: 'text-emerald-400',
  meaningful_event: 'text-amber-400',
  profile_enrichment: 'text-sky-400',
};

const demoBadgeColors: Record<CaptureNotification['type'], string> = {
  contact_created: 'bg-emerald-500/30 text-emerald-300',
  meaningful_event: 'bg-amber-500/30 text-amber-300',
  profile_enrichment: 'bg-sky-500/30 text-sky-300',
};

// ─── Toast Item ─────────────────────────────────────────────────

interface ToastItem {
  id: string;
  type: CaptureNotification['type'];
  label: string;
}

const Toast: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({ item, onDismiss }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 30, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -40, scale: 0.95, transition: { duration: 0.4, ease: 'easeIn' } }}
    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    className={`
      flex items-center gap-2.5 pl-3 pr-2 py-2.5 rounded-xl
      bg-gradient-to-r ${accentColors[item.type]}
      backdrop-blur-xl border border-white/15
      shadow-xl shadow-black/30
      pointer-events-auto cursor-pointer select-none
    `}
    onClick={() => onDismiss(item.id)}
    title="Click to dismiss"
  >
    {/* Demo badge */}
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${demoBadgeColors[item.type]}`}>
      Demo
    </span>

    {/* Icon */}
    <span className={iconColors[item.type]}>{icons[item.type]}</span>

    {/* Label */}
    <span className="text-sm font-medium text-white/90 whitespace-nowrap">{item.label}</span>

    {/* Dismiss X */}
    <span className="ml-1 text-white/40 hover:text-white/70 transition-colors text-xs leading-none p-1">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
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
  const timerRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timerRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
  }, []);

  const showCapture = useCallback((notification: CaptureNotification) => {
    const id = `toast-${++idCounter.current}`;
    setToasts((prev) => [...prev, { id, ...notification }]);

    // Auto-dismiss after 8s (user can dismiss earlier by clicking)
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timerRefs.current.delete(id);
    }, 8000);
    timerRefs.current.set(id, timer);
  }, []);

  return (
    <ActivityToastContext.Provider value={{ showCapture }}>
      {children}
      {/* Toast container — fixed bottom-center, above content */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <Toast key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ActivityToastContext.Provider>
  );
};
