import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import {
  blockProgressPct, deleteSet, deleteWorkout, discardWorkout, editSet, finishSession, getActiveSession, isCheckInDue,
  logSet, skipRest, startNextSession, submitCheckIn, swapExercise, validateSet,
} from './session';
import { restFor, WARMUP_REST_SEC } from '../engine/rules';
import { isValidExposure } from '../engine/stall';
import type { SetLog } from '../types';

const set = (o: Partial<SetLog> = {}): SetLog => ({
  weight: 60, fullReps: 8, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null, ...o,
});
const DAY = 86_400_000;
const T0 = 1_700_000_000_000;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

async function runSession(now: number, o: Partial<SetLog> = {}) {
  const s = await startNextSession(now);
  const first = s.entries[0].exerciseId;
  await logSet(s.id!, first, set(o), now + 1000);
  await finishSession(s.id!, now + 3_600_000);
  return s;
}

describe('validateSet', () => {
  it('rejects bad input', () => {
    expect(validateSet(set({ weight: -1 }))).toBe('Enter a weight (0 for bodyweight).');
    expect(validateSet({ ...set(), weight: undefined })).toBe('Enter a weight (0 for bodyweight).');
    expect(validateSet(set({ weight: NaN }))).toBe('Enter a weight (0 for bodyweight).');
    expect(validateSet(set({ fullReps: -1 }))).toBe('Reps must be whole numbers, 0 or more.');
    expect(validateSet(set({ partialReps: -1 }))).toBe('Reps must be whole numbers, 0 or more.');
    expect(validateSet(set({ fullReps: 0, partialReps: 0 }))).toBe('Log at least 1 rep (full or partial).');
    expect(validateSet(set({ rir: 6 }))).toBe('Reps left must be 0–5.');
    expect(validateSet(set({ kneePain: 11 }))).toBe('Knee pain must be 0–10.');
  });
  it('accepts valid input, incl. 0 full reps with partials', () => {
    expect(validateSet(set())).toBeNull();
    expect(validateSet(set({ fullReps: 0, partialReps: 1, rir: 0 }))).toBeNull();
    expect(validateSet(set({ kneePain: 0 }))).toBeNull();
    expect(validateSet(set({ weight: 0 }))).toBeNull(); // bodyweight
  });
});

