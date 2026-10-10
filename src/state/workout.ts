import { db } from '../db/db';
import type { Exercise, Session } from '../types';

/** Alternatives for an exercise that exist, are not marked avoid and are not already in the session. */
export async function swapOptions(session: Session, exerciseId: string): Promise<Exercise[]> {
  const ex = await db.exercises.get(exerciseId);
  if (!ex) return [];
  const inSession = new Set(session.entries.map((e) => e.exerciseId));
  const out: Exercise[] = [];
  for (const id of ex.alternatives) {
    if (inSession.has(id)) continue;
    const alt = await db.exercises.get(id);
    if (alt && !alt.avoid) out.push(alt);
  }
  return out;
}

/** Latest knee pain in a session: the last-logged exercise's last set, else the last value in entry order. */
function latestKnee(s: Session): number | null {
  const lastEntry = s.lastLoggedExerciseId ? s.entries.find((e) => e.exerciseId === s.lastLoggedExerciseId) : undefined;
  const lastSet = lastEntry?.sets[lastEntry.sets.length - 1];
  if (lastSet && lastSet.kneePain !== null) return lastSet.kneePain;
  const pains = s.entries.flatMap((e) => e.sets.map((x) => x.kneePain)).filter((x): x is number => x !== null);
  return pains.length ? pains[pains.length - 1] : null;
}

/** Default knee pain for the next lower-body set: this session, else the latest in history, else 0. */
export async function defaultKneePain(session: Session): Promise<number> {
  const here = latestKnee(session);
  if (here !== null) return here;
  const finished = (await db.sessions.toArray())
    .filter((s) => s.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const s of finished) {
    const k = latestKnee(s);
    if (k !== null) return k;
  }
  return 0;
}
