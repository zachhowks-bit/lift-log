import { db } from '../db/db';
import { SLOT_ORDER } from '../data/library';
import { nextPrescription } from '../engine/progression';
import { defaultsFor, restFor } from '../engine/rules';
import { isDeloadWeek, weekInBlock } from '../engine/block';
import { isValidExposure } from '../engine/stall';
import { rampLegSets } from '../engine/volume';
import { applyCheckIn } from '../engine/checkin';
import type {
  CheckIn, CheckInAnswers, Exercise, ExerciseEntry, ProgramState, Session, SetLog, SlotId,
} from '../types';

const DAY_MS = 86_400_000;
const SESSIONS_PER_BLOCK = 20;

type Lib = Record<string, Exercise>;

async function loadLib(): Promise<Lib> {
  const lib: Lib = {};
  for (const ex of await db.exercises.toArray()) lib[ex.id] = ex;
  return lib;
}

async function getState(): Promise<ProgramState> {
  const state = await db.programState.get('main');
  if (!state) throw new Error('Program state is missing.');
  return state;
}

async function finishedSessionsNewestFirst(): Promise<Session[]> {
  const all = await db.sessions.toArray();
  return all.filter((s) => s.finishedAt !== null).sort((a, b) => b.startedAt - a.startedAt);
}

function buildEntry(ex: Exercise, finished: Session[], state: ProgramState, week: number, now: number): ExerciseEntry {
  const history: ExerciseEntry[] = [];
  for (const s of finished) {
    const e = s.entries.find((x) => x.exerciseId === ex.id);
    if (e) history.push(e);
  }
  const last = finished[0];
  const daysSinceLast = last && last.finishedAt !== null
    ? Math.floor((now - last.finishedAt) / DAY_MS)
    : null;
  const prescription = nextPrescription(ex, history, {
    week, daysSinceLast, sets: state.setsByExercise[ex.id] ?? defaultsFor(ex).sets,
  });
  return { exerciseId: ex.id, prescription, doneOutOfOrder: false, isDeload: isDeloadWeek(week), sets: [] };
}

export async function getActiveSession(): Promise<Session | null> {
  const open = (await db.sessions.toArray()).filter((s) => s.finishedAt === null);
  if (open.length === 0) return null;
  return open.sort((a, b) => b.startedAt - a.startedAt)[0];
}

export async function startNextSession(now: number): Promise<Session> {
  return db.transaction('rw', [db.sessions, db.exercises, db.templates, db.programState], async () => {
    const existing = await getActiveSession();
    if (existing) return existing;
    const state = await getState();
    const slot: SlotId = SLOT_ORDER[state.nextSlotIndex % SLOT_ORDER.length];
    const week = weekInBlock(state.sessionsInBlock);
    const lib = await loadLib();
    const tpl = await db.templates.get(slot);
    const finished = await finishedSessionsNewestFirst();
    const entries = (tpl?.ids ?? [])
      .filter((id) => lib[id] && !lib[id].avoid)
      .map((id) => buildEntry(lib[id], finished, state, week, now));
    const session: Session = {
      slot, startedAt: now, finishedAt: null, blockNumber: state.blockNumber, weekInBlock: week,
      entries, restEndsAt: null, lastLoggedExerciseId: null,
    };
    session.id = await db.sessions.add(session);
    return session;
  });
}

const isWhole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function validateSet(s: Partial<SetLog>): string | null {
  const w = s.weight;
  if (typeof w !== 'number' || !Number.isFinite(w) || w <= 0) return 'Enter a weight above 0.';
  if (!isWhole(s.fullReps) || !isWhole(s.partialReps) || s.fullReps < 0 || s.partialReps < 0) {
    return 'Reps must be whole numbers, 0 or more.';
  }
  if (s.fullReps === 0 && s.partialReps === 0) return 'Log at least 1 rep (full or partial).';
  if (!isWhole(s.rir) || s.rir < 0 || s.rir > 5) return 'Reps left must be 0–5.';
  if (s.kneePain !== null && s.kneePain !== undefined && (!isWhole(s.kneePain) || s.kneePain < 0 || s.kneePain > 10)) {
    return 'Knee pain must be 0–10.';
  }
  return null;
}

