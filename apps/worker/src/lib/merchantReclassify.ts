/**
 * Merchant cross-group reclassification.
 *
 * When a user confirms a sub-category that lives in a different category group
 * than the merchant's current category, we have to retroactively realign the
 * GL or the books and the Habits map disagree. This module owns that move.
 *
 * The contract:
 *   1. Same-group sub change       → metadata-only, no GL work, returns reclassified=false
 *   2. Cross-group sub change      → all of:
 *      a. Ensure cat_default_<newGroup> exists in `categories`
 *      b. UPDATE merchant.category_default_id to that default
 *      c. UPDATE every transactions.category_id for this merchant to that default
 *      d. For every existing JE on this merchant's transactions:
 *         - Reverse the original (dated today, source_type='reversal')
 *         - Post a new entry under the new GL expense account (dated today,
 *           source_type='reclassify_repost')
 *
 * Why date adjustments today and not the original posted_at:
 *   `postJournalEntry` rejects backdated writes into closed periods. Even for
 *   open periods, dating the adjustment today gives a clean audit trail —
 *   "on 2026-05-01 you reclassified Bar Raval; here are the offsetting entries."
 *   Sealed periods' trial balances are never modified.
 */

import type { Env } from '../env.js';
import type { CategoryGroup } from './glBackfill.js';
import { categoryGroupToAccountId } from './glBackfill.js';
import { postJournalEntry } from './gl.js';
import { writeEditLog } from './editlog.js';
import { newId, nowIso } from './ids.js';
import {
  ESSENTIALS_SUBS,
  LIFESTYLE_SUBS,
  INDULGENCE_SUBS,
  type SubCategory,
  type SubGroup,
} from './subCategoryDetect.js';

// ---------- pure helpers ----------

/**
 * Pure: maps a SubCategory enum value to its parent group.
 * Throws on unknown sub (programmer error — input must come from isSubCategory).
 */
export function subToGroup(sub: SubCategory): SubGroup {
  if ((ESSENTIALS_SUBS as readonly string[]).includes(sub)) return 'essentials';
  if ((LIFESTYLE_SUBS as readonly string[]).includes(sub)) return 'lifestyle';
  if ((INDULGENCE_SUBS as readonly string[]).includes(sub)) return 'indulgence';
  throw new Error(`subToGroup: unknown SubCategory ${sub}`);
}

/**
 * Pure: returns true when the merchant must be retroactively realigned.
 * False when groups match, when either side is missing, or when the new group
 * isn't one of the three sub-bearing groups (e.g. moving FROM debt is fine,
 * but the sub-category enum can't represent debt anyway).
 */
export function crossesGroup(
  oldGroup: string | null | undefined,
  newGroup: SubGroup,
): boolean {
  if (!oldGroup) return true; // no current category → always reassign
  return oldGroup !== newGroup;
}

/**
 * Pure: stable id for the per-group default category. We auto-create these
 * on demand the first time a reclassify needs one. The user-facing label
 * comes from sub_category, not from this category row's name.
 */
export function defaultCategoryIdForGroup(group: SubGroup): string {
  return `cat_default_${group}`;
}

/**
 * Pure: builds the reversal JE lines for an original list of journal lines.
 * Same accounts, debits and credits swapped. Equal magnitude in cents.
 */
export function buildReversalLines(
  original: ReadonlyArray<{ account_id: string; debit_cents: number; credit_cents: number }>,
): Array<{ account_id: string; debit_cents: number; credit_cents: number }> {
  return original.map((l) => ({
    account_id: l.account_id,
    debit_cents: l.credit_cents,
    credit_cents: l.debit_cents,
  }));
}

/**
 * Pure: invariant guard for reversal correctness. A reversal must:
 *   - have the same number of lines
 *   - reference the same account_ids in the same order
 *   - swap debit/credit per line (equal magnitudes)
 *   - sum to zero on each side (preserved from original by construction)
 */
