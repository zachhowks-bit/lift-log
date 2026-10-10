import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../../types';
import { useRestRemaining } from '../useRestRemaining';
import RestTimer from './RestTimer';
import SetRow from './SetRow';

const EX: Exercise = {
  id: 'bench', name: 'Bench', type: 'H', primary: ['chest'], secondary: [], equipment: 'barbell',
  increment: 2.5, lower: false, kneeSensitive: false, alternatives: [], avoid: false,
};
const T0 = 1_700_000_000_000;

/** Same wiring as the Workout screen: overlay while resting, Log locked until zero. */
function Harness({ restEndsAt, onSkip = () => {}, onFinish }: { restEndsAt: number | null; onSkip?: () => void; onFinish?: () => void }) {
  const remaining = useRestRemaining(restEndsAt, onFinish);
  return (
    <>
      <SetRow exercise={EX} setNumber={2} defaultWeight={60} defaultReps={8} defaultKnee={0}
        locked={remaining > 0} onLog={async () => {}} />
      {remaining > 0 && <RestTimer remainingMs={remaining} onSkip={onSkip} />}
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RestTimer', () => {
  it('shows 2:00 for a 120 s end time and locks the log button, then unlocks after the end', () => {
    const onFinish = vi.fn();
    render(<Harness restEndsAt={T0 + 120_000} onFinish={onFinish} />);
    expect(screen.getByRole('timer')).toHaveProperty('textContent', '2:00');
    expect(screen.getByRole('button', { name: 'Log set 2' })).toHaveProperty('disabled', true);

    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByRole('timer').textContent).toBe('1:30');

    act(() => { vi.advanceTimersByTime(90_250); });
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.getByRole('button', { name: 'Log set 2' })).toHaveProperty('disabled', false);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('recomputes from the end timestamp on visibilitychange (app switching)', () => {
    render(<Harness restEndsAt={T0 + 120_000} />);
    // Simulate a suspended tab: wall clock jumps without intervals firing.
    vi.setSystemTime(T0 + 100_000);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(screen.getByRole('timer').textContent).toBe('0:20');
  });

  it('is not shown when the stored end time is already past (reopened late)', () => {
    const onFinish = vi.fn();
    render(<Harness restEndsAt={T0 - 5_000} onFinish={onFinish} />);
    expect(screen.queryByRole('timer')).toBeNull();
    expect(screen.getByRole('button', { name: 'Log set 2' })).toHaveProperty('disabled', false);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('skips only after a 600 ms hold', () => {
    const onSkip = vi.fn();
    render(<Harness restEndsAt={T0 + 120_000} onSkip={onSkip} />);
    const hold = screen.getByRole('button', { name: 'Hold to skip rest' });
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.pointerUp(hold);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onSkip).not.toHaveBeenCalled();
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(600); });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
