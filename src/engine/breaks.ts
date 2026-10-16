export interface BreakAdjust {
  /** Multiply prescribed weights by this. */
  factor: number;
  /** Cancel any weight increase for this session (ease back in). */
  hold: boolean;
  /** Short reason, or null when no break applies. */
  label: string | null;
}

/**
 * After a layoff (trips, events):
 * 7–13 days → same weights, no increase; 14–20 → −10%; 21+ → −20%.
 */
export function breakAdjust(daysSinceLast: number | null): BreakAdjust {
  if (daysSinceLast === null || daysSinceLast < 7) return { factor: 1, hold: false, label: null };
  if (daysSinceLast < 14) return { factor: 1, hold: true, label: `Back after ${daysSinceLast} days: same weight, ease in. ` };
  if (daysSinceLast < 21) return { factor: 0.9, hold: true, label: `−10%: back after ${daysSinceLast} days. ` };
  return { factor: 0.8, hold: true, label: `−20%: back after ${daysSinceLast} days. ` };
}

/** Weight multiplier after a layoff. */
export function breakFactor(daysSinceLast: number | null): number {
  return breakAdjust(daysSinceLast).factor;
}