describe('session flow', () => {
  it('start → log 3 sets → finish advances to pullA', async () => {
    const s = await startNextSession(T0);
    expect(s.slot).toBe('pushA');
    expect(s.weekInBlock).toBe(1);
    const id = s.entries[0].exerciseId;
    for (let i = 0; i < 3; i++) await logSet(s.id!, id, set(), T0 + i * 1000);
    const res = await finishSession(s.id!, T0 + 10_000);
    expect(res.checkInDue).toBe(false);
    expect(await getActiveSession()).toBeNull();
    const state = await db.programState.get('main');
    expect(state?.nextSlotIndex).toBe(1);
    expect(state?.sessionsInBlock).toBe(1);
    expect((await startNextSession(T0 + DAY)).slot).toBe('pullA');
  });

  it('startNextSession returns the unfinished session instead of a second', async () => {
    const a = await startNextSession(T0);
    const b = await startNextSession(T0 + 5);
    expect(b.id).toBe(a.id);
    expect(await db.sessions.count()).toBe(1);
  });

  it('restores an in-progress session after restart, with restEndsAt', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    await logSet(s.id!, id, set(), T0 + 500);
    await logSet(s.id!, id, set(), T0 + 900);
    const ex = (await db.exercises.get(id))!;
    db.close();
    await db.open();
    const back = await getActiveSession();
    expect(back?.id).toBe(s.id);
    expect(back?.entries[0].sets).toHaveLength(2);
    expect(back?.restEndsAt).toBe(T0 + 900 + restFor(ex, set()) * 1000);
  });

  it('rest end time = now + restFor', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    const ex = (await db.exercises.get(id))!;
    const a = set({ rir: 0 });
    const out = await logSet(s.id!, id, a, T0);
    expect(out.restEndsAt).toBe(T0 + restFor(ex, a) * 1000);
    expect((await db.sessions.get(s.id!))?.restEndsAt).toBe(out.restEndsAt);
  });

  it('never stores an invalid set', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    await expect(logSet(s.id!, id, set({ weight: -5 }), T0)).rejects.toThrow('Enter a weight (0 for bodyweight).');
    await expect(logSet(s.id!, id, set({ fullReps: 0, partialReps: 0 }), T0)).rejects.toThrow();
    await expect(logSet(s.id!, 'nope', set(), T0)).rejects.toThrow();
    const back = await db.sessions.get(s.id!);
    expect(back?.entries[0].sets).toHaveLength(0);
    expect(back?.restEndsAt).toBeNull();
  });

  it('allows 0 full reps with partials', async () => {
    const s = await startNextSession(T0);
    const out = await logSet(s.id!, s.entries[0].exerciseId, set({ fullReps: 0, partialReps: 2, rir: 0 }), T0);
    expect(out.entries[0].sets).toHaveLength(1);
  });

  it('flags out-of-order logging', async () => {
    const s = await startNextSession(T0);
    const out = await logSet(s.id!, s.entries[2].exerciseId, set(), T0);
    expect(out.entries[2].doneOutOfOrder).toBe(true);
    const ok = await logSet(s.id!, s.entries[0].exerciseId, set(), T0 + 1);
    expect(ok.entries[0].doneOutOfOrder).toBe(false);
  });

  it('skipRest records rest taken, clears restEndsAt, keeps the finished set valid; no-op when no rest', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    expect((await skipRest(s.id!, T0)).restEndsAt).toBeNull();
    await logSet(s.id!, id, set(), T0);
    const out = await skipRest(s.id!, T0 + 20_000);
    expect(out.restEndsAt).toBeNull();
    expect(out.restSkippedPending).toBe(true);
    const last = out.entries[0].sets[0];
    expect(last.restSkipped).toBe(false);
    expect(last.restTakenSec).toBe(20);
  });

  it('a skipped rest invalidates the next set of the same exercise', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    await logSet(s.id!, id, set(), T0);
    await skipRest(s.id!, T0 + 20_000);
    const out = await logSet(s.id!, id, set(), T0 + 30_000);
    expect(out.entries[0].sets[0].restSkipped).toBe(false);
    expect(out.entries[0].sets[0].restTakenSec).toBe(20);
    expect(out.entries[0].sets[1].restSkipped).toBe(true);
    expect(out.restSkippedPending).toBeFalsy();
    expect(isValidExposure(out.entries[0])).toBe(false);
    const third = await logSet(s.id!, id, set(), T0 + 400_000);
    expect(third.entries[0].sets[2].restSkipped).toBe(false);
  });

  it('a skip after the last set of an exercise invalidates nothing when moving on', async () => {
    const s = await startNextSession(T0);
    const a = s.entries[0].exerciseId;
    const b = s.entries[1].exerciseId;
    for (let i = 0; i < 3; i++) await logSet(s.id!, a, set(), T0 + i * 300_000);
    await skipRest(s.id!, T0 + 1_000_000);
    const out = await logSet(s.id!, b, set(), T0 + 1_010_000);
    expect(out.restSkippedPending).toBeFalsy();
    expect(out.entries.every((e) => e.sets.every((x) => !x.restSkipped))).toBe(true);
    expect(isValidExposure(out.entries[0])).toBe(true);
    expect(isValidExposure(out.entries[1])).toBe(true);
  });

  it('skip after the final set, then finish: pushdown 15/15/15 RIR 1 still progresses', async () => {
    const s = await startNextSession(T0);
    expect(s.slot).toBe('pushA');
    const id = 'cablePushdown';
    const w = 20;
    for (let i = 0; i < 3; i++) {
      await logSet(s.id!, id, set({ weight: w, fullReps: 15, rir: 1 }), T0 + i * 120_000);
    }
    await skipRest(s.id!, T0 + 250_000);
    await finishSession(s.id!, T0 + 260_000);
    const done = (await db.sessions.get(s.id!))!;
    expect(done.restSkippedPending).toBeFalsy();
    expect(done.entries.find((e) => e.exerciseId === id)!.sets.every((x) => !x.restSkipped)).toBe(true);
    for (let i = 1; i <= 5; i++) await runSession(T0 + i * DAY);
    const next = await startNextSession(T0 + 6 * DAY);
    expect(next.slot).toBe('pushA');
    const p = next.entries.find((e) => e.exerciseId === id)!.prescription;
    const inc = (await db.exercises.get(id))!.increment;
    expect(p.weight).toBe(w + inc);
  });

  it('records restTakenSec of the previous set on the next log', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    await logSet(s.id!, id, set(), T0);
    const out = await logSet(s.id!, id, set(), T0 + 1000);
    expect(out.entries[0].sets[0].restTakenSec).toBe(restFor((await db.exercises.get(id))!, set()));
    expect(out.entries[0].sets[1].restTakenSec).toBeNull();
  });

  it('swap works before sets and is refused after', async () => {
    const s = await startNextSession(T0);
    const from = s.entries[0].exerciseId;
    const to = (await db.exercises.get(from))!.alternatives[0];
    const out = await swapExercise(s.id!, from, to);
    expect(out.entries[0].exerciseId).toBe(to);
    expect(out.entries[0].prescription.exerciseId).toBe(to);
    expect(out.entries).toHaveLength(s.entries.length);
    await logSet(s.id!, to, set(), T0);
    await expect(swapExercise(s.id!, to, from)).rejects.toThrow("Can't swap after logging sets.");
  });

  it('no break adjustment when the gap since the last session overall is under 7 days', async () => {
    const first = await runSession(T0, { weight: 60, fullReps: 8, rir: 2 });
    const id = first.entries[0].exerciseId;
    for (let i = 0; i < 5; i++) await runSession(T0 + (8 + i) * DAY);
    const again = await startNextSession(T0 + 15 * DAY);
    const e = again.entries.find((x) => x.exerciseId === id)!;
    expect(again.slot).toBe('pushA');
    expect(e.prescription.weight).toBe(60);
    expect(e.prescription.why).not.toMatch(/back after/);
  });

  it('applies the break cut when the gap since the last session is 14+ days', async () => {
    const first = await runSession(T0, { weight: 60, fullReps: 8, rir: 2 });
    const id = first.entries[0].exerciseId;
    for (let i = 0; i < 5; i++) await runSession(T0 + (8 + i) * DAY);
    const again = await startNextSession(T0 + 30 * DAY);
    const e = again.entries.find((x) => x.exerciseId === id)!;
    expect(e.prescription.weight).toBeLessThan(60);
    expect(e.prescription.why).toMatch(/^−10%: back after \d+ days/);
  });

  it('an 8-day trip holds weights without cutting', async () => {
    const first = await runSession(T0, { weight: 60, fullReps: 8, rir: 2 });
    const id = first.entries[0].exerciseId;
    for (let i = 0; i < 5; i++) await runSession(T0 + (1 + i) * DAY);
    const again = await startNextSession(T0 + 13 * DAY);
    const e = again.entries.find((x) => x.exerciseId === id)!;
    expect(e.prescription.weight).toBe(60);
    expect(e.prescription.why).toMatch(/^Back after \d+ days: same weight/);
  });

  it('ignores restSkipped passed by the caller', async () => {
    const s = await startNextSession(T0);
    const out = await logSet(s.id!, s.entries[0].exerciseId, set({ restSkipped: true, restTakenSec: 5 }), T0);
    expect(out.entries[0].sets[0].restSkipped).toBe(false);
    expect(out.entries[0].sets[0].restTakenSec).toBeNull();
  });

  it('swap refuses an exercise already in the workout', async () => {
    const s = await startNextSession(T0);
    await expect(swapExercise(s.id!, s.entries[0].exerciseId, s.entries[1].exerciseId))
      .rejects.toThrow('That exercise is already in this workout.');
  });

  it('concurrent starts create only one session', async () => {
    const [a, b] = await Promise.all([startNextSession(T0), startNextSession(T0 + 1)]);
    expect(a.id).toBe(b.id);
    expect(await db.sessions.count()).toBe(1);
  });

  it('submitCheckIn refuses before 30 sessions', async () => {
    await expect(submitCheckIn({ recovery: 'sometimes', knee: 'same', swapIds: [], motivation: 'ok' }))
      .rejects.toThrow('Check-in is not due yet.');
    expect(await db.checkIns.count()).toBe(0);
  });

  it('no ramp after only 5 sessions', async () => {
    const before = await db.programState.get('main');
    for (let i = 0; i < 5; i++) await runSession(T0 + i * DAY, { kneePain: 1 });
    const after = await db.programState.get('main');
    expect(after?.volumeTargets).toEqual(before?.volumeTargets);
    expect(after?.setsByExercise).toEqual({});
  });

  it('no ramp when legRampFrozen', async () => {
    await db.programState.update('main', { legRampFrozen: true });
    const before = await db.programState.get('main');
    for (let i = 0; i < 6; i++) await runSession(T0 + i * DAY, { kneePain: 1 });
    const after = await db.programState.get('main');
    expect(after?.sessionsInBlock).toBe(6);
    expect(after?.volumeTargets).toEqual(before?.volumeTargets);
  });

  it('blockProgressPct counts exercises that progressed (exact)', async () => {
    // two sessions of the same slot-less exercise set: bench progresses, other first exercises do not exist
    const s1 = await startNextSession(T0);
    const id = s1.entries[0].exerciseId;
    await logSet(s1.id!, id, set({ weight: 60 }), T0);
    const other = s1.entries[1].exerciseId;
    await logSet(s1.id!, other, set({ weight: 40 }), T0 + 1);
    await finishSession(s1.id!, T0 + 2);
    // hand-build a second finished session with the same exercises: one up, one flat
    const mk = (w1: number, w2: number) => ({
      ...s1, id: undefined, startedAt: T0 + DAY, finishedAt: T0 + DAY + 5,
      entries: [
        { ...s1.entries[0], sets: [set({ weight: w1 })] },
        { ...s1.entries[1], sets: [set({ weight: w2 })] },
      ],
    });
    await db.sessions.add(mk(65, 40));
    expect(await blockProgressPct()).toBe(50);
  });

  it('submitCheckIn saves templates', async () => {
    for (let i = 0; i < 30; i++) {
      const s = await startNextSession(T0 + i * DAY);
      await logSet(s.id!, s.entries[0].exerciseId, set({ weight: 60 + i }), T0 + i * DAY + 1);
      await finishSession(s.id!, T0 + i * DAY + 5000);
    }
    const tplBefore = (await db.templates.toArray()).map((t) => t.ids.join());
    const swapId = (await db.templates.get('pushA'))!.ids[0];
    const changes = await submitCheckIn({ recovery: 'sometimes', knee: 'same', swapIds: [swapId], motivation: 'ok' });
    expect(changes.some((c) => c.startsWith('Swapped'))).toBe(true);
    const pushA = (await db.templates.get('pushA'))!.ids;
    expect(pushA).not.toContain(swapId);
    expect((await db.templates.toArray()).map((t) => t.ids.join())).not.toEqual(tplBefore);
  });

  it('ramps leg sets after a full round of 6 with low knee pain', async () => {
    const before = await db.programState.get('main');
    for (let i = 0; i < 6; i++) await runSession(T0 + i * DAY, { kneePain: 1 });
    const after = await db.programState.get('main');
    expect(after?.sessionsInBlock).toBe(6);
    const [chosen] = Object.keys(after!.setsByExercise);
    expect(Object.keys(after!.setsByExercise)).toHaveLength(1);
    expect(after!.setsByExercise[chosen]).toBe(3);
    const ex = (await db.exercises.get(chosen))!;
    expect(ex.lower).toBe(true);
    for (const m of ex.primary) expect(after!.volumeTargets[m]).toBe(before!.volumeTargets[m] + 1);
  });

  it('does not ramp when knee pain was high', async () => {
    const before = await db.programState.get('main');
    for (let i = 0; i < 6; i++) await runSession(T0 + i * DAY, { kneePain: 5 });
    const after = await db.programState.get('main');
    expect(after?.volumeTargets).toEqual(before?.volumeTargets);
  });

  it('30 finished sessions → checkInDue, and submitCheckIn resets block', async () => {
    let due = false;
    for (let i = 0; i < 30; i++) {
      const s = await startNextSession(T0 + i * DAY);
      await logSet(s.id!, s.entries[0].exerciseId, set({ weight: 60 + i }), T0 + i * DAY + 1);
      due = (await finishSession(s.id!, T0 + i * DAY + 5000)).checkInDue;
      expect(due).toBe(i === 29);
    }
    expect(await isCheckInDue()).toBe(true);
    expect(await blockProgressPct()).toBeGreaterThan(0);
    const changes = await submitCheckIn(
      { recovery: 'sometimes', knee: 'worse', swapIds: [], motivation: 'ok' }, T0 + 40 * DAY,
    );
    expect(Array.isArray(changes)).toBe(true);
    const st = await db.programState.get('main');
    expect(st?.sessionsInBlock).toBe(0);
    expect(st?.blockNumber).toBe(2);
    expect(st?.legRampFrozen).toBe(true);
    const ci = await db.checkIns.toArray();
    expect(ci).toHaveLength(1);
    expect(ci[0].blockNumber).toBe(1);
    expect(ci[0].changes).toEqual(changes);
    expect(ci[0].at).toBe(T0 + 40 * DAY);
    expect(await isCheckInDue()).toBe(false);
  });
});

