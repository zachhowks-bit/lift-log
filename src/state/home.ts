import { db } from '../db/db';
import { SLOT_NAMES, SLOT_ORDER } from '../data/library';
import { targetRirLabel, weekInBlock } from '../engine/block';
import { backupOverdue, kneeRisingNow } from './progress';
import { getActiveSession, isCheckInDue } from './session';
import type { SlotId } from '../types';

export interface HomeInfo {
  /** Slot of the in-progress session if any, else the next slot to start. */
  slot: SlotId;
  slotName: string;
  blockNumber: number;
  week: number;
  targetRir: string;
  activeSessionId: number | null;
  lastSession: { date: number; slotName: string; sets: number; exercises: number } | null;
  backupOverdue: boolean;
  kneeWarning: boolean;
  checkInDue: boolean;
}

export async function getHomeInfo(now: number): Promise<HomeInfo> {
  const state = await db.programState.get('main');
  if (!state) throw new Error('Program state is missing.');
  const active = await getActiveSession();
  const slot = active ? active.slot : SLOT_ORDER[state.nextSlotIndex % SLOT_ORDER.length];
  const blockNumber = active ? active.blockNumber : state.blockNumber;
  const week = active ? active.weekInBlock : weekInBlock(state.sessionsInBlock);

  const last = (await db.sessions.toArray())
    .filter((s) => s.finishedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  const lastSession = last
    ? {
      date: last.startedAt,
      slotName: SLOT_NAMES[last.slot],
      sets: last.entries.reduce((n, e) => n + e.sets.length, 0),
      exercises: last.entries.filter((e) => e.sets.length > 0).length,
    }
    : null;

  const checkIns = await db.checkIns.toArray();
  const latestCheckIn = checkIns.sort((a, b) => b.at - a.at)[0];
  const kneeWarning = (await kneeRisingNow()) || latestCheckIn?.knee === 'worse';

  return {
    slot,
    slotName: SLOT_NAMES[slot],
    blockNumber,
    week,
    targetRir: targetRirLabel(week),
    activeSessionId: active?.id ?? null,
    lastSession,
    backupOverdue: await backupOverdue(now),
    kneeWarning,
    checkInDue: await isCheckInDue(),
  };
}
