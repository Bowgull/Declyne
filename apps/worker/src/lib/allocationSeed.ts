// Pure helper that drafts allocation rows for a pay period. No DB access.
//
// Inputs are gathered by the caller from the live tables:
//   - recurring bill predictions (from recurring.ts) → essentials/transfer/debt
//   - active goals → savings (one row per goal, equal split across periods/yr)
//   - debt min payments → debt (one per non-archived debt with min > 0)
//   - last period's actual indulgence → indulgence (single carry-forward row,
//     editable; framed as "buffer", not a quota)
//
// Caller treats the result as an additive draft: existing rows that are
// stamped or user-edited are never overwritten.

export type DraftDebt = {
  id: string;
  name: string;
  min_payment_cents: number;
};

// Plan-aware allocation per debt: combines kernel min + extra (priority or
// avalanche) into a single row per debt labeled with the role.
export type DraftPlanDebt = {
  id: string;
  name: string;
  // sum across all roles for this debt from the kernel
  total_cents: number;
  // role of the highest-amount non-min role, or 'min' if only the minimum was paid
  role: 'min' | 'priority' | 'avalanche';
};

export type DraftGoal = {
  id: string;
  name: string;
  monthly_contribution_cents: number;
};

export type DraftRecurring = {
  merchant_id: string;
  merchant_name: string;
  amount_cents: number;
  group: 'essentials' | 'lifestyle' | 'debt' | 'transfer';
};

export type DraftAllocation = {
  category_group: 'essentials' | 'lifestyle' | 'debt' | 'savings' | 'indulgence';
  label: string;
  planned_cents: number;
};

export type SeedInputs = {
  debts: DraftDebt[];
  goals: DraftGoal[];
  recurring: DraftRecurring[];
  last_period_indulgence_cents: number;
  // When present, debt rows come from the kernel plan and `debts` is ignored.
  plan_debts?: DraftPlanDebt[];
};

// Map recurring group → allocation group (transfer is treated as savings).
function mapGroup(g: DraftRecurring['group']): DraftAllocation['category_group'] {
  if (g === 'transfer') return 'savings';
  return g;
}

export function draftAllocations(inputs: SeedInputs): DraftAllocation[] {
  const out: DraftAllocation[] = [];

  for (const r of inputs.recurring) {
    if (r.amount_cents <= 0) continue;
    out.push({
      category_group: mapGroup(r.group),
      label: r.merchant_name,
      planned_cents: Math.round(r.amount_cents),
    });
  }

  if (inputs.plan_debts && inputs.plan_debts.length > 0) {
    for (const d of inputs.plan_debts) {
      if (d.total_cents <= 0) continue;
      const suffix = d.role === 'priority' ? 'priority' : d.role === 'avalanche' ? 'avalanche' : 'min';
      out.push({
        category_group: 'debt',
        label: `${d.name} ${suffix}`,
        planned_cents: Math.round(d.total_cents),
      });
    }
  } else {
    for (const d of inputs.debts) {
      if (d.min_payment_cents <= 0) continue;
      out.push({
        category_group: 'debt',
        label: `${d.name} min`,
        planned_cents: Math.round(d.min_payment_cents),
      });
    }
  }

  for (const g of inputs.goals) {
    if (g.monthly_contribution_cents <= 0) continue;
    out.push({
      category_group: 'savings',
      label: g.name,
      planned_cents: Math.round(g.monthly_contribution_cents),
    });
  }

  if (inputs.last_period_indulgence_cents > 0) {
    out.push({
      category_group: 'indulgence',
      label: 'Indulgence buffer',
      planned_cents: Math.round(inputs.last_period_indulgence_cents),
    });
  }

  return out;
}

// Given existing rows + a fresh draft, return only rows that should be
// inserted: the draft is additive — never overwrites stamped or user-edited
// rows. A label collision with an existing row in the same group is treated as
// already covered (skipped). Stamped rows always win.
export function diffDraft(
  existing: { category_group: string; label: string; stamped_at: string | null }[],
  draft: DraftAllocation[],
): DraftAllocation[] {
  const seen = new Set(existing.map((r) => `${r.category_group}::${r.label.toLowerCase()}`));
  return draft.filter((d) => !seen.has(`${d.category_group}::${d.label.toLowerCase()}`));
}
