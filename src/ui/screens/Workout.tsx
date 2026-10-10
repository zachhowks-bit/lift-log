import { useCallback, useEffect, useState } from 'react';
import { getExercises, slotName } from '../../state/library';
import { finishSession, getActiveSession, logSet, skipRest, swapExercise } from '../../state/session';
import { defaultKneePain, swapOptions } from '../../state/workout';
import type { Exercise, Session, SetLog } from '../../types';
import { beep } from '../audio';
import ExerciseCard from '../components/ExerciseCard';
import RestTimer from '../components/RestTimer';
import SwapSheet from '../components/SwapSheet';
import { useRestRemaining } from '../useRestRemaining';

interface Props {
  onExit: () => void;
  onFinished: (checkInDue: boolean) => void;
  onError: (message: string) => void;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** First entry that still needs sets, preferring the one logged last. */
function pickExpanded(s: Session): string | null {
  const last = s.entries.find((e) => e.exerciseId === s.lastLoggedExerciseId);
  if (last && last.sets.length < last.prescription.sets) return last.exerciseId;
  const next = s.entries.find((e) => e.sets.length < e.prescription.sets);
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
      if (set.kneePain !== null) setKnee(set.kneePain);
      setSession(s);
      const entry = s.entries.find((e) => e.exerciseId === exerciseId);
      if (entry && entry.sets.length >= entry.prescription.sets) setExpanded(pickExpanded(s));
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

  const pickSwap = async (toId: string) => {
    if (!session?.id || !swapFor) return;
    try {
      const s = await swapExercise(session.id, swapFor, toId);
      setSession(s);
      setExpanded(toId);
      setSwapFor(null);
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
      onFinished(checkInDue);
    } catch (e) {
      onError(msg(e));
      setFinishing(false);
    }
  };

  if (!session) return <main className="screen"><p className="hint">Loading…</p></main>;

  const nextId = pickExpanded(session);
  const swapName = swapFor ? lib[swapFor]?.name ?? swapFor : '';

  return (
    <main className="screen workout">
      <header className="workout-head">
        <button type="button" className="btn-link" onClick={onExit}>‹ Home</button>
        <h1 className="workout-title">{slotName(session.slot)}</h1>
        <p className="workout-sub">Block {session.blockNumber} · Week {session.weekInBlock}</p>
      </header>
      {session.entries.map((entry) => (
        <ExerciseCard key={entry.exerciseId} entry={entry} exercise={lib[entry.exerciseId]}
          expanded={expanded === entry.exerciseId} locked={resting} defaultKnee={knee}
          onToggle={() => setExpanded((cur) => (cur === entry.exerciseId ? null : entry.exerciseId))}
          onLog={(set) => log(entry.exerciseId, set)} onSwap={() => void openSwap(entry.exerciseId)} />
      ))}
      <button type="button" className="btn btn-finish" disabled={finishing} onClick={() => void finish()}>
        Finish workout
      </button>
      {swapFor && (
        <SwapSheet fromName={swapName} options={options} onPick={(id) => void pickSwap(id)} onClose={() => setSwapFor(null)} />
      )}
      {resting && (
        <RestTimer remainingMs={remaining} onSkip={() => void skip()}
          nextLabel={nextId ? lib[nextId]?.name : undefined} />
      )}
    </main>
  );
}
