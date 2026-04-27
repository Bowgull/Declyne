import { describe, it, expect } from 'vitest';
import {
  buildNotificationSchedule,
  isTankLow,
  nextDueDate,
  type ScheduleInput,
} from '../lib/notificationSchedule.js';

const TODAY = '2026-04-27';

const empty: ScheduleInput = {
  bills: [],
  debts: [],
  payday: { next_payday: null },
  tank: null,
};

describe('nextDueDate', () => {
  it('returns this month when due_day is later in the month', () => {
    expect(nextDueDate('2026-04-27', 30)).toBe('2026-04-30');
  });
  it('rolls into next month when due_day already passed', () => {
    expect(nextDueDate('2026-04-27', 5)).toBe('2026-05-05');
  });
  it('clamps to last day of month when due_day exceeds it', () => {
    expect(nextDueDate('2026-02-01', 31)).toBe('2026-02-28');
  });
  it('returns null on invalid due_day', () => {
    expect(nextDueDate('2026-04-27', 0)).toBeNull();
    expect(nextDueDate('2026-04-27', 32)).toBeNull();
  });
});

describe('isTankLow', () => {
  it('flags when remaining is zero or negative', () => {
    expect(isTankLow({ paycheque_cents: 200000, remaining_cents: 0, days_remaining: 5 })).toBe(true);
    expect(isTankLow({ paycheque_cents: 200000, remaining_cents: -100, days_remaining: 5 })).toBe(true);
  });
  it('flags when daily burn is well below expected', () => {
    // expected burn = 200000/14 ≈ 14285. actual = 5000/10 = 500 → low
    expect(isTankLow({ paycheque_cents: 200000, remaining_cents: 5000, days_remaining: 10 })).toBe(true);
  });
  it('does not flag a healthy tank', () => {
    expect(isTankLow({ paycheque_cents: 200000, remaining_cents: 150000, days_remaining: 10 })).toBe(false);
  });
  it('does not flag when no days remain', () => {
    expect(isTankLow({ paycheque_cents: 200000, remaining_cents: 0, days_remaining: 0 })).toBe(false);
  });
});

describe('buildNotificationSchedule', () => {
  it('returns empty for empty input', () => {
    expect(buildNotificationSchedule(empty, TODAY)).toEqual([]);
  });

  it('emits bill_due_tomorrow with day-before fire date', () => {
    const out = buildNotificationSchedule(
      {
        ...empty,
        bills: [{ merchant_name: 'Rogers', amount_cents: 9500, next_due: '2026-05-10' }],
      },
      TODAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('bill_due_tomorrow');
    expect(out[0]!.id).toBe(100);
    expect(out[0]!.fire_date).toBe('2026-05-09');
    expect(out[0]!.title).toContain('Rogers');
  });

  it('skips bills already past due', () => {
    const out = buildNotificationSchedule(
      {
        ...empty,
        bills: [{ merchant_name: 'Old Bill', amount_cents: 1000, next_due: '2026-04-26' }],
      },
      TODAY,
    );
    expect(out).toHaveLength(0);
  });

  it('emits debt_min_due 3 days before next due_day', () => {
    const out = buildNotificationSchedule(
      {
        ...empty,
        debts: [
          {
            id: 'd1',
            name: 'Capital One',
            due_day: 5,
            min_payment_fixed_cents: 5000,
            min_payment_percent_bps: null,
            principal_cents: 100000,
          },
        ],
      },
      TODAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('debt_min_due');
    expect(out[0]!.id).toBe(200);
    expect(out[0]!.fire_date).toBe('2026-05-02');
    expect(out[0]!.body).toContain('$50.00');
  });

  it('uses percent min when no fixed min', () => {
    const out = buildNotificationSchedule(
      {
        ...empty,
        debts: [
          {
            id: 'd1',
            name: 'TD Visa',
            due_day: 5,
            min_payment_fixed_cents: null,
            min_payment_percent_bps: 300,
            principal_cents: 100000,
          },
        ],
      },
      TODAY,
    );
    expect(out[0]!.body).toContain('$30.00');
  });

  it('emits paycheque_landed only on the day of', () => {
    const out = buildNotificationSchedule(
      { ...empty, payday: { next_payday: TODAY } },
      TODAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('paycheque_landed');
    expect(out[0]!.id).toBe(300);
  });

  it('skips paycheque on other days', () => {
    const out = buildNotificationSchedule(
      { ...empty, payday: { next_payday: '2026-05-08' } },
      TODAY,
    );
    expect(out).toHaveLength(0);
  });

  it('emits tank_low when pacing is bad', () => {
    const out = buildNotificationSchedule(
      {
        ...empty,
        tank: { paycheque_cents: 200000, remaining_cents: 1000, days_remaining: 10 },
      },
      TODAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('tank_low');
    expect(out[0]!.id).toBe(400);
  });
});
