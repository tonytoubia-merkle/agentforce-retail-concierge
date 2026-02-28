import { useState, useEffect, useRef } from 'react';

const SESSION_KEY = 'beaute-exit-intent-shown';

/**
 * Detects exit intent (mouse leaving the viewport from the top).
 *
 * Tries SalesforceInteractions.DisplayUtils.pageExit() if the SDK is loaded,
 * otherwise falls back to native mouseleave detection.
 *
 * Only fires once per session (tracked via sessionStorage).
 * Does not fire on mobile/touch devices.
 */
export function useExitIntent(): { triggered: boolean; dismiss: () => void } {
  const [triggered, setTriggered] = useState(false);
  const firedRef = useRef(false);

  const dismiss = () => setTriggered(false);

  useEffect(() => {
    // Don't fire if already shown this session
    if (sessionStorage.getItem(SESSION_KEY)) return;

    // Skip on touch/mobile devices (exit intent relies on mouse cursor)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    // Give the user a few seconds to settle in before arming
    const armDelay = setTimeout(() => {
      // Try SDK's DisplayUtils.pageExit() first
      const w = window as any;
      const displayUtils =
        w.SalesforceInteractions?.DisplayUtils ||
        w.DataCloudInteractions?.DisplayUtils;

      if (displayUtils?.pageExit) {
        displayUtils.pageExit(300).then(() => {
          if (firedRef.current) return;
          firedRef.current = true;
          sessionStorage.setItem(SESSION_KEY, '1');
          setTriggered(true);
        });
        return;
      }

      // Fallback: native mouseleave detection
      const handleMouseLeave = (e: MouseEvent) => {
        // Only trigger when mouse exits from the top of the viewport
        if (e.clientY > 0) return;
        if (firedRef.current) return;

        firedRef.current = true;
        sessionStorage.setItem(SESSION_KEY, '1');
        setTriggered(true);
        document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      };

      document.documentElement.addEventListener('mouseleave', handleMouseLeave);

      // Store cleanup ref
      (handleMouseLeave as any).__cleanup = () => {
        document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      };
    }, 3000);

    return () => {
      clearTimeout(armDelay);
    };
  }, []);

  return { triggered, dismiss };
}
