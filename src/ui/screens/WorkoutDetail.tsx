import { useCallback, useEffect, useState } from 'react';
import { workoutDetail, type WorkoutDetail as Detail } from '../../state/history';
import { deleteSet, deleteWorkout, editSet } from '../../state/session';
import type { SetLog } from '../../types';
import SetEditSheet from '../components/SetEditSheet';
import SetList from '../components/SetList';
import { longDate, statsLine } from '../components/WorkoutRow';
import { errMsg } from '../labels';

interface Props {
  id: number;
  /** 'summary' right after finishing; 'history' when opened from a list. */
  mode: 'summary' | 'history';
  onBack: () => void;
  onError: (message: string) => void;
}

/** One finished workout: stats, PRs and every set, all editable. Also the post-workout summary. */
export default function WorkoutDetail({ id, mode, onBack, onError }: Props) {
  const [d, setD] = useState<Detail | null | undefined>(undefined);
  const [editing, setEditing] = useState<{ exerciseId: string; index: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await workoutDetail(id));
    } catch (e) {
      onError(errMsg(e));
    }
  }, [id, onError]);
  useEffect(() => { void load(); }, [load]);

  if (d === undefined) return <main className="screen"><p className="hint">Loading…</p></main>;
  if (d === null) {
    return (
      <main className="screen">
        <p className="hint">This workout no longer exists.</p>
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
      </main>
    );
  }

  const { session, summary, names, lib } = d;
  const prIdx = (exerciseId: string) => summary.prs.filter((p) => p.exerciseId === exerciseId).map((p) => p.setIndex);
  const editSetLog = editing ? session.entries.find((e) => e.exerciseId === editing.exerciseId)?.sets[editing.index] : undefined;

  const save = async (set: SetLog) => {
    if (!editing) return;
    try {
      await editSet(id, editing.exerciseId, editing.index, set);
      setEditing(null);
      await load();
    } catch (e) {
      onError(errMsg(e));
    }
  };
  const remove = async () => {
    if (!editing) return;
    try {
      await deleteSet(id, editing.exerciseId, editing.index);
      setEditing(null);
      await load();
    } catch (e) {
      onError(errMsg(e));
    }
  };
  const removeWorkout = async () => {
    if (!window.confirm('Delete this whole workout? This can’t be undone.')) return;
    try {
      await deleteWorkout(id);
      onBack();
    } catch (e) {
      onError(errMsg(e));
    }
  };

  const done = mode === 'summary';
  return (
    <main className="screen detail">
      {!done && <button type="button" className="btn-link" onClick={onBack}>‹ Back</button>}
      <header className="detail-head">
        {done && <p className="detail-kicker">Workout done</p>}
        <h1 className="workout-title">{summary.slotName}</h1>
        <p className="workout-sub">{longDate(summary.date)}</p>
      </header>

      <dl className="detail-stats">
        <div><dt>Sets</dt><dd>{summary.sets}</dd></div>
        <div><dt>Volume (kg)</dt><dd>{summary.volumeKg.toLocaleString('en-GB')}</dd></div>
        <div><dt>Time</dt><dd>{summary.durationMin !== null ? `${summary.durationMin} min` : '–'}</dd></div>
      </dl>

      {summary.prs.length > 0 && (
        <section className="pr-wall" aria-label="Personal records">
          <h2 className="pr-wall-title">{summary.prs.length === 1 ? 'New personal record' : `${summary.prs.length} new personal records`}</h2>
          <ul className="pr-list">
            {summary.prs.map((p) => (
              <li key={`${p.exerciseId}-${p.kind}`} className="pr-item">
                <span className="pr-name">{p.name}</span>
                <span className="pr-set">{p.setText}</span>
                <span className="pr-delta">
                  {p.kind === 'weight' ? `Heaviest ever, up from ${p.previous} kg` : `Best estimated max: ${p.value} kg (was ${p.previous})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done && summary.prs.length === 0 && <p className="hint">{statsLine(summary)}. Logged and counted for next time.</p>}

      {session.entries.filter((e) => e.sets.length > 0).map((e) => (
        <section key={e.exerciseId} className="card card-static" aria-label={names[e.exerciseId]}>
          <h2 className="card-name detail-ex">{names[e.exerciseId]}</h2>
          <div className="card-body">
            <SetList sets={e.sets} prIndexes={prIdx(e.exerciseId)}
              onEdit={(index) => setEditing({ exerciseId: e.exerciseId, index })} />
          </div>
        </section>
      ))}
      <p className="hint">Tap a set to fix it. Changes count toward your next workout.</p>

      {done ? (
        <button type="button" className="btn btn-primary btn-big" onClick={onBack}>Done</button>
      ) : (
        <button type="button" className="btn btn-danger" onClick={() => void removeWorkout()}>Delete workout</button>
      )}

      {editing && editSetLog && lib[editing.exerciseId] && (
        <SetEditSheet exercise={lib[editing.exerciseId]} index={editing.index} set={editSetLog}
          onSave={save} onDelete={remove} onClose={() => setEditing(null)} />
      )}
    </main>
  );
}
