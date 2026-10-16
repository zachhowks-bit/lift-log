import type { CheckInAnswers, Exercise, Muscle, ProgramState, SlotId } from '../types';
import { LEG_MUSCLES } from '../types';
import { ALL_MUSCLES, MAX_TARGET, currentSets } from './volume';

const SLOT_ORDER: SlotId[] = ['pushA', 'pullA', 'legsA', 'pushB', 'pullB', 'legsB'];
const UPPER_SLOTS: SlotId[] = ['pushA', 'pullA', 'pushB', 'pullB'];
const LOWER_SLOTS: SlotId[] = ['legsA', 'legsB'];
const UPPER_MUSCLES: Muscle[] = ALL_MUSCLES.filter(m => !LEG_MUSCLES.includes(m) && m !== 'abs');

type Templates = Record<SlotId, string[]>;

/** Replace `from` in the given slots with the first alternative accepted by `ok`. Returns the first (from,to) swap made. */
function swapIn(
  templates: Templates, slots: SlotId[], from: string, lib: Record<string, Exercise>,
  ok: (alt: Exercise) => boolean,
): { from: string; to: string } | null {
  let first: { from: string; to: string } | null = null;
  const src = lib[from];
  if (!src) return null;
  for (const slot of slots) {
    const t = templates[slot];
    const idx = t.indexOf(from);
    if (idx < 0) continue;
    const to = src.alternatives.find(a => lib[a] && !lib[a].avoid && ok(lib[a]) && !t.includes(a));
    if (!to) continue;
    templates[slot] = t.map(id => (id === from ? to : id));
    first = first ?? { from, to };
  }
  return first;
}

export function applyCheckIn(
  state: ProgramState, a: CheckInAnswers, pctProgressed: number,
  lib: Record<string, Exercise>, templates: Templates,
): { state: ProgramState; templates: Templates; changes: string[] } {
  const volumeTargets = { ...state.volumeTargets };
  const setsByExercise = { ...state.setsByExercise };
  const next: ProgramState = { ...state, volumeTargets, setsByExercise };
  const tpl = Object.fromEntries(SLOT_ORDER.map((s) => [s, [...(templates[s] ?? [])]])) as Templates;
  const changes: string[] = [];
  const sets = (id: string) => currentSets(next, id, lib);
  const name = (id: string) => lib[id]?.name ?? id;

  if (a.recovery === 'rarely' && pctProgressed >= 60) {
    for (const m of UPPER_MUSCLES) volumeTargets[m] = Math.min(MAX_TARGET, volumeTargets[m] + 2);
    for (const slot of UPPER_SLOTS) {
      const c = tpl[slot].find(id => lib[id]?.type === 'C');
      if (c) setsByExercise[c] = sets(c) + 1;
    }
    changes.push('More upper volume: +2 sets/muscle');
  } else if (a.recovery === 'often') {
    for (const m of ALL_MUSCLES) volumeTargets[m] = Math.max(4, volumeTargets[m] - 2);
    for (const slot of SLOT_ORDER) {
      const ids = tpl[slot].filter(id => lib[id]);
      if (ids.length === 0) continue;
      let top = ids[0];
      for (const id of ids) if (sets(id) > sets(top)) top = id;
      const reduced = Math.max(2, sets(top) - 1);
      if (reduced !== sets(top)) setsByExercise[top] = reduced;
    }
    changes.push('Less volume: −2 sets/muscle (recovery)');
  }

  if (a.knee === 'worse') {
    for (const slot of LOWER_SLOTS) {
      for (const id of [...tpl[slot]]) {
        if (!lib[id]?.kneeSensitive) continue;
        const r = swapIn(tpl, [slot], id, lib, alt => !alt.kneeSensitive);
        if (r) changes.push(`Knee: swapped ${name(r.from)} → ${name(r.to)}`);
      }
    }
    next.legRampFrozen = true;
  } else {
    next.legRampFrozen = false;
  }

  for (const id of a.swapIds) {
    const r = swapIn(tpl, SLOT_ORDER, id, lib, () => true);
    if (r) changes.push(`Swapped ${name(r.from)} → ${name(r.to)}`);
  }

  if (a.motivation === 'low') {
    const all = SLOT_ORDER.flatMap(s => tpl[s]);
    const targets: string[] = [];
    for (let i = all.length - 1; i >= 0 && targets.length < 2; i--) {
      if (lib[all[i]]?.type === 'I' && !targets.includes(all[i])) targets.push(all[i]);
    }
    for (const id of targets) {
      const r = swapIn(tpl, SLOT_ORDER, id, lib, () => true);
      if (r) changes.push(`Variety: swapped ${name(r.from)} → ${name(r.to)}`);
    }
  }

  return { state: next, templates: tpl, changes };
}
