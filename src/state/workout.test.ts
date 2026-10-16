import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import { finishSession, logSet, startNextSession } from './session';
import { defaultKneePain, swapOptions } from './workout';
import type { SetLog } from '../types';

const set = (o: Partial<SetLog> = {}): SetLog => ({
  weight: 60, fullReps: 9, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null, ...o,
});
const T0 = 1_700_000_000_000;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('swapOptions', () => {
  it('lists existing, non-avoid alternatives not already in the workout', async () => {
    const s = await startNextSession(T0); // pushA: machineChestPress, inclineDbPress, chestFly, ...
    const dbBench = (await db.exercises.get('dbBench'))!;
    await db.exercises.put({ ...dbBench, avoid: true });
    const ids = (await swapOptions(s, 'chestFly')).map((e) => e.id);
    expect(ids).toEqual(['cableFly']); // inclineDbPress is already in the session
    expect((await swapOptions(s, 'machineChestPress')).map((e) => e.id)).toEqual(['bench', 'declinePress']); // dbBench avoided
    expect(await swapOptions(s, 'unknown')).toEqual([]);
  });
});

describe('defaultKneePain', () => {
  it('is 0 with no history', async () => {
    const s = await startNextSession(T0);
    expect(await defaultKneePain(s)).toBe(0);
  });

  it('uses the latest finished session, then the current session', async () => {
    const a = await startNextSession(T0);
    await logSet(a.id!, a.entries[0].exerciseId, set({ kneePain: 2 }), T0 + 1);
    await logSet(a.id!, a.entries[1].exerciseId, set({ kneePain: 4 }), T0 + 2);
    await finishSession(a.id!, T0 + 3);
    const b = await startNextSession(T0 + 10);
    expect(await defaultKneePain(b)).toBe(4);
    const b2 = await logSet(b.id!, b.entries[0].exerciseId, set({ kneePain: 1 }), T0 + 11);
    expect(await defaultKneePain(b2)).toBe(1);
  });
});
