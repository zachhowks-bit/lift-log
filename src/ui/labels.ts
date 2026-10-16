import type { Exercise, ExType, Muscle } from '../types';

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: 'Chest',
  frontDelt: 'Front delts',
  sideDelt: 'Side delts',
  rearDelt: 'Rear delts',
  triceps: 'Triceps',
  biceps: 'Biceps',
  lats: 'Lats',
  midBack: 'Mid back',
  lowerBack: 'Lower back',
  quads: 'Quads',
  glutes: 'Glutes',
  gluteMed: 'Glute med',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  abs: 'Abs',
};

export const TYPE_LABELS: Record<ExType, string> = { H: 'Heavy compound', C: 'Compound', I: 'Isolation' };

export const EQUIPMENT: Exercise['equipment'][] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** e.g. "12 Oct" */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
