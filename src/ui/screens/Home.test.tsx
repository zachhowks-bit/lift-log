import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../../db/db';
import App from '../App';
import { startNextSession } from '../../state/session';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});
afterEach(cleanup);

describe('Home', () => {
  it('shows the next slot, block/week label and Start on a fresh install', async () => {
    render(<App />);
    expect(await screen.findByText('Next: Push A — Chest focus')).toBeTruthy();
    expect(screen.getByText('Block 1 · Round 1 · 3 reps left')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByText('No workouts yet.')).toBeTruthy();
    expect(screen.queryByText('Knee pain rising — see a physio.')).toBeNull();
  });

  it('shows the physio banner and check-in button when due', async () => {
    await db.checkIns.add({
      recovery: 'sometimes', knee: 'worse', swapIds: [], motivation: 'ok', blockNumber: 1, at: 1,
      pctProgressed: 0, changes: [],
    });
    const st = (await db.programState.get('main'))!;
    await db.programState.put({ ...st, sessionsInBlock: 30 });
    render(<App />);
    expect(await screen.findByText('Knee pain rising — see a physio.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Do block check-in' }));
    expect(await screen.findByRole('heading', { name: 'Block check-in' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(await db.sessions.count()).toBe(0);
  });

  it('still allows resuming an active session while the check-in is due', async () => {
    await startNextSession(Date.now());
    const st = (await db.programState.get('main'))!;
    await db.programState.put({ ...st, sessionsInBlock: 30 });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
    expect(await screen.findByRole('button', { name: 'Finish workout' })).toBeTruthy();
  });
});
