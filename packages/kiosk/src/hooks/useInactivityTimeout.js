/**
 * useInactivityTimeout
 * Resets kiosk to welcome screen after `seconds` of no user interaction.
 * Attach to any screen except WelcomeScreen.
 *
 * Usage:
 *   useInactivityTimeout(90); // resets after 90s of inactivity
 */
import { useEffect, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'click', 'scroll'];

export function useInactivityTimeout(seconds = 90) {
  const goTo     = useKioskStore((s) => s.goTo);
  const resetAll = useKioskStore((s) => s.resetAll);
  const timerRef = useRef(null);

  useEffect(() => {
    const reset = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        console.log('[Kiosk] Inactivity timeout — resetting to welcome');
        resetAll();
        goTo('welcome');
      }, seconds * 1000);
    };

    // Start the timer
    reset();

    // Reset timer on any user interaction
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));

    return () => {
      clearTimeout(timerRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [seconds, goTo, resetAll]);
}
