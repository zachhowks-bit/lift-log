import { describe, it, expect } from 'vitest';
import { weekInBlock, isDeloadWeek, targetRirLabel, SESSIONS_PER_BLOCK } from './block';

describe('weekInBlock (6 workouts per round)', () => {
  it.each([[0, 1], [5, 1], [6, 2], [12, 3], [18, 4], [24, 5], [29, 5], [40, 5]])('%d sessions -> round %d', (n, w) => {
    expect(weekInBlock(n)).toBe(w);
  });
  it('a block is 30 workouts', () => {
    expect(SESSIONS_PER_BLOCK).toBe(30);
  });
});

describe('isDeloadWeek', () => {
  it.each([[1, false], [4, false], [5, true]])('round %d -> %s', (w, e) => {
    expect(isDeloadWeek(w)).toBe(e);
  });
});

describe('targetRirLabel', () => {
  it.each([
    [1, '3 reps left'], [2, '2 reps left'], [3, '1–2 reps left'], [4, '1 rep left'], [5, 'Deload: easy, 3+ left'],
  ])('round %d', (w, e) => {
    expect(targetRirLabel(w)).toBe(e);
  });
});
