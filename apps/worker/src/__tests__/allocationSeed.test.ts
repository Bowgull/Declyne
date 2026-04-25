import { describe, it, expect } from 'vitest';
import { draftAllocations, diffDraft } from '../lib/allocationSeed.js';

describe('draftAllocations', () => {
  it('emits one row per recurring bill', () => {
    const out = draftAllocations({
      debts: [],
      goals: [],
      recurring: [
        { merchant_id: 'm1', merchant_name: 'Rogers', amount_cents: 8500, group: 'essentials' },
        { merchant_id: 'm2', merchant_name: 'Hydro', amount_cents: 12000, group: 'essentials' },
      ],
      last_period_indulgence_cents: 0,
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ category_group: 'essentials', label: 'Rogers', planned_cents: 8500 });
  });

  it('maps transfer recurring to savings', () => {
    const out = draftAllocations({
      debts: [],
      goals: [],
      recurring: [{ merchant_id: 'm1', merchant_name: 'TFSA Auto', amount_cents: 50000, group: 'transfer' }],
      last_period_indulgence_cents: 0,
    });
    expect(out[0]?.category_group).toBe('savings');
  });

  it('emits debt min lines tagged debt', () => {
    const out = draftAllocations({
      debts: [{ id: 'd1', name: 'Visa', min_payment_cents: 2500 }],
      goals: [],
      recurring: [],
      last_period_indulgence_cents: 0,
    });
    expect(out).toEqual([
      { category_group: 'debt', label: 'Visa min', planned_cents: 2500 },
    ]);
  });

  it('emits goal contribution as savings', () => {
    const out = draftAllocations({
      debts: [],
      goals: [{ id: 'g1', name: 'Vacation', monthly_contribution_cents: 30000 }],
      recurring: [],
      last_period_indulgence_cents: 0,
    });
    expect(out[0]).toMatchObject({ category_group: 'savings', label: 'Vacation', planned_cents: 30000 });
  });

  it('carries last-period indulgence as buffer', () => {
    const out = draftAllocations({
      debts: [],
      goals: [],
      recurring: [],
      last_period_indulgence_cents: 18000,
    });
    expect(out).toEqual([
      { category_group: 'indulgence', label: 'Indulgence buffer', planned_cents: 18000 },
    ]);
  });

  it('skips zero/negative amounts', () => {
    const out = draftAllocations({
      debts: [{ id: 'd1', name: 'PaidOff', min_payment_cents: 0 }],
      goals: [{ id: 'g1', name: 'Done', monthly_contribution_cents: 0 }],
      recurring: [{ merchant_id: 'm1', merchant_name: 'Free', amount_cents: 0, group: 'essentials' }],
      last_period_indulgence_cents: 0,
    });
    expect(out).toEqual([]);
  });
});

describe('diffDraft', () => {
  it('skips draft rows whose label+group already exists', () => {
    const existing = [
      { category_group: 'essentials', label: 'Rogers', stamped_at: null },
    ];
    const draft = [
      { category_group: 'essentials' as const, label: 'Rogers', planned_cents: 8500 },
      { category_group: 'essentials' as const, label: 'Hydro', planned_cents: 12000 },
    ];
    const out = diffDraft(existing, draft);
    expect(out).toHaveLength(1);
    expect(out[0]?.label).toBe('Hydro');
  });

  it('matches case-insensitively', () => {
    const existing = [{ category_group: 'debt', label: 'Visa Min', stamped_at: '2026-04-25' }];
    const draft = [{ category_group: 'debt' as const, label: 'visa min', planned_cents: 2500 }];
    expect(diffDraft(existing, draft)).toEqual([]);
  });

  it('treats different groups as separate', () => {
    const existing = [{ category_group: 'essentials', label: 'X', stamped_at: null }];
    const draft = [{ category_group: 'debt' as const, label: 'X', planned_cents: 100 }];
    expect(diffDraft(existing, draft)).toHaveLength(1);
  });
});
