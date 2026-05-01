import { describe, it, expect } from 'vitest';
import {
  buildForecast,
  projectPaydays,
  projectGoalCompletion,
  projectGoalWithCuts,
  type ForecastEventInput,
} from '../lib/forecast.js';

describe('projectPaydays', () => {
  it('projects bi-weekly paydays inside the horizon', () => {
    const out = projectPaydays({
      next_due: '2026-05-02',
      amount_cents: 425000,
      cadence_days: 14,
      today: '2026-04-28',
      days: 30,
    });
    expect(out.map((p) => p.date)).toEqual(['2026-05-02', '2026-05-16']);
    expect(out.every((p) => p.amount_cents === 425000)).toBe(true);
  });

  it('returns empty when next_due is after horizon', () => {
    const out = projectPaydays({
      next_due: '2026-06-30',
      amount_cents: 425000,
      cadence_days: 14,
      today: '2026-04-28',
      days: 30,
    });
    expect(out).toEqual([]);
  });

  it('skips paydays before today', () => {
    const out = projectPaydays({
      next_due: '2026-04-15',
      amount_cents: 100000,
      cadence_days: 14,
      today: '2026-04-28',
      days: 30,
    });
    expect(out.map((p) => p.date)).toEqual(['2026-04-29', '2026-05-13', '2026-05-27']);
  });
});

describe('buildForecast', () => {
  const baseEvents = (): ForecastEventInput[] => [
    { date: '2026-04-29', type: 'bill', label: 'Rogers', amount_cents: 9500 },
    { date: '2026-05-02', type: 'payday', label: 'Payday', amount_cents: 425000 },
    { date: '2026-05-02', type: 'plan', label: 'TD Visa', amount_cents: 50000 },
    { date: '2026-05-05', type: 'savings_recurring', label: 'TFSA sweep', amount_cents: 20000 },
  ];

  it('walks events in order, payday first on shared dates', () => {
    const out = buildForecast({
      today: '2026-04-28',
      days: 30,
      starting_balance_cents: 100000,
      events: baseEvents(),
    });
    expect(out.length).toBe(4);
    expect(out[0]!.label).toBe('Rogers');
    expect(out[0]!.amount_cents).toBe(-9500);
    expect(out[0]!.running_balance_cents).toBe(90500);
    // 2026-05-02: payday lands before plan
    expect(out[1]!.type).toBe('payday');
    expect(out[1]!.running_balance_cents).toBe(515500);
    expect(out[2]!.type).toBe('plan');
    expect(out[2]!.amount_cents).toBe(-50000);
    expect(out[2]!.running_balance_cents).toBe(465500);
    expect(out[3]!.running_balance_cents).toBe(445500);
  });

  it('drops events outside the window', () => {
    const out = buildForecast({
      today: '2026-04-28',
      days: 1,
      starting_balance_cents: 0,
      events: baseEvents(),
    });
    expect(out.length).toBe(1);
    expect(out[0]!.label).toBe('Rogers');
  });

  it('drops events with zero or negative input cents', () => {
    const out = buildForecast({
      today: '2026-04-28',
      days: 30,
      starting_balance_cents: 0,
      events: [
        { date: '2026-04-29', type: 'bill', label: 'Junk', amount_cents: 0 },
        { date: '2026-04-29', type: 'bill', label: 'Junk2', amount_cents: -100 },
        { date: '2026-04-29', type: 'bill', label: 'Real', amount_cents: 5000 },
      ],
    });
    expect(out.length).toBe(1);
    expect(out[0]!.label).toBe('Real');
  });

  it('starting balance can go negative', () => {
    const out = buildForecast({
      today: '2026-04-28',
      days: 30,
      starting_balance_cents: 5000,
      events: [
        { date: '2026-04-29', type: 'bill', label: 'Big', amount_cents: 20000 },
      ],
    });
    expect(out[0]!.running_balance_cents).toBe(-15000);
  });
});

describe('projectGoalCompletion', () => {
  it('returns null when per_paycheque is zero', () => {
    expect(
      projectGoalCompletion({
        remaining_cents: 100000,
        per_paycheque_cents: 0,
        next_payday: '2026-05-02',
        cadence_days: 14,
      }),
    ).toBeNull();
  });

  it('returns next_payday when nothing remaining', () => {
    expect(
      projectGoalCompletion({
        remaining_cents: 0,
        per_paycheque_cents: 10000,
        next_payday: '2026-05-02',
        cadence_days: 14,
      }),
    ).toBe('2026-05-02');
  });

  it('projects forward at cadence', () => {
    // 30000 remaining at 10000/paycheque = 3 periods, 2 cadence gaps
    expect(
      projectGoalCompletion({
        remaining_cents: 30000,
        per_paycheque_cents: 10000,
        next_payday: '2026-05-02',
        cadence_days: 14,
      }),
    ).toBe('2026-05-30');
  });

  it('rounds up partial paycheque into one extra period', () => {
    // 25000 remaining at 10000/paycheque = ceil(2.5) = 3 periods
    expect(
      projectGoalCompletion({
        remaining_cents: 25000,
        per_paycheque_cents: 10000,
        next_payday: '2026-05-02',
        cadence_days: 14,
      }),
    ).toBe('2026-05-30');
  });

  it('returns null when next_payday is unknown', () => {
    expect(
      projectGoalCompletion({
        remaining_cents: 10000,
        per_paycheque_cents: 5000,
        next_payday: null,
        cadence_days: 14,
      }),
    ).toBeNull();
  });
});

