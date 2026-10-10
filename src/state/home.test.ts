import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import { getHomeInfo } from './home';
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

describe('getHomeInfo', () => {
  it('shows the first slot, week label and no banners on a fresh install', async () => {
    const i = await getHomeInfo(T0);
    expect(i).toMatchObject({
      slot: 'upperA', slotName: 'Upper A — Push', blockNumber: 1, week: 1, targetRir: '3 reps left',
      activeSessionId: null, lastSession: null, backupOverdue: false, kneeWarning: false, checkInDue: false,
    });
  });

  it('reports the active session for Resume', async () => {
    const s = await startNextSession(T0);
    const i = await getHomeInfo(T0 + 1000);
    expect(i.activeSessionId).toBe(s.id);
    expect(i.slot).toBe('upperA');
  });

  it('summarises the last finished session and moves to the next slot', async () => {
    const s = await startNextSession(T0);
    await logSet(s.id!, s.entries[0].exerciseId, set(), T0 + 1);
    await logSet(s.id!, s.entries[0].exerciseId, set(), T0 + 2);
    await logSet(s.id!, s.entries[1].exerciseId, set(), T0 + 3);
    await finishSession(s.id!, T0 + 3_600_000);
    const i = await getHomeInfo(T0 + DAY);
    expect(i.slotName).toBe('Lower A — Quads & Glutes');
    expect(i.lastSession).toEqual({ date: T0, slotName: 'Upper A — Push', sets: 3, exercises: 2 });
    expect(i.backupOverdue).toBe(true);
  });

  it('flags knee warning from a "worse" check-in and check-in due', async () => {
    await db.checkIns.add({
      recovery: 'sometimes', knee: 'worse', swapIds: [], motivation: 'ok', blockNumber: 1, at: T0,
      pctProgressed: 0, changes: [],
    });
    const st = (await db.programState.get('main'))!;
    await db.programState.put({ ...st, sessionsInBlock: 20 });
    const i = await getHomeInfo(T0);
    expect(i.kneeWarning).toBe(true);
    expect(i.checkInDue).toBe(true);
    expect(i.week).toBe(5);
    expect(i.targetRir).toBe('Deload: easy, 3+ left');
  });

  it('flags knee warning when knee pain rises across sessions', async () => {
    for (const [n, pain] of [[0, 1], [1, 3], [2, 5]] as const) {
      const s = await startNextSession(T0 + n * DAY);
      await logSet(s.id!, s.entries[0].exerciseId, set({ kneePain: pain }), T0 + n * DAY + 1);
      await finishSession(s.id!, T0 + n * DAY + 2);
    }
    expect((await getHomeInfo(T0 + 3 * DAY)).kneeWarning).toBe(true);
  });
});
