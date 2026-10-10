import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../useRestRemaining';

interface Props {
  remainingMs: number;
  nextLabel?: string;
  onSkip: () => void;
}

export const HOLD_MS = 600;

/** Full-screen rest countdown. Render only while rest is running. */
export default function RestTimer({ remainingMs, nextLabel, onSkip }: Props) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    cancel();
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onSkip();
    }, HOLD_MS);
  };
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return (
    <div className="rest" role="dialog" aria-modal="true" aria-label="Rest timer">
      <p className="rest-label">Rest</p>
      <p className="rest-clock" role="timer" aria-live="off">{formatClock(remainingMs)}</p>
      {nextLabel && <p className="rest-next">Next: {nextLabel}</p>}
      <button type="button" className={holding ? 'hold-btn hold-on' : 'hold-btn'}
        onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}>
        <span className="hold-fill" style={{ transitionDuration: holding ? `${HOLD_MS}ms` : '0ms' }} />
        <span className="hold-text">Hold to skip rest</span>
      </button>
    </div>
  );
}
