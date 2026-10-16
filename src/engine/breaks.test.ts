import { describe, it, expect } from 'vitest';
import { breakAdjust, breakFactor } from './breaks';

describe('breakFactor', () => {
  it.each([
    [null, 1], [0, 1], [6, 1], [8, 1], [13, 1], [14, 0.9], [20, 0.9], [21, 0.8], [60, 0.8],
  ])('%s days -> %d', (d, e) => {
    expect(breakFactor(d)).toBe(e);
  });
});

describe('breakAdjust', () => {
  it('no break under 7 days', () => {
    expect(breakAdjust(6)).toEqual({ factor: 1, hold: false, label: null });
  });
  it('a trip of 8 days holds weights without cutting them', () => {
    const b = breakAdjust(8);
    expect(b.factor).toBe(1);
    expect(b.hold).toBe(true);
    expect(b.label).toContain('8 days');
  });
  it('3 weeks off cuts 20% and holds', () => {
    expect(breakAdjust(25)).toMatchObject({ factor: 0.8, hold: true });
  });
});
