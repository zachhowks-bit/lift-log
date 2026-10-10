import { describe, it, expect } from 'vitest';
import { defaultsFor, effectiveRir, restFor } from './rules';
import type { Exercise, SetLog } from '../types';

const ex = (o: Partial<Exercise>): Exercise => ({
  id: 'x', name: 'X', type: 'C', primary: [], secondary: [], equipment: 'machine',
  increment: 2.5, lower: false, kneeSensitive: false, alternatives: [], avoid: false, ...o,
});
const set = (o: Partial<SetLog>): SetLog => ({
  weight: 50, fullReps: 8, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null, ...o,
});

describe('defaultsFor', () => {
  it.each([
    ['H upper', ex({ type: 'H' }), { repMin: 6, repMax: 10, sets: 3, restSec: 180 }],
    ['C lower knee-sensitive', ex({ type: 'C', lower: true, kneeSensitive: true }), { repMin: 10, repMax: 15, sets: 2, restSec: 120 }],
    ['I upper', ex({ type: 'I' }), { repMin: 10, repMax: 15, sets: 3, restSec: 90 }],
    ['H lower not knee', ex({ type: 'H', lower: true }), { repMin: 6, repMax: 10, sets: 2, restSec: 180 }],
    ['C upper', ex({ type: 'C' }), { repMin: 8, repMax: 12, sets: 3, restSec: 120 }],
  ])('%s', (_n, e, expected) => {
    expect(defaultsFor(e)).toEqual(expected);
  });
});

describe('effectiveRir', () => {
  it.each([
    [set({ rir: 2, partialReps: 0 }), 2],
    [set({ rir: 2, partialReps: 1 }), 0],
    [set({ rir: 0, partialReps: 0 }), 0],
  ])('%j', (s, expected) => {
    expect(effectiveRir(s)).toBe(expected);
  });
});

describe('restFor', () => {
  it.each([
    ['C rir2', ex({ type: 'C' }), set({ rir: 2 }), 120],
    ['C partial', ex({ type: 'C' }), set({ rir: 2, partialReps: 1 }), 150],
    ['I rir0', ex({ type: 'I' }), set({ rir: 0 }), 120],
  ])('%s', (_n, e, s, expected) => {
    expect(restFor(e, s)).toBe(expected);
  });
});
