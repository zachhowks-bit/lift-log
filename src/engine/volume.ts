import type { Exercise, Muscle, ProgramState, Session } from '../types';
import { defaultsFor, isWorking } from './rules';

export const ALL_MUSCLES: Muscle[] = ['chest', 'frontDelt', 'sideDelt', 'rearDelt', 'triceps', 'biceps',
  'lats', 'midBack', 'lowerBack', 'quads', 'glutes', 'gluteMed', 'hamstrings', 'calves', 'abs'];

export const MAX_TARGET = 20;

export function currentSets(state: ProgramState, id: string, lib: Record<string, Exercise>): number {
  return state.setsByExercise[id] ?? defaultsFor(lib[id]).sets;
}

export function weeklySets(sessions: Session[], lib: Record<string, Exercise>): Record<Muscle, number> {
  const out = {} as Record<Muscle, number>;
  for (const m of ALL_MUSCLES) out[m] = 0;
  for (const s of sessions) {
    for (const e of s.entries) {
      const ex = lib[e.exerciseId];
      if (!ex) continue;
      const n = e.sets.filter(isWorking).length;
      for (const m of ex.primary) out[m] += n;
      for (const m of ex.secondary) out[m] += n * 0.5;
    }
  }
  return out;
}

export function rampLegSets(
  state: ProgramState, weekKneeMax: number | null, poorRecovery: boolean,
  lib: Record<string, Exercise>, lowerIds: string[],
): { state: ProgramState; change: string | null } {
  if ((weekKneeMax !== null && weekKneeMax > 3) || poorRecovery) return { state, change: null };
  const candidates = lowerIds.filter(id => lib[id] && !lib[id].avoid);
  const nonK = candidates.filter(id => !lib[id].kneeSensitive);
  const pool = nonK.length > 0 ? nonK : candidates;
  if (pool.length === 0) return { state, change: null };
  let chosen = pool[0];
  for (const id of pool) {
    if (currentSets(state, id, lib) < currentSets(state, chosen, lib)) chosen = id;
  }
  const ex = lib[chosen];
  if (ex.primary.some(m => state.volumeTargets[m] + 1 > MAX_TARGET)) return { state, change: null };
  const volumeTargets = { ...state.volumeTargets };
  for (const m of ex.primary) volumeTargets[m] += 1;
  return {
    state: {
      ...state, volumeTargets,
      setsByExercise: { ...state.setsByExercise, [chosen]: currentSets(state, chosen, lib) + 1 },
    },
    change: `Legs: +1 set on ${ex.name}`,
  };
}
