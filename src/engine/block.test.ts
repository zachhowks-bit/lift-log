import { describe, it, expect } from 'vitest';
import { weekInBlock, isDeloadWeek, targetRirLabel } from './block';

describe('weekInBlock', () => {
  it.each([[0, 1], [3, 1], [4, 2], [8, 3], [12, 4], [16, 5], [19, 5], [25, 5]])('%d sessions -> week %d', (n, w) => {
    expect(weekInBlock(n)).toBe(w);
  });
});

describe('isDeloadWeek', () => {
  it.each([[1, false], [4, false], [5, true]])('week %d -> %s', (w, e) => {
    expect(isDeloadWeek(w)).toBe(e);
  });
});

describe('targetRirLabel', () => {
  it.each([
    [1, '3 reps left'], [2, '2 reps left'], [3, '1–2 reps left'], [4, '1 rep left'], [5, 'Deload: easy, 3+ left'],
  ])('week %d', (w, e) => {
    expect(targetRirLabel(w)).toBe(e);
  });
});
