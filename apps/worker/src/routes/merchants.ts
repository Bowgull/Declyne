import { Hono } from 'hono';
import type { Env } from '../env.js';
import { writeEditLog } from '../lib/editlog.js';
import {
  detectSubCategory,
  isSubCategory,
  type SubCategory,
} from '../lib/subCategoryDetect.js';

export const merchantsRoutes = new Hono<{ Bindings: Env }>();

type MerchantRow = {
  id: string;
  display_name: string;
  normalized_key: string;
  category_default_id: string | null;
  verified: number;
  sub_category: string | null;
  sub_category_confirmed: number;
};

type MerchantListRow = MerchantRow & {
  category_name: string | null;
  category_group: string | null;
  txn_count: number;
  last_seen_at: string | null;
  uncategorized_txn_count: number;
  spend_90d_cents: number;
  spend_30d_cents: number;
  spend_prior_30d_cents: number;
  txn_count_90d: number;
};

export type MerchantPatch = {
  display_name?: string;
  category_default_id?: string | null;
  verified?: 0 | 1 | boolean;
  apply_to_uncategorized?: boolean;
  sub_category?: SubCategory | null;
  sub_category_confirmed?: 0 | 1 | boolean;
};

export function parseMerchantPatch(raw: unknown): MerchantPatch {
  if (!raw || typeof raw !== 'object') return {};
  const b = raw as Record<string, unknown>;
  const out: MerchantPatch = {};
  if (typeof b.display_name === 'string') {
    const v = b.display_name.trim();
    if (v) out.display_name = v.slice(0, 120);
  }
  if ('category_default_id' in b) {
    const v = b.category_default_id;
    if (v === null || v === '') out.category_default_id = null;
    else if (typeof v === 'string') out.category_default_id = v;
  }
  if ('verified' in b) {
    out.verified = b.verified === true || b.verified === 1 ? 1 : 0;
  }
  if (b.apply_to_uncategorized === true) out.apply_to_uncategorized = true;
  if ('sub_category' in b) {
    const v = b.sub_category;
    if (v === null || v === '') out.sub_category = null;
    else if (isSubCategory(v)) out.sub_category = v;
  }
  if ('sub_category_confirmed' in b) {
    out.sub_category_confirmed =
      b.sub_category_confirmed === true || b.sub_category_confirmed === 1 ? 1 : 0;
  }
  return out;
}

