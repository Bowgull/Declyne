import { describe, it, expect } from 'vitest';
import { clampLimit, sanitizeEntityType } from '../routes/editLog.js';

describe('edit log query parsing', () => {
  it('clamps limit within bounds', () => {
    expect(clampLimit(undefined)).toBe(50);
    expect(clampLimit('10')).toBe(10);
    expect(clampLimit('0')).toBe(50);
    expect(clampLimit('-5')).toBe(50);
    expect(clampLimit('abc')).toBe(50);
    expect(clampLimit('9999')).toBe(500);
  });

  it('allows known entity types, rejects others', () => {
    expect(sanitizeEntityType('debt')).toBe('debt');
    expect(sanitizeEntityType('settings')).toBe('settings');
    expect(sanitizeEntityType('unknown')).toBeNull();
    expect(sanitizeEntityType(undefined)).toBeNull();
    expect(sanitizeEntityType('')).toBeNull();
  });
});
