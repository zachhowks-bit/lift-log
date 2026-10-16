import type { Exercise, ExerciseEntry, SetLog } from '../types';

export interface Defaults { repMin: number; repMax: number; sets: number; restSec: number }

export const WARMUP_REST_SEC = 60;

export function defaultsFor(ex: Exercise): Defaults {
  const byType = {
    H: { repMin: 6, repMax: 10, restSec: 180 },
    C: { repMin: 8, repMax: 12, restSec: 120 },
    I: { repMin: 10, repMax: 15, restSec: 90 },
  }[ex.type];
  const reps = ex.kneeSensitive ? { repMin: 10, repMax: 15 } : byType;
  return { repMin: reps.repMin, repMax: reps.repMax, sets: ex.lower ? 2 : 3, restSec: byType.restSec };
}

export function effectiveRir(s: SetLog): number {
  return s.partialReps > 0 ? 0 : s.rir;
}

/** A normal working set (not a warm-up or drop set). */
export function isWorking(s: SetLog): boolean {
  return s.kind === undefined;
}

/** The entry with only its working sets: what progression, stalls and volume read. */
export function workingOnly(e: ExerciseEntry): ExerciseEntry {
  return e.sets.every(isWorking) ? e : { ...e, sets: e.sets.filter(isWorking) };
}

export function restFor(ex: Exercise, last: SetLog): number {
  if (last.kind === 'warmup') return WARMUP_REST_SEC;
  return defaultsFor(ex).restSec + (effectiveRir(last) === 0 ? 30 : 0);
}
