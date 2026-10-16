import { describe, it, expect } from 'vitest';
import { weeklySets, rampLegSets } from './volume';
import { EXERCISE_BY_ID, TEMPLATES, initialProgramState } from '../data/library';
import type { ExerciseEntry, Session, SetLog } from '../types';

const set = (): SetLog => ({ weight: 100, fullReps: 8, partialReps: 0, rir: 2, restTakenSec: null, restSkipped: false, kneePain: null });
const entry = (id: string, n: number, isDeload = false): ExerciseEntry => ({
  exerciseId: id, doneOutOfOrder: false, isDeload, sets: Array.from({ length: n }, set),
  prescription: { exerciseId: id, weight: 100, sets: n, repMin: 6, repMax: 10, targetReps: [], restSec: 180,
    targetRir: '2', why: '', needsCalibration: false, suggestSwap: false },
});
const session = (entries: ExerciseEntry[]): Session => ({ slot: 'pushA', startedAt: 0, finishedAt: 1, blockNumber: 1, weekInBlock: 1, entries, restEndsAt: null });
const lowerIds = TEMPLATES.legsA;

describe('weeklySets', () => {
  it('ignores warm-up and drop sets', () => {
    const e = entry('bench', 3);
    e.sets.push({ ...set(), kind: 'warmup' }, { ...set(), kind: 'drop' });
    expect(weeklySets([session([e])], EXERCISE_BY_ID).chest).toBe(3);
  });
  it('counts primary 1 and secondary 0.5', () => {
    const r = weeklySets([session([entry('bench', 3)]), session([entry('bench', 3)])], EXERCISE_BY_ID);
    expect(r.chest).toBe(6);
    expect(r.triceps).toBe(3);
    expect(r.frontDelt).toBe(3);
    expect(r.quads).toBe(0);
    expect(Object.keys(r)).toHaveLength(15);
  });
  it('includes deload entries', () => {
    expect(weeklySets([session([entry('bench', 2, true)])], EXERCISE_BY_ID).chest).toBe(2);
  });
});

describe('rampLegSets', () => {
  it('adds a set to hip thrust, not leg extension', () => {
    const s = initialProgramState();
    const r = rampLegSets(s, 2, false, EXERCISE_BY_ID, lowerIds);
    expect(r.state.setsByExercise.hipThrust).toBe(3);
    expect(r.state.setsByExercise.legExtension).toBeUndefined();
    expect(r.state.volumeTargets.glutes).toBe(s.volumeTargets.glutes + 1);
    expect(r.change).toBe('Legs: +1 set on Hip thrust');
    expect(s.setsByExercise).toEqual({});
  });
  it('null knee ok; picks fewest sets', () => {
    const s = initialProgramState();
    s.setsByExercise = { hipThrust: 3 };
    const r = rampLegSets(s, null, false, EXERCISE_BY_ID, lowerIds);
    expect(r.state.setsByExercise.seatedLegCurl).toBe(3);
  });
  it('knee 5 or poor recovery -> no change', () => {
    const s = initialProgramState();
    expect(rampLegSets(s, 5, false, EXERCISE_BY_ID, lowerIds)).toEqual({ state: s, change: null });
    expect(rampLegSets(s, 2, true, EXERCISE_BY_ID, lowerIds).change).toBeNull();
  });
  it('falls back to knee-sensitive when no others', () => {
    const r = rampLegSets(initialProgramState(), 0, false, EXERCISE_BY_ID, ['legPress', 'legExtension']);
    expect(r.state.setsByExercise.legPress).toBe(3);
  });
  it('no change when target would exceed 20', () => {
    const s = initialProgramState();
    s.volumeTargets.glutes = 20;
    const r = rampLegSets(s, 0, false, EXERCISE_BY_ID, lowerIds);
    expect(r.change).toBeNull();
    expect(r.state).toBe(s);
  });
  it('skips avoid exercises and unknown ids', () => {
    const lib = { ...EXERCISE_BY_ID, hipThrust: { ...EXERCISE_BY_ID.hipThrust, avoid: true } };
    const r = rampLegSets(initialProgramState(), 0, false, lib, ['nope', ...lowerIds]);
    expect(r.state.setsByExercise.hipThrust).toBeUndefined();
    expect(r.state.setsByExercise.seatedLegCurl).toBe(3);
  });
});
