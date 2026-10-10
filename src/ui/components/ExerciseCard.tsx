import type { Exercise, ExerciseEntry, SetLog } from '../../types';
import SetRow from './SetRow';

interface Props {
  entry: ExerciseEntry;
  exercise: Exercise | undefined;
  expanded: boolean;
  locked: boolean;
  defaultKnee: number;
  onToggle: () => void;
  onLog: (set: SetLog) => Promise<void>;
  onSwap: () => void;
}

export function targetText(entry: ExerciseEntry): string {
  const p = entry.prescription;
  if (p.needsCalibration || p.weight === null) return 'Pick a weight';
  return `${p.weight} kg × ${p.targetReps.join('/')}`;
}

function setText(s: SetLog): string {
  let t = `${s.weight} kg × ${s.fullReps}`;
  if (s.partialReps > 0) t += ` + ${s.partialReps}p`;
  t += ` · ${s.rir >= 3 ? '3+' : s.rir} left`;
  if (s.kneePain !== null) t += ` · knee ${s.kneePain}`;
  if (s.restSkipped) t += ' · rest skipped';
  return t;
}

export default function ExerciseCard({ entry, exercise, expanded, locked, defaultKnee, onToggle, onLog, onSwap }: Props) {
  const p = entry.prescription;
  const done = entry.sets.length;
  const complete = done >= p.sets;
  const name = exercise?.name ?? entry.exerciseId;
  const last = entry.sets[done - 1];
  const defaultWeight = last ? last.weight : p.weight;
  const defaultReps = p.targetReps[done] ?? p.targetReps[p.targetReps.length - 1] ?? p.repMin;
  const calibrating = p.needsCalibration && done === 0;
  const hint = `First time: pick a weight you could do for ${p.repMax} with ~2 reps left`;
  // The engine's calibration "why" is the same sentence; don't show it twice next to the weight input.
  const showWhy = !(expanded && calibrating && p.why === hint);

  return (
    <section className={`card${expanded ? ' card-open' : ''}${complete ? ' card-done' : ''}`} aria-label={name}>
      <button type="button" className="card-head" aria-expanded={expanded} onClick={onToggle}>
        <span className="card-title">
          <span className="card-name">{name}</span>
          {entry.isDeload && <span className="tag">Deload</span>}
        </span>
        <span className="card-meta">
          <span className="card-target">{targetText(entry)}</span>
          <span className={complete ? 'card-count count-done' : 'card-count'}>{done}/{p.sets}</span>
        </span>
      </button>
      {showWhy && <p className="card-why">{p.why}</p>}
      {p.suggestSwap && done === 0 && <p className="swap-hint">Stalled or knee pain — consider a swap</p>}
      {expanded && (
        <div className="card-body">
          {done > 0 && (
            <ol className="done-sets">
              {entry.sets.map((s, i) => <li key={i}><span className="done-n">{i + 1}</span>{setText(s)}</li>)}
            </ol>
          )}
          {complete && <p className="hint">All {p.sets} sets done. Log an extra set if you want.</p>}
          {exercise && (
            <SetRow key={done} exercise={exercise} setNumber={done + 1} defaultWeight={defaultWeight}
              defaultReps={defaultReps} defaultKnee={defaultKnee} locked={locked} onLog={onLog}
              calibrationHint={calibrating ? hint : undefined} />
          )}
          {done === 0 && (
            <button type="button" className="btn btn-ghost" onClick={onSwap}>Swap exercise</button>
          )}
        </div>
      )}
    </section>
  );
}
