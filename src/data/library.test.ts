import { describe, it, expect } from 'vitest';
import { EXERCISES, EXERCISE_BY_ID, TEMPLATES, SLOT_ORDER, SLOT_NAMES, initialProgramState } from './library';

const tmplIds = [...new Set(Object.values(TEMPLATES).flat())];

describe('library', () => {
  it('ids unique', () => {
    expect(new Set(EXERCISES.map(e => e.id)).size).toBe(EXERCISES.length);
    expect(Object.keys(EXERCISE_BY_ID)).toHaveLength(EXERCISES.length);
  });
  it('slots and names', () => {
    expect(SLOT_ORDER).toEqual(['pushA', 'pullA', 'legsA', 'pushB', 'pullB', 'legsB']);
    expect(SLOT_NAMES.legsB).toBe('Legs B — Hamstrings & Glutes');
    expect(SLOT_NAMES.upperA).toBe('Upper A (old plan)');
    expect(TEMPLATES.pushA).toHaveLength(6);
    expect(TEMPLATES.legsA).toHaveLength(5);
  });
  it('push days only push, pull days only pull (abs allowed)', () => {
    const PUSH = ['chest', 'frontDelt', 'sideDelt', 'triceps', 'abs'];
    const PULL = ['lats', 'midBack', 'rearDelt', 'biceps', 'abs'];
    for (const id of [...TEMPLATES.pushA, ...TEMPLATES.pushB]) expect(PUSH, id).toContain(EXERCISE_BY_ID[id].primary[0]);
    for (const id of [...TEMPLATES.pullA, ...TEMPLATES.pullB]) expect(PULL, id).toContain(EXERCISE_BY_ID[id].primary[0]);
    for (const id of [...TEMPLATES.legsA, ...TEMPLATES.legsB]) expect(EXERCISE_BY_ID[id].lower, id).toBe(true);
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
    expect(k).toEqual(['gobletBoxSquat', 'hackSquat', 'horizontalLegPress', 'legExtension', 'legPress']);
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
    expect(Object.keys(s.volumeTargets)).toHaveLength(15);
    // Targets = what one round of the default plan delivers (min 4, max 20).
    expect(s.volumeTargets.chest).toBe(17);
    expect(s.volumeTargets.quads).toBe(4);
    expect(s.volumeTargets.abs).toBe(6);
    for (const v of Object.values(s.volumeTargets)) { expect(v).toBeGreaterThanOrEqual(4); expect(v).toBeLessThanOrEqual(20); }
    expect(s).toMatchObject({ id: 'main', nextSlotIndex: 0, blockNumber: 1, sessionsInBlock: 0, setsByExercise: {}, legRampFrozen: false });
    expect(initialProgramState()).not.toBe(s);
  });
});
