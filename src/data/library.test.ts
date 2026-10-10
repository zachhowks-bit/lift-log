import { describe, it, expect } from 'vitest';
import { EXERCISES, EXERCISE_BY_ID, TEMPLATES, SLOT_ORDER, SLOT_NAMES, initialProgramState } from './library';

const tmplIds = [...new Set(Object.values(TEMPLATES).flat())];

describe('library', () => {
  it('ids unique', () => {
    expect(new Set(EXERCISES.map(e => e.id)).size).toBe(EXERCISES.length);
    expect(Object.keys(EXERCISE_BY_ID)).toHaveLength(EXERCISES.length);
  });
  it('slots and names', () => {
    expect(SLOT_ORDER).toEqual(['upperA', 'lowerA', 'upperB', 'lowerB']);
    expect(SLOT_NAMES.lowerB).toBe('Lower B — Hamstrings & Glutes');
    expect(TEMPLATES.upperA).toHaveLength(6);
    expect(TEMPLATES.lowerA).toHaveLength(5);
  });
  it('every template id exists', () => {
    for (const id of tmplIds) expect(EXERCISE_BY_ID[id], id).toBeDefined();
  });
  it('alternatives exist, share a primary muscle, not avoid', () => {
    for (const e of EXERCISES) for (const a of e.alternatives) {
      const alt = EXERCISE_BY_ID[a];
      expect(alt, `${e.id}->${a}`).toBeDefined();
      expect(alt.avoid).toBe(false);
      expect(alt.primary.some(m => e.primary.includes(m)), `${e.id}->${a}`).toBe(true);
    }
  });
  it('template exercises have >=2 alternatives', () => {
    for (const id of tmplIds) expect(EXERCISE_BY_ID[id].alternatives.length, id).toBeGreaterThanOrEqual(2);
  });
  it('kneeSensitive set is exact and lower-only', () => {
    const k = EXERCISES.filter(e => e.kneeSensitive).map(e => e.id).sort();
    expect(k).toEqual(['gobletBoxSquat', 'hackSquat', 'legExtension', 'legPress']);
    for (const e of EXERCISES) if (e.kneeSensitive) expect(e.lower).toBe(true);
  });
  it('kneeSensitive exercises have a safe alternative, listed first for legPress/legExtension', () => {
    for (const e of EXERCISES.filter(x => x.kneeSensitive)) {
      const safe = e.alternatives.map(a => EXERCISE_BY_ID[a])
        .filter(a => !a.kneeSensitive && !a.avoid && a.primary.some(m => e.primary.includes(m)));
      expect(safe.length, e.id).toBeGreaterThan(0);
    }
    for (const id of ['legPress', 'legExtension']) expect(EXERCISE_BY_ID[EXERCISE_BY_ID[id].alternatives[0]].kneeSensitive).toBe(false);
  });
  it('increments and flags', () => {
    for (const e of EXERCISES) {
      expect(e.avoid).toBe(false);
      if (e.lower) expect(e.increment).toBe(2.5);
      else expect(e.increment).toBe(e.equipment === 'dumbbell' ? 2 : 2.5);
    }
  });
  it('bench definition', () => {
    const b = EXERCISE_BY_ID.bench;
    expect(b.primary).toEqual(['chest']);
    expect(b.secondary).toEqual(['triceps', 'frontDelt']);
    expect(b.alternatives[0]).toBe('dbBench');
  });
  it('initialProgramState', () => {
    const s = initialProgramState();
    expect(Object.keys(s.volumeTargets)).toHaveLength(14);
    expect(s.volumeTargets.chest).toBe(10);
    expect(s.volumeTargets.quads).toBe(6);
    expect(s.volumeTargets.lowerBack).toBe(10);
    expect(s).toMatchObject({ id: 'main', nextSlotIndex: 0, blockNumber: 1, sessionsInBlock: 0, setsByExercise: {}, legRampFrozen: false });
    expect(initialProgramState()).not.toBe(s);
  });
});
