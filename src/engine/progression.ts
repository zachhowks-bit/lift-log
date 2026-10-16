import type { Exercise, ExerciseEntry, Prescription } from '../types';
import { roundTo } from './round';
import { defaultsFor, effectiveRir, workingOnly } from './rules';
import { isDeloadWeek, targetRirLabel } from './block';
import { breakAdjust } from './breaks';
import { kneeAction } from './knee';
import { isStalled, isValidExposure, topWeight } from './stall';

export interface ProgressionCtx {
  week: number; daysSinceLast: number | null; sets: number;
  /** Working-set weights already used on this exercise: the gym's real stack/plate steps. */
  knownWeights?: number[];
}

const tenth = (n: number) => Math.round(n * 10) / 10;

/** Next weight up: a known heavier weight within two increments, else last + increment. */
function stepUp(last: number, inc: number, known: number[]): number {
  const up = known.filter((w) => w > last + 1e-9 && w <= last + 2 * inc + 1e-9).sort((a, b) => a - b)[0];
  return up ?? tenth(last + inc);
}

/** Scaled-down weight: the heaviest known weight in [85%, 100%] of target, else rounded to the increment. */
function scaleTo(target: number, inc: number, known: number[]): number {
  const hit = known.filter((w) => w <= target + 1e-9 && w >= target * 0.85).sort((a, b) => b - a)[0];
  return hit ?? roundTo(target, inc);
}

const fmt = (n: number): string => String(Number(n.toFixed(4)));

function missedBottom(e: ExerciseEntry | undefined, repMin: number): boolean {
  return !!e && e.sets.some((s) => s.fullReps < repMin && effectiveRir(s) === 0);
}

function plusOneTargets(last: ExerciseEntry, sets: number, repMax: number): { targets: number[]; n: number; k: number } {
  const reps = last.sets.map((s) => s.fullReps).slice(0, sets);
  const pad = Math.min(...last.sets.map((s) => s.fullReps));
  while (reps.length < sets) reps.push(pad);
  const low = Math.min(...reps);
  const k = reps.indexOf(low);
  const n = Math.min(repMax, low + 1);
  const targets = reps.slice();
  targets[k] = n;
  return { targets, n, k: k + 1 };
}

export function nextPrescription(ex: Exercise, history: ExerciseEntry[], ctx: ProgressionCtx): Prescription {
  const d = defaultsFor(ex);
  const { repMin, repMax, restSec } = d;
  const deload = isDeloadWeek(ctx.week);
  const sets = deload ? Math.ceil(ctx.sets / 2) : ctx.sets;
  const base = {
    exerciseId: ex.id, sets, repMin, repMax, restSec,
    targetRir: targetRirLabel(ctx.week), suggestSwap: false,
  };
  const rep = (n: number) => Array<number>(sets).fill(n);

  const working = history.map(workingOnly);
  const entries = working.filter((e) => !e.isDeload && e.sets.length > 0);
  const known = ctx.knownWeights ?? [];
  if (entries.length === 0) {
    return {
      ...base, weight: null, targetReps: rep(repMax), needsCalibration: true,
      why: `First time: pick a weight you could do for ${repMax} with ~2 reps left`,
    };
  }

  const valid = entries.filter(isValidExposure);
  const last = valid[0] ?? entries[0];
  const lastTop = topWeight(last);
  let weight = lastTop;
  let scale = 1;
  let targets = rep(repMin);
  let why: string;
  let suggestSwap = false;
  let increased = false;

  if (valid.length === 0) {
    why = "Same weight: last session didn't count (rest skipped / out of order)";
  } else if (last.sets.length >= last.prescription.sets
    && last.sets.every((s) => s.fullReps >= repMax && effectiveRir(s) >= 1)) {
    weight = stepUp(lastTop, ex.increment, known);
    increased = true;
    why = `+${fmt(tenth(weight - lastTop))} kg: hit ${last.sets.map((s) => s.fullReps).join('/')} last time`;
  } else if (missedBottom(last, repMin)) {
    if (missedBottom(valid[1], repMin)) {
      scale = 0.925;
      why = '−7.5%: missed bottom of range twice';
    } else {
      why = `Same weight: missed ${repMin} last time`;
    }
  } else {
    const p = plusOneTargets(last, sets, repMax);
    targets = p.targets;
    why = `Same weight: aim ${p.n} reps on set ${p.k}`;
  }

  if (ex.lower) {
    // Safety reads the newest session with sets, whatever its validity or deload status.
    const newest = working.find((e) => e.sets.length > 0) ?? last;
    const pains = newest.sets.map((s) => s.kneePain).filter((x): x is number => x !== null);
    const maxPain = pains.length ? Math.max(...pains) : null;
    const action = kneeAction(maxPain);
    if (action === 'noIncrease' && increased) {
      weight = lastTop;
      increased = false;
      const p = plusOneTargets(last, sets, repMax);
      targets = p.targets;
      why = `Held: knee pain ${maxPain} last time`;
    } else if (action === 'reduceAndSwap') {
      weight = lastTop;
      increased = false;
      scale = 0.9;
      targets = rep(repMin);
      suggestSwap = true;
      why = `−10% + try a swap: knee pain ${maxPain}`;
    }
  }

  let prefix = '';
  const br = breakAdjust(ctx.daysSinceLast);
  if (br.label) {
    if (br.hold && increased) {
      weight = lastTop;
      increased = false;
      const p = plusOneTargets(last, sets, repMax);
      targets = p.targets;
      why = `Same weight: aim ${p.n} reps on set ${p.k}`;
    }
    scale *= br.factor;
    prefix = br.label;
  }

  if (deload) {
    scale *= 0.9;
    targets = rep(repMin);
    why = 'Deload week: lighter, easy reps';
  }
  why = prefix + why;

  if (isStalled(valid)) {
    suggestSwap = true;
    why += ' Stalled 3 sessions — consider a swap.';
  }

  return {
    ...base, weight: scale < 1 ? scaleTo(weight * scale, ex.increment, known) : weight, targetReps: targets, why,
    needsCalibration: false, suggestSwap,
  };
}
