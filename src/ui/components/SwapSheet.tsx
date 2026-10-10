import type { Exercise } from '../../types';

interface Props {
  fromName: string;
  options: Exercise[] | null;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** Bottom sheet listing swap alternatives. `options === null` while loading. */
export default function SwapSheet({ fromName, options, onPick, onClose }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Swap exercise" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Swap {fromName}</h2>
        {options === null && <p className="hint">Loading…</p>}
        {options !== null && options.length === 0 && <p className="hint">No alternatives available.</p>}
        {options !== null && options.length > 0 && (
          <ul className="sheet-list">
            {options.map((o) => (
              <li key={o.id}>
                <button type="button" className="sheet-item" onClick={() => onPick(o.id)}>{o.name}</button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
