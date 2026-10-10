import { LEG_MUSCLES } from '../types';
import type { Exercise, ExType, Muscle, ProgramState, SlotId } from '../types';

type Equip = Exercise['equipment'];
const ALL_MUSCLES: Muscle[] = ['chest', 'frontDelt', 'sideDelt', 'rearDelt', 'triceps', 'biceps',
  'lats', 'midBack', 'lowerBack', 'quads', 'glutes', 'gluteMed', 'hamstrings', 'calves'];

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
  ex('latPulldown', 'Lat pulldown', 'C', ['lats'], ['biceps'], 'cable', ['neutralGripPulldown', 'assistedPullup']),
  ex('seatedCableRow', 'Seated cable row', 'C', ['midBack'], ['lats'], 'cable', ['machineRow', 'oneArmDbRow', 'chestSupportedRow']),
  ex('dbLateralRaise', 'Dumbbell lateral raise', 'I', ['sideDelt'], [], 'dumbbell', ['cableLateralRaise', 'machineLateralRaise']),
  ex('cablePushdown', 'Cable triceps pushdown', 'I', ['triceps'], [], 'cable', ['overheadCableExtension', 'dbKickback']),
  // ---- Lower A
  ex('legPress', 'Leg press (feet mid-high)', 'C', ['quads'], ['glutes'], 'machine', ['reverseSledDrag', 'hackSquat', 'gobletBoxSquat'], K),
  ex('hipThrust', 'Hip thrust', 'C', ['glutes'], [], 'barbell', ['gluteBridge', 'cableKickback', 'cablePullThrough'], L),
  ex('legExtension', 'Leg extension (light)', 'I', ['quads'], [], 'machine', ['spanishSquat', 'reverseSledDrag', 'hackSquat'], K),
  ex('seatedLegCurl', 'Seated leg curl', 'I', ['hamstrings'], [], 'machine', ['lyingLegCurl', 'cablePullThrough'], L),
  ex('standingCalfRaise', 'Standing calf raise', 'I', ['calves'], [], 'machine', ['seatedCalfRaise', 'legPressCalfRaise'], L),
  // ---- Upper B
  ex('chestSupportedRow', 'Chest-supported row', 'H', ['midBack'], ['lats', 'rearDelt'], 'machine', ['seatedCableRow', 'machineRow', 'oneArmDbRow']),
  ex('assistedPullup', 'Assisted pull-up', 'C', ['lats'], ['biceps'], 'machine', ['neutralGripPulldown', 'latPulldown']),
  ex('machineChestPress', 'Machine chest press', 'C', ['chest'], ['triceps'], 'machine', ['dbBench', 'inclineDbPress', 'inclineMachinePress']),
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
];

export const EXERCISE_BY_ID: Record<string, Exercise> =
  Object.fromEntries(EXERCISES.map(e => [e.id, e]));

export const SLOT_ORDER: SlotId[] = ['upperA', 'lowerA', 'upperB', 'lowerB'];

export const SLOT_NAMES: Record<SlotId, string> = {
  upperA: 'Upper A — Push',
  lowerA: 'Lower A — Quads & Glutes',
  upperB: 'Upper B — Pull',
  lowerB: 'Lower B — Hamstrings & Glutes',
};

export const TEMPLATES: Record<SlotId, string[]> = {
  upperA: ['bench', 'inclineDbPress', 'latPulldown', 'seatedCableRow', 'dbLateralRaise', 'cablePushdown'],
  lowerA: ['legPress', 'hipThrust', 'legExtension', 'seatedLegCurl', 'standingCalfRaise'],
  upperB: ['chestSupportedRow', 'assistedPullup', 'machineChestPress', 'seatedDbShoulderPress', 'facePull', 'dbCurl'],
  lowerB: ['rdl', 'hipThrust', 'lyingLegCurl', 'hipAbduction', 'seatedCalfRaise'],
};

export function initialProgramState(): ProgramState {
  const volumeTargets = {} as Record<Muscle, number>;
  for (const m of ALL_MUSCLES) volumeTargets[m] = LEG_MUSCLES.includes(m) ? 6 : 10;
  return { id: 'main', nextSlotIndex: 0, blockNumber: 1, sessionsInBlock: 0,
    volumeTargets, setsByExercise: {}, legRampFrozen: false };
}
