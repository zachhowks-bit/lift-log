import { useState, type FormEvent } from 'react';
import { addCustomExercise, setAvoid, setIncrement, validateIncrement } from '../../state/library';
import { cap, EQUIPMENT, errMsg, MUSCLE_LABELS, TYPE_LABELS } from '../labels';
import type { Exercise, ExType, Muscle } from '../../types';

interface Props {
  lib: Record<string, Exercise>;
  reload: () => Promise<void>;
  onError: (message: string) => void;
}

function IncrementInput({ ex, reload, onError }: { ex: Exercise } & Omit<Props, 'lib'>) {
  const [text, setText] = useState(String(ex.increment));
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    const inc = text.trim() === '' ? Number.NaN : Number(text.replace(',', '.'));
    const err = validateIncrement(inc);
    setError(err);
    if (err || inc === ex.increment) return;
    try {
      await setIncrement(ex.id, inc);
      await reload();
    } catch (e) {
      onError(errMsg(e));
    }
  };

  return (
    <>
      <label className="inc">
        <span className="inc-label">Increment</span>
        <input className="inc-input" type="text" inputMode="decimal" value={text}
          aria-label={`${ex.name} increment (kg)`} aria-invalid={error ? true : undefined}
          onChange={(e) => setText(e.target.value)} onBlur={() => void commit()}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <span className="inc-unit">kg</span>
      </label>
      {error && <p className="error lib-error" role="alert">{error}</p>}
    </>
  );
}

const MUSCLES = Object.keys(MUSCLE_LABELS) as Muscle[];

function AddExerciseForm({ reload, onError }: Omit<Props, 'lib'>) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ExType>('C');
  const [primary, setPrimary] = useState<Muscle>('chest');
  const [equipment, setEquipment] = useState<Exercise['equipment']>('machine');
  const [lower, setLower] = useState(false);
  const [knee, setKnee] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAdded(null);
    if (!name.trim()) { setError('Enter a name.'); return; }
    setError(null);
    try {
      const ex = await addCustomExercise({ name, type, primary, equipment, lower, kneeSensitive: lower && knee });
      setName('');
      setLower(false);
      setKnee(false);
      setAdded(`Added ${ex.name}.`);
      await reload();
    } catch (err) {
      onError(errMsg(err));
    }
  };

  return (
    <form className="add-form" onSubmit={(e) => void submit(e)} aria-labelledby="add-h">
      <h3 className="sub-title" id="add-h">Add custom exercise</h3>
      <label className="field">
        <span className="field-label">Name</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </label>
      <div className="field-pair">
        <label className="field">
          <span className="field-label">Type</span>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as ExType)}>
            {(['H', 'C', 'I'] as ExType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Equipment</span>
          <select className="select" value={equipment} onChange={(e) => setEquipment(e.target.value as Exercise['equipment'])}>
            {EQUIPMENT.map((q) => <option key={q} value={q}>{cap(q)}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">Primary muscle</span>
        <select className="select" value={primary} onChange={(e) => setPrimary(e.target.value as Muscle)}>
          {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={lower} onChange={(e) => { setLower(e.target.checked); if (!e.target.checked) setKnee(false); }} />
        Lower-body exercise
      </label>
      <label className={lower ? 'check' : 'check check-off'}>
        <input type="checkbox" checked={knee} disabled={!lower} onChange={(e) => setKnee(e.target.checked)} />
        Knee-sensitive
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {added && <p className="ok" role="status">{added}</p>}
      <button type="submit" className="btn btn-primary btn-wide">Add exercise</button>
    </form>
  );
}

/** Exercise library: avoid toggle and increment per exercise, plus custom exercises (spec §6.6). */
export default function LibraryEditor({ lib, reload, onError }: Props) {
  const list = Object.values(lib).sort((a, b) => a.name.localeCompare(b.name));

  const toggle = async (ex: Exercise) => {
    try {
      await setAvoid(ex.id, !ex.avoid);
      await reload();
    } catch (e) {
      onError(errMsg(e));
    }
  };

  return (
    <section className="panel" aria-labelledby="lib-h">
      <h2 className="panel-title" id="lib-h">Exercise library</h2>
      <p className="hint">Avoided exercises are left out of workouts and swap lists.</p>
      <ul className="lib-list">
        {list.map((ex) => (
          <li key={ex.id} className={ex.avoid ? 'lib-row lib-avoid' : 'lib-row'}>
            <div className="lib-name">
              <span>{ex.name}</span>
              <span className="lib-meta">{TYPE_LABELS[ex.type]} · {cap(ex.equipment)}</span>
            </div>
            <div className="lib-controls">
              <button type="button" role="switch" aria-checked={ex.avoid} aria-label={`Avoid ${ex.name}`}
                className={ex.avoid ? 'toggle toggle-on' : 'toggle'} onClick={() => void toggle(ex)}>
                {ex.avoid ? 'Avoided' : 'Avoid'}
              </button>
              <IncrementInput key={ex.increment} ex={ex} reload={reload} onError={onError} />
            </div>
          </li>
        ))}
      </ul>
      <AddExerciseForm reload={reload} onError={onError} />
    </section>
  );
}
