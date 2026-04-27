import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { detectPeriods, type PaycheckCandidate } from '../lib/payperiods.js';
import { runCcStatementDerivation } from './ccStatements.js';
import { draftForPeriod, autoMatchAllocations } from './allocations.js';
import { disableLinksForSplit } from './paymentLinks.js';
import { postSplitEventJe } from '../lib/glCounterparty.js';

interface ImportRow {
  posted_at: string;
  amount_cents: number;
  description_raw: string;
  account_id: string;
  dedup_hash: string;
  merchant_normalized_key: string;
}

interface ImportPayload {
  rows: ImportRow[];
  merchant_norm_version: number;
}

export const importRoutes = new Hono<{ Bindings: Env }>();

importRoutes.post('/transactions', async (c) => {
  const body = (await c.req.json()) as ImportPayload;
  if (!Array.isArray(body.rows)) return c.json({ error: 'rows must be array' }, 400);

  let inserted = 0;
  let skipped = 0;
  let newMerchants = 0;
  let flagged = 0;

  const insertTx = c.env.DB.prepare(
    `INSERT OR IGNORE INTO transactions
     (id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  );
  const getMerchant = c.env.DB.prepare(`SELECT id, category_default_id FROM merchants WHERE normalized_key = ?`);
  const insertMerchant = c.env.DB.prepare(
    `INSERT INTO merchants (id, display_name, normalized_key, verified) VALUES (?,?,?,0)`,
  );
  const insertReview = c.env.DB.prepare(
    `INSERT INTO review_queue (id, transaction_id, reason, resolved_at) VALUES (?,?,?,NULL)`,
  );

  for (const r of body.rows) {
    const key = r.merchant_normalized_key;
    let merchantId: string | null = null;
    let categoryId: string | null = null;
    let isNewMerchant = false;

    if (key) {
      const existing = await getMerchant.bind(key).first<{ id: string; category_default_id: string | null }>();
      if (existing) {
        merchantId = existing.id;
        categoryId = existing.category_default_id;
      } else {
        merchantId = newId('mer');
        await insertMerchant.bind(merchantId, r.description_raw.slice(0, 80), key).run();
        isNewMerchant = true;
        newMerchants++;
      }
    }

    const txId = newId('tx');
    const res = await insertTx
      .bind(
        txId,
        r.account_id,
        r.posted_at,
        r.amount_cents,
        r.description_raw,
        merchantId,
        categoryId,
        r.dedup_hash,
        'csv',
        nowIso(),
      )
      .run();

    if (res.meta.changes > 0) {
      inserted++;
      if (isNewMerchant || !categoryId) {
        await insertReview.bind(newId('rq'), txId, isNewMerchant ? 'new_merchant' : 'uncategorized').run();
        flagged++;
      }
    } else {
      skipped++;
    }
  }

  await c.env.DB.prepare(`UPDATE accounts SET last_import_at = ? WHERE id IN (SELECT DISTINCT account_id FROM transactions WHERE dedup_hash IN (${body.rows.map(() => '?').join(',')}))`)
    .bind(nowIso(), ...body.rows.map((r) => r.dedup_hash))
    .run()
    .catch(() => void 0);

  await writeEditLog(c.env, [
    {
      entity_type: 'import',
      entity_id: nowIso(),
      field: 'rows',
      old_value: null,
      new_value: JSON.stringify({ inserted, skipped, newMerchants, flagged }),
      actor: 'system',
      reason: 'csv_import',
    },
  ]);

  const periodsInserted = await autoDetectPeriods(c.env);
  const ccDerive = await runCcStatementDerivation(c.env).catch(() => ({
    debts_considered: 0,
    inserted: 0,
    inserted_ids: [] as string[],
  }));

  // Allocations: draft for current period (additive), then auto-match.
  let allocationsDrafted = 0;
  let allocationsMatched = 0;
  const currentPeriod = await c.env.DB.prepare(
    `SELECT id FROM pay_periods ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string }>();
  if (currentPeriod) {
    allocationsDrafted = await draftForPeriod(c.env, currentPeriod.id).catch(() => 0);
    allocationsMatched = await autoMatchAllocations(c.env, currentPeriod.id).catch(() => 0);
  }

  // Splits: auto-match open tabs by amount + ±3d window.
  const splitsSettled = await autoMatchSplits(c.env).catch(() => 0);

  return c.json({
    inserted,
    skipped_dedup: skipped,
    new_merchants: newMerchants,
    flagged_for_review: flagged,
    pay_periods_inserted: periodsInserted,
    cc_statements_inserted: ccDerive.inserted,
    allocations_drafted: allocationsDrafted,
    allocations_matched: allocationsMatched,
    splits_settled: splitsSettled,
  });
});

