import { describe, expect, it } from 'vitest';
import { isValidPurgeBody } from '../routes/dataPurge.js';

describe('isValidPurgeBody', () => {
  it('accepts the exact confirmation phrase', () => {
    expect(isValidPurgeBody({ confirm: 'DELETE EVERYTHING' })).toBe(true);
  });

  it('rejects missing confirm', () => {
    expect(isValidPurgeBody({})).toBe(false);
    expect(isValidPurgeBody({ ok: true })).toBe(false);
  });

  it('rejects wrong phrase', () => {
    expect(isValidPurgeBody({ confirm: 'delete everything' })).toBe(false);
    expect(isValidPurgeBody({ confirm: 'YES' })).toBe(false);
    expect(isValidPurgeBody({ confirm: 'DELETE  EVERYTHING' })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isValidPurgeBody(null)).toBe(false);
    expect(isValidPurgeBody(undefined)).toBe(false);
    expect(isValidPurgeBody('DELETE EVERYTHING')).toBe(false);
    expect(isValidPurgeBody(['DELETE EVERYTHING'])).toBe(false);
  });

  it('rejects boolean / number confirm', () => {
    expect(isValidPurgeBody({ confirm: true })).toBe(false);
    expect(isValidPurgeBody({ confirm: 1 })).toBe(false);
  });
});
