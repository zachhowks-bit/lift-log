import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import { backupOverdue, currentWeekSets, exerciseHistory, kneeRisingNow, kneeTrend, loggedExercises } from './progress';
import { finishSession, logSet, startNextSession } from './session';
import type { SetLog } from '../types';

const set = (o: Partial<SetLog> = {}): SetLog => ({
  weight: 60, fullReps: 9, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null, ...o,
});
const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('exerciseHistory', () => {
  it('returns top weight and Epley e1rm ascending', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    await logSet(s.id!, id, set({ weight: 60, fullReps: 9 }), T0);
    await logSet(s.id!, id, set({ weight: 70, fullReps: 3 }), T0 + 1);
    await finishSession(s.id!, T0 + 1000);
    const h = await exerciseHistory(id);
    expect(h).toEqual([{ date: T0, topWeight: 70, e1rm: 78 }]);
    expect(await exerciseHistory('unknown')).toEqual([]);
  });
});

describe('currentWeekSets', () => {
  it('lists all 14 muscles with done and target', async () => {
    const s = await startNextSession(T0);
    await logSet(s.id!, s.entries[0].exerciseId, set(), T0);
    const rows = await currentWeekSets();
    expect(rows).toHaveLength(14);
    expect(rows.find((r) => r.muscle === 'chest')!.done).toBeGreaterThan(0);
    expect(rows.find((r) => r.muscle === 'chest')!.target).toBe(10);
    expect(rows.find((r) => r.muscle === 'calves')!.done).toBe(0);
  });
});

describe('knee', () => {
  it('kneeTrend and kneeRisingNow', async () => {
    for (let i = 0; i < 3; i++) {
      const s = await startNextSession(T0 + i * DAY);
      await logSet(s.id!, s.entries[0].exerciseId, set({ kneePain: i + 1 }), T0 + i * DAY);
      await finishSession(s.id!, T0 + i * DAY + 1000);
    }
    expect((await kneeTrend()).map((k) => k.max)).toEqual([1, 2, 3]);
    expect(await kneeRisingNow()).toBe(true);
  });
  it('not rising with no data', async () => {
    expect(await kneeRisingNow()).toBe(false);
  });
});

describe('backupOverdue', () => {
  it('never backed up: only overdue with a finished session', async () => {
    expect(await backupOverdue(T0)).toBe(false);
    const s = await startNextSession(T0);
    await logSet(s.id!, s.entries[0].exerciseId, set(), T0);
    await finishSession(s.id!, T0 + 1000);
    expect(await backupOverdue(T0 + 2000)).toBe(true);
  });
  it('backed up: overdue after 7 days', async () => {
    await db.settings.update('main', { lastBackupAt: T0 });
    expect(await backupOverdue(T0 + 7 * DAY)).toBe(false);
    expect(await backupOverdue(T0 + 7 * DAY + 1)).toBe(true);
  });
});

describe('loggedExercises', () => {
  it('lists exercises with a set in a finished session, by name', async () => {
    expect(await loggedExercises()).toEqual([]);
    const s = await startNextSession(T0);
    await logSet(s.id!, 'latPulldown', set(), T0);
    await logSet(s.id!, 'bench', set(), T0 + 1);
    expect(await loggedExercises()).toEqual([]); // still in progress
    await finishSession(s.id!, T0 + 1000);
    expect(await loggedExercises()).toEqual([
      { id: 'bench', name: 'Barbell bench press' },
      { id: 'latPulldown', name: 'Lat pulldown' },
    ]);
  });
});
