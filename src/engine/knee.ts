export type KneeAction = 'normal' | 'noIncrease' | 'reduceAndSwap';

export function kneeAction(maxPain: number | null): KneeAction {
  if (maxPain === null || Number.isNaN(maxPain) || maxPain <= 3) return 'normal';
  return maxPain >= 6 ? 'reduceAndSwap' : 'noIncrease';
}

/** Newest first; true if pain was higher on 2 consecutive sessions. */
export function kneeRising(lowerSessionMaxPains: number[]): boolean {
  const [a, b, c] = lowerSessionMaxPains;
  if (a === undefined || b === undefined || c === undefined) return false;
  return a > b && b > c;
}
