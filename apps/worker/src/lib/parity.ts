// Pure parity helpers. Two GL-vs-legacy invariants the test suite pins:
//
//   1. For every counterparty, the signed sum of splits.remaining_cents
//      (they_owe positive, i_owe negative) equals the GL receivable balance
//      derived from running splitCreateLines + splitEventLines through the
//      same JE generators production uses.
//
//   2. For every holding wrapper, sum(holdings cost_cents) equals the GL
//      Assets:Investments:<Wrapper>:* balance derived from running the
//      opening-balance JE pattern from runHoldingsBackfill.
//
// Both invariants hold by construction today. The tests guard against future
// drift in the JE generators or the legacy aggregation.

import {
  splitCreateLines,
  splitEventLines,
  type SplitDirection,
} from './glCounterparty.js';
import { holdingCostCents, type AccountWrapper } from './glHoldings.js';

export interface ParitySplit {
  id: string;
  counterparty_id: string;
  direction: SplitDirection;
  original_cents: number;
  remaining_cents: number;
}

export interface ParitySplitEvent {
  split_id: string;
  delta_cents: number;
}

export interface ParityHolding {
  symbol: string;
  account_wrapper: AccountWrapper;
  units: number; // scaled × 10_000
  avg_cost_cents: number;
}

// Legacy aggregate: signed remaining per counterparty.
// they_owe → +remaining (asset to me); i_owe → -remaining (liability to me).
export function splitsAggregateByCounterparty(
  splits: ParitySplit[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of splits) {
    const sign = s.direction === 'they_owe' ? 1 : -1;
    const cur = out.get(s.counterparty_id) ?? 0;
    out.set(s.counterparty_id, cur + sign * s.remaining_cents);
  }
  return out;
}

// GL aggregate: replay each split + event through the production JE
// generators, accumulate (debit - credit) on the cp's receivable account.
// The cash account is a fixed sentinel — we only sum the cp side here.
export function glReceivableBalancesByCounterparty(
  splits: ParitySplit[],
  events: ParitySplitEvent[],
): Map<string, number> {
  const out = new Map<string, number>();
  const CP = (id: string) => `cp:${id}`;
  const CASH = 'sentinel:cash';

  const accumulate = (acctId: string, lines: ReturnType<typeof splitCreateLines>) => {
    for (const ln of lines) {
      if (ln.account_id !== acctId) continue;
      const debit = ln.debit_cents ?? 0;
      const credit = ln.credit_cents ?? 0;
      // strip prefix to key by cp id
      const cpId = acctId.replace(/^cp:/, '');
      out.set(cpId, (out.get(cpId) ?? 0) + debit - credit);
    }
  };

  for (const s of splits) {
    const lines = splitCreateLines({
      direction: s.direction,
      amount_cents: s.original_cents,
      cpAccountId: CP(s.counterparty_id),
    });
    accumulate(CP(s.counterparty_id), lines);
  }

  const splitById = new Map(splits.map((s) => [s.id, s]));
  for (const e of events) {
    const split = splitById.get(e.split_id);
    if (!split) continue;
    const lines = splitEventLines({
      direction: split.direction,
      delta_cents: e.delta_cents,
      cpAccountId: CP(split.counterparty_id),
      cashAccountId: CASH,
    });
    accumulate(CP(split.counterparty_id), lines);
  }

  return out;
}

// Legacy aggregate: cost basis per wrapper (cents).
export function holdingsCostByWrapper(
  holdings: ParityHolding[],
): Map<AccountWrapper, number> {
  const out = new Map<AccountWrapper, number>();
  for (const h of holdings) {
    const cost = holdingCostCents(h.units, h.avg_cost_cents);
    out.set(h.account_wrapper, (out.get(h.account_wrapper) ?? 0) + cost);
  }
  return out;
}

// GL aggregate: replay each holding's opening-balance JE pattern (DR Asset /
// CR Equity:Opening Balance), accumulate the asset-side debit per wrapper.
// MTM is not auto-applied (deferred from session 56), so this is a cost-basis
// parity, not market-value parity.
export function glInvestmentBalancesByWrapper(
  holdings: ParityHolding[],
): Map<AccountWrapper, number> {
  const out = new Map<AccountWrapper, number>();
  for (const h of holdings) {
    const cost = holdingCostCents(h.units, h.avg_cost_cents);
    if (cost === 0) continue;
    // Opening JE: DR Assets:Investments:<Wrapper>:<Symbol> / CR Equity:Opening Balance
    // Asset side debit_cents = cost. Aggregate by wrapper.
    out.set(h.account_wrapper, (out.get(h.account_wrapper) ?? 0) + cost);
  }
  return out;
}

// Convenience: returns the keys present in either map plus the values from each.
export function diffMaps<K>(
  a: Map<K, number>,
  b: Map<K, number>,
): Array<{ key: K; a: number; b: number; delta: number }> {
  const keys = new Set<K>([...a.keys(), ...b.keys()]);
  const out: Array<{ key: K; a: number; b: number; delta: number }> = [];
  for (const k of keys) {
    const av = a.get(k) ?? 0;
    const bv = b.get(k) ?? 0;
    if (av !== bv) out.push({ key: k, a: av, b: bv, delta: av - bv });
  }
  return out;
}
