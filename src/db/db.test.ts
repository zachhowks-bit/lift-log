import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, ensureSeeded } from './db';
import { exportBackup, importBackup } from './backup';
import { EXERCISES } from '../data/library';
import { SCHEMA_VERSION, type Session } from '../types';

const session = (startedAt: number): Session => ({
  slot: 'pushA', startedAt, finishedAt: startedAt + 1000, blockNumber: 1, weekInBlock: 1,
  entries: [], restEndsAt: null,
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.restoreAllMocks();
});

describe('ensureSeeded', () => {
  it('seeds an empty database', async () => {
    await ensureSeeded();
    expect(await db.exercises.count()).toBe(EXERCISES.length);
    expect(await db.templates.count()).toBe(6);
    expect((await db.templates.get('pushA'))?.ids.length).toBeGreaterThan(0);
    expect((await db.programState.get('main'))?.blockNumber).toBe(1);
    expect(await db.settings.get('main')).toEqual({ id: 'main', lastBackupAt: null, schemaVersion: SCHEMA_VERSION });
  });

  it('is idempotent and does not overwrite existing state', async () => {
    await ensureSeeded();
    await db.programState.update('main', { blockNumber: 3 });
    await ensureSeeded();
    expect(await db.exercises.count()).toBe(EXERCISES.length);
    expect(await db.templates.count()).toBe(6);
    expect(await db.programState.count()).toBe(1);
    expect((await db.programState.get('main'))?.blockNumber).toBe(3);
  });

  it('requests persistent storage and tolerates rejection or absence', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('no'));
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    await expect(ensureSeeded()).resolves.toBeUndefined();
    expect(persist).toHaveBeenCalled();
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    await expect(ensureSeeded()).resolves.toBeUndefined();
  });
});

describe('exportBackup', () => {
  it('names the file by local date and does not record a backup', async () => {
    await ensureSeeded();
    await db.sessions.add(session(1));
    const { filename, json } = await exportBackup();
    expect(filename).toMatch(/^workout-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(filename).toBe(`workout-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`);
    const p = JSON.parse(json);
    expect(Object.keys(p).sort()).toEqual(
      ['checkIns', 'exercises', 'exportedAt', 'programState', 'schemaVersion', 'sessions', 'settings', 'templates']);
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Array.isArray(p.programState)).toBe(false);
    expect(p.programState.id).toBe('main');
    expect(p.settings.lastBackupAt).toBe(p.exportedAt);
    expect((await db.settings.get('main'))?.lastBackupAt).toBeNull();
    expect(json).toContain('\n  "schemaVersion"');
  });
});

describe('importBackup', () => {
  it('round-trips sessions: seed, export, clear, import', async () => {
    await ensureSeeded();
    await db.sessions.bulkAdd([session(1), session(2)]);
    const before = await db.sessions.toArray();
    const { json } = await exportBackup();
    await db.delete();
    await db.open();
    expect(await db.sessions.count()).toBe(0);
    expect(await importBackup(json)).toEqual({ ok: true });
    expect(await db.sessions.toArray()).toEqual(before);
    expect(await db.exercises.count()).toBe(EXERCISES.length);
    expect(await db.templates.count()).toBe(6);
    expect((await db.programState.get('main'))?.id).toBe('main');
  });

  async function expectRejected(input: string, msg: string) {
    await ensureSeeded();
    await db.sessions.clear();
    await db.sessions.add(session(5));
    const r = await importBackup(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.exercises.count()).toBe(EXERCISES.length);
  }

  it('rejects malformed JSON', () => expectRejected('{', 'not a valid backup'));
  it('rejects non-objects', () => expectRejected('[1,2]', 'not a valid backup'));
  it('rejects null', () => expectRejected('null', 'not a valid backup'));

  it('rejects a newer schemaVersion', async () => {
    await ensureSeeded();
    const p = JSON.parse((await exportBackup()).json);
    await expectRejected(JSON.stringify({ ...p, schemaVersion: 99 }), 'newer version');
  });

  it('rejects an older / non-numeric schemaVersion as not valid', async () => {
    await ensureSeeded();
    const p = JSON.parse((await exportBackup()).json);
    await expectRejected(JSON.stringify({ ...p, schemaVersion: 0 }), 'not a valid backup');
    await expectRejected(JSON.stringify({ ...p, schemaVersion: '2' }), 'not a valid backup');
  });

  it('rejects a truncated export', async () => {
    await ensureSeeded();
    const { json } = await exportBackup();
    await expectRejected(json.slice(0, Math.floor(json.length / 2)), 'not a valid backup');
  });

  it('rejects a missing key', async () => {
    await ensureSeeded();
    const p = JSON.parse((await exportBackup()).json);
    delete p.checkIns;
    await expectRejected(JSON.stringify(p), 'not a valid backup');
  });

  it('rejects wrong-kind keys and malformed rows', async () => {
    await ensureSeeded();
    const p = JSON.parse((await exportBackup()).json);
    await expectRejected(JSON.stringify({ ...p, sessions: {} }), 'not a valid backup');
    await expectRejected(JSON.stringify({ ...p, programState: [] }), 'not a valid backup');
    await expectRejected(JSON.stringify({ ...p, settings: { ...p.settings, id: 'x' } }), 'not a valid backup');
    await expectRejected(JSON.stringify({ ...p, exercises: [{ id: 1, name: 'x' }] }), 'not a valid backup');
    await expectRejected(JSON.stringify({ ...p, templates: [{ slot: 'bogus', ids: [] }] }), 'not a valid backup');
    await expectRejected(JSON.stringify({ ...p, templates: [{ slot: 'pushA', ids: [1] }] }), 'not a valid backup');
    await expectRejected(JSON.stringify({ ...p, sessions: [{ slot: 'pushA', startedAt: 'x', entries: [] }] }), 'not a valid backup');
    await expectRejected(JSON.stringify({ ...p, sessions: [{ slot: 'pushA', startedAt: 1 }] }), 'not a valid backup');
  });

  it('rolls back when the transaction fails midway', async () => {
    await ensureSeeded();
    await db.sessions.add(session(5));
    const p = JSON.parse((await exportBackup()).json);
    // an invalid primary key makes bulkPut throw mid-transaction, after the tables were cleared
    p.sessions = [{ ...session(9), id: { bad: true } }];
    const r = await importBackup(JSON.stringify(p));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('not a valid backup');
    expect(await db.sessions.count()).toBe(1);
    expect((await db.sessions.toArray())[0].startedAt).toBe(5);
    expect(await db.exercises.count()).toBe(EXERCISES.length);
  });
});
