import type { Exercise, ExType, LegacySlotId, Muscle, ProgramState, SessionSlot, SlotId } from '../types';

type Equip = Exercise['equipment'];
const ALL_MUSCLES: Muscle[] = ['chest', 'frontDelt', 'sideDelt', 'rearDelt', 'triceps', 'biceps',
  'lats', 'midBack', 'lowerBack', 'quads', 'glutes', 'gluteMed', 'hamstrings', 'calves', 'abs'];

interface Opts { lower?: boolean; knee?: boolean }

function ex(id: string, name: string, type: ExType, primary: Muscle[], secondary: Muscle[],
  equipment: Equip, alternatives: string[], o: Opts = {}): Exercise {
  const lower = !!o.lower;
  const increment = lower ? 2.5 : equipment === 'dumbbell' ? 2 : 2.5;
  return { id, name, type, primary, secondary, equipment, increment, lower,
    kneeSensitive: !!o.knee, alternatives, avoid: false };
}
const L: Opts = { lower: true };
const K: Opts = { lower: true, knee: true };

export const EXERCISES: Exercise[] = [
  // ---- Upper A
  ex('bench', 'Barbell bench press', 'H', ['chest'], ['triceps', 'frontDelt'], 'barbell', ['dbBench', 'machineChestPress', 'inclineDbPress']),
  ex('inclineDbPress', 'Incline dumbbell press', 'C', ['chest'], ['frontDelt'], 'dumbbell', ['inclineMachinePress', 'machineChestPress', 'dbBench']),
  ex('latPulldown', 'Lat pulldown', 'C', ['lats'], ['biceps'], 'cable', ['neutralGripPulldown', 'assistedPullup', 'isoLowRow']),
  ex('seatedCableRow', 'Seated cable row', 'C', ['midBack'], ['lats'], 'cable', ['machineRow', 'oneArmDbRow', 'chestSupportedRow']),
  ex('dbLateralRaise', 'Dumbbell lateral raise', 'I', ['sideDelt'], [], 'dumbbell', ['cableLateralRaise', 'machineLateralRaise']),
  ex('cablePushdown', 'Cable triceps pushdown', 'I', ['triceps'], [], 'cable', ['overheadCableExtension', 'dbKickback']),
  // ---- Lower A
  ex('legPress', 'Leg press (feet mid-high)', 'C', ['quads'], ['glutes'], 'machine', ['reverseSledDrag', 'horizontalLegPress', 'hackSquat', 'gobletBoxSquat'], K),
  ex('hipThrust', 'Hip thrust', 'C', ['glutes'], [], 'barbell', ['gluteBridge', 'cableKickback', 'cablePullThrough'], L),
  ex('legExtension', 'Leg extension (light)', 'I', ['quads'], [], 'machine', ['spanishSquat', 'reverseSledDrag', 'hackSquat'], K),
  ex('seatedLegCurl', 'Seated leg curl', 'I', ['hamstrings'], [], 'machine', ['lyingLegCurl', 'cablePullThrough'], L),
  ex('standingCalfRaise', 'Standing calf raise', 'I', ['calves'], [], 'machine', ['seatedCalfRaise', 'legPressCalfRaise'], L),
  // ---- Upper B
  ex('chestSupportedRow', 'Chest-supported T-bar row', 'H', ['midBack'], ['lats', 'rearDelt'], 'machine', ['isoRow', 'seatedCableRow', 'machineRow', 'oneArmDbRow']),
  ex('assistedPullup', 'Assisted pull-up', 'C', ['lats'], ['biceps'], 'machine', ['neutralGripPulldown', 'latPulldown']),
  ex('machineChestPress', 'Machine chest press', 'C', ['chest'], ['triceps'], 'machine', ['dbBench', 'bench', 'declinePress']),
  ex('seatedDbShoulderPress', 'Seated dumbbell shoulder press', 'C', ['frontDelt'], ['triceps'], 'dumbbell', ['machineShoulderPress', 'standingDbPress']),
  ex('facePull', 'Face pull', 'I', ['rearDelt'], ['midBack'], 'cable', ['reversePecDeck', 'dbRearRaise']),
  ex('dbCurl', 'Dumbbell curl', 'I', ['biceps'], [], 'dumbbell', ['cableCurl', 'hammerCurl']),
  // ---- Lower B
  ex('rdl', 'Romanian deadlift', 'H', ['hamstrings'], ['glutes', 'lowerBack'], 'barbell', ['backExtension45', 'cablePullThrough', 'dbRdl'], L),
  ex('lyingLegCurl', 'Lying leg curl', 'I', ['hamstrings'], [], 'machine', ['seatedLegCurl', 'cablePullThrough'], L),
  ex('hipAbduction', 'Hip abduction machine', 'I', ['gluteMed'], [], 'machine', ['cableHipAbduction', 'sideLyingAbduction'], L),
  ex('seatedCalfRaise', 'Seated calf raise', 'I', ['calves'], [], 'machine', ['standingCalfRaise', 'legPressCalfRaise'], L),
  // ---- Alternatives
  ex('dbBench', 'Dumbbell bench press', 'H', ['chest'], ['triceps', 'frontDelt'], 'dumbbell', ['machineChestPress', 'bench']),
  ex('inclineMachinePress', 'Incline machine press', 'C', ['chest'], ['frontDelt', 'triceps'], 'machine', ['inclineDbPress', 'machineChestPress']),
  ex('neutralGripPulldown', 'Neutral-grip pulldown', 'C', ['lats'], ['biceps'], 'cable', ['latPulldown', 'assistedPullup']),
  ex('machineRow', 'Machine row', 'C', ['midBack'], ['lats', 'rearDelt'], 'machine', ['seatedCableRow', 'oneArmDbRow']),
  ex('oneArmDbRow', 'One-arm dumbbell row', 'C', ['midBack'], ['lats'], 'dumbbell', ['machineRow', 'seatedCableRow']),
  ex('cableLateralRaise', 'Cable lateral raise', 'I', ['sideDelt'], [], 'cable', ['dbLateralRaise', 'machineLateralRaise']),
  ex('machineLateralRaise', 'Machine lateral raise', 'I', ['sideDelt'], [], 'machine', ['dbLateralRaise', 'cableLateralRaise']),
  ex('overheadCableExtension', 'Overhead cable triceps extension', 'I', ['triceps'], [], 'cable', ['cablePushdown', 'dbKickback']),
  ex('dbKickback', 'Dumbbell triceps kickback', 'I', ['triceps'], [], 'dumbbell', ['cablePushdown', 'overheadCableExtension']),
  ex('hackSquat', 'Hack squat', 'C', ['quads'], ['glutes'], 'machine', ['reverseSledDrag', 'legPress', 'spanishSquat'], K),
  ex('gobletBoxSquat', 'Goblet box squat', 'C', ['quads'], ['glutes'], 'dumbbell', ['reverseSledDrag', 'spanishSquat', 'legPress'], K),
  ex('reverseSledDrag', 'Reverse sled drag', 'C', ['quads'], [], 'machine', ['spanishSquat'], L),
  ex('spanishSquat', 'Spanish squat (band-assisted wall sit)', 'I', ['quads'], [], 'bodyweight', ['reverseSledDrag'], L),
  ex('gluteBridge', 'Glute bridge', 'C', ['glutes'], ['hamstrings'], 'bodyweight', ['hipThrust', 'cableKickback'], L),
  ex('cableKickback', 'Cable glute kickback', 'I', ['glutes'], [], 'cable', ['hipThrust', 'gluteBridge'], L),
  ex('cablePullThrough', 'Cable pull-through', 'C', ['hamstrings', 'glutes'], ['lowerBack'], 'cable', ['rdl', 'backExtension45'], L),
  ex('backExtension45', '45° back extension', 'C', ['hamstrings', 'glutes'], ['lowerBack'], 'bodyweight', ['rdl', 'cablePullThrough'], L),
  ex('dbRdl', 'Dumbbell Romanian deadlift', 'C', ['hamstrings'], ['glutes', 'lowerBack'], 'dumbbell', ['rdl', 'cablePullThrough'], L),
  ex('legPressCalfRaise', 'Leg press calf raise', 'I', ['calves'], [], 'machine', ['standingCalfRaise', 'seatedCalfRaise'], L),
  ex('machineShoulderPress', 'Machine shoulder press', 'C', ['frontDelt'], ['triceps'], 'machine', ['seatedDbShoulderPress', 'standingDbPress']),
  ex('standingDbPress', 'Standing dumbbell press', 'C', ['frontDelt'], ['triceps'], 'dumbbell', ['seatedDbShoulderPress', 'machineShoulderPress']),
  ex('reversePecDeck', 'Reverse pec deck', 'I', ['rearDelt'], ['midBack'], 'machine', ['facePull', 'dbRearRaise']),
  ex('dbRearRaise', 'Bent-over dumbbell rear raise', 'I', ['rearDelt'], [], 'dumbbell', ['facePull', 'reversePecDeck']),
  ex('cableCurl', 'Cable curl', 'I', ['biceps'], [], 'cable', ['dbCurl', 'hammerCurl']),
  ex('hammerCurl', 'Hammer curl', 'I', ['biceps'], [], 'dumbbell', ['dbCurl', 'cableCurl']),
  ex('cableHipAbduction', 'Cable hip abduction', 'I', ['gluteMed'], [], 'cable', ['hipAbduction', 'sideLyingAbduction'], L),
  ex('sideLyingAbduction', 'Side-lying hip abduction', 'I', ['gluteMed'], [], 'bodyweight', ['hipAbduction', 'cableHipAbduction'], L),
  // ---- Added in v2 (Push/Pull/Legs, from the machines in the owner's gym)
  ex('chestFly', 'Chest fly (machine)', 'I', ['chest'], [], 'machine', ['cableFly', 'inclineDbPress']),
  ex('cableFly', 'Cable fly', 'I', ['chest'], [], 'cable', ['chestFly', 'machineChestPress']),
  ex('declinePress', 'Decline chest press (machine)', 'C', ['chest'], ['triceps'], 'machine', ['machineChestPress', 'dbBench']),
  ex('seatedDip', 'Seated dip machine', 'C', ['triceps'], ['chest'], 'machine', ['cablePushdown', 'overheadCableExtension']),
  ex('singleArmPushdown', 'Single-arm cable pushdown', 'I', ['triceps'], [], 'cable', ['cablePushdown', 'overheadCableExtension']),
  ex('straightArmPulldown', 'Straight-arm rope pulldown', 'I', ['lats'], [], 'cable', ['neutralGripPulldown', 'latPulldown']),
  ex('preacherCurl', 'Preacher curl (machine)', 'I', ['biceps'], [], 'machine', ['barbellCurl', 'cableCurl', 'dbCurl']),
  ex('barbellCurl', 'Barbell curl', 'I', ['biceps'], [], 'barbell', ['preacherCurl', 'cableCurl']),
  ex('isoRow', 'Iso-lateral row (machine)', 'C', ['midBack'], ['lats', 'rearDelt'], 'machine', ['chestSupportedRow', 'machineRow', 'wideCableRow']),
  ex('isoLowRow', 'Iso-lateral low row', 'C', ['lats'], ['midBack'], 'machine', ['neutralGripPulldown', 'latPulldown']),
  ex('wideCableRow', 'Seated cable row (wide grip)', 'C', ['midBack'], ['rearDelt', 'lats'], 'cable', ['seatedCableRow', 'isoRow']),
  ex('bentOverRow', 'Barbell bent-over row', 'C', ['midBack'], ['lats', 'lowerBack'], 'barbell', ['chestSupportedRow', 'oneArmDbRow']),
  ex('horizontalLegPress', 'Horizontal leg press', 'C', ['quads'], ['glutes'], 'machine', ['reverseSledDrag', 'spanishSquat', 'legPress'], K),
  ex('cableCrunch', 'Cable crunch', 'I', ['abs'], [], 'cable', ['declineCrunch', 'hangingKneeRaise']),
  ex('declineCrunch', 'Decline crunch', 'I', ['abs'], [], 'bodyweight', ['cableCrunch', 'hangingKneeRaise']),
  ex('hangingKneeRaise', 'Hanging knee raise', 'I', ['abs'], [], 'bodyweight', ['cableCrunch', 'declineCrunch']),
];