describe('set types', () => {
  it('warm-up rest is 60 s, and warm-ups do not mark the exercise done out of order', async () => {
    const s = await startNextSession(T0);
    const out = await logSet(s.id!, s.entries[2].exerciseId, set({ kind: 'warmup', weight: 20 }), T0);
    expect(out.restEndsAt).toBe(T0 + WARMUP_REST_SEC * 1000);
    expect(out.entries[2].doneOutOfOrder).toBe(false);
    expect(out.entries[2].sets[0].kind).toBe('warmup');
  });
  it('a drop set right after a skipped rest is not flagged as skipping rest', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    await logSet(s.id!, id, set({ rir: 0 }), T0);
    await skipRest(s.id!, T0 + 5_000);
    const out = await logSet(s.id!, id, set({ kind: 'drop', weight: 45, fullReps: 5, rir: 0 }), T0 + 10_000);
    expect(out.entries[0].sets[1].restSkipped).toBe(false);
  });
  it('normal sets have no kind field stored', async () => {
    const s = await startNextSession(T0);
    const out = await logSet(s.id!, s.entries[0].exerciseId, set(), T0);
    expect('kind' in out.entries[0].sets[0]).toBe(false);
  });
  it('next prescription uses weights already used on that machine', async () => {
    const s = await startNextSession(T0);
    const id = 'cablePushdown';
    for (let i = 0; i < 3; i++) await logSet(s.id!, id, set({ weight: 24.8, fullReps: 12, rir: 2 }), T0 + i);
    await finishSession(s.id!, T0 + 10);
    // Another push day where 20.3 hit the top of the range.
    for (let i = 1; i <= 5; i++) await runSession(T0 + i * DAY);
    const s2 = await startNextSession(T0 + 6 * DAY);
    for (let i = 0; i < 3; i++) await logSet(s2.id!, id, set({ weight: 20.3, fullReps: 15, rir: 1 }), T0 + 6 * DAY + i);
    await finishSession(s2.id!, T0 + 6 * DAY + 10);
    for (let i = 7; i <= 11; i++) await runSession(T0 + i * DAY);
    const s3 = await startNextSession(T0 + 12 * DAY);
    expect(s3.entries.find((e) => e.exerciseId === id)!.prescription.weight).toBe(24.8);
  });
});

