import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureSeeded } from '../../db/db';
import { finishSession, logSet, startNextSession } from '../../state/session';
import App from '../App';
import type { SetLog } from '../../types';

const set = (o: Partial<SetLog> = {}): SetLog => ({
  weight: 60, fullReps: 8, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null, ...o,
});
const DAY = 86_400_000;
const T0 = new Date(2026, 9, 5, 18).getTime();

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function workout(at: number, weight: number) {
  const s = await startNextSession(at);
  await logSet(s.id!, s.entries[0].exerciseId, set({ weight }), at + 1);
  await finishSession(s.id!, at + 40 * 60_000);
  return s.id!;
}

describe('History', () => {
  it('Home shows the last 3 workouts; History shows all; a past set can be edited', async () => {
    for (let i = 0; i < 4; i++) await workout(T0 + i * DAY, 50 + i);
    render(<App />);
    const recent = await screen.findByRole('region', { name: 'Recent workouts' });
    expect(within(recent).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'See all workouts' }));
    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /min/ })).toHaveLength(4);

    fireEvent.click(screen.getAllByRole('button', { name: /^Push A/ })[0]);
    expect(await screen.findByRole('heading', { name: 'Push A — Chest focus' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Edit Set 1: 50 kg × 8/ }));
    const ed = await screen.findByRole('dialog', { name: 'Edit set' });
    fireEvent.change(within(ed).getByLabelText('Weight (kg)'), { target: { value: '52.5' } });
    fireEvent.click(within(ed).getByRole('button', { name: 'Save set' }));
    expect(await screen.findByRole('button', { name: /^Edit Set 1: 52.5 kg × 8/ })).toBeTruthy();
  });

  it('deletes a workout after confirming', async () => {
    const id = await workout(T0, 50);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App initial="history" />);
    fireEvent.click(await screen.findByRole('button', { name: /^Push A/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete workout' }));
    expect(await screen.findByText(/Finished workouts show up here/)).toBeTruthy();
    expect(await db.sessions.get(id)).toBeUndefined();
  });
});

describe('Progress highlights', () => {
  it('shows the week strip and a PR after beating a weight', async () => {
    await workout(T0, 50);
    for (let i = 1; i <= 5; i++) await workout(T0 + i * DAY, 10);
    await workout(T0 + 6 * DAY, 55);
    vi.setSystemTime(T0 + 7 * DAY);
    render(<App initial="progress" />);
    expect(await screen.findByRole('list', { name: 'Workouts per week, last 12 weeks' }, { timeout: 5000 })).toBeTruthy();
    const prs = screen.getByRole('region', { name: 'Personal records, last 30 days' });
    expect(within(prs).getByText('55 kg × 8')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Biggest gains' })).toBeTruthy();
    vi.useRealTimers();
  });
});

describe('Add workouts from a file', () => {
  it('adds them to History without replacing anything', async () => {
    await workout(T0, 50);
    render(<App initial="settings" />);
    const input = await screen.findByTestId('add-workouts-file');
    const json = JSON.stringify({ format: 'lift-log-import', version: 1, sessions: [
      { start: '2026-09-21T21:55:00+08:00', minutes: 40, type: 'push', exercises: [{ id: 'chestFly', sets: [[72, 7]] }] },
    ] });
    fireEvent.change(input, { target: { files: [new File([json], 'hevy-history.json', { type: 'application/json' })] } });
    expect((await screen.findByRole('status')).textContent).toBe('Added 1 workout.');
    expect(await db.sessions.count()).toBe(2);
  });
});
