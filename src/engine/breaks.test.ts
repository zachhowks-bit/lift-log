import { describe, it, expect } from 'vitest';
import { breakFactor } from './breaks';

describe('breakFactor', () => {
  it.each([
    [null, 1], [0, 1], [9, 1], [10, 0.9], [20, 0.9], [21, 0.8], [60, 0.8],
  ])('%s days -> %d', (d, e) => {
    expect(breakFactor(d)).toBe(e);
  });
});
