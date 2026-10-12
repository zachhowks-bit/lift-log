import type { Exercise, ExerciseEntry, Prescription } from '../types';
import { roundTo } from './round';
import { defaultsFor, effectiveRir } from './rules';
import { isDeloadWeek, targetRirLabel } from './block';
import { breakFactor } from './breaks';
import { kneeAction } from './knee';
import { isStalled, isValidExposure, topWeight } from './stall';

export interface ProgressionCtx { week: number; daysSinceLast: number | null; sets: number }

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

  const entries = history.filter((e) => !e.isDeload && e.sets.length > 0);
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
  let targets = rep(repMin);
  let why: string;
  let suggestSwap = false;
  let increased = false;

  if (valid.length === 0) {
    why = "Same weight: last session didn't count (rest skipped / out of order)";
  } else if (last.sets.length >= last.prescription.sets
    && last.sets.every((s) => s.fullReps >= repMax && effectiveRir(s) >= 1)) {
    weight = lastTop + ex.increment;
    increased = true;
    why = `+${fmt(ex.increment)} kg: hit ${last.sets.map((s) => s.fullReps).join('/')} last time`;
  } else if (missedBottom(last, repMin)) {
    if (missedBottom(valid[1], repMin)) {
      weight = lastTop * 0.925;
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
    const newest = history.find((e) => e.sets.length > 0) ?? last;
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
      weight = lastTop * 0.9;
      targets = rep(repMin);
      suggestSwap = true;
      why = `−10% + try a swap: knee pain ${maxPain}`;
    }
  }

  let prefix = '';
  const bf = breakFactor(ctx.daysSinceLast);
  if (bf < 1) {
    weight *= bf;
    prefix = `${bf <= 0.8 ? '−20%' : '−10%'}: back after ${ctx.daysSinceLast} days. `;
  }

  if (deload) {
    weight *= 0.9;
    targets = rep(repMin);
    why = 'Deload week: lighter, easy reps';
  }
  why = prefix + why;

  if (isStalled(valid)) {
    suggestSwap = true;
    why += ' Stalled 3 sessions — consider a swap.';
  }

  return {
    ...base, weight: roundTo(weight, ex.increment), targetReps: targets, why,
    needsCalibration: false, suggestSwap,
  };
}
