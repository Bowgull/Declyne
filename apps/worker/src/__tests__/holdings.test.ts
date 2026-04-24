import { describe, it, expect } from 'vitest';
import { parseHoldingInput, parseHoldingPatch } from '../routes/holdings.js';

describe('parseHoldingInput', () => {
  it('accepts a valid input and uppercases symbol', () => {
    const out = parseHoldingInput({
      symbol: 'xiu.to',
      account_wrapper: 'tfsa',
      units: 1000000,
      avg_cost_cents: 320000,
    });
    expect(out).toEqual({
      symbol: 'XIU.TO',
      account_wrapper: 'tfsa',
      units: 1000000,
      avg_cost_cents: 320000,
    });
  });

  it('rejects unknown wrapper', () => {
    expect('error' in parseHoldingInput({
      symbol: 'SPY',
      account_wrapper: 'cash',
      units: 1,
      avg_cost_cents: 1,
    })).toBe(true);
  });

  it('rejects empty symbol', () => {
    expect('error' in parseHoldingInput({
      symbol: '   ',
      account_wrapper: 'tfsa',
      units: 1,
      avg_cost_cents: 1,
    })).toBe(true);
  });

  it('rejects non-positive units', () => {
    expect('error' in parseHoldingInput({
      symbol: 'SPY',
      account_wrapper: 'tfsa',
      units: 0,
      avg_cost_cents: 1,
    })).toBe(true);
  });

  it('rounds numeric fields', () => {
    const out = parseHoldingInput({
      symbol: 'SPY',
      account_wrapper: 'nonreg',
      units: 12345.6,
      avg_cost_cents: 100.4,
    });
    if ('error' in out) throw new Error(out.error);
    expect(out.units).toBe(12346);
    expect(out.avg_cost_cents).toBe(100);
  });
});

describe('parseHoldingPatch', () => {
  it('returns only specified fields', () => {
    const out = parseHoldingPatch({ units: 5000 });
    expect(out).toEqual({ units: 5000 });
  });

  it('uppercases symbol on patch', () => {
    expect(parseHoldingPatch({ symbol: 'spy' })).toEqual({ symbol: 'SPY' });
  });

  it('rejects bad fields', () => {
    expect('error' in parseHoldingPatch({ symbol: '   ' })).toBe(true);
    expect('error' in parseHoldingPatch({ account_wrapper: 'cash' })).toBe(true);
    expect('error' in parseHoldingPatch({ units: 0 })).toBe(true);
    expect('error' in parseHoldingPatch({ avg_cost_cents: -1 })).toBe(true);
  });
});