export const EXERCISE_BY_ID: Record<string, Exercise> =
  Object.fromEntries(EXERCISES.map(e => [e.id, e]));

export const SLOT_ORDER: SlotId[] = ['pushA', 'pullA', 'legsA', 'pushB', 'pullB', 'legsB'];

export const SLOT_NAMES: Record<SessionSlot, string> = {
  pushA: 'Push A — Chest focus',
  pullA: 'Pull A — Lats focus',
  legsA: 'Legs A — Quads & Glutes',
  pushB: 'Push B — Incline & Shoulders',
  pullB: 'Pull B — Rows focus',
  legsB: 'Legs B — Hamstrings & Glutes',
  // v1 slots, kept so old workouts still show a name
  upperA: 'Upper A (old plan)',
  lowerA: 'Lower A (old plan)',
  upperB: 'Upper B (old plan)',
  lowerB: 'Lower B (old plan)',
};

/** Short label for chips and lists. */
export const SLOT_SHORT: Record<SessionSlot, string> = {
  pushA: 'Push A', pullA: 'Pull A', legsA: 'Legs A', pushB: 'Push B', pullB: 'Pull B', legsB: 'Legs B',
  upperA: 'Upper A', lowerA: 'Lower A', upperB: 'Upper B', lowerB: 'Lower B',
};

