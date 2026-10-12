import { db } from '../db/db';
import { exportBackup, importBackup, markBackedUp as recordBackup } from '../db/backup';

/** Builds the backup JSON. Does not record a backup: call markBackedUp once the file was handed off. */
export function createBackup(): Promise<{ filename: string; json: string }> {
  return exportBackup();
}

/** Records the backup time; call only after the share completed or the download was started. */
export function markBackedUp(now: number): Promise<void> {
  return recordBackup(now);
}

/** Validates and restores a backup; existing data is untouched when it fails. */
export function restoreBackup(json: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return importBackup(json);
}

export async function lastBackupAt(): Promise<number | null> {
  return (await db.settings.get('main'))?.lastBackupAt ?? null;
}
