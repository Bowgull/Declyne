import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

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

  return c.json({
    inserted,
    skipped_dedup: skipped,
    new_merchants: newMerchants,
    flagged_for_review: flagged,
  });
});
