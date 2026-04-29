import { describe, it, expect } from 'vitest';
import { isVerdict, parseVerdictBody } from '../routes/budget.js';

describe('isVerdict', () => {
  it('accepts the three valid verdicts', () => {
    expect(isVerdict('keep')).toBe(true);
    expect(isVerdict('kill')).toBe(true);
    expect(isVerdict('not_a_sub')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isVerdict('KEEP')).toBe(false);
    expect(isVerdict('cancel')).toBe(false);
    expect(isVerdict('')).toBe(false);
    expect(isVerdict(null)).toBe(false);
    expect(isVerdict(undefined)).toBe(false);
    expect(isVerdict(0)).toBe(false);
  });
});

describe('parseVerdictBody', () => {
  it('parses a keep verdict', () => {
    expect(parseVerdictBody({ merchant_id: 'm_1', verdict: 'keep' })).toEqual({
      merchant_id: 'm_1',
      verdict: 'keep',
    });
  });

  it('parses a kill verdict', () => {
    expect(parseVerdictBody({ merchant_id: 'm_1', verdict: 'kill' })).toEqual({
      merchant_id: 'm_1',
      verdict: 'kill',
    });
  });

  it('parses a not_a_sub verdict', () => {
    expect(parseVerdictBody({ merchant_id: 'm_1', verdict: 'not_a_sub' })).toEqual({
      merchant_id: 'm_1',
      verdict: 'not_a_sub',
    });
  });

  it('treats null verdict as a clear', () => {
    expect(parseVerdictBody({ merchant_id: 'm_1', verdict: null })).toEqual({
      merchant_id: 'm_1',
      verdict: null,
    });
  });

  it('trims merchant_id whitespace', () => {
    expect(parseVerdictBody({ merchant_id: '  m_1  ', verdict: 'keep' })).toEqual({
      merchant_id: 'm_1',
      verdict: 'keep',
    });
  });

  it('rejects missing merchant_id', () => {
    expect(parseVerdictBody({ verdict: 'keep' })).toEqual({ error: 'merchant_id_required' });
  });

  it('rejects empty merchant_id', () => {
    expect(parseVerdictBody({ merchant_id: '   ', verdict: 'keep' })).toEqual({
      error: 'merchant_id_required',
    });
  });

  it('rejects non-string merchant_id', () => {
    expect(parseVerdictBody({ merchant_id: 42, verdict: 'keep' })).toEqual({
      error: 'merchant_id_required',
    });
  });

  it('rejects missing verdict (not the same as a clear)', () => {
    expect(parseVerdictBody({ merchant_id: 'm_1' })).toEqual({ error: 'verdict_required' });
  });

  it('rejects an invalid verdict string', () => {
    expect(parseVerdictBody({ merchant_id: 'm_1', verdict: 'cancel' })).toEqual({
      error: 'invalid_verdict',
    });
  });

  it('rejects non-object bodies', () => {
    expect(parseVerdictBody(null)).toEqual({ error: 'invalid_body' });
    expect(parseVerdictBody(undefined)).toEqual({ error: 'invalid_body' });
    expect(parseVerdictBody('keep')).toEqual({ error: 'invalid_body' });
    expect(parseVerdictBody(42)).toEqual({ error: 'invalid_body' });
  });
});
