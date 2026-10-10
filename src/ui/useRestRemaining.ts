import { useEffect, useRef, useState } from 'react';

/**
 * Milliseconds of rest left, derived from the stored end timestamp so it stays correct after
 * app switching or a reload. Recomputed every 250 ms and on visibilitychange.
 * Calls onFinish once when a running timer reaches zero.
 */
export function useRestRemaining(restEndsAt: number | null, onFinish?: () => void): number {
  const calc = () => (restEndsAt === null ? 0 : Math.max(0, restEndsAt - Date.now()));
  const [remaining, setRemaining] = useState(calc);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    let running = restEndsAt !== null && restEndsAt > Date.now();
    const tick = () => {
      const left = restEndsAt === null ? 0 : Math.max(0, restEndsAt - Date.now());
      setRemaining(left);
      if (running && left === 0) {
        running = false;
        finishRef.current?.();
      }
    };
    tick();
    if (!running) return undefined;
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [restEndsAt]);

  return remaining;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
