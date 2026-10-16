import { db } from '../db/db';
import { IMPORTED_SLOTS } from '../data/library';
import { defaultsFor, isWorking } from '../engine/rules';
import type { Exercise, ExerciseEntry, ImportedSlotId, Session, SetLog } from '../types';
import { validateSet } from './session';

/**
 * Adds finished workouts from a "lift-log-import" file (e.g. history copied from Hevy) next to the
 * workouts already in the app. Nothing is replaced, the plan's position doesn't move, and a workout
 * already present (same start time) is skipped, so the same file can be imported twice safely.
 *
 * File: { format: 'lift-log-import', version: 1, sessions: [{ start, minutes, type: 'push'|'pull'|'legs',
 *   exercises: [{ id, sets: [[kg, reps] | [kg, reps, 'W'|'D'|'F']] }] }] }
 *
 * Hevy doesn't record reps left, so: a failure set ('F') or a set 3+ reps under the exercise's rep range
 * = 0 left (a clear miss); any other working set = 1 left. A set just 1–2 reps short is not treated as a miss.
 */

const NOT_VALID = 'This file is not a workout file.';
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

export type ImportResult = { ok: true; added: number; skipped: number } | { ok: false; error: string };

function toSet(raw: unknown, ex: Exercise): SetLog | string {
  if (!Array.isArray(raw) || raw.length < 2) return NOT_VALID;
  const [weight, reps, tag] = raw as [unknown, unknown, unknown];
  if (typeof weight !== 'number' || typeof reps !== 'number') return NOT_VALID;
  if (tag !== undefined && tag !== 'W' && tag !== 'D' && tag !== 'F') return NOT_VALID;
  const set: SetLog = {
    weight, fullReps: reps, partialReps: 0, rir: 1, restTakenSec: null, restSkipped: false, kneePain: null,
  };
  if (tag === 'W') { set.kind = 'warmup'; set.rir = 3; }
  if (tag === 'D') { set.kind = 'drop'; set.rir = 0; }
  if (tag === 'F' || (tag === undefined && reps < defaultsFor(ex).repMin - 2)) set.rir = 0;
  return validateSet(set) ? `${ex.name}: ${validateSet(set)}` : set;
}

export async function importWorkouts(json: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: NOT_VALID };
  }
  if (!isObj(parsed) || parsed.format !== 'lift-log-import' || parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
    return { ok: false, error: NOT_VALID };
  }

  const lib: Record<string, Exercise> = {};
  for (const e of await db.exercises.toArray()) lib[e.id] = e;

  // Build everything first; write only if the whole file is valid.
  const built: Session[] = [];
  for (const raw of parsed.sessions) {
    if (!isObj(raw) || typeof raw.start !== 'string' || !Array.isArray(raw.exercises)) return { ok: false, error: NOT_VALID };
    const startedAt = Date.parse(raw.start);
    const minutes = typeof raw.minutes === 'number' && raw.minutes > 0 ? raw.minutes : 60;
    const slot = raw.type as ImportedSlotId;
    if (!Number.isFinite(startedAt) || !IMPORTED_SLOTS.includes(slot)) return { ok: false, error: NOT_VALID };
    const entries: ExerciseEntry[] = [];
    for (const e of raw.exercises) {
      if (!isObj(e) || typeof e.id !== 'string' || !Array.isArray(e.sets)) return { ok: false, error: NOT_VALID };
      const ex = lib[e.id];
      if (!ex) return { ok: false, error: `Unknown exercise "${e.id}".` };
      if (e.sets.length === 0) continue; // left out on purpose (e.g. a typo or knee-limited sets)
      const sets: SetLog[] = [];
      for (const s of e.sets) {
        const r = toSet(s, ex);
        if (typeof r === 'string') return { ok: false, error: r };
        sets.push(r);
      }
      const work = sets.filter(isWorking);
      const d = defaultsFor(ex);
      entries.push({
        exerciseId: ex.id, doneOutOfOrder: false, isDeload: false, sets,
        prescription: {
          exerciseId: ex.id, weight: work.length ? Math.max(...work.map((s) => s.weight)) : null,
          sets: Math.max(1, work.length), repMin: d.repMin, repMax: d.repMax, targetReps: [], restSec: d.restSec,
          targetRir: '', why: 'Imported', needsCalibration: false, suggestSwap: false,
        },
      });
    }
    if (entries.length === 0) continue;
    built.push({
      slot, startedAt, finishedAt: startedAt + minutes * 60_000, blockNumber: 0, weekInBlock: 0,
      entries, restEndsAt: null, lastLoggedExerciseId: null,
    });
  }

  return db.transaction('rw', db.sessions, async () => {
    const have = new Set((await db.sessions.toArray()).map((s) => s.startedAt));
    let added = 0;
    let skipped = 0;
    for (const s of built) {
      if (have.has(s.startedAt)) { skipped++; continue; }
      await db.sessions.add(s);
      have.add(s.startedAt);
      added++;
    }
    return { ok: true as const, added, skipped };
  });
}
