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
  /** Nothing logged yet in this workout: suggest warm-up sets on a compound. */
  firstOfWorkout?: boolean;
}

const near = (w: number, inc: number) => Math.max(inc, Math.round(w / inc) * inc);

/** Two ramp-up sets before the first heavy exercise: ~50% × 8, then ~75% × 4. */
export function warmupText(weight: number, inc: number): string {
  return `Warm up first: ${near(weight * 0.5, inc)} kg × 8, then ${near(weight * 0.75, inc)} kg × 4. Log them as Warm-up.`;
}

export function targetText(entry: ExerciseEntry): string {
  const p = entry.prescription;
  if (p.needsCalibration || p.weight === null) return 'Pick a weight';
  return `${p.weight === 0 ? 'Bodyweight' : `${p.weight} kg`} × ${p.targetReps.join('/')}`;
}

export default function ExerciseCard({
  entry, exercise, expanded, locked, defaultKnee, onToggle, onLog, onSwap, onEditSet, firstOfWorkout,
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
          {firstOfWorkout && exercise && exercise.type !== 'I' && p.weight !== null && p.weight >= 20 && (
            <p className="warmup-hint">{warmupText(p.weight, exercise.increment)}</p>
          )}
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
