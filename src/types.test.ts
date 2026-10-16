import { describe, expect, it } from 'vitest';
import { LEG_MUSCLES, SCHEMA_VERSION } from './types';

describe('types', () => {
  it('exposes schema version 2', () => {
    expect(SCHEMA_VERSION).toBe(2);
  });
  it('lists the five leg muscles', () => {
    expect(LEG_MUSCLES).toHaveLength(5);
  });
});
