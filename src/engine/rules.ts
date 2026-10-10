import type { Exercise, SetLog } from '../types';

export interface Defaults { repMin: number; repMax: number; sets: number; restSec: number }

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

export function restFor(ex: Exercise, last: SetLog): number {
  return defaultsFor(ex).restSec + (effectiveRir(last) === 0 ? 30 : 0);
}
