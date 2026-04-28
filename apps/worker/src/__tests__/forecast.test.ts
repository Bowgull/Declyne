import { describe, it, expect } from 'vitest';
import {
  buildForecast,
  projectPaydays,
  projectGoalCompletion,
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
