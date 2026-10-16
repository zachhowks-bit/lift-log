import { useState } from 'react';
import { validateSet } from '../../state/session';
import type { Exercise, SetKind, SetLog } from '../../types';
import Chips from './Chips';
import Stepper from './Stepper';

interface Props {
  exercise: Exercise;
  setNumber: number;
  defaultWeight: number | null;
  defaultReps: number;
  defaultKnee: number;
  calibrationHint?: string;
  /** True while the rest timer runs: logging is locked (drop sets are still allowed). */
  locked: boolean;
  onLog: (set: SetLog) => Promise<void>;
  /** Editing an existing set: start from these values. */
  initial?: SetLog;
  /** Button text; defaults to "Log set N". */
  submitLabel?: string;
}

type KindChoice = 'work' | SetKind;

const RIR_OPTIONS = [
  { value: 0, text: '0' }, { value: 1, text: '1' }, { value: 2, text: '2' }, { value: 3, text: '3+' },
];
const KIND_OPTIONS: { value: KindChoice; text: string }[] = [
  { value: 'work', text: 'Working' }, { value: 'warmup', text: 'Warm-up' }, { value: 'drop', text: 'Drop set' },
];
const KNEE_OPTIONS = Array.from({ length: 11 }, (_, i) => ({ value: i, text: String(i) }));

const roundStep = (n: number) => Math.round(n * 100) / 100;

/** Input for one set: logging the next set, or editing a logged one. */
export default function SetRow({
  exercise, setNumber, defaultWeight, defaultReps, defaultKnee, calibrationHint, locked, onLog, initial, submitLabel,
}: Props) {
  const startWeight = initial ? initial.weight : defaultWeight;
  const [weight, setWeight] = useState(startWeight === null ? '' : String(startWeight));
  const [fullReps, setFullReps] = useState(initial ? initial.fullReps : defaultReps);
  const [partialReps, setPartialReps] = useState(initial ? initial.partialReps : 0);
  const [rir, setRir] = useState<number | null>(initial ? Math.min(3, initial.rir) : null);
  const [knee, setKnee] = useState(initial?.kneePain ?? defaultKnee);
  const [kind, setKind] = useState<KindChoice>(initial?.kind ?? 'work');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const w = weight.trim() === '' ? NaN : Number(weight);
  const stepWeight = (dir: 1 | -1) => {
    const base = Number.isFinite(w) ? w : 0;
    setWeight(String(Math.max(0, roundStep(base + dir * exercise.increment))));
  };
  const warmup = kind === 'warmup';

  const submit = async () => {
    const set: SetLog = {
      weight: w, fullReps, partialReps, rir: warmup ? 3 : rir ?? 0,
      restTakenSec: initial?.restTakenSec ?? null, restSkipped: initial?.restSkipped ?? false,
      kneePain: exercise.lower ? knee : null,
    };
    if (kind !== 'work') set.kind = kind;
    const err = validateSet(set) ?? (rir === null && !warmup ? 'Pick reps left.' : null);
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      await onLog(set);
    } finally {
      setBusy(false);
    }
  };

  const id = `w-${exercise.id}${initial ? '-edit' : ''}`;
  const label = submitLabel ?? (kind === 'work' ? `Log set ${setNumber}` : kind === 'warmup' ? 'Log warm-up' : 'Log drop set');
  return (
    <div className={initial ? 'set-row set-row-edit' : 'set-row'}>
      {!initial && <div className="set-row-title">{kind === 'work' ? `Set ${setNumber}` : KIND_OPTIONS.find((k) => k.value === kind)!.text}</div>}
      <Chips label="Set type" options={KIND_OPTIONS} value={kind} onChange={setKind} cols={3} compact />
      <div className="field">
        <label className="field-label" htmlFor={id}>Weight (kg)</label>
        <div className="stepper">
          <button type="button" className="step-btn" aria-label="Less weight" onClick={() => stepWeight(-1)}>−</button>
          <input id={id} className="step-input" type="text" inputMode="decimal" autoComplete="off"
            value={weight} placeholder="kg" onChange={(e) => setWeight(e.target.value.replace(',', '.'))} />
          <button type="button" className="step-btn" aria-label="More weight" onClick={() => stepWeight(1)}>+</button>
        </div>
        {calibrationHint && <p className="hint">{calibrationHint}</p>}
      </div>
      <div className="field-pair">
        <Stepper label="Full reps" value={fullReps} onChange={setFullReps} />
        <Stepper label="Partial reps" value={partialReps} onChange={setPartialReps} />
      </div>
      {!warmup && <Chips label="Reps left" options={RIR_OPTIONS} value={rir} onChange={setRir} />}
      {exercise.lower && <Chips label="Knee pain" options={KNEE_OPTIONS} value={knee} onChange={setKnee} small />}
      <div className="log-line">
        <button type="button" className="btn btn-primary btn-log"
          disabled={(locked && kind !== 'drop') || busy} onClick={() => void submit()}>
          {label}
        </button>
        {locked && kind !== 'drop' && !initial && <p className="hint">Resting. A drop set can be logged now.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
