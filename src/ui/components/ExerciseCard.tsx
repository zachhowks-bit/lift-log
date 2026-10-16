import { isWorking } from '../../engine/rules';
import type { Exercise, ExerciseEntry, SetLog } from '../../types';
import SetList from './SetList';
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
  onEditSet: (index: number) => void;
}

export function targetText(entry: ExerciseEntry): string {
  const p = entry.prescription;
  if (p.needsCalibration || p.weight === null) return 'Pick a weight';
  return `${p.weight} kg × ${p.targetReps.join('/')}`;
}

export default function ExerciseCard({
  entry, exercise, expanded, locked, defaultKnee, onToggle, onLog, onSwap, onEditSet,
}: Props) {
  const p = entry.prescription;
  const working = entry.sets.filter(isWorking);
  const done = working.length;
  const complete = done >= p.sets;
  const name = exercise?.name ?? entry.exerciseId;
  const last = working[done - 1] ?? entry.sets[entry.sets.length - 1];
  const defaultWeight = last && isWorking(last) ? last.weight : p.weight ?? last?.weight ?? null;
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
          {entry.sets.length > 0 && <SetList sets={entry.sets} onEdit={onEditSet} />}
          {complete && <p className="hint">All {p.sets} sets done. Log an extra set if you want.</p>}
          {exercise && (
            <SetRow key={entry.sets.length} exercise={exercise} setNumber={done + 1} defaultWeight={defaultWeight}
              defaultReps={defaultReps} defaultKnee={defaultKnee} locked={locked} onLog={onLog}
              calibrationHint={calibrating ? hint : undefined} />
          )}
          {entry.sets.length === 0 && (
            <button type="button" className="btn btn-ghost" onClick={onSwap}>Swap exercise</button>
          )}
        </div>
      )}
    </section>
  );
}
