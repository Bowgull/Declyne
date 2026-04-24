import { describe, it, expect } from 'vitest';
import { parseGoalInput, parseGoalPatch } from '../routes/goals.js';

describe('parseGoalInput', () => {
  it('accepts a valid input', () => {
    const out = parseGoalInput({
      name: 'Cash buffer',
      target_cents: 260000,
      target_date: '2026-09-01',
      linked_account_id: 'acc_td_sav',
      progress_cents: 75000,
    });
    expect(out).toEqual({
      name: 'Cash buffer',
      target_cents: 260000,
      target_date: '2026-09-01',
      linked_account_id: 'acc_td_sav',
      progress_cents: 75000,
    });
  });

  it('defaults progress to 0 and linked_account to null', () => {
    const out = parseGoalInput({
      name: 'Vacation',
      target_cents: 100000,
      target_date: '2027-01-01',
    });
    if ('error' in out) throw new Error(out.error);
    expect(out.progress_cents).toBe(0);
    expect(out.linked_account_id).toBeNull();
  });

  it('rejects empty name', () => {
    expect('error' in parseGoalInput({ name: '   ', target_cents: 100, target_date: '2026-09-01' })).toBe(true);
  });

  it('rejects bad target_date', () => {
    expect('error' in parseGoalInput({ name: 'x', target_cents: 100, target_date: 'soon' })).toBe(true);
  });

  it('rejects non-positive target_cents', () => {
    expect('error' in parseGoalInput({ name: 'x', target_cents: 0, target_date: '2026-09-01' })).toBe(true);
    expect('error' in parseGoalInput({ name: 'x', target_cents: -1, target_date: '2026-09-01' })).toBe(true);
  });

  it('rounds numeric fields', () => {
    const out = parseGoalInput({
      name: 'Buffer',
      target_cents: 260000.7,
      target_date: '2026-09-01',
      progress_cents: 75000.4,
    });
    if ('error' in out) throw new Error(out.error);
    expect(out.target_cents).toBe(260001);
    expect(out.progress_cents).toBe(75000);
  });
});

describe('parseGoalPatch', () => {
  it('returns only specified fields', () => {
    const out = parseGoalPatch({ progress_cents: 90000 });
    expect(out).toEqual({ progress_cents: 90000 });
  });

  it('coerces archived to 0/1', () => {
    expect(parseGoalPatch({ archived: true })).toEqual({ archived: 1 });
    expect(parseGoalPatch({ archived: false })).toEqual({ archived: 0 });
    expect(parseGoalPatch({ archived: 1 })).toEqual({ archived: 1 });
    expect(parseGoalPatch({ archived: 'yes' })).toEqual({ archived: 0 });
  });

  it('treats null/empty linked_account_id as clear', () => {
    expect(parseGoalPatch({ linked_account_id: null })).toEqual({ linked_account_id: null });
    expect(parseGoalPatch({ linked_account_id: '' })).toEqual({ linked_account_id: null });
    expect(parseGoalPatch({ linked_account_id: '  ' })).toEqual({ linked_account_id: null });
  });

  it('rejects bad fields', () => {
    expect('error' in parseGoalPatch({ name: '   ' })).toBe(true);
    expect('error' in parseGoalPatch({ target_cents: 0 })).toBe(true);
    expect('error' in parseGoalPatch({ target_date: 'whenever' })).toBe(true);
    expect('error' in parseGoalPatch({ progress_cents: -1 })).toBe(true);
  });
});