async function openSession(sessionId: number): Promise<Session> {
  const s = await db.sessions.get(sessionId);
  if (!s) throw new Error('Session not found.');
  if (s.finishedAt !== null) throw new Error('Session is already finished.');
  return s;
}

export async function logSet(sessionId: number, exerciseId: string, set: SetLog, now: number): Promise<Session> {
  const err = validateSet(set);
  if (err) throw new Error(err);
  return db.transaction('rw', [db.sessions, db.exercises], async () => {
    const s = await openSession(sessionId);
    const idx = s.entries.findIndex((e) => e.exerciseId === exerciseId);
    if (idx < 0) throw new Error('Exercise is not in this session.');
    const lib = await loadLib();

    const prev = s.lastLoggedExerciseId
      ? s.entries.find((e) => e.exerciseId === s.lastLoggedExerciseId)
      : undefined;
    const prevSet = prev?.sets[prev.sets.length - 1];
    if (prev && prevSet && prevSet.restTakenSec === null && !prevSet.restSkipped && lib[prev.exerciseId]) {
      prevSet.restTakenSec = restFor(lib[prev.exerciseId], prevSet);
    }

    const entry = s.entries[idx];
    if (entry.sets.length === 0 && s.entries.slice(0, idx).some((e) => e.sets.length === 0)) {
      entry.doneOutOfOrder = true;
    }
    entry.sets.push({ ...set, restTakenSec: null, restSkipped: false });
    const ex = lib[exerciseId];
    s.restEndsAt = now + (ex ? restFor(ex, set) : 0) * 1000;
    s.lastLoggedExerciseId = exerciseId;
    await db.sessions.put(s);
    return s;
  });
}

export async function skipRest(sessionId: number, now: number): Promise<Session> {
  return db.transaction('rw', [db.sessions, db.exercises], async () => {
    const s = await openSession(sessionId);
    if (s.restEndsAt === null) return s;
    const entry = s.entries.find((e) => e.exerciseId === s.lastLoggedExerciseId);
    const last = entry?.sets[entry.sets.length - 1];
    const ex = entry ? await db.exercises.get(entry.exerciseId) : undefined;
    if (last && ex) {
      const planned = restFor(ex, last);
      last.restSkipped = true;
      last.restTakenSec = Math.max(0, Math.round((now - (s.restEndsAt - planned * 1000)) / 1000));
    }
    s.restEndsAt = null;
    await db.sessions.put(s);
    return s;
  });
}

export async function swapExercise(sessionId: number, fromId: string, toId: string): Promise<Session> {
  return db.transaction('rw', [db.sessions, db.exercises, db.programState], async () => {
    const s = await openSession(sessionId);
    const idx = s.entries.findIndex((e) => e.exerciseId === fromId);
    if (idx < 0) throw new Error('Exercise is not in this session.');
    if (s.entries[idx].sets.length > 0) throw new Error("Can't swap after logging sets.");
    if (s.entries.some((e) => e.exerciseId === toId)) throw new Error('That exercise is already in this workout.');
    const to = await db.exercises.get(toId);
    if (!to || to.avoid) throw new Error('That exercise is not available.');
    const state = await getState();
    const finished = await finishedSessionsNewestFirst();
    s.entries[idx] = buildEntry(to, finished, state, s.weekInBlock, s.startedAt);
    await db.sessions.put(s);
    return s;
  });
}

