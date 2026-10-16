import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import { highlights, listWorkouts, weekStart, workoutDetail } from './history';
import { finishSession, logSet, startNextSession } from './session';
import type { SetLog } from '../types';

const set = (o: Partial<SetLog> = {}): SetLog => ({
  weight: 60, fullReps: 8, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null, ...o,
});
const DAY = 86_400_000;
const T0 = new Date(2026, 9, 5, 18, 0).getTime(); // Mon 5 Oct 2026, 6pm local

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

async function workout(at: number, weight: number, reps = 8, extra: Partial<SetLog>[] = []) {
  const s = await startNextSession(at);
  const id = s.entries[0].exerciseId;
  await logSet(s.id!, id, set({ weight, fullReps: reps }), at + 1);
  for (const x of extra) await logSet(s.id!, id, set(x), at + 2);
  await finishSession(s.id!, at + 45 * 60_000);
  return { id: s.id!, exerciseId: id };
}

describe('listWorkouts', () => {
  it('lists every finished workout newest first with sets, volume and duration', async () => {
    const a = await workout(T0, 60, 8, [{ kind: 'warmup', weight: 20, fullReps: 10 }, { kind: 'drop', weight: 40, fullReps: 6 }]);
    const b = await workout(T0 + DAY, 50);
    const open = await startNextSession(T0 + 2 * DAY);
    const list = await listWorkouts();
    expect(list.map((w) => w.id)).toEqual([b.id, a.id]);
    expect(list.map((w) => w.id)).not.toContain(open.id);
    const first = list[1];
    expect(first.sets).toBe(1); // warm-up and drop are not working sets
    expect(first.volumeKg).toBe(60 * 8 + 40 * 6); // warm-up excluded from volume
    expect(first.durationMin).toBe(45);
    expect(first.slotShort).toBe('Push A');
    expect(await listWorkouts(1)).toHaveLength(1);
  });
});

describe('PRs', () => {
  it('first time is a baseline; heavier is a weight PR; more reps is an e1RM PR', async () => {
    const one = await workout(T0, 60, 8);
    for (let i = 1; i <= 5; i++) await workout(T0 + i * DAY, 10);
    const two = await workout(T0 + 6 * DAY, 62.5, 8);
    for (let i = 7; i <= 11; i++) await workout(T0 + i * DAY, 10);
    const three = await workout(T0 + 12 * DAY, 62.5, 10);
    const list = await listWorkouts();
    const prs = (id: number) => list.find((w) => w.id === id)!.prs;
    expect(prs(one.id)).toEqual([]);
    expect(prs(two.id)).toEqual([expect.objectContaining({ kind: 'weight', value: 62.5, previous: 60, setText: '62.5 kg × 8' })]);
    expect(prs(three.id)).toEqual([expect.objectContaining({ kind: 'e1rm', setText: '62.5 kg × 10' })]);
    const d = await workoutDetail(three.id);
    expect(d!.summary.prs).toHaveLength(1);
    expect(d!.names[three.exerciseId]).toBeTruthy();
  });
});

describe('highlights', () => {
  it('week streak counts weeks with 3+ workouts; gains and this week vs last', async () => {
    // Last week (Mon 28 Sep): 3 workouts. This week: 2 so far.
    const lastMon = weekStart(T0) - 7 * DAY;
    for (let i = 0; i < 3; i++) await workout(lastMon + i * DAY + 3_600_000, 50 + i);
    await workout(T0, 55);
    await workout(T0 + DAY, 40);
    const h = await highlights(T0 + DAY + 3_600_000);
    expect(h.totalWorkouts).toBe(5);
    expect(h.weekStreak).toBe(1);
    expect(h.thisWeek.workouts).toBe(2);
    expect(h.lastWeek.workouts).toBe(3);
    expect(h.gains).toEqual([]); // no exercise repeated yet
    expect(h.weeks).toHaveLength(12);
    expect(h.weeks.slice(-2).map((x) => x.count)).toEqual([3, 2]);
  });
  it('gains compare the first workout of an exercise with its best since', async () => {
    const first = await workout(T0, 50);
    for (let i = 1; i <= 5; i++) await workout(T0 + i * DAY, 10);
    await workout(T0 + 6 * DAY, 55);
    const h = await highlights(T0 + 7 * DAY);
    const g = h.gains.find((x) => x.exerciseId === first.exerciseId)!;
    expect(g.pct).toBe(10);
    expect(g.series).toHaveLength(2);
    expect(h.recentPRs[0]).toMatchObject({ exerciseId: first.exerciseId, kind: 'weight', value: 55 });
  });
  it('weekStart is Monday 00:00', () => {
    const d = new Date(weekStart(new Date(2026, 9, 11, 15).getTime())); // Sunday
    expect([d.getDay(), d.getDate(), d.getHours()]).toEqual([1, 5, 0]);
  });
});
