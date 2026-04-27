import { describe, it, expect } from 'vitest';
import { validateLines, computeTrialBalance, JournalEntryError } from '../lib/gl.js';
import {
  bankAccountToGlPath,
  categoryGroupToAccountId,
  buildTransactionLines,
} from '../lib/glBackfill.js';

describe('validateLines — balance enforcement', () => {
  it('accepts a balanced two-line entry', () => {
    const out = validateLines([
      { account_id: 'gla_assets_cash', debit_cents: 1000 },
      { account_id: 'gla_income_salary', credit_cents: 1000 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ account_id: 'gla_assets_cash', debit_cents: 1000, credit_cents: 0 });
    expect(out[1]).toEqual({ account_id: 'gla_income_salary', debit_cents: 0, credit_cents: 1000 });
  });

  it('accepts a balanced three-line entry (split debit)', () => {
    const out = validateLines([
      { account_id: 'a', debit_cents: 600 },
      { account_id: 'b', debit_cents: 400 },
      { account_id: 'c', credit_cents: 1000 },
    ]);
    expect(out).toHaveLength(3);
  });

  it('rejects fewer than two lines', () => {
    expect(() => validateLines([{ account_id: 'a', debit_cents: 100 }])).toThrow(JournalEntryError);
    expect(() => validateLines([])).toThrow(JournalEntryError);
  });

  it('rejects unbalanced entries (debits != credits)', () => {
    expect(() =>
      validateLines([
        { account_id: 'a', debit_cents: 1000 },
        { account_id: 'b', credit_cents: 999 },
      ]),
    ).toThrow(/unbalanced/);
  });

  it('rejects double-sided lines (both debit and credit non-zero)', () => {
    expect(() =>
      validateLines([
        { account_id: 'a', debit_cents: 100, credit_cents: 100 },
        { account_id: 'b', credit_cents: 100 },
      ]),
    ).toThrow(/single_sided|both/);
  });

  it('rejects zero-on-both-sides lines', () => {
    expect(() =>
      validateLines([
        { account_id: 'a', debit_cents: 0, credit_cents: 0 },
        { account_id: 'b', credit_cents: 0 },
      ]),
    ).toThrow(JournalEntryError);
  });

  it('rejects negative amounts', () => {
    expect(() =>
      validateLines([
        { account_id: 'a', debit_cents: -100 },
        { account_id: 'b', credit_cents: -100 },
      ]),
    ).toThrow(/bad_amount/);
  });

  it('rejects empty account_id', () => {
    expect(() =>
      validateLines([
        { account_id: '', debit_cents: 100 },
        { account_id: 'b', credit_cents: 100 },
      ]),
    ).toThrow(/bad_account/);
  });

  it('balances over 100 random pairs', () => {
    for (let i = 0; i < 100; i++) {
      const amt = 1 + Math.floor(Math.random() * 100_000);
      const out = validateLines([
        { account_id: 'a', debit_cents: amt },
        { account_id: 'b', credit_cents: amt },
      ]);
      const sumD = out.reduce((s, l) => s + l.debit_cents, 0);
      const sumC = out.reduce((s, l) => s + l.credit_cents, 0);
      expect(sumD).toBe(sumC);
    }
  });
});

describe('computeTrialBalance', () => {
  it('returns delta=0 when debits = credits across all accounts', () => {
    const tb = computeTrialBalance([
      { account_id: 'a', path: 'Assets:Cash', type: 'asset', debit_cents: 5000, credit_cents: 1500 },
      { account_id: 'b', path: 'Income:Salary', type: 'income', debit_cents: 0, credit_cents: 5000 },
      { account_id: 'c', path: 'Expenses:Essentials', type: 'expense', debit_cents: 1500, credit_cents: 0 },
    ]);
    expect(tb.totals.debit_cents).toBe(6500);
    expect(tb.totals.credit_cents).toBe(6500);
    expect(tb.totals.delta_cents).toBe(0);
  });

  it('surfaces non-zero delta when books are out of balance', () => {
    const tb = computeTrialBalance([
      { account_id: 'a', path: 'Assets:Cash', type: 'asset', debit_cents: 100, credit_cents: 0 },
      { account_id: 'b', path: 'Income:Salary', type: 'income', debit_cents: 0, credit_cents: 50 },
    ]);
    expect(tb.totals.delta_cents).toBe(50);
  });

  it('balance_cents per line equals debit - credit', () => {
    const tb = computeTrialBalance([
      { account_id: 'a', path: 'Assets:Cash', type: 'asset', debit_cents: 5000, credit_cents: 1200 },
    ]);
    expect(tb.lines[0]?.balance_cents).toBe(3800);
  });
});

describe('bankAccountToGlPath', () => {
  it('chequing → Assets:Cash', () => {
    const r = bankAccountToGlPath({ name: 'TD Chq', type: 'chequing' });
    expect(r.path).toBe('Assets:Cash:TD Chq');
    expect(r.type).toBe('asset');
    expect(r.parent_id).toBe('gla_assets_cash');
  });

  it('savings → Assets:Cash', () => {
    expect(bankAccountToGlPath({ name: 'TD Sav', type: 'savings' }).path).toBe('Assets:Cash:TD Sav');
  });

  it('credit → Liabilities:CreditCards', () => {
    const r = bankAccountToGlPath({ name: 'TD Visa', type: 'credit' });
    expect(r.path).toBe('Liabilities:CreditCards:TD Visa');
    expect(r.type).toBe('liability');
    expect(r.parent_id).toBe('gla_liab_cc');
  });

  it('loan → Liabilities:Loans', () => {
    const r = bankAccountToGlPath({ name: 'Car Loan', type: 'loan' });
    expect(r.path).toBe('Liabilities:Loans:Car Loan');
    expect(r.type).toBe('liability');
    expect(r.parent_id).toBe('gla_liab_loans');
  });
});

describe('categoryGroupToAccountId', () => {
  it('maps each group to its expected expense/income account', () => {
    expect(categoryGroupToAccountId('essentials')).toBe('gla_exp_essentials');
    expect(categoryGroupToAccountId('lifestyle')).toBe('gla_exp_lifestyle');
    expect(categoryGroupToAccountId('indulgence')).toBe('gla_exp_indulgence');
    expect(categoryGroupToAccountId('debt')).toBe('gla_exp_debt');
    expect(categoryGroupToAccountId('income')).toBe('gla_income_salary');
    expect(categoryGroupToAccountId('transfer')).toBe('gla_income_transfer');
  });

  it('null group falls back to opening balance', () => {
    expect(categoryGroupToAccountId(null)).toBe('gla_equity_opening');
  });
});

describe('buildTransactionLines', () => {
  it('asset outflow (CC charge from chequing): CR cash, DR expense', () => {
    const lines = buildTransactionLines({
      amount_cents: -5000,
      cashAccountId: 'gla_chq',
      cashType: 'asset',
      otherAccountId: 'gla_exp_essentials',
    });
    expect(lines).toEqual([
      { account_id: 'gla_chq', debit_cents: 0, credit_cents: 5000 },
      { account_id: 'gla_exp_essentials', debit_cents: 5000, credit_cents: 0 },
    ]);
  });

  it('asset inflow (paycheque): DR cash, CR income', () => {
    const lines = buildTransactionLines({
      amount_cents: 240000,
      cashAccountId: 'gla_chq',
      cashType: 'asset',
      otherAccountId: 'gla_income_salary',
    });
    expect(lines).toEqual([
      { account_id: 'gla_chq', debit_cents: 240000, credit_cents: 0 },
      { account_id: 'gla_income_salary', debit_cents: 0, credit_cents: 240000 },
    ]);
  });

  it('liability outflow (CC charge): CR liability, DR expense', () => {
    const lines = buildTransactionLines({
      amount_cents: -8400,
      cashAccountId: 'gla_visa',
      cashType: 'liability',
      otherAccountId: 'gla_exp_indulgence',
    });
    expect(lines).toEqual([
      { account_id: 'gla_visa', debit_cents: 0, credit_cents: 8400 },
      { account_id: 'gla_exp_indulgence', debit_cents: 8400, credit_cents: 0 },
    ]);
  });

  it('liability inflow (CC payment received): DR liability, CR clearing', () => {
    const lines = buildTransactionLines({
      amount_cents: 50000,
      cashAccountId: 'gla_visa',
      cashType: 'liability',
      otherAccountId: 'gla_income_transfer',
    });
    expect(lines).toEqual([
      { account_id: 'gla_visa', debit_cents: 50000, credit_cents: 0 },
      { account_id: 'gla_income_transfer', debit_cents: 0, credit_cents: 50000 },
    ]);
  });

  it('every output line is balanced and feeds validateLines cleanly', () => {
    const cases: Array<Parameters<typeof buildTransactionLines>[0]> = [
      { amount_cents: -1234, cashAccountId: 'a', cashType: 'asset', otherAccountId: 'b' },
      { amount_cents: 9876, cashAccountId: 'a', cashType: 'asset', otherAccountId: 'b' },
      { amount_cents: -50000, cashAccountId: 'c', cashType: 'liability', otherAccountId: 'd' },
      { amount_cents: 50000, cashAccountId: 'c', cashType: 'liability', otherAccountId: 'd' },
    ];
    for (const args of cases) {
      const lines = buildTransactionLines(args);
      expect(() => validateLines(lines)).not.toThrow();
    }
  });
});
