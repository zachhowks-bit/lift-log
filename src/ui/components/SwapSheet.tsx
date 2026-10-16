import { useState, type FormEvent } from 'react';
import type { Exercise } from '../../types';

interface Props {
  fromName: string;
  options: Exercise[] | null;
  onPick: (id: string, always: boolean) => void;
  /** Add a new exercise by name (same muscle as the one being replaced) and swap to it. */
  onOther: (name: string, always: boolean) => void;
  onClose: () => void;
}

/** Bottom sheet listing swap alternatives, plus "Other" to type your own. `options === null` while loading. */
export default function SwapSheet({ fromName, options, onPick, onOther, onClose }: Props) {
  const [always, setAlways] = useState(true);
  const [other, setOther] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitOther = (e: FormEvent) => {
    e.preventDefault();
    const name = (other ?? '').trim();
    if (!name) { setError('Type the exercise name.'); return; }
    onOther(name, always);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Swap exercise" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Swap {fromName}</h2>
        <label className="check">
          <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} />
          <span>Use the new one in future workouts too</span>
        </label>
        {options === null && <p className="hint">Loading…</p>}
        {options !== null && (
          <ul className="sheet-list">
            {options.map((o) => (
              <li key={o.id}>
                <button type="button" className="sheet-item" onClick={() => onPick(o.id, always)}>{o.name}</button>
              </li>
            ))}
            <li>
              {other === null ? (
                <button type="button" className="sheet-item sheet-other" onClick={() => setOther('')}>
                  Other (type your own)
                </button>
              ) : (
                <form className="other-form" onSubmit={submitOther}>
                  <label className="field">
                    <span className="field-label">Exercise name</span>
                    <input className="text-input" autoFocus autoComplete="off" value={other}
                      placeholder="e.g. Pec deck" onChange={(e) => { setOther(e.target.value); setError(null); }} />
                  </label>
                  <p className="hint">Counts for the same muscle as {fromName}.</p>
                  {error && <p className="error" role="alert">{error}</p>}
                  <button type="submit" className="btn btn-primary">Add and swap</button>
                </form>
              )}
            </li>
          </ul>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