export const LEGACY_SLOTS: LegacySlotId[] = ['upperA', 'lowerA', 'upperB', 'lowerB'];
export const LEG_SLOTS: SlotId[] = ['legsA', 'legsB'];

export const TEMPLATES: Record<SlotId, string[]> = {
  pushA: ['machineChestPress', 'inclineDbPress', 'chestFly', 'dbLateralRaise', 'cablePushdown', 'cableCrunch'],
  pullA: ['latPulldown', 'chestSupportedRow', 'straightArmPulldown', 'facePull', 'preacherCurl'],
  legsA: ['legPress', 'hipThrust', 'legExtension', 'seatedLegCurl', 'standingCalfRaise'],
  pushB: ['inclineMachinePress', 'machineShoulderPress', 'declinePress', 'machineLateralRaise', 'seatedDip'],
  pullB: ['isoRow', 'neutralGripPulldown', 'wideCableRow', 'reversePecDeck', 'cableCurl', 'declineCrunch'],
  legsB: ['rdl', 'lyingLegCurl', 'backExtension45', 'hipAbduction', 'seatedCalfRaise'],
};

/** Planned working sets per muscle in one full round of the default templates (primary 1, secondary ½). */
export function plannedRoundSets(): Record<Muscle, number> {
  const out = {} as Record<Muscle, number>;
  for (const m of ALL_MUSCLES) out[m] = 0;
  for (const slot of SLOT_ORDER) {
    for (const id of TEMPLATES[slot]) {
      const e = EXERCISE_BY_ID[id];
      const n = e.lower ? 2 : 3;
      for (const m of e.primary) out[m] += n;
      for (const m of e.secondary) out[m] += n / 2;
    }
  }
  return out;
}

export function initialProgramState(): ProgramState {
  const planned = plannedRoundSets();
  const volumeTargets = {} as Record<Muscle, number>;
  // Targets start at what the plan delivers in one round (min 4, max 20); legs then ramp up.
  for (const m of ALL_MUSCLES) volumeTargets[m] = Math.min(20, Math.max(4, Math.round(planned[m])));
  return { id: 'main', nextSlotIndex: 0, blockNumber: 1, sessionsInBlock: 0,
    volumeTargets, setsByExercise: {}, legRampFrozen: false };
}
