import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import { importWorkouts } from './importWorkouts';
import { finishSession, logSet, startNextSession } from './session';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

const file = (sessions: unknown[]) => JSON.stringify({ format: 'lift-log-import', version: 1, sessions });
const push = {
  start: '2026-09-21T21:55:00+08:00', minutes: 40, type: 'push', exercises: [
    { id: 'machineChestPress', sets: [[30, 5, 'W'], [59, 10], [59, 10], [59, 9]] },
    { id: 'inclineDbPress', sets: [[22.5, 8], [22.5, 6], [22.5, 5], [15, 5]] },
    { id: 'chestFly', sets: [[72, 7], [63, 2, 'D'], [54, 6, 'F']] },
    { id: 'declineCrunch', sets: [[0, 12], [0, 10]] },
    { id: 'legPress', sets: [], skipped: 'knee' },
  ],
};

describe('importWorkouts', () => {
  it('adds workouts next to existing ones, mapping set types and reps left', async () => {
    const s = await startNextSession(Date.parse('2026-10-20T20:00:00+08:00'));
    await logSet(s.id!, s.entries[0].exerciseId, { weight: 50, fullReps: 10, partialReps: 0, rir: 2,
      restTakenSec: null, restSkipped: false, kneePain: null }, s.startedAt + 1);
    await finishSession(s.id!, s.startedAt + 60_000);

    const res = await importWorkouts(file([push]));
    expect(res).toEqual({ ok: true, added: 1, skipped: 0 });
    expect(await db.sessions.count()).toBe(2);
    const imported = (await db.sessions.toArray()).find((x) => x.slot === 'push')!;
    expect(imported.startedAt).toBe(Date.parse('2026-09-21T21:55:00+08:00'));
    expect(imported.finishedAt! - imported.startedAt).toBe(40 * 60_000);
    expect(imported.entries.map((e) => e.exerciseId)).toEqual(['machineChestPress', 'inclineDbPress', 'chestFly', 'declineCrunch']);
    const [press, incline, fly, crunch] = imported.entries;
    expect(press.sets[0]).toMatchObject({ weight: 30, fullReps: 5, kind: 'warmup' });
    expect(press.sets[1]).toMatchObject({ weight: 59, fullReps: 10, rir: 1 });
    expect('kind' in press.sets[1]).toBe(false);
    expect(incline.sets[2].rir).toBe(0); // 5 reps is 3 under the 8–12 range: a clear miss
    expect(incline.sets[1].rir).toBe(1); // 6 reps, just short: not treated as a miss
    expect(fly.sets[1]).toMatchObject({ kind: 'drop' });
    expect(fly.sets[2]).toMatchObject({ rir: 0 }); // Hevy failure set
    expect(crunch.sets[0].weight).toBe(0);
    expect(imported.blockNumber).toBe(0); // never counts toward the current block
    // The program position is untouched.
    expect((await db.programState.get('main'))!.sessionsInBlock).toBe(1);
  });

  it('is safe to run twice: the same workout is not added again', async () => {
    await importWorkouts(file([push]));
    expect(await importWorkouts(file([push]))).toEqual({ ok: true, added: 0, skipped: 1 });
    expect(await db.sessions.count()).toBe(1);
  });

  it('the next workout is prescribed from the imported numbers', async () => {
    await importWorkouts(file([push]));
    const s = await startNextSession(Date.parse('2026-09-24T20:00:00+08:00'));
    const p = s.entries.find((e) => e.exerciseId === 'machineChestPress')!.prescription;
    expect(p.needsCalibration).toBe(false);
    expect(p.weight).toBe(59);
  });

  it('rejects files that are not workout files, without changing anything', async () => {
    expect(await importWorkouts('{')).toEqual({ ok: false, error: 'This file is not a workout file.' });
    expect(await importWorkouts(JSON.stringify({ format: 'other' }))).toMatchObject({ ok: false });
    const bad = { ...push, exercises: [{ id: 'nope', sets: [[10, 5]] }] };
    expect(await importWorkouts(file([bad]))).toEqual({ ok: false, error: 'Unknown exercise "nope".' });
    const badSet = { ...push, exercises: [{ id: 'chestFly', sets: [[-1, 5]] }] };
    expect(await importWorkouts(file([badSet]))).toMatchObject({ ok: false });
    expect(await db.sessions.count()).toBe(0);
  });
});
