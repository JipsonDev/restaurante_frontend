import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// One shared clock for the visible waiter workspace; no request per timer/card.
export default function useServiceClock(enabled = true) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => setNow(Date.now());
    let timer;
    const sync = () => {
      clearInterval(timer);
      const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
      if (visible && AppState.currentState !== 'background' && AppState.currentState !== 'inactive') {
        tick(); timer = setInterval(tick, 15000);
      }
    };
    sync();
    const subscription = AppState.addEventListener('change', sync);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer); subscription.remove();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', sync);
    };
  }, [enabled]);
  return now;
}
