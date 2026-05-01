import { describe, it, expect } from 'vitest';
import {
  subToGroup,
  crossesGroup,
  defaultCategoryIdForGroup,
  buildReversalLines,
  validateReversal,
  buildRepostLines,
} from '../lib/merchantReclassify.js';

describe('subToGroup', () => {
  it('maps essentials subs', () => {
    expect(subToGroup('groceries')).toBe('essentials');
    expect(subToGroup('transit')).toBe('essentials');
  });
  it('maps lifestyle subs', () => {
    expect(subToGroup('shopping')).toBe('lifestyle');
    expect(subToGroup('personal_care')).toBe('lifestyle');
    expect(subToGroup('entertainment')).toBe('lifestyle');
  });
  it('maps indulgence subs', () => {
    expect(subToGroup('alcohol')).toBe('indulgence');
    expect(subToGroup('restaurants')).toBe('indulgence');
    expect(subToGroup('delivery')).toBe('indulgence');
    expect(subToGroup('weed')).toBe('indulgence');
    expect(subToGroup('streaming')).toBe('indulgence');
    expect(subToGroup('treats')).toBe('indulgence');
  });
});

describe('crossesGroup', () => {
  it('detects cross-group changes', () => {
    expect(crossesGroup('lifestyle', 'indulgence')).toBe(true);
    expect(crossesGroup('indulgence', 'lifestyle')).toBe(true);
    expect(crossesGroup('essentials', 'indulgence')).toBe(true);
    expect(crossesGroup('debt', 'indulgence')).toBe(true);
  });
  it('returns false for same-group changes', () => {
    expect(crossesGroup('lifestyle', 'lifestyle')).toBe(false);
    expect(crossesGroup('indulgence', 'indulgence')).toBe(false);
    expect(crossesGroup('essentials', 'essentials')).toBe(false);
  });
  it('treats null as cross-group (always reassign)', () => {
    expect(crossesGroup(null, 'indulgence')).toBe(true);
    expect(crossesGroup(undefined, 'lifestyle')).toBe(true);
  });
});

describe('defaultCategoryIdForGroup', () => {
  it('returns stable ids', () => {
    expect(defaultCategoryIdForGroup('essentials')).toBe('cat_default_essentials');
    expect(defaultCategoryIdForGroup('lifestyle')).toBe('cat_default_lifestyle');
    expect(defaultCategoryIdForGroup('indulgence')).toBe('cat_default_indulgence');
  });
});

describe('buildReversalLines', () => {
  it('swaps debit and credit per line', () => {
    const orig = [
      { account_id: 'cash', debit_cents: 0, credit_cents: 1000 },
      { account_id: 'expense_lifestyle', debit_cents: 1000, credit_cents: 0 },
    ];
    const rev = buildReversalLines(orig);
    expect(rev).toEqual([
      { account_id: 'cash', debit_cents: 1000, credit_cents: 0 },
      { account_id: 'expense_lifestyle', debit_cents: 0, credit_cents: 1000 },
    ]);
  });
  it('preserves account_ids and totals', () => {
    const orig = [
      { account_id: 'a', debit_cents: 250, credit_cents: 0 },
      { account_id: 'b', debit_cents: 0, credit_cents: 250 },
    ];
    const rev = buildReversalLines(orig);
    const origTotalDr = orig.reduce((s, l) => s + l.debit_cents, 0);
    const revTotalCr = rev.reduce((s, l) => s + l.credit_cents, 0);
    expect(origTotalDr).toBe(revTotalCr);
  });
});

describe('validateReversal', () => {
  const orig = [
    { account_id: 'cash', debit_cents: 0, credit_cents: 1000 },
    { account_id: 'exp', debit_cents: 1000, credit_cents: 0 },
  ];
  it('accepts a correct reversal', () => {
    const rev = buildReversalLines(orig);
    expect(validateReversal(orig, rev)).toEqual({ valid: true });
  });
  it('rejects line count mismatch', () => {
    const rev = [orig[0]!];
    const guard = validateReversal(orig, rev as never);
    expect(guard.valid).toBe(false);
  });
  it('rejects account_id mismatch', () => {
    const rev = [
      { account_id: 'cash', debit_cents: 1000, credit_cents: 0 },
      { account_id: 'WRONG', debit_cents: 0, credit_cents: 1000 },
    ];
    const guard = validateReversal(orig, rev);
    expect(guard.valid).toBe(false);
  });
  it('rejects amount mismatch', () => {
    const rev = [
      { account_id: 'cash', debit_cents: 999, credit_cents: 0 },
      { account_id: 'exp', debit_cents: 0, credit_cents: 1000 },
    ];
    const guard = validateReversal(orig, rev);
    expect(guard.valid).toBe(false);
  });
});

describe('buildRepostLines', () => {
  const orig = [
    { account_id: 'gla_cash_chequing', debit_cents: 0, credit_cents: 1000 },
    { account_id: 'gla_exp_lifestyle', debit_cents: 1000, credit_cents: 0 },
  ];
  it('remaps the other-side account, keeps cash side', () => {
    const repost = buildRepostLines(orig, 'gla_exp_lifestyle', 'gla_exp_indulgence');
    expect(repost).toEqual([
      { account_id: 'gla_cash_chequing', debit_cents: 0, credit_cents: 1000 },
      { account_id: 'gla_exp_indulgence', debit_cents: 1000, credit_cents: 0 },
    ]);
  });
  it('returns identical shape when old account not present', () => {
    const repost = buildRepostLines(orig, 'gla_exp_unrelated', 'gla_exp_indulgence');
    expect(repost).toEqual(orig);
  });
  it('handles 3-line entries (e.g. loan payment with interest split)', () => {
    const three = [
      { account_id: 'gla_cash', debit_cents: 0, credit_cents: 1000 },
      { account_id: 'gla_exp_lifestyle', debit_cents: 800, credit_cents: 0 },
      { account_id: 'gla_exp_debt', debit_cents: 200, credit_cents: 0 },
    ];
    const repost = buildRepostLines(three, 'gla_exp_lifestyle', 'gla_exp_indulgence');
    expect(repost[1]!.account_id).toBe('gla_exp_indulgence');
    expect(repost[0]!.account_id).toBe('gla_cash');
    expect(repost[2]!.account_id).toBe('gla_exp_debt');
  });
});
