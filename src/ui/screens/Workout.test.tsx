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
    await logSet(s.id!, 'bench', {
      weight: 60, fullReps: 8, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null,
    }, T0); // heavy compound: 180 s rest
    vi.setSystemTime(T0 + 100_000); // app was closed for 100 s

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
    expect((await screen.findByRole('timer')).textContent).toBe('1:20');
    expect(within(card('Barbell bench press')).getByRole('button', { name: 'Log set 2' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('navigation')).toBeNull(); // tab bar hidden in a workout

    vi.setSystemTime(T0 + 181_000);
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.queryByRole('timer')).toBeNull();
    expect(within(card('Barbell bench press')).getByRole('button', { name: 'Log set 2' })).toHaveProperty('disabled', false);
  });

  it('logs a set, starts the rest timer, and skipping clears it', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    const bench = await screen.findByRole('region', { name: 'Barbell bench press' });
    expect(within(bench).getByText('Pick a weight')).toBeTruthy();
    expect(within(bench).getByText('0/3')).toBeTruthy();

    fireEvent.change(within(bench).getByLabelText('Weight (kg)'), { target: { value: '50' } });
    fireEvent.click(rir(bench, '2'));
    fireEvent.click(within(bench).getByRole('button', { name: 'Log set 1' }));
    expect((await screen.findByRole('timer')).textContent).toBe('3:00');
    expect(within(card('Barbell bench press')).getByText('1/3')).toBeTruthy();

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
    expect(await screen.findByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByText('Next: Lower A — Quads & Glutes')).toBeTruthy();
    expect(await getActiveSession()).toBeNull();
  });

  it('swaps an exercise with no sets', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await screen.findByRole('region', { name: 'Barbell bench press' });
    fireEvent.click(screen.getByRole('button', { name: 'Swap exercise' }));
    const sheet = await screen.findByRole('dialog', { name: 'Swap exercise' });
    fireEvent.click(await within(sheet).findByRole('button', { name: 'Machine chest press' }));
    expect(await screen.findByRole('region', { name: 'Machine chest press' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Barbell bench press' })).toBeNull();
  });

  it('shows a toast when a state call fails and keeps the inputs', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    const bench = await screen.findByRole('region', { name: 'Barbell bench press' });
    fireEvent.change(within(bench).getByLabelText('Weight (kg)'), { target: { value: '50' } });
    fireEvent.click(rir(bench, '2'));
    const active = await getActiveSession();
    await db.sessions.update(active!.id!, { finishedAt: T0 }); // simulate the session vanishing
    fireEvent.click(within(bench).getByRole('button', { name: 'Log set 1' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Session is already finished.');
    expect((within(bench).getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('50');
  });
});
