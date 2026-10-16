export type ExType = 'H' | 'C' | 'I';
export type Muscle = 'chest' | 'frontDelt' | 'sideDelt' | 'rearDelt' | 'triceps' | 'biceps'
  | 'lats' | 'midBack' | 'lowerBack' | 'quads' | 'glutes' | 'gluteMed' | 'hamstrings' | 'calves' | 'abs';
export const LEG_MUSCLES: Muscle[] = ['quads', 'glutes', 'gluteMed', 'hamstrings', 'calves'];

/** Workouts in the current rotation (Push/Pull/Legs, two variations each). */
export type SlotId = 'pushA' | 'pullA' | 'legsA' | 'pushB' | 'pullB' | 'legsB';
/** Slots from the first version (Upper/Lower). Old sessions keep them so history still reads correctly. */
export type LegacySlotId = 'upperA' | 'lowerA' | 'upperB' | 'lowerB';
export type SessionSlot = SlotId | LegacySlotId;

export interface Exercise { id: string; name: string; type: ExType; primary: Muscle[]; secondary: Muscle[];
  equipment: 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'; increment: number;
  lower: boolean; kneeSensitive: boolean; alternatives: string[]; avoid: boolean; }

/** Missing kind = a normal working set. Warm-up and drop sets never drive progression. */
export type SetKind = 'warmup' | 'drop';
export interface SetLog { weight: number; fullReps: number; partialReps: number; rir: number;
  restTakenSec: number | null; restSkipped: boolean; kneePain: number | null; kind?: SetKind; }
export interface Prescription { exerciseId: string; weight: number | null; sets: number; repMin: number;
  repMax: number; targetReps: number[]; restSec: number; targetRir: string; why: string;
  needsCalibration: boolean; suggestSwap: boolean; }
export interface ExerciseEntry { exerciseId: string; prescription: Prescription; doneOutOfOrder: boolean;
  isDeload: boolean; sets: SetLog[]; }
export interface Session { id?: number; slot: SessionSlot; startedAt: number; finishedAt: number | null;
  blockNumber: number; weekInBlock: number; entries: ExerciseEntry[]; restEndsAt: number | null;
  lastLoggedExerciseId?: string | null;
  /** Rest was skipped after the last logged set; the next set of that same exercise is marked restSkipped. */
  restSkippedPending?: boolean; }
export interface ProgramState { id: 'main'; nextSlotIndex: number; blockNumber: number; sessionsInBlock: number;
  volumeTargets: Record<Muscle, number>; setsByExercise: Record<string, number>; legRampFrozen: boolean; }
export interface CheckInAnswers { recovery: 'rarely' | 'sometimes' | 'often'; knee: 'better' | 'same' | 'worse';
  swapIds: string[]; motivation: 'high' | 'ok' | 'low'; }
export interface CheckIn extends CheckInAnswers { id?: number; blockNumber: number; at: number;
  pctProgressed: number; changes: string[]; }
export interface Settings { id: 'main'; lastBackupAt: number | null; schemaVersion: number; }
/** v2: Push/Pull/Legs rotation, abs muscle, set kinds. v1 backups are migrated on import. */
export const SCHEMA_VERSION = 2;
