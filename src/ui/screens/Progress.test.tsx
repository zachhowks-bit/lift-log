import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../../db/db';
import { finishSession, logSet, startNextSession } from '../../state/session';
import App from '../App';

const T0 = 1_700_000_000_000;
// Progress (with Recharts) is a lazy chunk; under full-suite load its first import can take seconds.
const LOAD = { timeout: 5000 };

beforeAll(async () => {
  await import('./Progress');
}, 20_000);

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});
afterEach(cleanup);

describe('Progress', () => {
  it('shows empty states on a fresh install', async () => {
    render(<App initial="progress" />);
    expect(await screen.findByText('No sets logged yet.', {}, LOAD)).toBeTruthy();
    expect(screen.getByText('No knee ratings yet.')).toBeTruthy();
    expect(screen.getByText('Front delts')).toBeTruthy();
  });

  it('lists logged exercises and weekly sets done / target', async () => {
    const s = await startNextSession(T0);
    await logSet(s.id!, 'machineChestPress', {
      weight: 60, fullReps: 8, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null,
    }, T0);
    await finishSession(s.id!, T0 + 1000);
    render(<App initial="progress" />);
    const select = await screen.findByRole('combobox', { name: 'Exercise' }, LOAD);
    expect((select as HTMLSelectElement).value).toBe('machineChestPress');
    expect(await screen.findByRole('cell', { name: '60 kg' })).toBeTruthy(); // table view of the chart
    expect(screen.getByRole('meter', { name: 'Chest sets' }).getAttribute('aria-valuenow')).toBe('1');
    expect(screen.getByText('1 / 17')).toBeTruthy();
  });
});
