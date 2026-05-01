import { describe, it, expect } from 'vitest';
import { adminBlockers } from '../lib/loadMasterQueue.js';
import type { QueueItem } from '../lib/masterQueue.js';

function item(kind: QueueItem['kind'], id = 'x'): QueueItem {
  return {
    kind,
    id,
    label: 'l',
    due_date: null,
    tier: 0,
    href: '/',
  };
}

describe('adminBlockers', () => {
  it('returns zero on empty', () => {
    expect(adminBlockers([])).toEqual({ count: 0, by_kind: {} });
  });

  it('ignores tier-0..3 kinds (reconcile, bill, plan_installment, payday)', () => {
    const items: QueueItem[] = [
      item('reconcile'),
      item('bill', 'b'),
      item('plan_installment', 'p'),
      item('payday', 'pd'),
    ];
    expect(adminBlockers(items)).toEqual({ count: 0, by_kind: {} });
  });

  it('counts every tier-4 admin kind', () => {
    const items: QueueItem[] = [
      item('review_uncategorized', '1'),
      item('sub_category_unconfirmed', '2'),
      item('sub_category_stale', '3'),
      item('tab_to_match', '4'),
      item('uncleared_line', '5'),
      item('subscription_pending_verdict', '6'),
      item('statement_mismatch', '7'),
      item('counterparty_stale', '8'),
    ];
    const out = adminBlockers(items);
    expect(out.count).toBe(8);
    expect(out.by_kind.review_uncategorized).toBe(1);
    expect(out.by_kind.sub_category_unconfirmed).toBe(1);
    expect(out.by_kind.sub_category_stale).toBe(1);
    expect(out.by_kind.tab_to_match).toBe(1);
    expect(out.by_kind.uncleared_line).toBe(1);
    expect(out.by_kind.subscription_pending_verdict).toBe(1);
    expect(out.by_kind.statement_mismatch).toBe(1);
    expect(out.by_kind.counterparty_stale).toBe(1);
  });

  it('aggregates duplicates per kind', () => {
    const items: QueueItem[] = [
      item('review_uncategorized', '1'),
      item('review_uncategorized', '2'),
      item('review_uncategorized', '3'),
      item('uncleared_line', '4'),
      item('uncleared_line', '5'),
    ];
    const out = adminBlockers(items);
    expect(out.count).toBe(5);
    expect(out.by_kind.review_uncategorized).toBe(3);
    expect(out.by_kind.uncleared_line).toBe(2);
  });

  it('mixes admin kinds with non-blockers correctly', () => {
    const items: QueueItem[] = [
      item('reconcile'),
      item('bill', 'b'),
      item('review_uncategorized', '1'),
      item('payday', 'pd'),
      item('counterparty_stale', '2'),
    ];
    const out = adminBlockers(items);
    expect(out.count).toBe(2);
    expect(out.by_kind.review_uncategorized).toBe(1);
    expect(out.by_kind.counterparty_stale).toBe(1);
    expect(out.by_kind.bill).toBeUndefined();
    expect(out.by_kind.payday).toBeUndefined();
    expect(out.by_kind.reconcile).toBeUndefined();
  });
});
