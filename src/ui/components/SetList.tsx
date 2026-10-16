import type { SetLog } from '../../types';

export function setText(s: SetLog): string {
  let t = `${s.weight} kg × ${s.fullReps}`;
  if (s.partialReps > 0) t += ` + ${s.partialReps}p`;
  if (s.kind !== 'warmup') t += ` · ${s.rir >= 3 ? '3+' : s.rir} left`;
  if (s.kneePain !== null) t += ` · knee ${s.kneePain}`;
  if (s.restSkipped) t += ' · rest skipped';
  return t;
}

interface Props {
  sets: SetLog[];
  /** Set indexes that set a personal record. */
  prIndexes?: number[];
  onEdit?: (index: number) => void;
}

/**
 * Logged sets. Working sets are numbered 1, 2, 3; warm-ups show W and drop sets D (as in Hevy).
 * Tapping a set opens the editor.
 */
export default function SetList({ sets, prIndexes = [], onEdit }: Props) {
  let n = 0;
  return (
    <ol className="done-sets">
      {sets.map((s, i) => {
        const mark = s.kind === 'warmup' ? 'W' : s.kind === 'drop' ? 'D' : String(++n);
        const label = s.kind === 'warmup' ? 'Warm-up' : s.kind === 'drop' ? 'Drop set' : `Set ${mark}`;
        const body = (
          <>
            <span className={`done-n done-${s.kind ?? 'work'}`} aria-hidden="true">{mark}</span>
            <span className="done-text">{setText(s)}</span>
            {prIndexes.includes(i) && <span className="pr-badge">PR</span>}
          </>
        );
        return (
          <li key={i}>
            {onEdit ? (
              <button type="button" className="done-btn" aria-label={`Edit ${label}: ${setText(s)}`} onClick={() => onEdit(i)}>
                {body}<span className="done-edit" aria-hidden="true">Edit</span>
              </button>
            ) : <div className="done-btn">{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}
