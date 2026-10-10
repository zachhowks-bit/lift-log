import { describe, it, expect } from 'vitest';
import { nextPrescription } from './progression';
import { roundTo } from './round';
import { entry, bench, legPress, dbCurl } from './__tests__/testutil';
import type { Prescription } from '../types';

function expectNoNaN(p: Prescription) {
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'number') expect(Number.isFinite(v), k).toBe(true);
  }
  expect(p.targetReps.every((n) => Number.isFinite(n))).toBe(true);
  expect(p.targetReps).toHaveLength(p.sets);
  if (p.weight !== null) expect(Number.isFinite(p.weight)).toBe(true);
}

const ctx = (o: Partial<{ week: number; daysSinceLast: number | null; sets: number }> = {}) =>
  ({ week: 1, daysSinceLast: 3, sets: 3, ...o });

describe('nextPrescription', () => {
  it('calibration with no history', () => {
    const p = nextPrescription(bench, [], ctx());
    expect(p.needsCalibration).toBe(true);
    expect(p.weight).toBeNull();
    expect(p.why).toBe('First time: pick a weight you could do for 10 with ~2 reps left');
    expect(p.targetReps).toEqual([10, 10, 10]);
    expect(p.targetRir).toBe('3 reps left');
    expect(p.restSec).toBe(180);
  });
  it('calibration ignores deload/empty entries and halves sets in deload week, no NaN', () => {
    const p = nextPrescription(bench, [entry(60, [8, 8, 8], [1, 1, 1], { deload: true }), entry(60, [], [])], ctx({ week: 5 }));
    expect(p.needsCalibration).toBe(true);
    expect(p.sets).toBe(2);
    expect(p.targetReps).toHaveLength(2);
    expectNoNaN(p);
  });
  it('increases when all sets hit repMax with RIR>=1', () => {
    const p = nextPrescription(bench, [entry(60, [10, 10, 10], [1, 1, 1])], ctx());
    expect(p.weight).toBe(62.5);
    expect(p.targetReps).toEqual([6, 6, 6]);
    expect(p.why).toBe('+2.5 kg: hit 10/10/10 last time');
  });
  it('no increase if a set hit repMax with RIR 0', () => {
    const p = nextPrescription(bench, [entry(60, [10, 10, 10], [1, 1, 0])], ctx());
    expect(p.weight).toBe(60);
  });
  it('+1 rep on the first lowest set', () => {
    const p = nextPrescription(bench, [entry(60, [10, 10, 9], [1, 1, 1])], ctx());
    expect(p.weight).toBe(60);
    expect(p.targetReps).toEqual([10, 10, 10]);
    expect(p.why).toBe('Same weight: aim 10 reps on set 3');
  });
  it('+1 rep picks first lowest, pads/truncates to sets', () => {
    const p = nextPrescription(bench, [entry(60, [8, 7, 7], [1, 1, 1])], ctx());
    expect(p.targetReps).toEqual([8, 8, 7]);
    expect(p.why).toBe('Same weight: aim 8 reps on set 2');
    const q = nextPrescription(bench, [entry(60, [8, 7], [1, 1])], ctx());
    expect(q.targetReps).toEqual([8, 8, 7]);
    const r = nextPrescription(bench, [entry(60, [8, 7, 9, 9], [1, 1, 1, 1])], ctx());
    expect(r.targetReps).toEqual([8, 8, 9]);
  });
  it('missed bottom with RIR 0 holds, twice cuts 7.5%', () => {
    const miss = entry(60, [5, 6, 6], [0, 1, 1]);
    const once = nextPrescription(bench, [miss, entry(60, [8, 8, 8], [1, 1, 1])], ctx());
    expect(once.weight).toBe(60);
    expect(once.why).toBe('Same weight: missed 6 last time');
    expect(once.targetReps).toEqual([6, 6, 6]);
    const twice = nextPrescription(bench, [miss, miss], ctx());
    expect(twice.weight).toBe(roundTo(55.5, 2.5));
    expect(twice.weight).toBe(55);
    expect(twice.why).toBe('−7.5%: missed bottom of range twice');
  });
  it('partial forces RIR 0 and blocks increase', () => {
    const p = nextPrescription(bench, [entry(60, [10, 10, 9], [1, 1, 2], { partial: [0, 0, 1] })], ctx());
    expect(p.weight).toBe(60);
    expect(p.targetReps).toEqual([10, 10, 10]);
  });
  it('step 2: only invalid entries holds newest top weight', () => {
    const p = nextPrescription(bench, [entry(60, [10, 10, 10], [1, 1, 1], { skip: true })], ctx());
    expect(p.weight).toBe(60);
    expect(p.why).toBe("Same weight: last session didn't count (rest skipped / out of order)");
    expect(p.targetReps).toEqual([6, 6, 6]);
  });
  it('invalid newest + older valid builds from older', () => {
    const p = nextPrescription(bench, [entry(70, [10, 10, 10], [1, 1, 1], { skip: true }), entry(60, [10, 10, 10], [1, 1, 1])], ctx());
    expect(p.weight).toBe(62.5);
  });
  it('uses max set weight as top weight', () => {
    const e = entry(60, [10, 10, 10], [1, 1, 1]);
    e.sets[2].weight = 65;
    expect(nextPrescription(bench, [e], ctx()).weight).toBe(67.5);
  });
  it('deload entries are ignored', () => {
    const p = nextPrescription(bench, [entry(40, [10, 10, 10], [3, 3, 3], { deload: true }), entry(60, [10, 10, 10], [1, 1, 1])], ctx());
    expect(p.weight).toBe(62.5);
  });
  describe('knee', () => {
    const lp = (knee: number) => [entry(100, [15, 15], [1, 1], { knee, repMin: 10 })];
    it('normal increases', () => {
      const p = nextPrescription(legPress, lp(3), ctx({ sets: 2 }));
      expect(p.weight).toBe(105);
    });
    it('pain 5 holds', () => {
      const p = nextPrescription(legPress, lp(5), ctx({ sets: 2 }));
      expect(p.weight).toBe(100);
      expect(p.why).toBe('Held: knee pain 5 last time');
      expect(p.suggestSwap).toBe(false);
    });
    it('pain 6 cuts 10% and suggests swap', () => {
      const p = nextPrescription(legPress, lp(6), ctx({ sets: 2 }));
      expect(p.weight).toBe(90);
      expect(p.suggestSwap).toBe(true);
      expect(p.why).toBe('−10% + try a swap: knee pain 6');
      expect(p.targetReps).toEqual([10, 10]);
    });
    it('non-lower exercises ignore knee pain', () => {
      const p = nextPrescription(bench, [entry(60, [10, 10, 10], [1, 1, 1], { knee: 8 })], ctx());
      expect(p.weight).toBe(62.5);
    });
  });
  it('break factors', () => {
    const h = [entry(60, [8, 8, 8], [1, 1, 1])];
    const a = nextPrescription(bench, h, ctx({ daysSinceLast: 12 }));
    expect(a.weight).toBe(roundTo(54, 2.5));
    expect(a.why).toBe('−10%: back after 12 days. Same weight: aim 9 reps on set 1');
    const b = nextPrescription(bench, h, ctx({ daysSinceLast: 25 }));
    expect(b.weight).toBe(roundTo(48, 2.5));
    expect(b.why.startsWith('−20%: back after 25 days. ')).toBe(true);
  });
  it('deload week halves sets and weight', () => {
    const p = nextPrescription(bench, [entry(60, [8, 8, 8], [1, 1, 1])], ctx({ week: 5 }));
    expect(p.sets).toBe(2);
    expect(p.weight).toBe(roundTo(54, 2.5));
    expect(p.targetReps).toEqual([6, 6]);
    expect(p.why).toBe('Deload week: lighter, easy reps');
    expect(p.targetRir).toBe('Deload: easy, 3+ left');
    const q = nextPrescription(bench, [entry(60, [8, 8, 8], [1, 1, 1])], ctx({ week: 5, daysSinceLast: 12 }));
    expect(q.why).toBe('−10%: back after 12 days. Deload week: lighter, easy reps');
  });
  it('double miss with knee pain >= 6 gives last top x 0.9, not compounded', () => {
    const m = entry(100, [8, 9], [0, 1], { knee: 6, repMin: 10 });
    const p = nextPrescription(legPress, [m, m], ctx({ sets: 2 }));
    expect(p.weight).toBe(90);
    expect(p.suggestSwap).toBe(true);
    expect(p.why).toBe('−10% + try a swap: knee pain 6');
  });
  it('small dumbbell double miss never below one increment', () => {
    const m = entry(5, [8, 9, 9], [0, 1, 1], { repMin: 10 });
    const p = nextPrescription(dbCurl, [m, m], ctx());
    expect(p.weight).toBe(4);
  });
  it('stall suggests swap; improving does not', () => {
    const e = () => entry(60, [8, 8, 8], [1, 1, 1]);
    const s = nextPrescription(bench, [e(), e(), e(), e()], ctx());
    expect(s.suggestSwap).toBe(true);
    expect(s.why.endsWith(' Stalled 3 sessions — consider a swap.')).toBe(true);
    const i = nextPrescription(bench, [entry(65, [8, 8, 8], [1, 1, 1]), entry(62.5, [8, 8, 8], [1, 1, 1]), e(), e()], ctx());
    expect(i.suggestSwap).toBe(false);
  });
  it('fills every field with no NaN', () => {
    const p = nextPrescription(bench, [entry(60, [10, 10, 10], [1, 1, 1])], ctx());
    expect(Object.keys(p).sort()).toEqual(['exerciseId', 'needsCalibration', 'repMax', 'repMin', 'restSec', 'sets',
      'suggestSwap', 'targetReps', 'targetRir', 'weight', 'why']);
    expect(p.targetReps).toHaveLength(p.sets);
    expectNoNaN(p);
  });
});
