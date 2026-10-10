import { db } from '../db/db';
import { exportBackup, importBackup } from '../db/backup';

/** Builds the backup JSON and records the backup time. */
export function createBackup(): Promise<{ filename: string; json: string }> {
  return exportBackup();
}

/** Validates and restores a backup; existing data is untouched when it fails. */
export function restoreBackup(json: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return importBackup(json);
}

export async function lastBackupAt(): Promise<number | null> {
  return (await db.settings.get('main'))?.lastBackupAt ?? null;
}
