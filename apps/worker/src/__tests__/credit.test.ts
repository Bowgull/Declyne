import { describe, it, expect } from 'vitest';
import { parseCreditInput } from '../routes/credit.js';

describe('parseCreditInput', () => {
  it('accepts a valid input', () => {
    const out = parseCreditInput({
      as_of: '2026-04-20',
      score: 720,
      utilization_bps: 1500,
      on_time_streak_days: 400,
      source: 'manual',
    });
    expect(out).toEqual({
      as_of: '2026-04-20',
      score: 720,
      utilization_bps: 1500,
      on_time_streak_days: 400,
      source: 'manual',
    });
  });

  it('defaults source to manual when unknown', () => {
    const out = parseCreditInput({
      as_of: '2026-04-20',
      score: 720,
      utilization_bps: 0,
      on_time_streak_days: 0,
      source: 'bogus',
    });
    expect('error' in out ? out.error : out.source).toBe('manual');
  });

  it('rejects malformed as_of', () => {
    const out = parseCreditInput({
      as_of: 'yesterday',
      score: 720,
      utilization_bps: 0,
      on_time_streak_days: 0,
    });
    expect('error' in out).toBe(true);
  });

  it('rejects out-of-range score', () => {
    expect('error' in parseCreditInput({ as_of: '2026-04-20', score: 100, utilization_bps: 0, on_time_streak_days: 0 })).toBe(true);
    expect('error' in parseCreditInput({ as_of: '2026-04-20', score: 1000, utilization_bps: 0, on_time_streak_days: 0 })).toBe(true);
  });

  it('rejects out-of-range utilization_bps', () => {
    expect('error' in parseCreditInput({ as_of: '2026-04-20', score: 700, utilization_bps: -1, on_time_streak_days: 0 })).toBe(true);
    expect('error' in parseCreditInput({ as_of: '2026-04-20', score: 700, utilization_bps: 20000, on_time_streak_days: 0 })).toBe(true);
  });

  it('rounds numeric fields', () => {
    const out = parseCreditInput({
      as_of: '2026-04-20',
      score: 720.6,
      utilization_bps: 1499.4,
      on_time_streak_days: 100.9,
      source: 'equifax',
    });
    if ('error' in out) throw new Error(out.error);
    expect(out.score).toBe(721);
    expect(out.utilization_bps).toBe(1499);
    expect(out.on_time_streak_days).toBe(101);
    expect(out.source).toBe('equifax');
  });

  it('rejects non-object input', () => {
    expect('error' in parseCreditInput(null)).toBe(true);
    expect('error' in parseCreditInput('nope')).toBe(true);
  });
});
