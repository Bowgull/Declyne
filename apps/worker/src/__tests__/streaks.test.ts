import { describe, it, expect } from 'vitest';
import {
  countLeadingTrue,
  essentialsCoveredStreak,
  utilizationUnder30Streak,
  rollingEssentialsMonthlyCents,
  ccPayoffStreak,
  requiredMinPaymentCents,
  findLastMissedMinPayment,
  type PeriodRow,
  type CreditSnapshotRow,
  type CcPeriodRow,
  type DebtCycleDef,
  type DebtPaymentPoint,
} from '../lib/streaks.js';

describe('streaks', () => {
  it('countLeadingTrue stops at first false', () => {
    expect(countLeadingTrue([true, true, false, true])).toBe(2);
    expect(countLeadingTrue([false, true])).toBe(0);
    expect(countLeadingTrue([])).toBe(0);
  });

  it('essentialsCoveredStreak counts newest-first covered periods', () => {
    const p = (income: number, ess: number): PeriodRow => ({
      id: 'p',
      start_date: '2026-01-01',
      end_date: '2026-01-14',
      income_cents: income,
      essentials_spend_cents: ess,
    });
    expect(essentialsCoveredStreak([p(200_000, 150_000), p(200_000, 180_000)])).toBe(2);
    expect(essentialsCoveredStreak([p(200_000, 150_000), p(100_000, 180_000), p(200_000, 100_000)])).toBe(1);
    expect(essentialsCoveredStreak([p(50_000, 180_000)])).toBe(0);
  });

  it('essentials covered when income equals spend exactly', () => {
    const p: PeriodRow = {
      id: 'p',
      start_date: '2026-01-01',
      end_date: '2026-01-14',
      income_cents: 150_000,
      essentials_spend_cents: 150_000,
    };
    expect(essentialsCoveredStreak([p])).toBe(1);
  });

  it('utilizationUnder30Streak counts snapshots under 3000 bps', () => {
    const s = (bps: number): CreditSnapshotRow => ({ as_of: '2026-04-24', utilization_bps: bps, on_time_streak_days: 0 });
    expect(utilizationUnder30Streak([s(2000), s(2500), s(2900)])).toBe(3);
    expect(utilizationUnder30Streak([s(2000), s(3500), s(1000)])).toBe(1);
    expect(utilizationUnder30Streak([s(3000)])).toBe(0);
  });

  it('rollingEssentialsMonthlyCents divides 90d by 3', () => {
    expect(rollingEssentialsMonthlyCents(300_000)).toBe(100_000);
    expect(rollingEssentialsMonthlyCents(0)).toBe(0);
  });

  it('ccPayoffStreak counts leading periods with paid >= spent and paid > 0', () => {
    const p = (paid: number, spent: number): CcPeriodRow => ({ paid_cents: paid, spent_cents: spent });
    expect(ccPayoffStreak([p(12000, 8000), p(6000, 6000), p(10000, 5000)])).toBe(3);
    expect(ccPayoffStreak([p(0, 0), p(10000, 5000)])).toBe(0);
    expect(ccPayoffStreak([p(5000, 8000), p(10000, 5000)])).toBe(0);
    expect(ccPayoffStreak([])).toBe(0);
  });

  it('requiredMinPaymentCents honors fixed and percent with $10 floor', () => {
    const base = { debt_id: 'd', payment_due_date: 3 } as const;
    expect(
      requiredMinPaymentCents({ ...base, principal_cents: 300000, min_payment_type: 'fixed', min_payment_value: 5000 }),
    ).toBe(5000);
    expect(
      requiredMinPaymentCents({ ...base, principal_cents: 300000, min_payment_type: 'percent', min_payment_value: 300 }),
    ).toBe(9000);
    expect(
      requiredMinPaymentCents({ ...base, principal_cents: 10000, min_payment_type: 'percent', min_payment_value: 300 }),
    ).toBe(1000);
  });

  it('findLastMissedMinPayment returns null when every cycle has sufficient payment', () => {
    const today = new Date(Date.UTC(2026, 3, 24));
    const debt: DebtCycleDef = {
      debt_id: 'd1',
      principal_cents: 300000,
      min_payment_type: 'fixed',
      min_payment_value: 5000,
      payment_due_date: 3,
    };
    const payments: DebtPaymentPoint[] = [
      { amount_cents: 8000, posted_at: '2026-01-28' },
      { amount_cents: 8000, posted_at: '2026-02-28' },
      { amount_cents: 8000, posted_at: '2026-03-28' },
    ];
    expect(findLastMissedMinPayment([{ ...debt, payments }], today, 2)).toBe(null);
  });

  it('findLastMissedMinPayment returns most recent missed due date across debts', () => {
    const today = new Date(Date.UTC(2026, 3, 24));
    const d1: DebtCycleDef = {
      debt_id: 'd1',
      principal_cents: 100000,
      min_payment_type: 'fixed',
      min_payment_value: 5000,
      payment_due_date: 3,
    };
    const d2: DebtCycleDef = {
      debt_id: 'd2',
      principal_cents: 100000,
      min_payment_type: 'fixed',
      min_payment_value: 5000,
      payment_due_date: 15,
    };
    // d1: Feb cycle missed (no payments in Jan-Feb window), Mar/Apr paid.
    const p1: DebtPaymentPoint[] = [
      { amount_cents: 6000, posted_at: '2026-02-25' }, // covers Mar-3 window
      { amount_cents: 6000, posted_at: '2026-03-25' }, // covers Apr-3 window
    ];
    // d2: Mar cycle missed. Jan-20 hits Feb-15 window (Jan 11 - Feb 15) but not Mar-15 (Feb 8 - Mar 15).
    const p2: DebtPaymentPoint[] = [
      { amount_cents: 6000, posted_at: '2026-01-20' },
      { amount_cents: 6000, posted_at: '2026-04-10' },
    ];
    const result = findLastMissedMinPayment(
      [
        { ...d1, payments: p1 },
        { ...d2, payments: p2 },
      ],
      today,
      6,
    );
    expect(result).toBe('2026-03-15');
  });
});
