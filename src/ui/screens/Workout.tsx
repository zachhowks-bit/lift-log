import { useCallback, useEffect, useState } from 'react';
import { addCustomExercise, getExercises, slotName } from '../../state/library';
import { deleteSet, editSet, finishSession, getActiveSession, logSet, skipRest, swapExercise } from '../../state/session';
import { isWorking } from '../../engine/rules';
import { defaultKneePain, swapOptions } from '../../state/workout';
import type { Exercise, Session, SetLog } from '../../types';
import { beep } from '../audio';
import ExerciseCard from '../components/ExerciseCard';
import RestTimer from '../components/RestTimer';
import SetEditSheet from '../components/SetEditSheet';
import SwapSheet from '../components/SwapSheet';
import { useRestRemaining } from '../useRestRemaining';

interface Props {
  onExit: () => void;
  onFinished: (checkInDue: boolean, sessionId: number) => void;
  onError: (message: string) => void;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** First entry that still needs sets, preferring the one logged last. */
function pickExpanded(s: Session): string | null {
  const work = (e: Session['entries'][number]) => e.sets.filter(isWorking).length;
  const last = s.entries.find((e) => e.exerciseId === s.lastLoggedExerciseId);
  if (last && work(last) < last.prescription.sets) return last.exerciseId;
  const next = s.entries.find((e) => work(e) < e.prescription.sets);
  return next?.exerciseId ?? null;
}

export default function Workout({ onExit, onFinished, onError }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [lib, setLib] = useState<Record<string, Exercise>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [knee, setKnee] = useState(0);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [options, setOptions] = useState<Exercise[] | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [restMin, setRestMin] = useState(false);
  const [editing, setEditing] = useState<{ exerciseId: string; index: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getActiveSession();
      if (!alive) return;
      if (!s) { onExit(); return; }
      const [l, k] = await Promise.all([getExercises(), defaultKneePain(s)]);
      if (!alive) return;
      setLib(l);
      setKnee(k);
      setSession(s);
      setExpanded(pickExpanded(s));
    })().catch((e) => onError(msg(e)));
    return () => { alive = false; };
  }, [onExit, onError]);

  const remaining = useRestRemaining(session?.restEndsAt ?? null, beep);
  const resting = remaining > 0;

  const log = useCallback(async (exerciseId: string, set: SetLog) => {
    if (!session?.id) return;
    try {
      const s = await logSet(session.id, exerciseId, set, Date.now());
      setRestMin(false);
      if (set.kneePain !== null) setKnee(set.kneePain);
      setSession(s);
      const entry = s.entries.find((e) => e.exerciseId === exerciseId);
      if (entry && entry.sets.filter(isWorking).length >= entry.prescription.sets) setExpanded(pickExpanded(s));
    } catch (e) {
      onError(msg(e));
    }
  }, [session, onError]);

  const skip = async () => {
    if (!session?.id) return;
    try {
      setSession(await skipRest(session.id, Date.now()));
    } catch (e) {
      onError(msg(e));
    }
  };

  const openSwap = async (exerciseId: string) => {
    if (!session) return;
    setSwapFor(exerciseId);
    setOptions(null);
    try {
      setOptions(await swapOptions(session, exerciseId));
    } catch (e) {
      setSwapFor(null);
      onError(msg(e));
    }
  };

  const pickSwap = async (toId: string, always: boolean) => {
    if (!session?.id || !swapFor) return;
    try {
      const s = await swapExercise(session.id, swapFor, toId, always);
      setSession(s);
      setExpanded(toId);
      setSwapFor(null);
    } catch (e) {
      onError(msg(e));
    }
  };

  const swapOther = async (name: string, always: boolean) => {
    const from = swapFor ? lib[swapFor] : undefined;
    if (!from) return;
    try {
      const ex = await addCustomExercise({
        name, type: from.type, primary: from.primary[0], equipment: from.equipment,
        lower: from.lower, kneeSensitive: false,
      });
      setLib(await getExercises());
      await pickSwap(ex.id, always);
    } catch (e) {
      onError(msg(e));
    }
  };

  const saveEdit = async (set: SetLog) => {
    if (!session?.id || !editing) return;
    try {
      setSession(await editSet(session.id, editing.exerciseId, editing.index, set));
      setEditing(null);
    } catch (e) {
      onError(msg(e));
    }
  };

  const removeSet = async () => {
    if (!session?.id || !editing) return;
    try {
      setSession(await deleteSet(session.id, editing.exerciseId, editing.index));
      setEditing(null);
    } catch (e) {
      onError(msg(e));
    }
  };

  const finish = async () => {
    if (!session?.id) return;
    if (session.entries.some((e) => e.sets.length === 0)
      && !window.confirm('Some exercises have no sets. Finish anyway?')) return;
    setFinishing(true);
    try {
      const { checkInDue } = await finishSession(session.id, Date.now());
      onFinished(checkInDue, session.id);
    } catch (e) {
      onError(msg(e));
      setFinishing(false);
    }
  };

  if (!session) return <main className="screen"><p className="hint">Loading…</p></main>;

  const nextId = pickExpanded(session);
  const swapName = swapFor ? lib[swapFor]?.name ?? swapFor : '';
  const editSetLog = editing
    ? session.entries.find((e) => e.exerciseId === editing.exerciseId)?.sets[editing.index]
    : undefined;

  return (
    <main className="screen workout">
      <header className="workout-head">
        <button type="button" className="btn-link" onClick={onExit}>‹ Home</button>
        <h1 className="workout-title">{slotName(session.slot)}</h1>
        <p className="workout-sub">Block {session.blockNumber} · Round {session.weekInBlock}</p>
      </header>
      {session.entries.map((entry) => (
        <ExerciseCard key={entry.exerciseId} entry={entry} exercise={lib[entry.exerciseId]}
          expanded={expanded === entry.exerciseId} locked={resting} defaultKnee={knee}
          onToggle={() => setExpanded((cur) => (cur === entry.exerciseId ? null : entry.exerciseId))}
          onLog={(set) => log(entry.exerciseId, set)} onSwap={() => void openSwap(entry.exerciseId)}
          onEditSet={(index) => setEditing({ exerciseId: entry.exerciseId, index })}
          firstOfWorkout={session.entries.every((e) => e.sets.length === 0)} />
      ))}
      <button type="button" className="btn btn-finish" disabled={finishing} onClick={() => void finish()}>
        Finish workout
      </button>
      {swapFor && (
        <SwapSheet fromName={swapName} options={options} onPick={(id, always) => void pickSwap(id, always)}
          onOther={(name, always) => void swapOther(name, always)} onClose={() => setSwapFor(null)} />
      )}
      {editing && editSetLog && lib[editing.exerciseId] && (
        <SetEditSheet exercise={lib[editing.exerciseId]} index={editing.index} set={editSetLog}
          onSave={saveEdit} onDelete={removeSet} onClose={() => setEditing(null)} />
      )}
      {resting && (
        <RestTimer remainingMs={remaining} onSkip={() => void skip()}
          nextLabel={nextId ? lib[nextId]?.name : undefined}
          minimized={restMin} onMinimize={() => setRestMin(true)} onExpand={() => setRestMin(false)} />
      )}
    </main>
  );
}
