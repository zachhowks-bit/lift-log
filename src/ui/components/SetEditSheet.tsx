import type { Exercise, SetLog } from '../../types';
import SetRow from './SetRow';

interface Props {
  exercise: Exercise;
  index: number;
  set: SetLog;
  onSave: (set: SetLog) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

/** Bottom sheet to fix or remove a logged set. */
export default function SetEditSheet({ exercise, index, set, onSave, onDelete, onClose }: Props) {
  const remove = async () => {
    if (!window.confirm(`Delete set ${index + 1} of ${exercise.name}?`)) return;
    await onDelete();
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Edit set" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">Edit set {index + 1}</h2>
        <p className="hint">{exercise.name}</p>
        <SetRow exercise={exercise} setNumber={index + 1} defaultWeight={set.weight} defaultReps={set.fullReps}
          defaultKnee={set.kneePain ?? 0} locked={false} initial={set} submitLabel="Save set" onLog={onSave} />
        <button type="button" className="btn btn-danger" onClick={() => void remove()}>Delete set</button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
