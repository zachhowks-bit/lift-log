import { describe, it, expect } from 'vitest';
import { isStalled, isValidExposure } from './stall';
import { entry } from './__tests__/testutil';

describe('isValidExposure', () => {
  it('valid normally', () => expect(isValidExposure(entry(60, [8, 8], [1, 1]))).toBe(true));
  it('invalid if rest skipped', () => expect(isValidExposure(entry(60, [8, 8], [1, 1], { skip: true }))).toBe(false));
  it('invalid if out of order and under repMin', () => {
    expect(isValidExposure(entry(60, [8, 5], [1, 1], { ooo: true }))).toBe(false);
    expect(isValidExposure(entry(60, [8, 6], [1, 1], { ooo: true }))).toBe(true);
    expect(isValidExposure(entry(60, [8, 5], [1, 1]))).toBe(true);
  });
});
describe('isStalled', () => {
  const e = (w: number, r: number) => entry(w, [r, r], [1, 1]);
  it('needs >= 4 entries', () => expect(isStalled([e(60, 8), e(60, 8), e(60, 8)])).toBe(false));
  it('4 identical is stalled', () => expect(isStalled([e(60, 8), e(60, 8), e(60, 8), e(60, 8)])).toBe(true));
  it('improving series is not', () => expect(isStalled([e(65, 8), e(62.5, 8), e(60, 8), e(60, 8)])).toBe(false));
  it('more reps at same weight counts as improvement', () => expect(isStalled([e(60, 9), e(60, 8), e(60, 8), e(60, 8)])).toBe(false));
  it('improvement at the oldest of the 3 compared pairs prevents stall', () => expect(isStalled([e(60, 8), e(60, 8), e(60, 8), e(55, 8)])).toBe(false));
  it('lower weight is no improvement', () => expect(isStalled([e(55, 12), e(60, 8), e(60, 8), e(60, 8)])).toBe(true));
});
