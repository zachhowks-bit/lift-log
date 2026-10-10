import { db } from '../db/db';
import { SLOT_NAMES } from '../data/library';
import type { Exercise, SlotId } from '../types';

export async function getExercises(): Promise<Record<string, Exercise>> {
  const out: Record<string, Exercise> = {};
  for (const ex of await db.exercises.toArray()) out[ex.id] = ex;
  return out;
}

export async function getExercise(id: string): Promise<Exercise | null> {
  return (await db.exercises.get(id)) ?? null;
}

export function slotName(slot: SlotId): string {
  return SLOT_NAMES[slot];
}
