import { describe, it, expect } from 'vitest';
import { kneeAction, kneeRising } from './knee';

describe('kneeAction', () => {
  it('maps pain to action', () => {
    expect(kneeAction(null)).toBe('normal');
    expect(kneeAction(0)).toBe('normal');
    expect(kneeAction(3)).toBe('normal');
    expect(kneeAction(4)).toBe('noIncrease');
    expect(kneeAction(5)).toBe('noIncrease');
    expect(kneeAction(6)).toBe('reduceAndSwap');
    expect(kneeAction(10)).toBe('reduceAndSwap');
  });
});
describe('kneeRising', () => {
  it('needs strictly rising over 2 consecutive sessions', () => {
    expect(kneeRising([5, 4, 3])).toBe(true);
    expect(kneeRising([5, 5, 3])).toBe(false);
    expect(kneeRising([5])).toBe(false);
    expect(kneeRising([])).toBe(false);
  });
});
