import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from './db';
import { exportBackup, importBackup } from './backup';
import { EXERCISES, SLOT_ORDER, TEMPLATES, initialProgramState } from '../data/library';
import type { Session } from '../types';

const V1_IDS = new Set(['bench', 'inclineDbPress', 'latPulldown', 'seatedCableRow', 'dbLateralRaise', 'cablePushdown',
  'legPress', 'hipThrust', 'legExtension', 'seatedLegCurl', 'standingCalfRaise', 'chestSupportedRow', 'assistedPullup',
  'machineChestPress', 'seatedDbShoulderPress', 'facePull', 'dbCurl', 'rdl', 'lyingLegCurl', 'hipAbduction', 'seatedCalfRaise']);

const oldSession = (slot: Session['slot'], startedAt: number): Session => ({
  slot, startedAt, finishedAt: startedAt + 3_600_000, blockNumber: 1, weekInBlock: 2, restEndsAt: null,
  entries: [{ exerciseId: 'bench', doneOutOfOrder: false, isDeload: false,
    prescription: { exerciseId: 'bench', weight: 60, sets: 3, repMin: 6, repMax: 10, targetReps: [8, 8, 8], restSec: 180,
      targetRir: '', why: '', needsCalibration: false, suggestSwap: false },
    sets: [{ weight: 60, fullReps: 8, partialReps: 0, rir: 2, restTakenSec: 180, restSkipped: false, kneePain: null }] }],
});

/** Builds the database the way v1 left it on the phone. */
async function seedV1() {
  const old = EXERCISES.filter((e) => V1_IDS.has(e.id)).map((e) => (e.id === 'chestSupportedRow' ? { ...e, name: 'Chest-supported row' } : e));
  await db.exercises.bulkPut(old);
  await db.exercises.update('legExtension', { avoid: true });
  await db.exercises.put({ ...old[0], id: 'custom-pec-deck', name: 'Pec deck', alternatives: [] });
  await db.templates.bulkPut([
    { slot: 'upperA' as never, ids: ['bench'] }, { slot: 'lowerA' as never, ids: ['legPress'] },
    { slot: 'upperB' as never, ids: ['chestSupportedRow'] }, { slot: 'lowerB' as never, ids: ['rdl'] },
  ]);
  await db.programState.put({ ...initialProgramState(), nextSlotIndex: 2, sessionsInBlock: 7, setsByExercise: { hipThrust: 3 } });
  await db.settings.put({ id: 'main', lastBackupAt: 123, schemaVersion: 1 });
  await db.sessions.add(oldSession('upperA', 1_000));
  await db.sessions.add(oldSession('upperB', 2_000));
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('v1 → v2 migration', () => {
  it('switches to Push/Pull/Legs and keeps history, edits and custom exercises', async () => {
    await seedV1();
    await ensureSeeded();
    expect((await db.templates.toArray()).map((t) => t.slot).sort()).toEqual([...SLOT_ORDER].sort());
    expect((await db.templates.get('pushA'))!.ids).toEqual(TEMPLATES.pushA);
    expect(await db.exercises.get('isoRow')).toBeDefined();
    expect((await db.exercises.get('chestSupportedRow'))!.name).toBe('Chest-supported T-bar row');
    expect((await db.exercises.get('legExtension'))!.avoid).toBe(true);
    expect((await db.exercises.get('custom-pec-deck'))!.name).toBe('Pec deck');
    const sessions = await db.sessions.toArray();
    expect(sessions.map((s) => s.slot)).toEqual(['upperA', 'upperB']);
    expect(sessions[0].entries[0].sets[0].weight).toBe(60);
    const st = (await db.programState.get('main'))!;
    expect(SLOT_ORDER[st.nextSlotIndex]).toBe('legsA'); // last workout was the old pull day
    expect(st.sessionsInBlock).toBe(7);
    expect(st.setsByExercise).toEqual({ hipThrust: 3 });
    expect(st.volumeTargets.abs).toBeGreaterThan(0);
    expect((await db.settings.get('main'))).toMatchObject({ schemaVersion: 2, lastBackupAt: 123 });
  });

  it('runs once: a second start changes nothing', async () => {
    await seedV1();
    await ensureSeeded();
    await db.templates.put({ slot: 'pushA', ids: ['bench'] });
    await ensureSeeded();
    expect((await db.templates.get('pushA'))!.ids).toEqual(['bench']);
  });

  it('imports a v1 backup and upgrades it', async () => {
    await seedV1();
    const p = JSON.parse((await exportBackup()).json);
    p.schemaVersion = 1;
    p.settings.schemaVersion = 1;
    await db.delete();
    await db.open();
    await ensureSeeded();
    expect(await importBackup(JSON.stringify(p))).toEqual({ ok: true });
    expect((await db.templates.get('legsB'))!.ids).toEqual(TEMPLATES.legsB);
    expect(await db.sessions.count()).toBe(2);
    expect((await db.settings.get('main'))!.schemaVersion).toBe(2);
  });
});
