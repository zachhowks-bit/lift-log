import type { WorkoutSummary } from '../../state/history';

export const longDate = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function statsLine(w: WorkoutSummary): string {
  const parts = [plural(w.exercises, 'exercise'), plural(w.sets, 'set')];
  if (w.durationMin !== null) parts.push(`${w.durationMin} min`);
  return parts.join(', ');
}

/** One past workout in a list; opens its detail. */
export default function WorkoutRow({ w, onOpen }: { w: WorkoutSummary; onOpen: (id: number) => void }) {
  return (
    <li>
      <button type="button" className="wrow" onClick={() => onOpen(w.id)}
        aria-label={`${w.slotShort}, ${longDate(w.date)}, ${statsLine(w)}${w.prs.length ? `, ${w.prs.length} PR` : ''}`}>
        <span className="wrow-main">
          <span className="wrow-title">{w.slotShort}</span>
          <span className="wrow-date">{longDate(w.date)}</span>
        </span>
        <span className="wrow-sub">
          <span>{statsLine(w)}</span>
          {w.prs.length > 0 && <span className="pr-badge">{w.prs.length} PR</span>}
        </span>
      </button>
    </li>
  );
}
