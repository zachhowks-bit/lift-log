import { ensureSeeded } from '../db/db';

/** Prepare storage before the first screen renders (seeds an empty database). */
export async function initApp(): Promise<void> {
  await ensureSeeded();
}
