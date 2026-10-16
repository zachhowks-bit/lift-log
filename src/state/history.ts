import { db } from '../db/db';
import { SLOT_NAMES, SLOT_SHORT } from '../data/library';
import { isWorking } from '../engine/rules';
import type { Exercise, Session, SessionSlot, SetLog } from '../types';

const DAY_MS = 86_400_000;

/** Epley estimate of a one-rep max from a working set (full reps only). */
export const e1rmOf = (s: SetLog): number => s.weight * (1 + s.fullReps / 30);
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface PR {
  sessionId: number;
  date: number;
  exerciseId: string;
  name: string;
  /** 'weight': heaviest working set ever. 'e1rm': best estimated 1-rep max ever. */
  kind: 'weight' | 'e1rm';
  value: number;
  previous: number;
  /** Index into the entry's sets of the set that set the record. */
  setIndex: number;
  /** e.g. "62.5 kg × 10" */
  setText: string;
}

export interface WorkoutSummary {
  id: number;
  slot: SessionSlot;
  slotName: string;
  slotShort: string;
  date: number;
  durationMin: number | null;
  exercises: number;
  sets: number;
  volumeKg: number;
  prs: PR[];
}

async function finishedAsc(): Promise<Session[]> {
  return (await db.sessions.toArray()).filter((s) => s.finishedAt !== null).sort((a, b) => a.startedAt - b.startedAt);
}

async function nameMap(): Promise<Record<string, Exercise>> {
  const out: Record<string, Exercise> = {};
  for (const e of await db.exercises.toArray()) out[e.id] = e;
  return out;
}

const setText = (s: SetLog) => `${s.weight} kg × ${s.fullReps}`;

/**
 * Walks finished workouts oldest → newest and records personal records. An exercise's first
 * ever workout sets the baseline and is not counted as a PR.
 */
export function computePRs(sessionsAsc: Session[], lib: Record<string, Exercise>): Map<number, PR[]> {
  const bestW = new Map<string, number>();
  const bestE = new Map<string, number>();
  const out = new Map<number, PR[]>();
  for (const s of sessionsAsc) {
    const list: PR[] = [];
    for (const e of s.entries) {
      const work = e.sets.map((x, i) => ({ x, i })).filter(({ x }) => isWorking(x));
      if (work.length === 0) continue;
      const top = work.reduce((a, b) => (b.x.weight > a.x.weight ? b : a));
      const best = work.reduce((a, b) => (e1rmOf(b.x) > e1rmOf(a.x) ? b : a));
      const pw = bestW.get(e.exerciseId);
      const pe = bestE.get(e.exerciseId);
      const name = lib[e.exerciseId]?.name ?? e.exerciseId;
      const base = { sessionId: s.id!, date: s.startedAt, exerciseId: e.exerciseId, name };
      if (pw !== undefined && top.x.weight > pw + 1e-9) {
        list.push({ ...base, kind: 'weight', value: top.x.weight, previous: pw, setIndex: top.i, setText: setText(top.x) });
      } else if (pe !== undefined && e1rmOf(best.x) > pe + 0.05) {
        list.push({ ...base, kind: 'e1rm', value: r1(e1rmOf(best.x)), previous: r1(pe), setIndex: best.i, setText: setText(best.x) });
      }
      bestW.set(e.exerciseId, Math.max(pw ?? 0, top.x.weight));
      bestE.set(e.exerciseId, Math.max(pe ?? 0, e1rmOf(best.x)));
    }
    if (s.id !== undefined) out.set(s.id, list);
  }
  return out;
}

function summarize(s: Session, prs: PR[]): WorkoutSummary {
  let sets = 0;
  let volume = 0;
  let exercises = 0;
  for (const e of s.entries) {
    if (e.sets.length > 0) exercises++;
    for (const x of e.sets) {
      if (x.kind === 'warmup') continue;
      if (isWorking(x)) sets++;
      volume += x.weight * x.fullReps;
    }
  }
  const dur = s.finishedAt !== null ? Math.round((s.finishedAt - s.startedAt) / 60_000) : null;
  return {
    id: s.id!, slot: s.slot, slotName: SLOT_NAMES[s.slot] ?? s.slot, slotShort: SLOT_SHORT[s.slot] ?? s.slot,
    date: s.startedAt, durationMin: dur !== null && dur > 0 && dur < 600 ? dur : null,
    exercises, sets, volumeKg: Math.round(volume), prs,
  };
}

