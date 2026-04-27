import { describe, it, expect } from 'vitest';
import { parseDebtPatch } from '../routes/debts.js';

describe('parseDebtPatch', () => {
  it('returns only specified fields', () => {
    expect(parseDebtPatch({ principal_cents: 50000 })).toEqual({ principal_cents: 50000 });
  });

  it('coerces archived to 0/1', () => {
    expect(parseDebtPatch({ archived: true })).toEqual({ archived: 1 });
    expect(parseDebtPatch({ archived: false })).toEqual({ archived: 0 });
    expect(parseDebtPatch({ archived: 1 })).toEqual({ archived: 1 });
    expect(parseDebtPatch({ archived: 'yes' })).toEqual({ archived: 0 });
  });

  it('treats null/empty account_id_linked as clear', () => {
    expect(parseDebtPatch({ account_id_linked: null })).toEqual({ account_id_linked: null });
    expect(parseDebtPatch({ account_id_linked: '' })).toEqual({ account_id_linked: null });
    expect(parseDebtPatch({ account_id_linked: '  ' })).toEqual({ account_id_linked: null });
  });

  it('rejects empty name', () => {
    expect('error' in parseDebtPatch({ name: '   ' })).toBe(true);
  });

  it('rejects min_payment_type other than fixed|percent', () => {
    expect('error' in parseDebtPatch({ min_payment_type: 'monthly' })).toBe(true);
  });

  it('rejects out-of-range principal_cents', () => {
    expect('error' in parseDebtPatch({ principal_cents: -1 })).toBe(true);
  });

  it('rejects statement_date and payment_due_date out of 1..31', () => {
    expect('error' in parseDebtPatch({ statement_date: 0 })).toBe(true);
    expect('error' in parseDebtPatch({ statement_date: 32 })).toBe(true);
    expect('error' in parseDebtPatch({ payment_due_date: 0 })).toBe(true);
    expect('error' in parseDebtPatch({ payment_due_date: 32 })).toBe(true);
  });

  it('rounds numeric fields', () => {
    const out = parseDebtPatch({ principal_cents: 12345.7, interest_rate_bps: 1999.4, min_payment_value: 1000.6 });
    if ('error' in out) throw new Error(out.error);
    expect(out.principal_cents).toBe(12346);
    expect(out.interest_rate_bps).toBe(1999);
    expect(out.min_payment_value).toBe(1001);
  });

  // SQL-injection defense: arbitrary attacker-controlled keys must be silently
  // dropped. Only the documented allowlist may flow into the SET clause.
  it('drops attacker-controlled keys not in the allowlist', () => {
    const malicious = {
      principal_cents: 1000,
      // classic SQLi payload disguised as a column name
      'principal_cents = 0; DROP TABLE transactions; --': 1,
      // attempt to pivot to other tables
      'archived = 1; UPDATE accounts SET archived = 1; --': 1,
      // generic extra fields
      __proto__: { admin: true },
      id: 'attacker_chosen_id',
      created_at: '1970-01-01T00:00:00Z',
      not_a_real_column: 'whatever',
    };
    const out = parseDebtPatch(malicious);
    if ('error' in out) throw new Error(out.error);
    // Only the legitimate field survives.
    expect(out).toEqual({ principal_cents: 1000 });
    // Confirm none of the injection-shaped keys make it through.
    const keys = Object.keys(out);
    for (const k of keys) {
      expect(k).toMatch(/^(name|principal_cents|interest_rate_bps|min_payment_type|min_payment_value|statement_date|payment_due_date|account_id_linked|archived)$/);
    }
  });

  it('accepts the five severity values', () => {
    for (const v of ['current', 'past_due', 'in_collections', 'charged_off', 'settled_partial']) {
      const out = parseDebtPatch({ severity: v });
      if ('error' in out) throw new Error(out.error);
      expect(out.severity).toBe(v);
    }
  });

  it('rejects unknown severity values', () => {
    expect('error' in parseDebtPatch({ severity: 'collections' })).toBe(true);
    expect('error' in parseDebtPatch({ severity: '' })).toBe(true);
    expect('error' in parseDebtPatch({ severity: 42 })).toBe(true);
  });

  it('rejects non-object body', () => {
    expect('error' in parseDebtPatch(null)).toBe(true);
    expect('error' in parseDebtPatch(undefined)).toBe(true);
    expect('error' in parseDebtPatch('not an object')).toBe(true);
    expect('error' in parseDebtPatch(42)).toBe(true);
  });
});