merchantsRoutes.get('/', async (c) => {
  const status = c.req.query('status') ?? 'all';
  const q = (c.req.query('q') ?? '').trim().toLowerCase();
  const limit = Math.min(Number(c.req.query('limit') ?? '200') || 200, 1000);

  const where: string[] = [];
  const binds: unknown[] = [];
  if (status === 'unverified') where.push('m.verified = 0');
  else if (status === 'verified') where.push('m.verified = 1');
  if (q) {
    where.push('(LOWER(m.display_name) LIKE ? OR LOWER(m.normalized_key) LIKE ?)');
    binds.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `SELECT m.id, m.display_name, m.normalized_key, m.category_default_id, m.verified,
                      m.sub_category, m.sub_category_confirmed,
                      c.name AS category_name,
                      c.\`group\` AS category_group,
                      COUNT(t.id) AS txn_count,
                      MAX(t.posted_at) AS last_seen_at,
                      SUM(CASE WHEN t.category_id IS NULL THEN 1 ELSE 0 END) AS uncategorized_txn_count,
                      COALESCE(SUM(CASE WHEN t.posted_at >= date('now', '-90 days') AND t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) AS spend_90d_cents,
                      COALESCE(SUM(CASE WHEN t.posted_at >= date('now', '-30 days') AND t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) AS spend_30d_cents,
                      COALESCE(SUM(CASE WHEN t.posted_at >= date('now', '-60 days') AND t.posted_at < date('now', '-30 days') AND t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) AS spend_prior_30d_cents,
                      COALESCE(SUM(CASE WHEN t.posted_at >= date('now', '-90 days') THEN 1 ELSE 0 END), 0) AS txn_count_90d
               FROM merchants m
               LEFT JOIN transactions t ON t.merchant_id = m.id
               LEFT JOIN categories c ON c.id = m.category_default_id
               ${whereSql}
               GROUP BY m.id
               ORDER BY m.verified ASC, spend_90d_cents DESC, txn_count DESC, m.display_name ASC
               LIMIT ?`;
  binds.push(limit);
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<MerchantListRow>();
  return c.json({ merchants: results });
});

merchantsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const patch = parseMerchantPatch(await c.req.json().catch(() => ({})));
  const existing = await c.env.DB.prepare(
    `SELECT id, display_name, normalized_key, category_default_id, verified, sub_category, sub_category_confirmed FROM merchants WHERE id = ?`,
  )
    .bind(id)
    .first<MerchantRow>();
  if (!existing) return c.json({ error: 'not found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  const logs: Parameters<typeof writeEditLog>[1] = [];

  if (patch.display_name !== undefined && patch.display_name !== existing.display_name) {
    updates.push('display_name = ?');
    values.push(patch.display_name);
    logs.push({
      entity_type: 'merchant',
      entity_id: id,
      field: 'display_name',
      old_value: existing.display_name,
      new_value: patch.display_name,
      actor: 'user',
      reason: 'merchant_update',
    });
  }
  if (patch.category_default_id !== undefined && patch.category_default_id !== existing.category_default_id) {
    updates.push('category_default_id = ?');
    values.push(patch.category_default_id);
    logs.push({
      entity_type: 'merchant',
      entity_id: id,
      field: 'category_default_id',
      old_value: existing.category_default_id,
      new_value: patch.category_default_id,
      actor: 'user',
      reason: 'merchant_update',
    });
  }
  if (patch.verified !== undefined) {
    const next = patch.verified ? 1 : 0;
    if (next !== existing.verified) {
      updates.push('verified = ?');
      values.push(next);
      logs.push({
        entity_type: 'merchant',
        entity_id: id,
        field: 'verified',
        old_value: String(existing.verified),
        new_value: String(next),
        actor: 'user',
        reason: 'merchant_update',
      });
    }
  }

  if (patch.sub_category !== undefined && patch.sub_category !== existing.sub_category) {
    updates.push('sub_category = ?');
    values.push(patch.sub_category);
    logs.push({
      entity_type: 'merchant_sub_category',
      entity_id: id,
      field: 'sub_category',
      old_value: existing.sub_category,
      new_value: patch.sub_category,
      actor: 'user',
      reason: 'sub_category_set',
    });
  }
  if (patch.sub_category_confirmed !== undefined) {
    const next = patch.sub_category_confirmed ? 1 : 0;
    if (next !== existing.sub_category_confirmed) {
      updates.push('sub_category_confirmed = ?');
      values.push(next);
      logs.push({
        entity_type: 'merchant_sub_category',
        entity_id: id,
        field: 'sub_category_confirmed',
        old_value: String(existing.sub_category_confirmed),
        new_value: String(next),
        actor: 'user',
        reason: 'sub_category_confirm',
      });
    }
  }

  let backfilled = 0;
  if (updates.length) {
    await c.env.DB.prepare(`UPDATE merchants SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values, id)
      .run();
  }

  if (patch.apply_to_uncategorized && patch.category_default_id) {
    const res = await c.env.DB.prepare(
      `UPDATE transactions SET category_id = ? WHERE merchant_id = ? AND category_id IS NULL`,
    )
      .bind(patch.category_default_id, id)
      .run();
    backfilled = res.meta.changes ?? 0;
    if (backfilled > 0) {
      logs.push({
        entity_type: 'merchant',
        entity_id: id,
        field: 'backfill_category',
        old_value: null,
        new_value: String(backfilled),
        actor: 'user',
        reason: 'merchant_backfill',
      });
      await c.env.DB.prepare(
        `UPDATE review_queue SET resolved_at = ?
         WHERE resolved_at IS NULL
           AND transaction_id IN (SELECT id FROM transactions WHERE merchant_id = ? AND category_id = ?)`,
      )
        .bind(new Date().toISOString(), id, patch.category_default_id)
        .run();
    }
  }

  await writeEditLog(c.env, logs);
  return c.json({ ok: true, backfilled });
});

/**
 * GET /sub-categories/queue — discretionary merchants where the user hasn't
 * confirmed a sub-category yet. Sorted by 90d spend so the loudest habits
 * surface first.
 *
 * Surfaces both unguessed (sub_category IS NULL) and detector-guessed-but-
 * not-confirmed merchants. The Habits queue UI shows the guess in the
 * approve sheet so the user can accept-with-one-tap or override.
 */
merchantsRoutes.get('/sub-categories/queue', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? '50') || 50, 200);
  // Surfaces three states:
  //   1. sub_category IS NULL                   → unguessed, awaiting first verdict
  //   2. sub_category set but confirmed = 0     → detector guess, awaiting accept/override
  //   3. confirmed = 1 but sub doesn't match    → category was changed later; stale
  //                                                confirmation now visibly broken on the
  //                                                Habits map (UNCONFIRMED hub). Without
  //                                                surfacing here the user has no UI path.
  const sql = `SELECT m.id, m.display_name, m.normalized_key, m.sub_category,
                      m.sub_category_confirmed,
                      c.\`group\` AS category_group,
                      COALESCE(SUM(CASE WHEN t.posted_at >= date('now', '-90 days') AND t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) AS spend_90d_cents,
                      COALESCE(SUM(CASE WHEN t.posted_at >= date('now', '-90 days') THEN 1 ELSE 0 END), 0) AS txn_count_90d
               FROM merchants m
               LEFT JOIN transactions t ON t.merchant_id = m.id
               LEFT JOIN categories c ON c.id = m.category_default_id
               WHERE c.\`group\` IN ('lifestyle', 'indulgence')
               GROUP BY m.id
               HAVING spend_90d_cents > 0
               ORDER BY spend_90d_cents DESC
               LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql).bind(limit).all<{
    id: string;
    display_name: string;
    normalized_key: string;
    sub_category: string | null;
    sub_category_confirmed: number;
    category_group: string | null;
    spend_90d_cents: number;
    txn_count_90d: number;
  }>();
  // Filter in JS: only show merchants where the user hasn't confirmed yet.
  // Once confirmed (sub_category_confirmed = 1) the merchant is done — the
  // user's explicit choice stands regardless of category/group alignment.
  const filtered = results
    .filter((m) => m.sub_category_confirmed === 0)
    .map((m) => ({ ...m, mismatch: false as const }));
  return c.json({ merchants: filtered });
});

/**
 * POST /sub-categories/backfill — runs the detector against every
 * unconfirmed discretionary merchant. Used once after the migration to
 * seed guesses; harmless to re-run (only writes when the detector returns
 * a non-null guess that differs from current).
 */
merchantsRoutes.post('/sub-categories/backfill', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.display_name, m.sub_category, c.\`group\` AS category_group
     FROM merchants m
     LEFT JOIN categories c ON c.id = m.category_default_id
     WHERE m.sub_category_confirmed = 0
       AND c.\`group\` IN ('essentials', 'lifestyle', 'indulgence')`,
  ).all<{
    id: string;
    display_name: string;
    sub_category: string | null;
    category_group: 'essentials' | 'lifestyle' | 'indulgence';
  }>();

  let updated = 0;
  for (const m of results) {
    const guess = detectSubCategory(m.display_name, m.category_group);
    if (guess && guess !== m.sub_category) {
      await c.env.DB.prepare(
        `UPDATE merchants SET sub_category = ? WHERE id = ?`,
      )
        .bind(guess, m.id)
        .run();
      updated++;
    }
  }
  return c.json({ scanned: results.length, updated });
});