export function validateReversal(
  original: ReadonlyArray<{ account_id: string; debit_cents: number; credit_cents: number }>,
  reversal: ReadonlyArray<{ account_id: string; debit_cents: number; credit_cents: number }>,
): { valid: true } | { valid: false; reason: string } {
  if (original.length !== reversal.length) {
    return { valid: false, reason: 'line count mismatch' };
  }
  for (let i = 0; i < original.length; i++) {
    const o = original[i]!;
    const r = reversal[i]!;
    if (o.account_id !== r.account_id) {
      return { valid: false, reason: `line ${i} account_id mismatch` };
    }
    if (o.debit_cents !== r.credit_cents) {
      return { valid: false, reason: `line ${i} debit-credit swap mismatch` };
    }
    if (o.credit_cents !== r.debit_cents) {
      return { valid: false, reason: `line ${i} credit-debit swap mismatch` };
    }
  }
  return { valid: true };
}

/**
 * Pure: builds the new "repost" JE lines for a transaction whose category
 * group changed. Cash side (asset/liability account) keeps its original
 * account_id; the "other side" gets remapped to the new group's expense
 * account.
 */
export function buildRepostLines(
  original: ReadonlyArray<{ account_id: string; debit_cents: number; credit_cents: number }>,
  oldOtherAccountId: string,
  newOtherAccountId: string,
): Array<{ account_id: string; debit_cents: number; credit_cents: number }> {
  return original.map((l) => {
    if (l.account_id === oldOtherAccountId) {
      return { ...l, account_id: newOtherAccountId };
    }
    return { ...l };
  });
}

// ---------- impure orchestrator ----------

export interface ReclassifyResult {
  reclassified: boolean;
  from_group: string | null;
  to_group: SubGroup;
  txn_count: number;
  je_count: number;
}

/**
 * Ensures the cat_default_<group> row exists. Idempotent.
 */
