import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import {
  blockProgressPct, finishSession, getActiveSession, isCheckInDue, logSet, skipRest, startNextSession,
  submitCheckIn, swapExercise, validateSet,
} from './session';
import { restFor } from '../engine/rules';
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
    expect(validateSet(set({ weight: 0 }))).toBe('Enter a weight above 0.');
    expect(validateSet({ ...set(), weight: undefined })).toBe('Enter a weight above 0.');
    expect(validateSet(set({ weight: NaN }))).toBe('Enter a weight above 0.');
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
  });
});

describe('session flow', () => {
  it('start → log 3 sets → finish advances to lowerA', async () => {
    const s = await startNextSession(T0);
    expect(s.slot).toBe('upperA');
    expect(s.weekInBlock).toBe(1);
    const id = s.entries[0].exerciseId;
    for (let i = 0; i < 3; i++) await logSet(s.id!, id, set(), T0 + i * 1000);
    const res = await finishSession(s.id!, T0 + 10_000);
    expect(res.checkInDue).toBe(false);
    expect(await getActiveSession()).toBeNull();
    const state = await db.programState.get('main');
    expect(state?.nextSlotIndex).toBe(1);
    expect(state?.sessionsInBlock).toBe(1);
    expect((await startNextSession(T0 + DAY)).slot).toBe('lowerA');
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
    db.close();
    await db.open();
    const back = await getActiveSession();
    expect(back?.id).toBe(s.id);
    expect(back?.entries[0].sets).toHaveLength(2);
    expect(back?.restEndsAt).not.toBeNull();
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
    await expect(logSet(s.id!, id, set({ weight: 0 }), T0)).rejects.toThrow('Enter a weight above 0.');
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

  it('skipRest marks restSkipped and clears restEndsAt; no-op when no rest', async () => {
    const s = await startNextSession(T0);
    const id = s.entries[0].exerciseId;
    expect((await skipRest(s.id!, T0)).restEndsAt).toBeNull();
    await logSet(s.id!, id, set(), T0);
    const out = await skipRest(s.id!, T0 + 20_000);
    expect(out.restEndsAt).toBeNull();
    const last = out.entries[0].sets[0];
    expect(last.restSkipped).toBe(true);
    expect(last.restTakenSec).toBe(20);
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

  it('prescribes from history after a finished session', async () => {
    const first = await runSession(T0, { weight: 62.5 });
    const next = await startNextSession(T0 + 7 * DAY);
    expect(first.slot).toBe('upperA');
    expect(next.slot).toBe('lowerA');
    // upperA again after 4 sessions
    for (let i = 0; i < 3; i++) await runSession(T0 + (i + 8) * DAY);
    const again = await startNextSession(T0 + 20 * DAY);
    expect(again.slot).toBe('upperA');
    expect(again.weekInBlock).toBe(2);
    const e = again.entries.find((x) => x.exerciseId === first.entries[0].exerciseId)!;
    expect(e.prescription.needsCalibration).toBe(false);
    expect(e.prescription.weight).not.toBeNull();
  });

  it('ramps leg sets after 4 sessions with low knee pain', async () => {
    const before = await db.programState.get('main');
    for (let i = 0; i < 4; i++) await runSession(T0 + i * DAY, { kneePain: 1 });
    const after = await db.programState.get('main');
    expect(after?.sessionsInBlock).toBe(4);
    const [chosen] = Object.keys(after!.setsByExercise);
    expect(Object.keys(after!.setsByExercise)).toHaveLength(1);
    expect(after!.setsByExercise[chosen]).toBe(3);
    const ex = (await db.exercises.get(chosen))!;
    expect(ex.lower).toBe(true);
    for (const m of ex.primary) expect(after!.volumeTargets[m]).toBe(before!.volumeTargets[m] + 1);
  });

  it('does not ramp when knee pain was high', async () => {
    const before = await db.programState.get('main');
    for (let i = 0; i < 4; i++) await runSession(T0 + i * DAY, { kneePain: 5 });
    const after = await db.programState.get('main');
    expect(after?.volumeTargets).toEqual(before?.volumeTargets);
  });

  it('20 finished sessions → checkInDue, and submitCheckIn resets block', async () => {
    let due = false;
    for (let i = 0; i < 20; i++) {
      const s = await startNextSession(T0 + i * DAY);
      await logSet(s.id!, s.entries[0].exerciseId, set({ weight: 60 + i }), T0 + i * DAY + 1);
      due = (await finishSession(s.id!, T0 + i * DAY + 5000)).checkInDue;
      expect(due).toBe(i === 19);
    }
    expect(await isCheckInDue()).toBe(true);
    expect(await blockProgressPct()).toBeGreaterThan(0);
    const changes = await submitCheckIn(
      { recovery: 'sometimes', knee: 'worse', swapIds: [], motivation: 'ok' }, T0 + 30 * DAY,
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
    expect(ci[0].at).toBe(T0 + 30 * DAY);
    expect(await isCheckInDue()).toBe(false);
  });
});
