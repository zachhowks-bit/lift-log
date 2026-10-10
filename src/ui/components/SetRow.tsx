import { useState } from 'react';
import { validateSet } from '../../state/session';
import type { Exercise, SetLog } from '../../types';
import Chips from './Chips';
import Stepper from './Stepper';

interface Props {
  exercise: Exercise;
  setNumber: number;
  defaultWeight: number | null;
  defaultReps: number;
  defaultKnee: number;
  calibrationHint?: string;
  /** True while the rest timer runs: logging is locked. */
  locked: boolean;
  onLog: (set: SetLog) => Promise<void>;
}

const RIR_OPTIONS = [
  { value: 0, text: '0' }, { value: 1, text: '1' }, { value: 2, text: '2' }, { value: 3, text: '3+' },
];
const KNEE_OPTIONS = Array.from({ length: 11 }, (_, i) => ({ value: i, text: String(i) }));

const roundStep = (n: number) => Math.round(n * 100) / 100;

/** Input row for the next set of one exercise. */
export default function SetRow({
  exercise, setNumber, defaultWeight, defaultReps, defaultKnee, calibrationHint, locked, onLog,
}: Props) {
  const [weight, setWeight] = useState(defaultWeight === null ? '' : String(defaultWeight));
  const [fullReps, setFullReps] = useState(defaultReps);
  const [partialReps, setPartialReps] = useState(0);
  const [rir, setRir] = useState<number | null>(null);
  const [knee, setKnee] = useState(defaultKnee);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const w = weight.trim() === '' ? NaN : Number(weight);
  const stepWeight = (dir: 1 | -1) => {
    const base = Number.isFinite(w) ? w : 0;
    setWeight(String(Math.max(0, roundStep(base + dir * exercise.increment))));
  };

  const submit = async () => {
    const set: SetLog = {
      weight: w, fullReps, partialReps, rir: rir ?? 0,
      restTakenSec: null, restSkipped: false, kneePain: exercise.lower ? knee : null,
    };
    const err = validateSet(set) ?? (rir === null ? 'Pick reps left.' : null);
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      await onLog(set);
    } finally {
      setBusy(false);
    }
  };

  const id = `w-${exercise.id}`;
  return (
    <div className="set-row">
      <div className="set-row-title">Set {setNumber}</div>
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
      <Chips label="Reps left" options={RIR_OPTIONS} value={rir} onChange={setRir} />
      {exercise.lower && <Chips label="Knee pain" options={KNEE_OPTIONS} value={knee} onChange={setKnee} small />}
      <div className="log-line">
        <button type="button" className="btn btn-primary btn-log" disabled={locked || busy} onClick={() => void submit()}>
          Log set {setNumber}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
