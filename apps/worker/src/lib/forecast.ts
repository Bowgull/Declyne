// Session 80: forward 30-day forecast.
//
// Builds a chronological event list from recurring bills, committed plan
// installments, paycheque schedule and recurring savings sweeps, then walks
// it from a starting cash balance to produce a running balance per event.
// Pure helpers below; route in routes/forecast.ts handles the I/O.

const MS_PER_DAY = 86_400_000;

export type ForecastEventType = 'bill' | 'plan' | 'payday' | 'savings_recurring';

export interface ForecastEventInput {
  date: string;
  type: ForecastEventType;
  label: string;
  // Always positive cents; sign is applied based on type.
  amount_cents: number;
  category_group?: string;
}

export interface ForecastEvent {
  date: string;
  type: ForecastEventType;
  label: string;
  // Signed: positive for inflow (payday), negative for outflow.
  amount_cents: number;
  running_balance_cents: number;
  category_group?: string;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

// Pure: project bi-weekly paydays forward from a known anchor (next payday).
// Used when the only signal we have is "next paycheque is on X" — we extend at
// cadence_days until we exit the horizon.
export function projectPaydays(input: {
  next_due: string;
  amount_cents: number;
  cadence_days: number;
  today: string;
  days: number;
}): Array<{ date: string; amount_cents: number }> {
  const out: Array<{ date: string; amount_cents: number }> = [];
  const horizon = addDays(input.today, input.days);
  const cadence = Math.max(1, Math.round(input.cadence_days));
  let cursor = input.next_due;
  let safety = 0;
  while (cursor <= horizon && safety < 64) {
    if (cursor >= input.today) {
      out.push({ date: cursor, amount_cents: input.amount_cents });
    }
    cursor = addDays(cursor, cadence);
    safety += 1;
  }
  return out;
}

// Pure: sort key tiebreaker. On the same date, paydays land first (so the
// running balance reflects inflow before the outflows that share the day).
function typeOrder(t: ForecastEventType): number {
  if (t === 'payday') return 0;
  if (t === 'savings_recurring') return 1;
  if (t === 'bill') return 2;
  return 3; // plan
}

// Pure: walk events in date order, compute signed delta + running balance.
export function buildForecast(input: {
  today: string;
  days: number;
  starting_balance_cents: number;
  events: ForecastEventInput[];
}): ForecastEvent[] {
  const horizon = addDays(input.today, input.days);
  const filtered = input.events.filter(
    (e) => e.date >= input.today && e.date <= horizon && e.amount_cents > 0,
  );
  filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return typeOrder(a.type) - typeOrder(b.type);
  });

  const out: ForecastEvent[] = [];
  let running = input.starting_balance_cents;
  for (const e of filtered) {
    const signed = e.type === 'payday' ? e.amount_cents : -e.amount_cents;
    running += signed;
    out.push({
      date: e.date,
      type: e.type,
      label: e.label,
      amount_cents: signed,
      running_balance_cents: running,
      ...(e.category_group ? { category_group: e.category_group } : {}),
    });
  }
  return out;
}

// Pure: per-goal projection. Given a per-paycheque savings allocation and the
// remaining gap to target, returns the absolute date the goal completes (or
// null when the per-paycheque allocation is zero or non-finite).
export function projectGoalCompletion(input: {
  remaining_cents: number;
  per_paycheque_cents: number;
  next_payday: string | null;
  cadence_days: number;
}): string | null {
  if (!Number.isFinite(input.per_paycheque_cents) || input.per_paycheque_cents <= 0) return null;
  if (input.remaining_cents <= 0) return input.next_payday ?? null;
  if (!input.next_payday) return null;
  const periods = Math.ceil(input.remaining_cents / input.per_paycheque_cents);
  const days = (periods - 1) * Math.max(1, Math.round(input.cadence_days));
  return addDays(input.next_payday, days);
}

// ---------------------------------------------------------------------------
// Session 8 (connect plan): habit context into goal projections.
//
// For each accelerating discretionary sub-category, simulate cutting it by 50%
// and redirecting the freed monthly cents into the goal. Returns the top 3
// candidates by months_saved descending. Pure — no DB.
//
// Math:
//   monthly_freed = round(monthly_burn × cut_pct / 100)
//   per_paycheque_freed = round(monthly_freed × 12 / 26)
//   new_per = current_per + per_paycheque_freed
//   new_complete = projectGoalCompletion(remaining, new_per, next_payday, cadence)
//   months_saved = round((current_complete_ms - new_complete_ms) / (30 days))
// ---------------------------------------------------------------------------

export interface GoalWhatIf {
  sub: string;
  cut_pct: number;
  monthly_freed_cents: number;
  new_complete_date: string;
  months_saved: number;
}

export interface AcceleratingSub {
  sub: string;
  monthly_burn_cents: number;
  velocity: 'accelerating' | 'steady' | 'cooling';
}

const PAYCHEQUES_PER_YEAR = 26;
const MONTHS_PER_YEAR = 12;

export function projectGoalWithCuts(input: {
  remaining_cents: number;
  per_paycheque_cents: number;
  next_payday: string | null;
  cadence_days: number;
  current_complete_date: string | null;
  subs: AcceleratingSub[];
  cut_pct?: number;
}): GoalWhatIf[] {
  const cut_pct = input.cut_pct ?? 50;
  if (!input.current_complete_date) return [];
  if (input.remaining_cents <= 0) return [];
  if (!input.next_payday) return [];

  const currentMs = Date.parse(input.current_complete_date);
  if (!Number.isFinite(currentMs)) return [];

  const candidates: GoalWhatIf[] = [];
  for (const s of input.subs) {
    if (s.velocity !== 'accelerating') continue;
    if (s.monthly_burn_cents <= 0) continue;

    const monthly_freed_cents = Math.round((s.monthly_burn_cents * cut_pct) / 100);
    if (monthly_freed_cents <= 0) continue;

    const per_paycheque_freed = Math.round((monthly_freed_cents * MONTHS_PER_YEAR) / PAYCHEQUES_PER_YEAR);
    if (per_paycheque_freed <= 0) continue;

    const new_complete_date = projectGoalCompletion({
      remaining_cents: input.remaining_cents,
      per_paycheque_cents: input.per_paycheque_cents + per_paycheque_freed,
      next_payday: input.next_payday,
      cadence_days: input.cadence_days,
    });
    if (!new_complete_date) continue;

    const newMs = Date.parse(new_complete_date);
    if (!Number.isFinite(newMs)) continue;

    const months_saved = Math.round((currentMs - newMs) / (30 * MS_PER_DAY));
    if (months_saved <= 0) continue;

    candidates.push({
      sub: s.sub,
      cut_pct,
      monthly_freed_cents,
      new_complete_date,
      months_saved,
    });
  }

  candidates.sort((a, b) => b.months_saved - a.months_saved);
  return candidates.slice(0, 3);
}
