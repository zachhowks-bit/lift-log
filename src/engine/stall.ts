import type { ExerciseEntry } from '../types';

export function topWeight(e: ExerciseEntry): number {
  return e.sets.reduce((m, s) => Math.max(m, s.weight), 0);
}

function totalReps(e: ExerciseEntry): number {
  return e.sets.reduce((n, s) => n + s.fullReps, 0);
}

export function isValidExposure(entry: ExerciseEntry): boolean {
  if (entry.sets.some((s) => s.restSkipped)) return false;
  if (entry.doneOutOfOrder && entry.sets.some((s) => s.fullReps < entry.prescription.repMin)) return false;
  return true;
}

/** True if `a` (newer) improved on `b` (older). */
function improved(a: ExerciseEntry, b: ExerciseEntry): boolean {
  const wa = topWeight(a);
  const wb = topWeight(b);
  return wa > wb || (wa === wb && totalReps(a) > totalReps(b));
}

/** validHistory newest first. */
export function isStalled(validHistory: ExerciseEntry[]): boolean {
  if (validHistory.length < 4) return false;
  for (let i = 0; i < 3; i++) {
    if (improved(validHistory[i], validHistory[i + 1])) return false;
  }
  return true;
}

