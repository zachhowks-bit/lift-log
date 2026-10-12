import { db } from './db';
import { SCHEMA_VERSION } from '../types';
import type { Settings } from '../types';
import { SLOT_ORDER } from '../data/library';

const NOT_VALID = 'This file is not a valid backup.';
const TOO_NEW = 'This backup is from a newer version of Lift Log. Update the app first.';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSlot = (v: unknown) => typeof v === 'string' && (SLOT_ORDER as string[]).includes(v);
const rows = (v: unknown, ok: (r: Obj) => boolean) =>
  Array.isArray(v) && v.every((r) => isObj(r) && ok(r));

/** Returns an error message, or null when the parsed backup has the expected shape. */
function validate(b: unknown): string | null {
  if (!isObj(b)) return NOT_VALID;
  if (typeof b.schemaVersion === 'number' && b.schemaVersion > SCHEMA_VERSION) return TOO_NEW;
  if (b.schemaVersion !== SCHEMA_VERSION) return NOT_VALID;
  const good =
    rows(b.exercises, (r) => typeof r.id === 'string' && typeof r.name === 'string') &&
    rows(b.templates, (r) => isSlot(r.slot) && Array.isArray(r.ids) && r.ids.every((i) => typeof i === 'string')) &&
    rows(b.sessions, (r) => isSlot(r.slot) && typeof r.startedAt === 'number' && Array.isArray(r.entries)) &&
    rows(b.checkIns, () => true) &&
    isObj(b.programState) && b.programState.id === 'main' &&
    isObj(b.settings) && b.settings.id === 'main';
  return good ? null : NOT_VALID;
}

export async function exportBackup(): Promise<{ filename: string; json: string }> {
  const exportedAt = Date.now();
  const d = new Date(exportedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const filename = `workout-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;

  // Read-only: the backup is recorded (markBackedUp) only once the file was actually handed off.
  const payload = await db.transaction('r', db.tables, async () => {
    const prev = await db.settings.get('main');
    const settings: Settings = { schemaVersion: SCHEMA_VERSION, ...prev, id: 'main', lastBackupAt: exportedAt };
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      exercises: await db.exercises.toArray(),
      templates: await db.templates.toArray(),
      sessions: await db.sessions.toArray(),
      checkIns: await db.checkIns.toArray(),
      programState: await db.programState.get('main'),
      settings,
    };
  });
  return { filename, json: JSON.stringify(payload, null, 2) };
}

/** Records that a backup file was saved or shared at `now`. */
export async function markBackedUp(now: number): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const prev = await db.settings.get('main');
    await db.settings.put({ schemaVersion: SCHEMA_VERSION, ...prev, id: 'main', lastBackupAt: now });
  });
}

export async function importBackup(json: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: NOT_VALID };
  }
  const error = validate(parsed);
  if (error) return { ok: false, error };
  const b = parsed as Obj;
  try {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
      await db.exercises.bulkPut(b.exercises as never[]);
      await db.templates.bulkPut(b.templates as never[]);
      await db.sessions.bulkPut(b.sessions as never[]);
      await db.checkIns.bulkPut(b.checkIns as never[]);
      await db.programState.put(b.programState as never);
      await db.settings.put({ ...(b.settings as Obj), id: 'main', schemaVersion: SCHEMA_VERSION } as unknown as Settings);
    });
    return { ok: true };
  } catch {
    return { ok: false, error: NOT_VALID };
  }
}
