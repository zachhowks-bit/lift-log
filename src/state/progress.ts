import { db } from '../db/db';
import { weekInBlock } from '../engine/block';
import { kneeRising } from '../engine/knee';
import { ALL_MUSCLES, weeklySets } from '../engine/volume';
import type { Exercise, Muscle, Session } from '../types';

const DAY_MS = 86_400_000;

async function finishedAsc(): Promise<Session[]> {
  const all = await db.sessions.toArray();
  return all.filter((s) => s.finishedAt !== null).sort((a, b) => a.startedAt - b.startedAt);
}

export async function exerciseHistory(id: string): Promise<{ date: number; topWeight: number; e1rm: number }[]> {
  const out: { date: number; topWeight: number; e1rm: number }[] = [];
  for (const s of await finishedAsc()) {
    const e = s.entries.find((x) => x.exerciseId === id);
    if (!e || e.sets.length === 0) continue;
    const topWeight = Math.max(...e.sets.map((x) => x.weight));
    const e1rm = Math.max(...e.sets.map((x) => x.weight * (1 + x.fullReps / 30)));
    out.push({ date: s.startedAt, topWeight, e1rm: Math.round(e1rm * 10) / 10 });
  }
  return out;
}

export async function currentWeekSets(): Promise<{ muscle: Muscle; done: number; target: number }[]> {
  const state = await db.programState.get('main');
  if (!state) throw new Error('Program state is missing.');
  const week = weekInBlock(state.sessionsInBlock);
  const lib: Record<string, Exercise> = {};
  for (const ex of await db.exercises.toArray()) lib[ex.id] = ex;
  const sessions = (await db.sessions.toArray())
    .filter((s) => s.blockNumber === state.blockNumber && s.weekInBlock === week);
  const done = weeklySets(sessions, lib);
  return ALL_MUSCLES.map((muscle) => ({ muscle, done: done[muscle], target: state.volumeTargets[muscle] }));
}

export async function kneeTrend(): Promise<{ date: number; max: number }[]> {
  const out: { date: number; max: number }[] = [];
  for (const s of await finishedAsc()) {
    const pains = s.entries.flatMap((e) => e.sets.map((x) => x.kneePain)).filter((x): x is number => x !== null);
    if (pains.length) out.push({ date: s.startedAt, max: Math.max(...pains) });
  }
  return out;
}

export async function kneeRisingNow(): Promise<boolean> {
  const maxes = (await kneeTrend()).map((k) => k.max).reverse();
  return kneeRising(maxes);
}

export async function backupOverdue(now: number): Promise<boolean> {
  const last = (await db.settings.get('main'))?.lastBackupAt ?? null;
  if (last === null) return (await finishedAsc()).length >= 1;
  return now - last > 7 * DAY_MS;
}
