import { db } from '../db/db';
import { SLOT_NAMES, SLOT_ORDER } from '../data/library';
import { targetRirLabel, weekInBlock } from '../engine/block';
import { backupOverdue, kneeRisingNow } from './progress';
import { getActiveSession, isCheckInDue } from './session';
import { listWorkouts, type WorkoutSummary } from './history';
import type { SessionSlot } from '../types';

export interface HomeInfo {
  /** Slot of the in-progress session if any, else the next slot to start. */
  slot: SessionSlot;
  slotName: string;
  blockNumber: number;
  week: number;
  targetRir: string;
  activeSessionId: number | null;
  /** Up to 3 latest finished workouts, newest first. */
  recent: WorkoutSummary[];
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

  const recent = await listWorkouts(3);

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
    recent,
    backupOverdue: await backupOverdue(now),
    kneeWarning,
    checkInDue: await isCheckInDue(),
  };
}
