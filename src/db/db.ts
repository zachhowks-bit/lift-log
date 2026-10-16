import Dexie, { type Table } from 'dexie';
import { EXERCISES, TEMPLATES, SLOT_ORDER, initialProgramState } from '../data/library';
import { SCHEMA_VERSION } from '../types';
import type { CheckIn, Exercise, ProgramState, Session, Settings, SlotId } from '../types';
import { migrateToV2 } from './migrate';

export interface TemplateRow { slot: SlotId; ids: string[]; }

export class LiftLogDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<TemplateRow, SlotId>;
  sessions!: Table<Session, number>;
  checkIns!: Table<CheckIn, number>;
  programState!: Table<ProgramState, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('lift-log');
    this.version(1).stores({
      exercises: 'id',
      templates: 'slot',
      sessions: '++id, startedAt, finishedAt',
      checkIns: '++id, blockNumber',
      programState: 'id',
      settings: 'id',
    });
  }
}

export const db = new LiftLogDB();

/** Seed an empty database (idempotent) and ask the browser for persistent storage. */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', [db.exercises, db.templates, db.programState, db.settings, db.sessions], async () => {
    if ((await db.programState.count()) > 0) {
      await migrateToV2(db);
      // New library exercises from app updates; the owner's own edits are never overwritten.
      const have = new Set((await db.exercises.toArray()).map((e) => e.id));
      const missing = EXERCISES.filter((e) => !have.has(e.id));
      if (missing.length) await db.exercises.bulkAdd(missing);
      return;
    }
    await db.exercises.bulkPut(EXERCISES);
    await db.templates.bulkPut(SLOT_ORDER.map((slot) => ({ slot, ids: [...TEMPLATES[slot]] })));
    await db.programState.put(initialProgramState());
    await db.settings.put({ id: 'main', lastBackupAt: null, schemaVersion: SCHEMA_VERSION });
  });
  try {
    await navigator.storage?.persist?.();
  } catch {
    // persistence is best-effort
  }
}
