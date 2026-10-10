import { describe, expect, it } from 'vitest';
import { LEG_MUSCLES, SCHEMA_VERSION } from './types';

describe('types', () => {
  it('exposes schema version 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
  it('lists the five leg muscles', () => {
    expect(LEG_MUSCLES).toHaveLength(5);
  });
});
