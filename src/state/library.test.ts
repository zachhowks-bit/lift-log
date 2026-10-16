import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import {
  addCustomExercise, getExercise, getExercises, getTemplates, setAvoid, setIncrement, setTemplate, slotName,
} from './library';

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
    expect(slotName('pullB')).toBe('Pull B — Rows focus');
    expect(slotName('upperB')).toBe('Upper B (old plan)');
  });
});

describe('library editing', () => {
  it('setAvoid toggles avoid', async () => {
    await setAvoid('bench', true);
    expect((await getExercise('bench'))?.avoid).toBe(true);
    await setAvoid('bench', false);
    expect((await getExercise('bench'))?.avoid).toBe(false);
    await expect(setAvoid('nope', true)).rejects.toThrow('Exercise not found.');
  });

  it('setIncrement accepts 0 < inc <= 50 only', async () => {
    await setIncrement('bench', 1.25);
    expect((await getExercise('bench'))?.increment).toBe(1.25);
    await expect(setIncrement('bench', 0)).rejects.toThrow('Increment must be above 0.');
    await expect(setIncrement('bench', 51)).rejects.toThrow('Increment must be above 0.');
    await expect(setIncrement('bench', Number.NaN)).rejects.toThrow('Increment must be above 0.');
    expect((await getExercise('bench'))?.increment).toBe(1.25);
  });

  it('addCustomExercise builds the exercise and links same-muscle alternatives both ways', async () => {
    await setAvoid('dbBench', true);
    const ex = await addCustomExercise({
      name: ' Smith Bench! ', type: 'H', primary: 'chest', equipment: 'dumbbell', lower: false, kneeSensitive: true,
    });
    expect(ex).toMatchObject({
      id: 'custom-smith-bench', name: 'Smith Bench!', primary: ['chest'], secondary: [], increment: 2,
      lower: false, kneeSensitive: false, avoid: false,
    });
    expect(ex.alternatives).toEqual(expect.arrayContaining(['bench', 'inclineDbPress', 'machineChestPress']));
    expect(ex.alternatives).not.toContain('dbBench');
    expect((await getExercise('bench'))?.alternatives).toContain('custom-smith-bench');
    expect((await getExercise('dbBench'))?.alternatives).not.toContain('custom-smith-bench');

    const again = await addCustomExercise({
      name: 'smith bench', type: 'C', primary: 'quads', equipment: 'machine', lower: true, kneeSensitive: true,
    });
    expect(again).toMatchObject({ id: 'custom-smith-bench-2', increment: 2.5, kneeSensitive: true });
    expect((await addCustomExercise({
      name: 'Smith bench', type: 'I', primary: 'calves', equipment: 'cable', lower: false, kneeSensitive: false,
    })).id).toBe('custom-smith-bench-3');
    await expect(addCustomExercise({
      name: '  ', type: 'I', primary: 'calves', equipment: 'cable', lower: false, kneeSensitive: false,
    })).rejects.toThrow('Enter a name.');
  });

  it('setTemplate replaces a slot and rejects unknown or duplicate ids', async () => {
    await setTemplate('pushA', ['inclineDbPress', 'bench']);
    expect((await getTemplates()).pushA).toEqual(['inclineDbPress', 'bench']);
    await expect(setTemplate('pushA', ['bench', 'bench'])).rejects.toThrow('An exercise appears twice in this workout.');
    await expect(setTemplate('pushA', ['nope'])).rejects.toThrow('Exercise not found.');
    expect((await getTemplates()).pushA).toEqual(['inclineDbPress', 'bench']);
  });
});
