/**
 * useInactivityTimeout (McDonald's & KFC Layered Timer Pattern)
 * Tracks user activity and triggers a friendly 20-second warning modal before resetting to welcome screen.
 */
import { useEffect, useRef } from 'react';
import { useKioskStore } from '../store/kioskStore';

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'click', 'scroll'];

export function useInactivityTimeout(seconds = 150) {
  const goTo = useKioskStore((s) => s.goTo);
  const resetAll = useKioskStore((s) => s.resetAll);
  const screen = useKioskStore((s) => s.screen);
  const setInactivityWarning = useKioskStore((s) => s.setInactivityWarning);

  const lastActivityRef = useRef(Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    // Dacă suntem pe ecranul welcome (screensaver), nu avem nevoie de timer de inactivitate
    if (screen === 'welcome') {
      setInactivityWarning({ show: false, secondsLeft: 20 });
      return;
    }

    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
      const currentWarning = useKioskStore.getState().inactivityWarning;
      if (currentWarning?.show) {
        setInactivityWarning({ show: false, secondsLeft: 20 });
      }
    };

    lastActivityRef.current = Date.now();
    EVENTS.forEach(e => window.addEventListener(e, onUserActivity, { passive: true }));

    // Verificăm în fiecare secundă starea de inactivitate
    intervalRef.current = setInterval(() => {
      const currentScreen = useKioskStore.getState().screen;
      if (currentScreen === 'welcome') return;

      const idleSec = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remainingSec = seconds - idleSec;

      if (remainingSec <= 0) {
        console.log('[Kiosk] Inactivity timeout — resetting to welcome');
        setInactivityWarning({ show: false, secondsLeft: 0 });
        resetAll();
        goTo('welcome');
      } else if (remainingSec <= 20) {
        // Dacă suntem pe ecranul de plată și se procesează o plată activă cu cardul, nu suprapunem pop-up-ul
        if (currentScreen === 'payment' && window._posPaymentActive) {
          return;
        }
        setInactivityWarning({ show: true, secondsLeft: remainingSec });
      } else {
        const currentWarning = useKioskStore.getState().inactivityWarning;
        if (currentWarning?.show) {
          setInactivityWarning({ show: false, secondsLeft: 20 });
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, onUserActivity));
    };
  }, [seconds, screen, goTo, resetAll, setInactivityWarning]);
}
