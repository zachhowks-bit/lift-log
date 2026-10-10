export function weekInBlock(sessionsInBlock: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.floor(sessionsInBlock / 4) + 1) as 1 | 2 | 3 | 4 | 5;
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
