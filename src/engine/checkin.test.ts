import { describe, it, expect } from 'vitest';
import { applyCheckIn } from './checkin';
import { EXERCISE_BY_ID, TEMPLATES, initialProgramState } from '../data/library';
import type { CheckInAnswers } from '../types';

const ans = (o: Partial<CheckInAnswers> = {}): CheckInAnswers => ({ recovery: 'sometimes', knee: 'same', swapIds: [], motivation: 'ok', ...o });
const run = (a: CheckInAnswers, pct = 0, state = initialProgramState(), templates = TEMPLATES) =>
  applyCheckIn(state, a, pct, EXERCISE_BY_ID, templates);

describe('applyCheckIn', () => {
  it('neutral answers: no changes', () => {
    const r = run(ans());
    expect(r.changes).toEqual([]);
    expect(r.state.legRampFrozen).toBe(false);
  });
  it('rarely + 70% raises upper targets by 2 and adds C set', () => {
    const r = run(ans({ recovery: 'rarely' }), 70);
    expect(r.state.volumeTargets.chest).toBe(12);
    expect(r.state.volumeTargets.quads).toBe(6);
    expect(r.state.setsByExercise.inclineDbPress).toBe(4);
    expect(r.changes).toContain('More upper volume: +2 sets/muscle');
  });
  it('rarely but pct < 60: nothing', () => {
    expect(run(ans({ recovery: 'rarely' }), 59).changes).toEqual([]);
  });
  it('caps at 20', () => {
    const s = initialProgramState(); s.volumeTargets.chest = 19;
    expect(run(ans({ recovery: 'rarely' }), 80, s).state.volumeTargets.chest).toBe(20);
  });
  it('often lowers targets by 2 (floor 4) and trims top exercise', () => {
    const s = initialProgramState(); s.volumeTargets.quads = 5;
    s.setsByExercise = { latPulldown: 4 };
    const r = run(ans({ recovery: 'often' }), 0, s);
    expect(r.state.volumeTargets.chest).toBe(8);
    expect(r.state.volumeTargets.quads).toBe(4);
    expect(r.state.setsByExercise.latPulldown).toBe(3);
    expect(r.state.setsByExercise.chestSupportedRow).toBe(2);
    expect(r.state.setsByExercise.bench).toBeUndefined();
    expect(r.state.setsByExercise.legPress).toBeUndefined(); // already at floor 2
    expect(r.changes).toContain('Less volume: −2 sets/muscle (recovery)');
  });
  it('knee worse swaps knee-sensitive in lower slots and freezes ramp', () => {
    const r = run(ans({ knee: 'worse' }));
    expect(r.templates.lowerA).not.toContain('legExtension');
    expect(r.templates.lowerA).not.toContain('legPress');
    expect(r.state.legRampFrozen).toBe(true);
    expect(r.changes.some(c => c.startsWith('Knee: swapped Leg extension'))).toBe(true);
    for (const id of r.templates.lowerA) expect(EXERCISE_BY_ID[id].kneeSensitive).toBe(false);
  });
  it('swapIds bench -> dbBench in upperA', () => {
    const r = run(ans({ swapIds: ['bench'] }));
    expect(r.templates.upperA[0]).toBe('dbBench');
    expect(r.changes).toContain('Swapped Barbell bench press → Dumbbell bench press');
  });
  it('swap skips alternatives already in template', () => {
    const t = { ...TEMPLATES, upperA: ['bench', 'dbBench', ...TEMPLATES.upperA.slice(1)] };
    const r = run(ans({ swapIds: ['bench'] }), 0, initialProgramState(), t);
    expect(r.templates.upperA[0]).toBe('machineChestPress');
  });
  it('motivation low swaps last 2 isolation exercises', () => {
    const r = run(ans({ motivation: 'low' }));
    const changes = r.changes.filter(c => c.startsWith('Variety: swapped'));
    expect(changes).toHaveLength(2);
  });
  it('does not mutate inputs', () => {
    const s = initialProgramState();
    const t = JSON.parse(JSON.stringify(TEMPLATES));
    const s0 = JSON.parse(JSON.stringify(s));
    const r = run(ans({ recovery: 'rarely', knee: 'worse', swapIds: ['bench'], motivation: 'low' }), 80, s, t);
    expect(s).toEqual(s0);
    expect(t).toEqual(TEMPLATES);
    expect(r.state).not.toBe(s);
    expect(r.templates).not.toBe(t);
  });
});