describe('projectGoalWithCuts', () => {
  // Baseline goal: $1000 remaining at $50/paycheque, next_payday 2026-05-02,
  // bi-weekly. ceil(1000/50) = 20 periods, 19 cadence gaps × 14d = 266 days
  // out from 2026-05-02 → 2027-01-23.
  const base = {
    remaining_cents: 100000,
    per_paycheque_cents: 5000,
    next_payday: '2026-05-02' as const,
    cadence_days: 14,
    current_complete_date: '2027-01-23',
  };

  it('returns top 3 cuts ranked by months_saved desc', () => {
    const out = projectGoalWithCuts({
      ...base,
      subs: [
        // Big monthly burn → biggest months saved
        { sub: 'takeout', monthly_burn_cents: 60000, velocity: 'accelerating' },
        { sub: 'bars', monthly_burn_cents: 30000, velocity: 'accelerating' },
        { sub: 'weed', monthly_burn_cents: 10000, velocity: 'accelerating' },
        { sub: 'gaming', monthly_burn_cents: 4000, velocity: 'accelerating' },
      ],
    });
    expect(out.length).toBe(3);
    expect(out[0]!.sub).toBe('takeout');
    expect(out[1]!.sub).toBe('bars');
    expect(out[2]!.sub).toBe('weed');
    expect(out[0]!.months_saved).toBeGreaterThanOrEqual(out[1]!.months_saved);
    expect(out[1]!.months_saved).toBeGreaterThanOrEqual(out[2]!.months_saved);
  });

  it('skips non-accelerating subs', () => {
    const out = projectGoalWithCuts({
      ...base,
      subs: [
        { sub: 'takeout', monthly_burn_cents: 60000, velocity: 'cooling' },
        { sub: 'bars', monthly_burn_cents: 30000, velocity: 'steady' },
      ],
    });
    expect(out).toEqual([]);
  });

  it('returns empty when no current_complete_date', () => {
    const out = projectGoalWithCuts({
      ...base,
      current_complete_date: null,
      subs: [{ sub: 'takeout', monthly_burn_cents: 60000, velocity: 'accelerating' }],
    });
    expect(out).toEqual([]);
  });

  it('returns empty when remaining_cents is 0', () => {
    const out = projectGoalWithCuts({
      ...base,
      remaining_cents: 0,
      subs: [{ sub: 'takeout', monthly_burn_cents: 60000, velocity: 'accelerating' }],
    });
    expect(out).toEqual([]);
  });

  it('returns empty when next_payday is null', () => {
    const out = projectGoalWithCuts({
      ...base,
      next_payday: null,
      subs: [{ sub: 'takeout', monthly_burn_cents: 60000, velocity: 'accelerating' }],
    });
    expect(out).toEqual([]);
  });

  it('drops cuts that save 0 months (dust)', () => {
    // $200/mo cut × 50% = $100/mo freed = $46/paycheque. New per = $96.
    // ceil(100000/9600)=11 periods on a 20-period base. Saves real months.
    // But $20/mo cut × 50% = $10/mo = $5/paycheque, ceil(100000/5500)=19, saves only days → 0 months.
    const out = projectGoalWithCuts({
      ...base,
      subs: [
        { sub: 'gaming', monthly_burn_cents: 2000, velocity: 'accelerating' },
      ],
    });
    expect(out).toEqual([]);
  });

  it('default cut_pct is 50', () => {
    const out = projectGoalWithCuts({
      ...base,
      subs: [{ sub: 'takeout', monthly_burn_cents: 60000, velocity: 'accelerating' }],
    });
    expect(out.length).toBe(1);
    expect(out[0]!.cut_pct).toBe(50);
    expect(out[0]!.monthly_freed_cents).toBe(30000);
  });

  it('respects custom cut_pct', () => {
    const out = projectGoalWithCuts({
      ...base,
      cut_pct: 25,
      subs: [{ sub: 'takeout', monthly_burn_cents: 60000, velocity: 'accelerating' }],
    });
    expect(out.length).toBe(1);
    expect(out[0]!.cut_pct).toBe(25);
    expect(out[0]!.monthly_freed_cents).toBe(15000);
  });

  it('skips zero or negative monthly_burn', () => {
    const out = projectGoalWithCuts({
      ...base,
      subs: [
        { sub: 'takeout', monthly_burn_cents: 0, velocity: 'accelerating' },
        { sub: 'bars', monthly_burn_cents: -100, velocity: 'accelerating' },
      ],
    });
    expect(out).toEqual([]);
  });

  it('new_complete_date is on or before current_complete_date', () => {
    const out = projectGoalWithCuts({
      ...base,
      subs: [{ sub: 'takeout', monthly_burn_cents: 60000, velocity: 'accelerating' }],
    });
    expect(Date.parse(out[0]!.new_complete_date)).toBeLessThanOrEqual(
      Date.parse(base.current_complete_date),
    );
  });
});
