import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../../db/db';
import App from '../App';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});
afterEach(cleanup);

describe('Home', () => {
  it('shows the next slot, block/week label and Start on a fresh install', async () => {
    render(<App />);
    expect(await screen.findByText('Next: Upper A — Push')).toBeTruthy();
    expect(screen.getByText('Block 1 · Week 1 · 3 reps left')).toBeTruthy();
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
    await db.programState.put({ ...st, sessionsInBlock: 20 });
    render(<App />);
    expect(await screen.findByText('Knee pain rising — see a physio.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Block check-in due' }));
    expect(await screen.findByRole('heading', { name: 'Block check-in' })).toBeTruthy();
  });
});
