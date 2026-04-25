import { describe, it, expect } from 'vitest';
import { mostRecentSunday, isCompletedThisWeek } from '../routes/reconciliation.js';

describe('mostRecentSunday', () => {
  it('returns the same day when today is Sunday', () => {
    // 2026-04-26 is a Sunday
    expect(mostRecentSunday('2026-04-26')).toBe('2026-04-26');
  });

  it('walks back to Sunday from a midweek day', () => {
    // 2026-04-29 is a Wednesday → 2026-04-26
    expect(mostRecentSunday('2026-04-29')).toBe('2026-04-26');
  });

  it('walks back to Sunday from Saturday', () => {
    // 2026-04-25 is a Saturday → 2026-04-19
    expect(mostRecentSunday('2026-04-25')).toBe('2026-04-19');
  });

  it('throws on bad input', () => {
    expect(() => mostRecentSunday('not-a-date')).toThrow();
  });
});

describe('isCompletedThisWeek', () => {
  it('false when no last_at', () => {
    expect(isCompletedThisWeek(null, '2026-04-29')).toBe(false);
  });

  it('true when last_at is on this week\'s Sunday', () => {
    expect(isCompletedThisWeek('2026-04-26T09:15:00.000Z', '2026-04-29')).toBe(true);
  });

  it('true when last_at is later in the same week', () => {
    expect(isCompletedThisWeek('2026-04-28T20:00:00.000Z', '2026-04-29')).toBe(true);
  });

  it('false when last_at is the prior Saturday', () => {
    expect(isCompletedThisWeek('2026-04-25T22:00:00.000Z', '2026-04-29')).toBe(false);
  });

  it('false when last_at is weeks ago', () => {
    expect(isCompletedThisWeek('2026-03-01T09:00:00.000Z', '2026-04-29')).toBe(false);
  });
});
