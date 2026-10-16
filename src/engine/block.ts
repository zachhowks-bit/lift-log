/** One round = every workout in the rotation once (Push A … Legs B). */
export const SESSIONS_PER_ROUND = 6;
/** A block is 5 rounds: 4 build rounds, then a deload round. */
export const SESSIONS_PER_BLOCK = SESSIONS_PER_ROUND * 5;

export function weekInBlock(sessionsInBlock: number, perRound = SESSIONS_PER_ROUND): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.floor(sessionsInBlock / perRound) + 1) as 1 | 2 | 3 | 4 | 5;
}

export function isDeloadWeek(week: number): boolean {
  return week === 5;
}

const LABELS: Record<number, string> = {
  1: '3 reps left',
  2: '2 reps left',
  3: '1–2 reps left',
  4: '1 rep left',
  5: 'Deload: easy, 3+ left',
};

export function targetRirLabel(week: number): string {
  return LABELS[week] ?? LABELS[5];
}
