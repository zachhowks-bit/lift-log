import { db } from '../db/db';
import { SLOT_NAMES, SLOT_ORDER } from '../data/library';
import type { Exercise, ExType, Muscle, SessionSlot, SlotId } from '../types';

export async function getExercises(): Promise<Record<string, Exercise>> {
  const out: Record<string, Exercise> = {};
  for (const ex of await db.exercises.toArray()) out[ex.id] = ex;
  return out;
}

export async function getExercise(id: string): Promise<Exercise | null> {
  return (await db.exercises.get(id)) ?? null;
}

export function slotName(slot: SessionSlot): string {
  return SLOT_NAMES[slot] ?? slot;
}

export async function getTemplates(): Promise<Record<SlotId, string[]>> {
  const out = {} as Record<SlotId, string[]>;
  for (const slot of SLOT_ORDER) out[slot] = [...((await db.templates.get(slot))?.ids ?? [])];
  return out;
}

export async function setAvoid(id: string, avoid: boolean): Promise<void> {
  const n = await db.exercises.update(id, { avoid });
  if (n === 0 && !(await db.exercises.get(id))) throw new Error('Exercise not found.');
}

export const INCREMENT_ERROR = 'Increment must be above 0.';

export function validateIncrement(inc: number): string | null {
  return Number.isFinite(inc) && inc > 0 && inc <= 50 ? null : INCREMENT_ERROR;
}

export async function setIncrement(id: string, increment: number): Promise<void> {
  const err = validateIncrement(increment);
  if (err) throw new Error(err);
  const n = await db.exercises.update(id, { increment });
  if (n === 0 && !(await db.exercises.get(id))) throw new Error('Exercise not found.');
}

export interface NewExercise {
  name: string;
  type: ExType;
  primary: Muscle;
  equipment: Exercise['equipment'];
  lower: boolean;
  kneeSensitive: boolean;
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Adds a custom exercise and links it both ways with same-muscle exercises so it shows in swap lists. */
export async function addCustomExercise(input: NewExercise): Promise<Exercise> {
  const name = input.name.trim();
  if (!name) throw new Error('Enter a name.');
  return db.transaction('rw', db.exercises, async () => {
    const all = await db.exercises.toArray();
    const taken = new Set(all.map((e) => e.id));
    const base = `custom-${slug(name) || 'exercise'}`;
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    const peers = all.filter((e) => !e.avoid && e.primary.includes(input.primary));
    const ex: Exercise = {
      id, name, type: input.type, primary: [input.primary], secondary: [], equipment: input.equipment,
      increment: input.lower ? 2.5 : input.equipment === 'dumbbell' ? 2 : 2.5,
      lower: input.lower, kneeSensitive: input.lower && input.kneeSensitive,
      alternatives: peers.map((e) => e.id), avoid: false,
    };
    await db.exercises.add(ex);
    await db.exercises.bulkPut(peers.map((e) => ({ ...e, alternatives: [...e.alternatives, id] })));
    return ex;
  });
}

export async function setTemplate(slot: SlotId, ids: string[]): Promise<void> {
  if (!SLOT_ORDER.includes(slot)) throw new Error('Unknown workout.');
  if (new Set(ids).size !== ids.length) throw new Error('An exercise appears twice in this workout.');
  await db.transaction('rw', [db.exercises, db.templates], async () => {
    const found = await db.exercises.bulkGet(ids);
    if (found.some((e) => !e)) throw new Error('Exercise not found.');
    await db.templates.put({ slot, ids: [...ids] });
  });
}

/** Workout slots in rotation order. */
export const SLOTS: readonly SlotId[] = SLOT_ORDER;
