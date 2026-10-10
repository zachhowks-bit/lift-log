import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import { getExercise, getExercises, slotName } from './library';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('library helpers', () => {
  it('returns exercises keyed by id and single lookups', async () => {
    const all = await getExercises();
    expect(all.bench.name).toBe('Barbell bench press');
    expect((await getExercise('legPress'))?.lower).toBe(true);
    expect(await getExercise('nope')).toBeNull();
  });

  it('names slots', () => {
    expect(slotName('upperB')).toBe('Upper B — Pull');
  });
});
