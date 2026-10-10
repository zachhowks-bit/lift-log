import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '../db/db';
import { createBackup, lastBackupAt, restoreBackup } from './backup';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('backup helpers', () => {
  it('creates a backup, records the time, and restores it', async () => {
    expect(await lastBackupAt()).toBeNull();
    const { filename, json } = await createBackup();
    expect(filename).toMatch(/^workout-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(await lastBackupAt()).toBeTypeOf('number');
    await db.exercises.delete('bench');
    expect(await restoreBackup(json)).toEqual({ ok: true });
    expect(await db.exercises.get('bench')).toBeTruthy();
  });

  it('rejects a bad file and leaves data untouched', async () => {
    expect(await restoreBackup('nope')).toEqual({ ok: false, error: 'This file is not a valid backup.' });
    expect(await db.exercises.get('bench')).toBeTruthy();
  });
});
