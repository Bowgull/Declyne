import { describe, it, expect } from 'vitest';
import { parseAllocInput, parseAllocPatch } from '../routes/allocations.js';

describe('parseAllocInput', () => {
  it('accepts a valid input', () => {
    const out = parseAllocInput({ category_group: 'essentials', label: 'Rogers', planned_cents: 8500 });
    expect(out).toEqual({ category_group: 'essentials', label: 'Rogers', planned_cents: 8500 });
  });

  it('rejects bad group', () => {
    expect('error' in parseAllocInput({ category_group: 'food', label: 'X', planned_cents: 1 })).toBe(true);
  });

  it('rejects empty label', () => {
    expect('error' in parseAllocInput({ category_group: 'essentials', label: '   ', planned_cents: 1 })).toBe(true);
  });

  it('rejects negative cents', () => {
    expect('error' in parseAllocInput({ category_group: 'essentials', label: 'X', planned_cents: -1 })).toBe(true);
  });

  it('rounds cents', () => {
    const out = parseAllocInput({ category_group: 'savings', label: 'Buf', planned_cents: 100.4 });
    if ('error' in out) throw new Error(out.error);
    expect(out.planned_cents).toBe(100);
  });
});

describe('parseAllocPatch', () => {
  it('returns only specified fields', () => {
    expect(parseAllocPatch({ planned_cents: 1000 })).toEqual({ planned_cents: 1000 });
  });
  it('rejects bad group on patch', () => {
    expect('error' in parseAllocPatch({ category_group: 'food' })).toBe(true);
  });
  it('rejects empty label on patch', () => {
    expect('error' in parseAllocPatch({ label: '   ' })).toBe(true);
  });

  // SQL-injection defense: arbitrary attacker-controlled keys must be silently
  // dropped. Only category_group, label, planned_cents may flow into the SET clause.
  it('drops attacker-controlled keys not in the allowlist', () => {
    const malicious = {
      planned_cents: 5000,
      'planned_cents = 0; DROP TABLE transactions; --': 1,
      'stamped_at = ?; UPDATE settings SET value = ?; --': 'now',
      pay_period_id: 'attacker_period',
      stamped_at: '1970-01-01T00:00:00Z',
      stamped_by: 'csv_match',
      matched_txn_id: 'attacker_txn',
      id: 'attacker_chosen_id',
      __proto__: { admin: true },
    };
    const out = parseAllocPatch(malicious);
    if ('error' in out) throw new Error(out.error);
    expect(out).toEqual({ planned_cents: 5000 });
    for (const k of Object.keys(out)) {
      expect(k).toMatch(/^(category_group|label|planned_cents)$/);
    }
  });
});