describe('editing', () => {
  it('edits a set in the open workout without touching the rest timer', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    const logged = await logSet(s.id!, id, set({ weight: 60, fullReps: 8 }), T0);
    const out = await editSet(s.id!, id, 0, { weight: 62.5, fullReps: 7, partialReps: 1, rir: 0, kneePain: null });
    expect(out.entries[0].sets[0]).toMatchObject({ weight: 62.5, fullReps: 7, partialReps: 1, rir: 0 });
    expect(out.restEndsAt).toBe(logged.restEndsAt);
  });
  it('edits a set in a finished workout and rejects bad values', async () => {
    const s = await runSession(T0, { weight: 60 });
    const id = s.entries[0].exerciseId;
    const out = await editSet(s.id!, id, 0, { weight: 65, fullReps: 8, partialReps: 0, rir: 2, kneePain: null, kind: 'drop' });
    expect(out.entries[0].sets[0].weight).toBe(65);
    expect(out.entries[0].sets[0].kind).toBe('drop');
    await expect(editSet(s.id!, id, 0, { weight: -1, fullReps: 8, partialReps: 0, rir: 2, kneePain: null }))
      .rejects.toThrow('Enter a weight (0 for bodyweight).');
    await expect(editSet(s.id!, id, 5, { weight: 60, fullReps: 8, partialReps: 0, rir: 2, kneePain: null }))
      .rejects.toThrow('Set not found.');
    const back = await editSet(s.id!, id, 0, { weight: 65, fullReps: 8, partialReps: 0, rir: 2, kneePain: null, kind: undefined });
    expect('kind' in back.entries[0].sets[0]).toBe(false);
  });
  it('deletes a set', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    await logSet(s.id!, id, set({ weight: 60 }), T0);
    await logSet(s.id!, id, set({ weight: 70 }), T0 + 1);
    const out = await deleteSet(s.id!, id, 0);
    expect(out.entries[0].sets.map((x) => x.weight)).toEqual([70]);
  });
  it('deletes a finished workout but not an open one; discard removes an open one', async () => {
    const done = await runSession(T0);
    const open = await startNextSession(T0 + DAY);
    await expect(deleteWorkout(open.id!)).rejects.toThrow();
    await deleteWorkout(done.id!);
    expect(await db.sessions.get(done.id!)).toBeUndefined();
    await discardWorkout(open.id!);
    expect(await getActiveSession()).toBeNull();
  });
});

describe('swap that sticks', () => {
  it('always = true replaces the exercise in the plan', async () => {
    const s = await startNextSession(T0);
    const from = s.entries[0].exerciseId;
    const to = (await db.exercises.get(from))!.alternatives[0];
    await swapExercise(s.id!, from, to, true);
    const tpl = (await db.templates.get('pushA'))!.ids;
    expect(tpl[0]).toBe(to);
    expect(tpl).not.toContain(from);
  });
  it('always = false leaves the plan alone', async () => {
    const s = await startNextSession(T0);
    const from = s.entries[0].exerciseId;
    const to = (await db.exercises.get(from))!.alternatives[0];
    await swapExercise(s.id!, from, to);
    expect((await db.templates.get('pushA'))!.ids[0]).toBe(from);
  });
});
