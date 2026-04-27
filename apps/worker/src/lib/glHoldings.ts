import type { Env } from '../env.js';
import { nowIso } from './ids.js';
import { postJournalEntry, type JournalLineInput } from './gl.js';

// ============================================================================
// Assets layer over GL. Each holding lot links to one GL asset account at
// path Assets:Investments:<Wrapper>:<Symbol>. ACB (adjusted cost basis) +
// units + currency live in gl_accounts.metadata_json.
//
// Pure helpers:
//   - holdingGlPath(wrapper, symbol)
//   - holdingCostCents(units_scaled, avg_cost_cents)   total cost basis
//   - computeAcb({existing, buy})                       weighted-average ACB
//   - inferCurrency(symbol)                             'CAD' for *.TO/*.V/*.CN, else 'USD'
//   - buyJeLines({assetAcct, cashAcct, cost_cents})
//   - sellJeLines({assetAcct, cashAcct, proceeds_cents, costBasis_cents})
//   - mtmDeltaLines({assetAcct, delta_cents})           DR/CR vs Equity:Unrealized
//
// Impure:
//   - runHoldingsBackfill(env)   creates accounts + opening JEs, idempotent
// ============================================================================

export type AccountWrapper = 'tfsa' | 'fhsa' | 'rrsp' | 'nonreg';

const WRAPPER_LABEL: Record<AccountWrapper, string> = {
  tfsa: 'TFSA',
  fhsa: 'FHSA',
  rrsp: 'RRSP',
  nonreg: 'NonReg',
};

// units field on holdings is stored as actual_units * 10_000 for 4-decimal
// precision. avg_cost_cents is per-unit cents. Total cost = units * cost / 10_000.
export function holdingCostCents(units_scaled: number, avg_cost_cents: number): number {
  const u = Math.max(0, Math.trunc(units_scaled));
  const c = Math.max(0, Math.trunc(avg_cost_cents));
  if (u === 0 || c === 0) return 0;
  return Math.round((u * c) / 10000);
}

export function holdingGlPath(wrapper: AccountWrapper, symbol: string): string {
  return `Assets:Investments:${WRAPPER_LABEL[wrapper]}:${symbol.toUpperCase()}`;
}

export function inferCurrency(symbol: string): 'CAD' | 'USD' {
  const s = symbol.toUpperCase();
  return /\.(TO|V|CN|NE)$/.test(s) ? 'CAD' : 'USD';
}

export interface AcbInput {
  existing_units_scaled: number;
  existing_acb_cents: number; // per unit
  buy_units_scaled: number;
  buy_unit_cost_cents: number;
}

// Pure: weighted-average ACB. Returns the new {units_scaled, acb_cents per unit}
// after a buy. Existing zero balances trivially adopt the buy's unit cost.
export function computeAcb(args: AcbInput): { units_scaled: number; acb_cents: number } {
  const eu = Math.max(0, Math.trunc(args.existing_units_scaled));
  const ea = Math.max(0, Math.trunc(args.existing_acb_cents));
  const bu = Math.max(0, Math.trunc(args.buy_units_scaled));
  const bc = Math.max(0, Math.trunc(args.buy_unit_cost_cents));
  if (bu === 0) return { units_scaled: eu, acb_cents: ea };
  if (eu === 0) return { units_scaled: bu, acb_cents: bc };
  const totalCost = eu * ea + bu * bc;
  const totalUnits = eu + bu;
  return { units_scaled: totalUnits, acb_cents: Math.round(totalCost / totalUnits) };
}

export interface BuyLinesInput {
  assetAccountId: string;
  cashAccountId: string;
  cost_cents: number;
}

// Pure: DR asset, CR cash.
export function buyJeLines(args: BuyLinesInput): JournalLineInput[] {
  const c = Math.max(0, Math.trunc(args.cost_cents));
  if (c === 0) return [];
  return [
    { account_id: args.assetAccountId, debit_cents: c },
    { account_id: args.cashAccountId, credit_cents: c },
  ];
}

export interface SellLinesInput {
  assetAccountId: string;
  cashAccountId: string;
  proceeds_cents: number;
  costBasis_cents: number;
}

// Pure: split sell into cost-portion + realized gain/loss.
//   DR cash         proceeds
//   CR asset        costBasis
//   CR/DR realized  delta (gain credits, loss debits)
// Collapses to 2 lines when proceeds == costBasis. Returns [] for proceeds <= 0.
export function sellJeLines(args: SellLinesInput): JournalLineInput[] {
  const proceeds = Math.max(0, Math.trunc(args.proceeds_cents));
  const cost = Math.max(0, Math.trunc(args.costBasis_cents));
  if (proceeds === 0) return [];
  const lines: JournalLineInput[] = [
    { account_id: args.cashAccountId, debit_cents: proceeds },
    { account_id: args.assetAccountId, credit_cents: cost },
  ];
  const delta = proceeds - cost;
  if (delta > 0) {
    lines.push({ account_id: 'gla_equity_realized', credit_cents: delta });
  } else if (delta < 0) {
    lines.push({ account_id: 'gla_equity_realized', debit_cents: -delta });
  }
  return lines;
}

export interface MtmLinesInput {
  assetAccountId: string;
  delta_cents: number; // signed: +ve = unrealized gain, -ve = unrealized loss
}

