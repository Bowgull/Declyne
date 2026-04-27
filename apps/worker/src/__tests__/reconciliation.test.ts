import { describe, it, expect } from 'vitest';
import {
  mostRecentSunday,
  isCompletedThisWeek,
  expectedSignedAmount,
  withinThreeDays,
  findAmbiguousSplits,
  isCandidateValid,
} from '../routes/reconciliation.js';

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

describe('expectedSignedAmount', () => {
  it('owes_josh expects positive (incoming)', () => {
    expect(expectedSignedAmount('they_owe', 4750)).toBe(4750);
  });
  it('josh_owes expects negative (outgoing)', () => {
    expect(expectedSignedAmount('i_owe', 8200)).toBe(-8200);
  });
});

describe('withinThreeDays', () => {
  it('same day is within', () => {
    expect(withinThreeDays('2026-04-20', '2026-04-20')).toBe(true);
  });
  it('±3 days inclusive', () => {
    expect(withinThreeDays('2026-04-17', '2026-04-20')).toBe(true);
    expect(withinThreeDays('2026-04-23', '2026-04-20')).toBe(true);
  });
  it('4 days apart is not within', () => {
    expect(withinThreeDays('2026-04-16', '2026-04-20')).toBe(false);
    expect(withinThreeDays('2026-04-24', '2026-04-20')).toBe(false);
  });
  it('accepts ISO timestamps and slices to date', () => {
    expect(withinThreeDays('2026-04-20T22:30:00.000Z', '2026-04-20T01:00:00.000Z')).toBe(true);
  });
});

describe('findAmbiguousSplits', () => {
  const splitA = {
    id: 'split_a',
    direction: 'they_owe' as const,
    remaining_cents: 4750,
    created_at: '2026-04-20T12:00:00Z',
  };

  it('returns nothing when no candidates exist', () => {
    expect(findAmbiguousSplits([splitA], [])).toEqual([]);
  });

  it('returns nothing when only one candidate exists (auto-matcher would settle)', () => {
    const txns = [{ id: 't1', posted_at: '2026-04-21', amount_cents: 4750 }];
    expect(findAmbiguousSplits([splitA], txns)).toEqual([]);
  });

  it('flags split with two candidates at the matching amount + window', () => {
    const txns = [
      { id: 't1', posted_at: '2026-04-19', amount_cents: 4750 },
      { id: 't2', posted_at: '2026-04-22', amount_cents: 4750 },
      { id: 't3', posted_at: '2026-04-21', amount_cents: 1000 }, // wrong amount
      { id: 't4', posted_at: '2026-04-30', amount_cents: 4750 }, // outside window
    ];
    const out = findAmbiguousSplits([splitA], txns);
    expect(out).toHaveLength(1);
    expect(out[0]!.split.id).toBe('split_a');
    expect(out[0]!.candidates.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('respects sign for josh_owes', () => {
    const splitB = { id: 'split_b', direction: 'i_owe' as const, remaining_cents: 8200, created_at: '2026-04-20' };
    const txns = [
      { id: 't1', posted_at: '2026-04-20', amount_cents: -8200 },
      { id: 't2', posted_at: '2026-04-21', amount_cents: -8200 },
      { id: 't3', posted_at: '2026-04-21', amount_cents: 8200 }, // wrong sign
    ];
    const out = findAmbiguousSplits([splitB], txns);
    expect(out).toHaveLength(1);
    expect(out[0]!.candidates.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('handles multiple splits independently', () => {
    const splitB = { id: 'split_b', direction: 'they_owe' as const, remaining_cents: 1000, created_at: '2026-04-20' };
    const txns = [
      { id: 't1', posted_at: '2026-04-19', amount_cents: 4750 },
      { id: 't2', posted_at: '2026-04-21', amount_cents: 4750 },
      { id: 't3', posted_at: '2026-04-21', amount_cents: 1000 }, // single match for splitB → not ambiguous
    ];
    const out = findAmbiguousSplits([splitA, splitB], txns);
    expect(out).toHaveLength(1);
    expect(out[0]!.split.id).toBe('split_a');
  });
});

describe('isCandidateValid', () => {
  const split = {
    id: 'split_a',
    direction: 'they_owe' as const,
    remaining_cents: 4750,
    created_at: '2026-04-20',
  };

  it('accepts a matching candidate', () => {
    expect(isCandidateValid(split, { id: 't1', posted_at: '2026-04-21', amount_cents: 4750 })).toBe(true);
  });

  it('rejects wrong amount', () => {
    expect(isCandidateValid(split, { id: 't1', posted_at: '2026-04-21', amount_cents: 4700 })).toBe(false);
  });

  it('rejects wrong sign', () => {
    expect(isCandidateValid(split, { id: 't1', posted_at: '2026-04-21', amount_cents: -4750 })).toBe(false);
  });

  it('rejects out-of-window', () => {
    expect(isCandidateValid(split, { id: 't1', posted_at: '2026-04-25', amount_cents: 4750 })).toBe(false);
  });
});
