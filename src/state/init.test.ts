import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { initApp } from './init';

describe('initApp', () => {
  it('seeds an empty database and is idempotent', async () => {
    await db.delete();
    await db.open();
    await initApp();
    await initApp();
    expect(await db.programState.count()).toBe(1);
    expect(await db.templates.count()).toBe(4);
  });
});
