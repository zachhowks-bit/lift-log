import type { Exercise, ExerciseEntry, Prescription } from '../types';

export const bench: Exercise = { id: 'bench', name: 'Bench', type: 'H', primary: ['chest'], secondary: [],
  equipment: 'barbell', increment: 2.5, lower: false, kneeSensitive: false, alternatives: [], avoid: false };
export const legPress: Exercise = { id: 'lp', name: 'Leg press', type: 'C', primary: ['quads'], secondary: [],
  equipment: 'machine', increment: 5, lower: true, kneeSensitive: true, alternatives: [], avoid: false };
export const dbCurl: Exercise = { id: 'curl', name: 'DB curl', type: 'I', primary: ['biceps'], secondary: [],
  equipment: 'dumbbell', increment: 2, lower: false, kneeSensitive: false, alternatives: [], avoid: false };

export interface EntryOpts { partial?: number[]; knee?: number | null; skip?: boolean; ooo?: boolean; deload?: boolean; repMin?: number }

export function entry(weight: number, reps: number[], rir: number[], o: EntryOpts = {}): ExerciseEntry {
  const prescription = { exerciseId: 'x', weight, sets: reps.length, repMin: o.repMin ?? 6, repMax: 10,
    targetReps: reps, restSec: 180, targetRir: '', why: '', needsCalibration: false, suggestSwap: false } as Prescription;
  return { exerciseId: 'x', prescription, doneOutOfOrder: !!o.ooo, isDeload: !!o.deload,
    sets: reps.map((r, i) => ({ weight, fullReps: r, partialReps: o.partial?.[i] ?? 0, rir: rir[i],
      restTakenSec: 120, restSkipped: !!o.skip, kneePain: o.knee ?? null })) };
}