/** All finished workouts, newest first. */
export async function listWorkouts(limit?: number): Promise<WorkoutSummary[]> {
  const asc = await finishedAsc();
  const prs = computePRs(asc, await nameMap());
  const out = asc.reverse().map((s) => summarize(s, prs.get(s.id!) ?? []));
  return limit === undefined ? out : out.slice(0, limit);
}

export interface WorkoutDetail {
  session: Session;
  summary: WorkoutSummary;
  names: Record<string, string>;
  lib: Record<string, Exercise>;
}

export async function workoutDetail(id: number): Promise<WorkoutDetail | null> {
  const session = await db.sessions.get(id);
  if (!session || session.finishedAt === null) return null;
  const lib = await nameMap();
  const prs = computePRs(await finishedAsc(), lib);
  const names: Record<string, string> = {};
  for (const e of session.entries) names[e.exerciseId] = lib[e.exerciseId]?.name ?? e.exerciseId;
  return { session, summary: summarize(session, prs.get(id) ?? []), names, lib };
}

// ---- Progress stats

export interface Highlights {
  totalWorkouts: number;
  thisMonth: number;
  /** Weeks in a row (Mon–Sun) with 3+ workouts, counting this week only once it has 3. */
  weekStreak: number;
  thisWeek: { workouts: number; sets: number; volumeKg: number };
  lastWeek: { workouts: number; sets: number; volumeKg: number };
  recentPRs: PR[];
  /** Last 12 weeks, oldest first: workouts per week (Mon–Sun). */
  weeks: { start: number; count: number }[];
  gains: { exerciseId: string; name: string; from: number; to: number; pct: number; series: number[] }[];
}

/** Monday 00:00 local time of the week containing `t`. */
export function weekStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export async function highlights(now: number): Promise<Highlights> {
  const asc = await finishedAsc();
  const lib = await nameMap();
  const prMap = computePRs(asc, lib);
  const sums = asc.map((s) => summarize(s, prMap.get(s.id!) ?? []));

  const thisWk = weekStart(now);
  const lastWk = weekStart(thisWk - DAY_MS);
  const agg = (from: number, to: number) => {
    const xs = sums.filter((x) => x.date >= from && x.date < to);
    return { workouts: xs.length, sets: xs.reduce((n, x) => n + x.sets, 0), volumeKg: xs.reduce((n, x) => n + x.volumeKg, 0) };
  };

  const perWeek = new Map<number, number>();
  for (const x of sums) perWeek.set(weekStart(x.date), (perWeek.get(weekStart(x.date)) ?? 0) + 1);
  let streak = 0;
  let wk = (perWeek.get(thisWk) ?? 0) >= 3 ? thisWk : lastWk;
  while ((perWeek.get(wk) ?? 0) >= 3) {
    streak++;
    wk = weekStart(wk - DAY_MS);
  }

  const weeks: { start: number; count: number }[] = [];
  let w = thisWk;
  for (let i = 0; i < 12; i++) {
    weeks.unshift({ start: w, count: perWeek.get(w) ?? 0 });
    w = weekStart(w - DAY_MS);
  }

  const month = new Date(now);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).getTime();

  const recentPRs = [...prMap.values()].flat()
    .filter((p) => now - p.date <= 30 * DAY_MS)
    .sort((a, b) => b.date - a.date)
    .slice(0, 8);

  const series = new Map<string, number[]>();
  for (const s of asc) {
    for (const e of s.entries) {
      const work = e.sets.filter(isWorking);
      if (work.length === 0) continue;
      const best = Math.max(...work.map(e1rmOf));
      series.set(e.exerciseId, [...(series.get(e.exerciseId) ?? []), r1(best)]);
    }
  }
  const gains = [...series.entries()]
    .filter(([, v]) => v.length >= 2)
    .map(([id, v]) => {
      const from = v[0];
      const to = Math.max(...v.slice(1));
      return { exerciseId: id, name: lib[id]?.name ?? id, from, to, pct: Math.round(((to - from) / from) * 100), series: v };
    })
    .filter((g) => g.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  return {
    totalWorkouts: sums.length,
    thisMonth: sums.filter((x) => x.date >= monthStart).length,
    weekStreak: streak,
    thisWeek: agg(thisWk, thisWk + 7 * DAY_MS),
    lastWeek: agg(lastWk, thisWk),
    recentPRs,
    weeks,
    gains,
  };
}