export async function finishSession(sessionId: number, now: number): Promise<{ checkInDue: boolean }> {
  return db.transaction('rw', [db.sessions, db.exercises, db.templates, db.programState], async () => {
    const s = await openSession(sessionId);
    s.finishedAt = now;
    s.restEndsAt = null;
    await db.sessions.put(s);

    let state = await getState();
    state = {
      ...state,
      nextSlotIndex: (state.nextSlotIndex + 1) % SLOT_ORDER.length,
      sessionsInBlock: state.sessionsInBlock + 1,
    };

    if (state.sessionsInBlock % 4 === 0 && weekInBlock(state.sessionsInBlock - 1) < 5 && !state.legRampFrozen) {
      const lib = await loadLib();
      const pains: number[] = [];
      for (const f of await finishedSessionsNewestFirst()) {
        if (f.blockNumber !== state.blockNumber || f.weekInBlock !== s.weekInBlock) continue;
        for (const e of f.entries) for (const x of e.sets) if (x.kneePain !== null) pains.push(x.kneePain);
      }
      const weekKneeMax = pains.length ? Math.max(...pains) : null;
      const lowerIds: string[] = [];
      for (const slot of ['lowerA', 'lowerB'] as SlotId[]) {
        for (const id of (await db.templates.get(slot))?.ids ?? []) {
          if (!lowerIds.includes(id)) lowerIds.push(id);
        }
      }
      state = rampLegSets(state, weekKneeMax, false, lib, lowerIds).state;
    }
    await db.programState.put(state);
    return { checkInDue: state.sessionsInBlock >= SESSIONS_PER_BLOCK };
  });
}

export async function isCheckInDue(): Promise<boolean> {
  return (await getState()).sessionsInBlock >= SESSIONS_PER_BLOCK;
}

export async function blockProgressPct(): Promise<number> {
  const state = await getState();
  const finished = (await finishedSessionsNewestFirst()).filter((s) => s.blockNumber === state.blockNumber).reverse();
  const byEx = new Map<string, ExerciseEntry[]>();
  for (const s of finished) {
    for (const e of s.entries) {
      if (e.isDeload || e.sets.length === 0 || !isValidExposure(e)) continue;
      byEx.set(e.exerciseId, [...(byEx.get(e.exerciseId) ?? []), e]);
    }
  }
  const top = (e: ExerciseEntry) => Math.max(...e.sets.map((x) => x.weight));
  const reps = (e: ExerciseEntry) => e.sets.reduce((n, x) => n + x.fullReps, 0);
  let eligible = 0;
  let progressed = 0;
  for (const list of byEx.values()) {
    if (list.length < 2) continue;
    eligible++;
    const first = list[0];
    const last = list[list.length - 1];
    if (top(last) > top(first) || (top(last) === top(first) && reps(last) > reps(first))) progressed++;
  }
  return eligible === 0 ? 0 : Math.round((100 * progressed) / eligible);
}

export async function submitCheckIn(answers: CheckInAnswers, now = Date.now()): Promise<string[]> {
  if (!(await isCheckInDue())) throw new Error('Check-in is not due yet.');
  const pct = await blockProgressPct();
  return db.transaction('rw', [db.exercises, db.templates, db.programState, db.checkIns, db.sessions], async () => {
    const state = await getState();
    const lib = await loadLib();
    const templates = {} as Record<SlotId, string[]>;
    for (const slot of SLOT_ORDER) templates[slot] = [...((await db.templates.get(slot))?.ids ?? [])];
    const res = applyCheckIn(state, answers, pct, lib, templates);
    await db.programState.put({
      ...res.state, sessionsInBlock: 0, blockNumber: state.blockNumber + 1,
      legRampFrozen: answers.knee === 'worse',
    });
    await db.templates.bulkPut(SLOT_ORDER.map((slot) => ({ slot, ids: res.templates[slot] })));
    const row: CheckIn = { ...answers, blockNumber: state.blockNumber, at: now, pctProgressed: pct, changes: res.changes };
    await db.checkIns.add(row);
    return res.changes;
  });
}