// Pure: mark-to-market for one lot.
//   gain (delta > 0):  DR asset / CR Equity:Unrealized
//   loss (delta < 0):  DR Equity:Unrealized / CR asset
// Returns [] for delta = 0.
export function mtmDeltaLines(args: MtmLinesInput): JournalLineInput[] {
  const d = Math.trunc(args.delta_cents);
  if (d === 0) return [];
  const mag = Math.abs(d);
  return d > 0
    ? [
        { account_id: args.assetAccountId, debit_cents: mag },
        { account_id: 'gla_equity_unrealized', credit_cents: mag },
      ]
    : [
        { account_id: 'gla_equity_unrealized', debit_cents: mag },
        { account_id: args.assetAccountId, credit_cents: mag },
      ];
}

// ----- impure: backfill ----------------------------------------------------

export interface HoldingsBackfillResult {
  scanned: number;
  created_new: number;
  linked_existing: number;
  skipped: number;
  opening_balance_je_posted: number;
}

interface HoldingRow {
  id: string;
  symbol: string;
  account_wrapper: AccountWrapper;
  units: number;
  avg_cost_cents: number;
  account_id: string | null;
}

async function resolveHoldingGl(
  env: Env,
  holding: HoldingRow,
  result: HoldingsBackfillResult,
): Promise<string | null> {
  if (holding.account_id) return holding.account_id;

  const path = holdingGlPath(holding.account_wrapper, holding.symbol);
  const existing = await env.DB.prepare(`SELECT id FROM gl_accounts WHERE path = ? LIMIT 1`)
    .bind(path)
    .first<{ id: string }>();

  let glaId: string;
  if (existing) {
    glaId = existing.id;
    result.linked_existing += 1;
  } else {
    glaId = `gla_hold_${holding.id}`;
    const metadata = JSON.stringify({
      acb_cents: holding.avg_cost_cents,
      units_scaled: holding.units,
      currency: inferCurrency(holding.symbol),
    });
    await env.DB.prepare(
      `INSERT INTO gl_accounts (id, path, name, type, parent_id, metadata_json, created_at)
       VALUES (?,?,?,?,?,?,?)`,
    )
      .bind(
        glaId,
        path,
        `${WRAPPER_LABEL[holding.account_wrapper]} · ${holding.symbol.toUpperCase()}`,
        'asset',
        'gla_assets_invest',
        metadata,
        nowIso(),
      )
      .run();
    result.created_new += 1;
  }

  await env.DB.prepare(`UPDATE holdings SET account_id = ? WHERE id = ?`)
    .bind(glaId, holding.id)
    .run();

  const cost = holdingCostCents(holding.units, holding.avg_cost_cents);
  if (cost > 0) {
    const sourceId = `holding_open_${holding.id}`;
    const before = await env.DB.prepare(
      `SELECT id FROM journal_entries WHERE source_type = 'holding_opening' AND source_id = ? LIMIT 1`,
    )
      .bind(sourceId)
      .first<{ id: string }>();
    if (!before) {
      await postJournalEntry(
        env,
        [
          { account_id: glaId, debit_cents: cost },
          { account_id: 'gla_equity_opening', credit_cents: cost },
        ],
        {
          posted_at: nowIso(),
          source_type: 'holding_opening',
          source_id: sourceId,
          memo: `opening · ${holding.symbol.toUpperCase()} ${WRAPPER_LABEL[holding.account_wrapper]}`,
        },
      );
      result.opening_balance_je_posted += 1;
    }
  }

  return glaId;
}

// Idempotent. Walks every holdings row, ensures GL account exists, posts an
// opening-balance JE seeding cost basis. Safe to re-run.
export async function runHoldingsBackfill(env: Env): Promise<HoldingsBackfillResult> {
  const result: HoldingsBackfillResult = {
    scanned: 0,
    created_new: 0,
    linked_existing: 0,
    skipped: 0,
    opening_balance_je_posted: 0,
  };
  const rows = await env.DB.prepare(
    `SELECT id, symbol, account_wrapper, units, avg_cost_cents, account_id
     FROM holdings ORDER BY symbol ASC`,
  ).all<HoldingRow>();
  for (const h of rows.results ?? []) {
    result.scanned += 1;
    if (h.account_id) {
      result.skipped += 1;
      continue;
    }
    await resolveHoldingGl(env, h, result);
  }
  return result;
}

// Per-lot GL balance for asset accounts.
// Returns sum(debits) - sum(credits) (positive = asset value).
// Filters journal_lines via parent journal_entry posted_at <= asOf.
export async function glAssetBalance(
  env: Env,
  glAccountId: string,
  asOf: string | null,
): Promise<number> {
  const sql = asOf
    ? `SELECT COALESCE(SUM(jl.debit_cents) - SUM(jl.credit_cents), 0) AS bal
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE jl.account_id = ? AND je.posted_at <= ?`
    : `SELECT COALESCE(SUM(jl.debit_cents) - SUM(jl.credit_cents), 0) AS bal
       FROM journal_lines jl
       WHERE jl.account_id = ?`;
  const stmt = asOf
    ? env.DB.prepare(sql).bind(glAccountId, asOf)
    : env.DB.prepare(sql).bind(glAccountId);
  const row = await stmt.first<{ bal: number }>();
  return row?.bal ?? 0;
}
