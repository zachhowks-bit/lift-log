/** Round to the nearest multiple of `inc` (half up), never below `inc`. */
export function roundTo(w: number, inc: number): number {
  const k = Math.max(1, Math.floor(w / inc + 0.5 + 1e-9));
  return Number((k * inc).toFixed(4));
}
