import { useEffect, useRef } from 'react';
import { useQrStore } from '../store/qrStore';

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'click', 'scroll'];

export function useInactivityTimeout(seconds = 90) {
  const isIdle = useQrStore((s) => s.isIdle);
  const setIdle = useQrStore((s) => s.setIdle);
  const timerRef = useRef(null);

  useEffect(() => {
    const reset = () => {
      if (isIdle) {
        setIdle(false);
      }
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        console.log('[QR Web] Inactivity timeout — showing ad poster');
        setIdle(true);
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
  }, [seconds, isIdle, setIdle]);
}
