import { describe, it, expect } from 'vitest';
import { roundTo } from './round';

describe('roundTo', () => {
  it.each([
    [41.3, 2.5, 42.5],
    [4.6, 2, 4],
    [0.5, 2.5, 2.5],
    [0, 2, 2],
    [43.75, 2.5, 45],
    [42.5, 2.5, 42.5],
    [7.5, 0.5, 7.5],
  ])('roundTo(%d, %d) = %d', (w, inc, expected) => {
    expect(roundTo(w, inc)).toBe(expected);
  });
});
