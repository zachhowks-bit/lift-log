import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureSeeded } from '../../db/db';
import { getActiveSession, logSet, startNextSession } from '../../state/session';
import App from '../App';

const T0 = 1_700_000_000_000;

beforeEach(async () => {
  // Fake only the clock and intervals; IndexedDB still needs real timers.
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(T0);
  await db.delete();
  await db.open();
  await ensureSeeded();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const card = (name: string) => screen.getByRole('region', { name });
const rir = (scope: HTMLElement, name: string) =>
  within(within(scope).getByRole('radiogroup', { name: 'Reps left' })).getByRole('radio', { name });

describe('Workout', () => {
  it('reopening mid-rest restores the session and the remaining rest time', async () => {
    const s = await startNextSession(T0);
    await logSet(s.id!, 'machineChestPress', {
      weight: 60, fullReps: 8, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null,
    }, T0); // compound: 120 s rest
    vi.setSystemTime(T0 + 100_000); // app was closed for 100 s

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
    expect((await screen.findByRole('timer')).textContent).toBe('0:20');
    expect(within(card('Machine chest press')).getByRole('button', { name: 'Log set 2' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('navigation')).toBeNull(); // tab bar hidden in a workout

    vi.setSystemTime(T0 + 121_000);
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.queryByRole('timer')).toBeNull();
    expect(within(card('Machine chest press')).getByRole('button', { name: 'Log set 2' })).toHaveProperty('disabled', false);
  });

  it('logs a set, starts the rest timer, and skipping clears it', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    const bench = await screen.findByRole('region', { name: 'Machine chest press' });
    expect(within(bench).getByText('Pick a weight')).toBeTruthy();
    expect(within(bench).getByText('0/3')).toBeTruthy();

    fireEvent.change(within(bench).getByLabelText('Weight (kg)'), { target: { value: '50' } });
    fireEvent.click(rir(bench, '2'));
    fireEvent.click(within(bench).getByRole('button', { name: 'Log set 1' }));
    expect((await screen.findByRole('timer')).textContent).toBe('2:00');
    expect(within(card('Machine chest press')).getByText('1/3')).toBeTruthy();

    // Hold to skip: the hold uses setTimeout, which stays real here.
    vi.useRealTimers();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Hold to skip rest' }));
    await vi.waitFor(() => expect(screen.queryByRole('timer')).toBeNull(), { timeout: 2000 });
    const active = await getActiveSession();
    expect(active?.restEndsAt).toBeNull();
    expect(active?.restSkippedPending).toBe(true);
    expect(active?.entries[0].sets[0].restSkipped).toBe(false);
  });

  it('confirms before finishing with empty exercises and returns home', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish workout' }));
    expect(confirm).toHaveBeenCalledWith('Some exercises have no sets. Finish anyway?');
    expect(screen.getByRole('button', { name: 'Finish workout' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finish workout' }));
    expect(await screen.findByText('Workout done')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByText('Next: Pull A — Lats focus')).toBeTruthy();
    expect(await getActiveSession()).toBeNull();
  });

  it('swaps an exercise with no sets', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await screen.findByRole('region', { name: 'Machine chest press' });
    fireEvent.click(screen.getByRole('button', { name: 'Swap exercise' }));
    const sheet = await screen.findByRole('dialog', { name: 'Swap exercise' });
    fireEvent.click(await within(sheet).findByRole('button', { name: 'Dumbbell bench press' }));
    expect(await screen.findByRole('region', { name: 'Dumbbell bench press' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Machine chest press' })).toBeNull();
    expect((await db.templates.get('pushA'))!.ids[0]).toBe('dbBench'); // "use in future workouts" is on by default
  });

  it('shows a toast when a state call fails and keeps the inputs', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    const bench = await screen.findByRole('region', { name: 'Machine chest press' });
    fireEvent.change(within(bench).getByLabelText('Weight (kg)'), { target: { value: '50' } });
    fireEvent.click(rir(bench, '2'));
    const active = await getActiveSession();
    await db.sessions.update(active!.id!, { finishedAt: T0 }); // simulate the session vanishing
    fireEvent.click(within(bench).getByRole('button', { name: 'Log set 1' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Session is already finished.');
    expect((within(bench).getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('50');
  });

  it('swaps to a custom "Other" exercise for the same muscle', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await screen.findByRole('region', { name: 'Machine chest press' });
    fireEvent.click(screen.getByRole('button', { name: 'Swap exercise' }));
    const sheet = await screen.findByRole('dialog', { name: 'Swap exercise' });
    fireEvent.click(await within(sheet).findByRole('button', { name: 'Other (type your own)' }));
    fireEvent.click(within(sheet).getByLabelText('Use the new one in future workouts too')); // just this workout
    fireEvent.change(within(sheet).getByLabelText('Exercise name'), { target: { value: 'Pec deck' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add and swap' }));
    expect(await screen.findByRole('region', { name: 'Pec deck' })).toBeTruthy();
    const ex = (await db.exercises.toArray()).find((e) => e.name === 'Pec deck')!;
    expect(ex.primary).toEqual(['chest']);
    expect((await db.templates.get('pushA'))!.ids[0]).toBe('machineChestPress');
  });

  it('edits a logged set right after logging it, and logs a drop set during rest', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    const c = await screen.findByRole('region', { name: 'Machine chest press' });
    fireEvent.change(within(c).getByLabelText('Weight (kg)'), { target: { value: '59' } });
    fireEvent.click(rir(c, '0'));
    fireEvent.click(within(c).getByRole('button', { name: 'Log set 1' }));
    await screen.findByRole('timer');
    fireEvent.click(screen.getByRole('button', { name: 'Log a drop set or fix a set' }));

    fireEvent.click(within(card('Machine chest press')).getByRole('button', { name: /^Edit Set 1: 59 kg × / }));
    const ed = await screen.findByRole('dialog', { name: 'Edit set' });
    fireEvent.change(within(ed).getByLabelText('Weight (kg)'), { target: { value: '61' } });
    fireEvent.click(within(ed).getByRole('button', { name: 'Save set' }));
    await vi.waitFor(async () => expect((await getActiveSession())!.entries[0].sets[0].weight).toBe(61));
    expect(screen.queryByRole('dialog', { name: 'Edit set' })).toBeNull();

    const c2 = card('Machine chest press');
    fireEvent.click(within(within(c2).getByRole('radiogroup', { name: 'Set type' })).getByRole('radio', { name: 'Drop set' }));
    fireEvent.change(within(c2).getByLabelText('Weight (kg)'), { target: { value: '45' } });
    fireEvent.click(rir(c2, '0'));
    fireEvent.click(within(c2).getByRole('button', { name: 'Log drop set' }));
    await vi.waitFor(async () => expect((await getActiveSession())!.entries[0].sets[1]).toMatchObject({ weight: 45, kind: 'drop' }));
    expect(within(card('Machine chest press')).getByText('1/3')).toBeTruthy(); // drop sets don't count toward the 3
  });

  it('discards a started workout: nothing saved, the next workout stays the same', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard workout' }));
    expect(await screen.findByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByText('Next: Push A — Chest focus')).toBeTruthy();
    expect(await db.sessions.count()).toBe(0);
  });
});