async function autoMatchSplits(env: import('../env.js').Env): Promise<number> {
  // Fetch all open splits (remaining > 0, no settlement_txn_id, not closed).
  const { results: openSplits } = await env.DB.prepare(
    `SELECT id, direction, remaining_cents, created_at
     FROM splits
     WHERE closed_at IS NULL AND settlement_txn_id IS NULL AND remaining_cents > 0`,
  ).all<{ id: string; direction: string; remaining_cents: number; created_at: string }>();

  if (openSplits.length === 0) return 0;

  let settled = 0;
  const now = nowIso();

  for (const split of openSplits) {
    // they_owe = incoming (positive amount); i_owe = outgoing (negative amount).
    const expectedAmount =
      split.direction === 'they_owe' ? split.remaining_cents : -split.remaining_cents;

    // Look for transactions within ±3 days of the split's created_at with matching amount.
    const { results: candidates } = await env.DB.prepare(
      `SELECT id FROM transactions
       WHERE amount_cents = ?
         AND posted_at >= date(?, '-3 days')
         AND posted_at <= date(?, '+3 days')`,
    )
      .bind(expectedAmount, split.created_at.slice(0, 10), split.created_at.slice(0, 10))
      .all<{ id: string }>();

    if (candidates.length !== 1 || !candidates[0]) continue; // skip ambiguous or no match

    const txId = candidates[0].id;
    const eventId = newId('se');

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE splits SET settlement_txn_id = ?, remaining_cents = 0, closed_at = ? WHERE id = ?`,
      ).bind(txId, now, split.id),
      env.DB.prepare(
        `INSERT INTO split_events (id, split_id, delta_cents, transaction_id, note, created_at)
         VALUES (?,?,?,?,?,?)`,
      ).bind(eventId, split.id, -split.remaining_cents, txId, 'auto-matched on import', now),
    ]);

    await writeEditLog(env, [
      {
        entity_type: 'split',
        entity_id: split.id,
        field: 'settlement_txn_id',
        old_value: null,
        new_value: txId,
        actor: 'rules',
        reason: 'split_auto_matched',
      },
    ]);

    await postSplitEventJe(env, {
      event_id: eventId,
      split_id: split.id,
      direction: split.direction as 'i_owe' | 'they_owe',
      delta_cents: -split.remaining_cents,
      transaction_id: txId,
      posted_at: now,
      note: 'auto-matched on import',
    }).catch(() => null);

    await disableLinksForSplit(env, split.id, 'split_auto_matched').catch(() => 0);

    settled++;
  }

  return settled;
}

async function autoDetectPeriods(env: import('../env.js').Env): Promise<number> {
  const { results: settingsRows } = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE key IN ('paycheque_source_account_id','paycheque_pattern','paycheque_min_cents','paycheque_fallback_days')`,
  ).all<{ key: string; value: string }>();
  const s: Record<string, string> = {};
  for (const r of settingsRows) s[r.key] = r.value;
  const sourceAccountId = s.paycheque_source_account_id;
  if (!sourceAccountId) return 0;

  const minCents = Number(s.paycheque_min_cents ?? '100000');
  const { results: candidates } = await env.DB.prepare(
    `SELECT posted_at, amount_cents, description_raw FROM transactions
     WHERE account_id = ? AND amount_cents >= ? ORDER BY posted_at ASC`,
  )
    .bind(sourceAccountId, minCents)
    .all<PaycheckCandidate>();

  const detected = detectPeriods(candidates, {
    pattern: s.paycheque_pattern ?? '',
    min_cents: minCents,
    fallback_days: Number(s.paycheque_fallback_days ?? '14'),
  });
  if (detected.length === 0) return 0;

  const { results: existingRows } = await env.DB.prepare(
    `SELECT start_date FROM pay_periods WHERE source_account_id = ?`,
  )
    .bind(sourceAccountId)
    .all<{ start_date: string }>();
  const existing = new Set(existingRows.map((r) => r.start_date));

  const fresh = detected.filter((p) => !existing.has(p.start_date));
  if (fresh.length === 0) return 0;

  const inserts = fresh.map((p) => ({ id: newId('pp'), ...p, source_account_id: sourceAccountId }));
  await env.DB.batch(
    inserts.map((r) =>
      env.DB.prepare(
        `INSERT INTO pay_periods (id, start_date, end_date, paycheque_cents, source_account_id)
         VALUES (?,?,?,?,?)`,
      ).bind(r.id, r.start_date, r.end_date, r.paycheque_cents, r.source_account_id),
    ),
  );
  await writeEditLog(
    env,
    inserts.map((r) => ({
      entity_type: 'pay_period',
      entity_id: r.id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify(r),
      actor: 'rules' as const,
      reason: 'paycheque_detected',
    })),
  );
  return inserts.length;
}
