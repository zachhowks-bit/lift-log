import { EXERCISES, LEGACY_SLOTS, SLOT_ORDER, TEMPLATES, initialProgramState } from '../data/library';
import { SCHEMA_VERSION } from '../types';
import type { LegacySlotId, Muscle, ProgramState, Session, SessionSlot } from '../types';
import type { LiftLogDB } from './db';

/** Where the new rotation continues after the last workout done on the old Upper/Lower plan. */
const NEXT_AFTER_LEGACY: Record<LegacySlotId, number> = {
  upperA: SLOT_ORDER.indexOf('pullA'), // last was push-heavy → pull next
  upperB: SLOT_ORDER.indexOf('legsA'), // last was pull-heavy → legs next
  lowerA: SLOT_ORDER.indexOf('pushA'),
  lowerB: SLOT_ORDER.indexOf('pushA'),
};

const isLegacy = (s: SessionSlot): s is LegacySlotId => (LEGACY_SLOTS as string[]).includes(s);

/**
 * v1 → v2: adds the new exercises (keeps the owner's edits and custom ones), replaces the
 * Upper/Lower templates with Push/Pull/Legs A/B, and continues the rotation sensibly.
 * Logged workouts are never changed. Safe to run more than once. Call inside a rw transaction
 * on exercises, templates, programState, settings, sessions.
 */
export async function migrateToV2(db: LiftLogDB): Promise<boolean> {
  const settings = await db.settings.get('main');
  if (settings && settings.schemaVersion >= 2) return false;

  const have = new Set((await db.exercises.toArray()).map((e) => e.id));
  await db.exercises.bulkAdd(EXERCISES.filter((e) => !have.has(e.id)));
  const row = await db.exercises.get('chestSupportedRow');
  if (row && row.name === 'Chest-supported row') await db.exercises.update(row.id, { name: 'Chest-supported T-bar row' });
  // Link the new gym exercises into existing swap lists.
  for (const id of ['machineChestPress', 'latPulldown', 'legPress', 'chestSupportedRow']) {
    const cur = await db.exercises.get(id);
    const def = EXERCISES.find((e) => e.id === id);
    if (!cur || !def) continue;
    const merged = [...new Set([...cur.alternatives, ...def.alternatives])];
    if (merged.length !== cur.alternatives.length) await db.exercises.update(id, { alternatives: merged });
  }

  await db.templates.bulkDelete(LEGACY_SLOTS as unknown as never[]);
  await db.templates.bulkPut(SLOT_ORDER.map((slot) => ({ slot, ids: [...TEMPLATES[slot]] })));

  const prev = await db.programState.get('main');
  const fresh = initialProgramState();
  if (prev) {
    const finished = (await db.sessions.toArray()).filter((s: Session) => s.finishedAt !== null)
      .sort((a, b) => b.startedAt - a.startedAt);
    const last = finished[0]?.slot;
    const volumeTargets = { ...fresh.volumeTargets } as Record<Muscle, number>;
    const next: ProgramState = {
      ...prev,
      volumeTargets,
      nextSlotIndex: last && isLegacy(last) ? NEXT_AFTER_LEGACY[last] : 0,
    };
    await db.programState.put(next);
  } else {
    await db.programState.put(fresh);
  }
  await db.settings.put({ lastBackupAt: null, ...settings, id: 'main', schemaVersion: SCHEMA_VERSION });
  return true;
}