async function ensureDefaultCategory(env: Env, group: SubGroup): Promise<string> {
  const id = defaultCategoryIdForGroup(group);
  const existing = await env.DB.prepare(`SELECT id FROM categories WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<{ id: string }>();
  if (existing) return id;
  // Names are placeholders; the sub_category drives user-facing labels on the
  // Habits map and queue. The category row exists only so the GL has a stable
  // anchor for "this merchant is in group X".
  const name =
    group === 'essentials' ? 'Other Essentials'
      : group === 'lifestyle' ? 'Other Lifestyle'
        : 'Other Indulgence';
  await env.DB.prepare(
    `INSERT OR IGNORE INTO categories (id, name, \`group\`) VALUES (?, ?, ?)`,
  )
    .bind(id, name, group)
    .run();
  return id;
}

/**
 * Reclassify a merchant's category group. Detects same-group → no-op.
 * Cross-group → updates merchant.category_default_id, all of its transactions'
 * category_id, and posts reversal+repost JE pairs for every existing JE on
 * those transactions.
 *
 * All entries are dated today. Sealed-period TBs are never modified.
 */
export async function reclassifyMerchant(
  env: Env,
  merchantId: string,
  newSubCategory: SubCategory,
  today?: string,
): Promise<ReclassifyResult> {
  const newGroup = subToGroup(newSubCategory);

  // Read current state.
  const merchant = await env.DB.prepare(
    `SELECT m.id, m.category_default_id, c.\`group\` AS category_group
     FROM merchants m
     LEFT JOIN categories c ON c.id = m.category_default_id
     WHERE m.id = ?`,
  )
    .bind(merchantId)
    .first<{ id: string; category_default_id: string | null; category_group: string | null }>();
  if (!merchant) throw new Error(`reclassifyMerchant: merchant ${merchantId} not found`);

  if (!crossesGroup(merchant.category_group, newGroup)) {
    return {
      reclassified: false,
      from_group: merchant.category_group,
      to_group: newGroup,
      txn_count: 0,
      je_count: 0,
    };
  }

  // Resolve target category. Re-uses cat_default_<group> across all merchants;
  // the sub provides the precision layer.
  const newCategoryId = await ensureDefaultCategory(env, newGroup);

  // Walk every transaction for this merchant.
  const txnsRes = await env.DB.prepare(
    `SELECT id FROM transactions WHERE merchant_id = ?`,
  )
    .bind(merchantId)
    .all<{ id: string }>();
  const txns = txnsRes.results ?? [];

  const oldOtherAccountId = categoryGroupToAccountId(
    (merchant.category_group as CategoryGroup | null) ?? null,
  );
  const newOtherAccountId = categoryGroupToAccountId(newGroup as CategoryGroup);

  const todayDay = (today ?? nowIso()).slice(0, 10);
  const todayIso = `${todayDay}T00:00:00.000Z`;

  let jeCount = 0;

  for (const txn of txns) {
    // Find every JE for this transaction (almost always 0 or 1, but handle N).
    const jeRes = await env.DB.prepare(
      `SELECT id, posted_at, memo FROM journal_entries
       WHERE source_type = 'transaction' AND source_id = ?`,
    )
      .bind(txn.id)
      .all<{ id: string; posted_at: string; memo: string | null }>();
    const jes = jeRes.results ?? [];
    for (const je of jes) {
      const linesRes = await env.DB.prepare(
        `SELECT account_id, debit_cents, credit_cents FROM journal_lines WHERE journal_entry_id = ?`,
      )
        .bind(je.id)
        .all<{ account_id: string; debit_cents: number; credit_cents: number }>();
      const lines = linesRes.results ?? [];
      if (lines.length === 0) continue;

      // Reversal: same accounts, debit/credit swapped, dated today.
      const reversal = buildReversalLines(lines);
      const guard = validateReversal(lines, reversal);
      if (!guard.valid) {
        throw new Error(`reclassifyMerchant: reversal invariant failed for je ${je.id}: ${guard.reason}`);
      }
      const reversalId = await postJournalEntry(env, reversal, {
        posted_at: todayIso,
        source_type: 'reversal',
        source_id: je.id,
        memo: `reclassify reversal of ${je.id}`,
      });

      // Repost: cash side unchanged, "other side" remapped to new group.
      const repost = buildRepostLines(lines, oldOtherAccountId, newOtherAccountId);
      const repostId = await postJournalEntry(env, repost, {
        posted_at: todayIso,
        source_type: 'reclassify_repost',
        source_id: txn.id,
        memo: `reclassify of ${je.id}: ${je.memo ?? ''}`.trim(),
      });

      await writeEditLog(env, [
        {
          entity_type: 'journal_entry',
          entity_id: je.id,
          field: 'reversed_by',
          old_value: null,
          new_value: reversalId,
          actor: 'user',
          reason: 'merchant_reclassify_adjustment',
        },
        {
          entity_type: 'journal_entry',
          entity_id: repostId,
          field: 'created',
          old_value: null,
          new_value: repostId,
          actor: 'user',
          reason: 'merchant_reclassify_repost',
        },
      ]);

      jeCount++;
      void newId; // unused but kept for future per-line ids if we need them
    }

    // Repoint the txn itself so future GL re-derivation is consistent.
    if (txns.length > 0) {
      await env.DB.prepare(
        `UPDATE transactions SET category_id = ? WHERE id = ?`,
      )
        .bind(newCategoryId, txn.id)
        .run();
    }
  }

  // Update the merchant's default category last so any concurrent imports
  // during the loop above still resolve through the old mapping (consistent
  // with the JE pairs we just posted).
  await env.DB.prepare(
    `UPDATE merchants SET category_default_id = ? WHERE id = ?`,
  )
    .bind(newCategoryId, merchantId)
    .run();
  await writeEditLog(env, [
    {
      entity_type: 'merchant',
      entity_id: merchantId,
      field: 'category_default_id',
      old_value: merchant.category_default_id,
      new_value: newCategoryId,
      actor: 'user',
      reason: 'merchant_reclassify_adjustment',
    },
  ]);

  return {
    reclassified: true,
    from_group: merchant.category_group,
    to_group: newGroup,
    txn_count: txns.length,
    je_count: jeCount,
  };
}
