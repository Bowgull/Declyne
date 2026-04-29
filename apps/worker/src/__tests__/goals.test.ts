import { describe, it, expect } from 'vitest';
import { parseGoalInput, parseGoalPatch, computeGoalSuggestion } from '../routes/goals.js';

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
      goal_type: 'other',
    });
  });

  it('accepts goal_type and validates the enum', () => {
    const ok = parseGoalInput({
      name: 'Emergency Fund',
      target_cents: 546000,
      target_date: '2027-01-01',
      goal_type: 'emergency',
    });
    if ('error' in ok) throw new Error(ok.error);
    expect(ok.goal_type).toBe('emergency');

    const bad = parseGoalInput({
      name: 'Bogus',
      target_cents: 100,
      target_date: '2026-09-01',
      goal_type: 'mansion',
    });
    if ('error' in bad) throw new Error('expected fall-through to other');
    expect(bad.goal_type).toBe('other');
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
    expect('error' in parseGoalPatch({ goal_type: 'mansion' })).toBe(true);
  });

  it('accepts goal_type when valid', () => {
    expect(parseGoalPatch({ goal_type: 'tfsa' })).toEqual({ goal_type: 'tfsa' });
  });
});

describe('computeGoalSuggestion', () => {
  const baseInputs = {
    paycheque_cents: 425000,
    essentials_monthly_cents: 182000,
    tfsa_room_cents: 700000,
    fhsa_room_cents: 800000,
    rrsp_room_cents: null,
  };

  it('emergency = 3 months essentials, 5% paycheque', () => {
    const s = computeGoalSuggestion('emergency', baseInputs);
    expect(s.target_cents).toBe(546000);
    expect(s.per_paycheque_cents).toBe(21250);
    expect(s.why_target).toContain('three months');
  });

  it('rrsp scales with paycheque, defaults rationale when room unknown', () => {
    const s = computeGoalSuggestion('rrsp', baseInputs);
    expect(s.target_cents).toBeGreaterThan(0);
    expect(s.why_target).toContain('starter contribution');
  });

  it('rrsp surfaces room when provided', () => {
    const s = computeGoalSuggestion('rrsp', { ...baseInputs, rrsp_room_cents: 1500000 });
    expect(s.why_target).toContain("last year's T4");
  });

  it('tfsa caps target at remaining room', () => {
    const s = computeGoalSuggestion('tfsa', { ...baseInputs, tfsa_room_cents: 200000 });
    expect(s.target_cents).toBe(200000);
  });

  it('fhsa fills entire room when provided', () => {
    const s = computeGoalSuggestion('fhsa', baseInputs);
    expect(s.target_cents).toBe(800000);
  });

  it('vacation/car/other return fixed defaults', () => {
    expect(computeGoalSuggestion('vacation', baseInputs).target_cents).toBe(300000);
    expect(computeGoalSuggestion('car', baseInputs).target_cents).toBe(800000);
    expect(computeGoalSuggestion('other', baseInputs).target_cents).toBe(100000);
  });

  it('handles zero paycheque/essentials gracefully', () => {
    const s = computeGoalSuggestion('emergency', {
      paycheque_cents: 0,
      essentials_monthly_cents: 0,
      tfsa_room_cents: 0,
      fhsa_room_cents: 0,
      rrsp_room_cents: null,
    });
    expect(s.target_cents).toBeGreaterThanOrEqual(100000);
    expect(s.per_paycheque_cents).toBeGreaterThanOrEqual(1000);
    expect(s.why_target).not.toContain('NaN');
  });
});
