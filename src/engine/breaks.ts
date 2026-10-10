/** Weight multiplier after a layoff. */
export function breakFactor(daysSinceLast: number | null): number {
  if (daysSinceLast === null || daysSinceLast < 10) return 1;
  return daysSinceLast >= 21 ? 0.8 : 0.9;
}
