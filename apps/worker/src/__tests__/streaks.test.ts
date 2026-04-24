import { describe, it, expect } from 'vitest';
import {
  countLeadingTrue,
  essentialsCoveredStreak,
  utilizationUnder30Streak,
  rollingEssentialsMonthlyCents,
  type PeriodRow,
  type CreditSnapshotRow,
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
});
