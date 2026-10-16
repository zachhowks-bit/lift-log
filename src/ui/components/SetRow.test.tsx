import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../../types';
import SetRow from './SetRow';

const EX: Exercise = {
  id: 'legPress', name: 'Leg press', type: 'C', primary: ['quads'], secondary: [], equipment: 'machine',
  increment: 2.5, lower: true, kneeSensitive: true, alternatives: [], avoid: false,
};

afterEach(cleanup);

function setup(over: Partial<Parameters<typeof SetRow>[0]> = {}) {
  const onLog = vi.fn(async () => {});
  render(<SetRow exercise={EX} setNumber={1} defaultWeight={100} defaultReps={12} defaultKnee={3}
    locked={false} onLog={onLog} {...over} />);
  return onLog;
}
const rir = (name: string) => within(screen.getByRole('radiogroup', { name: 'Reps left' })).getByRole('radio', { name });
const log = () => fireEvent.click(screen.getByRole('button', { name: 'Log set 1' }));

describe('SetRow', () => {
  it('rejects a negative weight with a visible error and does not log', () => {
    const onLog = setup();
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '-2' } });
    fireEvent.click(rir('2'));
    log();
    expect(screen.getByRole('alert').textContent).toBe('Enter a weight (0 for bodyweight).');
    expect(onLog).not.toHaveBeenCalled();
  });

  it('requires reps left to be picked', () => {
    const onLog = setup();
    log();
    expect(screen.getByRole('alert').textContent).toBe('Pick reps left.');
    expect(onLog).not.toHaveBeenCalled();
  });

  it('steps weight by the increment and logs defaults with knee pain', () => {
    const onLog = setup();
    fireEvent.click(screen.getByRole('button', { name: 'More weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'More partial reps' }));
    fireEvent.click(rir('3+'));
    log();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onLog).toHaveBeenCalledWith({
      weight: 102.5, fullReps: 12, partialReps: 1, rir: 3, restTakenSec: null, restSkipped: false, kneePain: 3,
    });
  });

  it('starts empty with a calibration hint', () => {
    setup({ defaultWeight: null, calibrationHint: 'First time: pick a weight you could do for 15 with ~2 reps left' });
    expect((screen.getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('First time: pick a weight you could do for 15 with ~2 reps left')).toBeTruthy();
  });

  it('disables logging while locked', () => {
    setup({ locked: true });
    expect(screen.getByRole('button', { name: 'Log set 1' })).toHaveProperty('disabled', true);
  });
});

describe('warmupText', () => {
  it('rounds to the exercise increment', async () => {
    const { warmupText } = await import('./ExerciseCard');
    expect(warmupText(59, 2.5)).toBe('Warm up first: 30 kg × 8, then 45 kg × 4. Log them as Warm-up.');
  });
});
