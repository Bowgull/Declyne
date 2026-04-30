import { Hono } from 'hono';
import type { Env } from '../env.js';
import {
  detectRecurring,
  detectSubscriptions,
  predictNextPayday,
  type RecurringTxn,
} from '../lib/recurring.js';
import {
  buildMasterQueue,
  summarizeQueue,
  type CounterpartyStaleInput,
  type PlanInstallmentInput,
  type StatementMismatchInput,
  type SubCategoryRowInput,
  type SubscriptionPendingInput,
  type TabToMatchInput,
  type UnclearedLineInput,
} from '../lib/masterQueue.js';
import {
  expectedSignedAmount,
  isCompletedThisWeek,
  mostRecentSunday,
  naturalBalanceCents,
  withinThreeDays,
  type GlAccountType,
} from './reconciliation.js';
import { stripRoleSuffix } from './today.js';
import { reconcileStatements } from '../lib/debtGl.js';
import { isSubCategory, isValidForGroup, type SubGroup } from '../lib/subCategoryDetect.js';

export const queueRoutes = new Hono<{ Bindings: Env }>();

const HORIZON_DAYS = 30;
const COUNTERPARTY_STALE_DAYS = 30;

queueRoutes.get('/', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const today_dow = new Date(`${today}T00:00:00Z`).getUTCDay();

  // 1. reconcile status
  const lastAtRow = await c.env.DB.prepare(
    `SELECT value FROM settings WHERE key = 'last_reconciliation_at'`,
  ).first<{ value: string }>();
  const completed_this_week = isCompletedThisWeek(lastAtRow?.value ?? null, today);

  // 2. bills + payday from recurring detector
  const { results: txnRows } = await c.env.DB.prepare(
    `SELECT t.posted_at as posted_at, t.amount_cents as amount_cents,
            t.merchant_id as merchant_id, m.display_name as merchant_name,
            c."group" as "group"
     FROM transactions t
     LEFT JOIN merchants m ON m.id = t.merchant_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at >= date('now', '-90 days')
       AND t.amount_cents < 0
       AND t.merchant_id IS NOT NULL`,
  ).all<RecurringTxn>();
  const bills = detectRecurring(txnRows, today, HORIZON_DAYS);

  const period = await c.env.DB.prepare(
    `SELECT id, end_date, paycheque_cents FROM pay_periods
     WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string; end_date: string; paycheque_cents: number }>();
  const payday = predictNextPayday(period ?? null, today, HORIZON_DAYS);

  // 3. plan installments — committed, unstamped debt rows in current period
  const plan_installments: PlanInstallmentInput[] = [];
  if (period) {
    const { results } = await c.env.DB.prepare(
      `SELECT id, label, planned_cents
       FROM period_allocations
       WHERE pay_period_id = ?
         AND category_group = 'debt'
         AND committed_at IS NOT NULL
         AND stamped_at IS NULL
         AND planned_cents > 0`,
    ).bind(period.id).all<{ id: string; label: string; planned_cents: number }>();
    const ms = Math.max(0, Date.parse(period.end_date) - Date.parse(today));
    const days_until = Math.floor(ms / 86_400_000);
    for (const r of results ?? []) {
      plan_installments.push({
        id: r.id,
        label: stripRoleSuffix(r.label),
        amount_cents: r.planned_cents,
        due_date: period.end_date,
        days_until,
      });
    }
  }

  // 4. review queue
  const { results: reviewRows } = await c.env.DB.prepare(
    `SELECT rq.id, t.description_raw, t.amount_cents
     FROM review_queue rq JOIN transactions t ON t.id = rq.transaction_id
     WHERE rq.resolved_at IS NULL ORDER BY t.posted_at DESC LIMIT 200`,
  ).all<{ id: string; description_raw: string; amount_cents: number }>();

  // 5. sub-category queue — same predicate as /merchants/sub-categories/queue
  const { results: subRows } = await c.env.DB.prepare(
    `SELECT m.id, m.display_name, m.sub_category, m.sub_category_confirmed,
            c.\`group\` AS category_group,
            COALESCE(SUM(CASE WHEN t.posted_at >= date('now','-90 days') AND t.amount_cents < 0
                              THEN -t.amount_cents ELSE 0 END), 0) AS spend_90d_cents
     FROM merchants m
     LEFT JOIN transactions t ON t.merchant_id = m.id
     LEFT JOIN categories c ON c.id = m.category_default_id
     WHERE c.\`group\` IN ('lifestyle','indulgence')
     GROUP BY m.id
     HAVING spend_90d_cents > 0`,
  ).all<{
    id: string;
    display_name: string;
    sub_category: string | null;
    sub_category_confirmed: number;
    category_group: string | null;
    spend_90d_cents: number;
  }>();
  const sub_category_queue: SubCategoryRowInput[] = [];
  for (const m of subRows ?? []) {
    let mismatch = false;
    if (m.sub_category_confirmed === 0) {
      mismatch = false;
    } else if (!m.sub_category || !isSubCategory(m.sub_category)) {
      mismatch = true;
    } else {
      const g = m.category_group;
      if (g !== 'lifestyle' && g !== 'indulgence' && g !== 'essentials') {
        mismatch = true;
      } else {
        mismatch = !isValidForGroup(m.sub_category, g as SubGroup);
      }
    }
    if (m.sub_category_confirmed === 0 || mismatch) {
      sub_category_queue.push({
        id: m.id,
        display_name: m.display_name,
        spend_90d_cents: m.spend_90d_cents,
        mismatch,
      });
    }
  }

  // 6. tabs to match
  const { results: openSplits } = await c.env.DB.prepare(
    `SELECT s.id, s.direction, s.remaining_cents, s.created_at, s.reason,
            COALESCE(cp.name, '') AS counterparty_name
     FROM splits s
     LEFT JOIN counterparties cp ON cp.id = s.counterparty_id
     WHERE s.closed_at IS NULL AND s.settlement_txn_id IS NULL AND s.remaining_cents > 0
     ORDER BY s.created_at DESC`,
  ).all<{
    id: string;
    direction: 'they_owe' | 'i_owe';
    remaining_cents: number;
    created_at: string;
    reason: string;
    counterparty_name: string;
  }>();

  const tabs_to_match: TabToMatchInput[] = [];
  const counterparty_stale: CounterpartyStaleInput[] = [];
  for (const s of openSplits ?? []) {
    const expected = expectedSignedAmount(s.direction, s.remaining_cents);
    const day = s.created_at.slice(0, 10);
    const { results: candidates } = await c.env.DB.prepare(
      `SELECT t.id, t.posted_at, t.amount_cents
       FROM transactions t
       WHERE t.amount_cents = ?
         AND t.posted_at >= date(?, '-3 days')
         AND t.posted_at <= date(?, '+3 days')`,
    ).bind(expected, day, day).all<{ id: string; posted_at: string; amount_cents: number }>();
    const validCandidates = (candidates ?? []).filter(
      (t) => withinThreeDays(t.posted_at, s.created_at),
    );
    if (validCandidates.length >= 2) {
      tabs_to_match.push({
        id: s.id,
        counterparty_name: s.counterparty_name,
        reason: s.reason,
        remaining_cents: s.remaining_cents,
        candidate_count: validCandidates.length,
      });
    }
    const days_open = Math.floor(
      (Date.parse(today) - Date.parse(day)) / 86_400_000,
    );
    if (days_open >= COUNTERPARTY_STALE_DAYS) {
      counterparty_stale.push({
        split_id: s.id,
        counterparty_name: s.counterparty_name,
        direction: s.direction,
        remaining_cents: s.remaining_cents,
        days_open,
      });
    }
  }

  // 7. uncleared lines (this week, asset/liability accounts)
  const weekStart = mostRecentSunday(today);
  const { results: glAccounts } = await c.env.DB.prepare(
    `SELECT id, path, type FROM gl_accounts
     WHERE archived_at IS NULL AND type IN ('asset','liability')`,
  ).all<{ id: string; path: string; type: GlAccountType }>();
  const uncleared_lines: UnclearedLineInput[] = [];
  if ((glAccounts ?? []).length > 0) {
    const ids = (glAccounts ?? []).map((a) => a.id);
    const placeholders = ids.map(() => '?').join(',');
    const accountById = new Map((glAccounts ?? []).map((a) => [a.id, a]));
    const { results: lineRows } = await c.env.DB.prepare(
      `SELECT l.id, l.account_id, l.debit_cents, l.credit_cents,
              e.posted_at, e.memo
       FROM journal_lines l
       JOIN journal_entries e ON e.id = l.journal_entry_id
       WHERE l.account_id IN (${placeholders})
         AND l.cleared_at IS NULL
         AND date(e.posted_at) >= ?
         AND date(e.posted_at) <= ?`,
    ).bind(...ids, weekStart, today).all<{
      id: string;
      account_id: string;
      debit_cents: number;
      credit_cents: number;
      posted_at: string;
      memo: string | null;
    }>();
    for (const r of lineRows ?? []) {
      const acct = accountById.get(r.account_id);
      if (!acct) continue;
      const signed = naturalBalanceCents(acct.type, r.debit_cents, r.credit_cents);
      uncleared_lines.push({
        id: r.id,
        account_path: acct.path,
        posted_at: r.posted_at,
        amount_cents: signed,
        memo: r.memo,
      });
    }
  }

  // 8. subscriptions pending verdict
  const { results: subTxns } = await c.env.DB.prepare(
    `SELECT t.posted_at, t.amount_cents, t.merchant_id,
            m.display_name AS merchant_name, c."group" AS "group"
     FROM transactions t
     LEFT JOIN merchants m ON m.id = t.merchant_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at >= date('now','-180 days')
       AND t.merchant_id IS NOT NULL`,
  ).all<RecurringTxn>();
  const detectedSubs = detectSubscriptions(subTxns);
  const { results: verdictRows } = await c.env.DB.prepare(
    `SELECT merchant_id, verdict FROM subscription_verdicts`,
  ).all<{ merchant_id: string; verdict: string }>();
  const verdictMap = new Map<string, string>();
  for (const v of verdictRows ?? []) verdictMap.set(v.merchant_id, v.verdict);
  const subscriptions_pending: SubscriptionPendingInput[] = detectedSubs
    .filter((s) => !verdictMap.has(s.merchant_id))
    .map((s) => {
      const monthly = Math.round((s.amount_cents * 30) / Math.max(1, s.cadence_days));
      return {
        merchant_id: s.merchant_id,
        merchant_name: s.merchant_name,
        amount_cents: monthly,
      };
    });

  // 9. statement mismatches (non-zero in last 60 days)
  const stmtRows = await reconcileStatements(c.env, 60);
  const statement_mismatches: StatementMismatchInput[] = stmtRows
    .filter((r) => r.mismatch_cents !== 0)
    .map((r) => ({
      statement_id: r.statement_id,
      debt_name: r.debt_name,
      statement_date: r.statement_date,
      mismatch_cents: r.mismatch_cents,
    }));

  const items = buildMasterQueue(
    {
      completed_this_week,
      today_dow,
      bills,
      plan_installments,
      payday,
      review_uncategorized: (reviewRows ?? []).map((r) => ({
        id: r.id,
        description_raw: r.description_raw,
        amount_cents: r.amount_cents,
      })),
      sub_category_queue,
      tabs_to_match,
      uncleared_lines,
      subscriptions_pending,
      statement_mismatches,
      counterparty_stale,
    },
    today,
  );

  const summary = summarizeQueue(items);
  return c.json({ items, ...summary });
});
