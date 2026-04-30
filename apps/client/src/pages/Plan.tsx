import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import { SeedArt } from '../components/PostageArt';
import { showVocabularyToast } from '../lib/vocabularyToast';
import { toastErrorFrom, showSuccessToast } from '../lib/toast';

const perf: React.CSSProperties = { borderTop: '1px dashed var(--color-hairline)' };

type DebtSeverity = 'current' | 'past_due' | 'in_collections' | 'charged_off' | 'settled_partial';

type PlanAllocation = {
  debt_id: string;
  debt_name: string;
  role: 'min' | 'priority' | 'avalanche';
  amount_cents: number;
};

type PlanOutput = {
  next_paycheque_allocations: PlanAllocation[];
  monthly_schedule: Array<{ month: number; balances_cents: Record<string, number>; payments_cents: Record<string, number> }>;
  payoff_months: Record<string, number | null>;
  total_interest_cents: number;
  baseline_total_interest_cents: number;
  savings_cents: number;
  capacity_cents: number;
};

type InstallmentRow = {
  allocation_id: string;
  debt_name: string;
  amount_cents: number;
  due_date: string;
  status: 'paid' | 'pending';
  stamped_at: string | null;
};

type CommittedSummary = {
  plan_id: string;
  committed_at: string;
  pay_period_id: string;
  period_end_date: string;
  installment_count: number;
  total_cents: number;
  stamped_count: number;
  unstamped_count: number;
  installments: InstallmentRow[];
};

type PlanResponse = {
  plan: PlanOutput;
  inputs: {
    paycheque_cents: number;
    essentials_baseline_cents: number;
    indulgence_allowance_cents: number;
    charge_velocity_per_debt_cents: Record<string, number>;
    debt_count: number;
  };
  rationale: string | null;
  observations: string[];
  rationale_generated_at: string | null;
  rationale_source: 'ai' | 'manual' | 'pending' | null;
  inputs_hash: string;
  current_period_id: string | null;
  committed: CommittedSummary | null;
};

const ROLE_LABEL: Record<PlanAllocation['role'], string> = {
  min: 'min',
  priority: 'priority',
  avalanche: 'avalanche',
};

function payoffLabel(months: number | null): string {
  if (months == null) return 'beyond horizon';
  if (months === 0) return 'this month';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months}mo`;
  if (rem === 0) return `${years}y`;
  return `${years}y ${rem}mo`;
}

// Horizontal payoff timeline — a perforated arrow sequence showing each debt
// name and its payoff month in the plan. Sorted earliest-to-last.
function PayoffTimeline({ plan, debtIds, allocsByDebt }: {
  plan: PlanOutput;
  debtIds: string[];
  allocsByDebt: Map<string, { name: string; total: number; role: PlanAllocation['role'] }>;
}) {
  const sorted = debtIds
    .map((id) => ({ id, name: allocsByDebt.get(id)!.name, months: plan.payoff_months[id] ?? null }))
    .filter((d) => d.months != null)
    .sort((a, b) => (a.months ?? Infinity) - (b.months ?? Infinity));

  if (sorted.length === 0) return null;

  return (
    <div className="pt-3 flex flex-col gap-2" style={perf}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
        Payoff order
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {sorted.map((d, i) => (
          <span key={d.id} className="flex items-center gap-1">
            <span className="flex flex-col">
              <span className="text-xs font-mono">{d.name}</span>
              <span className="text-[10px] text-[color:var(--color-text-muted)] uppercase tracking-[0.14em]">{payoffLabel(d.months)}</span>
            </span>
            {i < sorted.length - 1 && (
              <span className="text-[color:var(--color-text-muted)] text-xs mx-1">→</span>
            )}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="text-[color:var(--color-text-muted)] text-xs mx-1">→</span>
          <span className="text-xs font-mono" style={{ color: 'var(--color-accent-gold)' }}>Debt free</span>
        </span>
      </div>
    </div>
  );
}

export default function Plan() {
  const qc = useQueryClient();
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [commitMsg, setCommitMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());

  const planQ = useQuery({
    queryKey: ['plan'],
    queryFn: () => api.get<PlanResponse>('/api/plan'),
  });

  const refresh = useMutation({
    mutationFn: () =>
      api.post<{ id: string; rationale: string; observations: string[] }>('/api/plan/refresh', {}),
    onSuccess: () => {
      setRefreshMsg('refreshed');
      qc.invalidateQueries({ queryKey: ['plan'] });
    },
    onError: (err) => {
      const m = err instanceof Error ? err.message : 'refresh failed';
      setRefreshMsg(m.includes('rate_limited') ? 'rate limit hit; try later' : m);
      toastErrorFrom(err, "Couldn't refresh the rationale.");
    },
  });

  const accept = useMutation({
    mutationFn: () =>
      api.post<{
        plan_id: string;
        committed_at: string;
        installments_committed: number;
        vocabulary_unlock?: { level: number; message: string };
      }>('/api/plan/accept', {}),
    onSuccess: (r) => {
      if (r.vocabulary_unlock) showVocabularyToast(r.vocabulary_unlock.message);
      setCommitMsg(`accepted · ${r.installments_committed} installments`);
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['allocations'] });
    },
    onError: (err) => {
      const m = err instanceof Error ? err.message : 'accept failed';
      setCommitMsg(
        m.includes('no_debt_allocations')
          ? 'no debt allocations this period — draft them first'
          : m.includes('no_current_period')
            ? 'no current pay period'
            : m,
      );
      toastErrorFrom(err, "Couldn't accept this plan.");
    },
  });

  const release = useMutation({
    mutationFn: () => api.post<{ released: number }>('/api/plan/release', {}),
    onSuccess: (r) => {
      setCommitMsg(`released · ${r.released} cleared`);
      setPaidIds(new Set());
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['allocations'] });
    },
    onError: (err) => {
      setCommitMsg(err instanceof Error ? err.message : 'release failed');
      toastErrorFrom(err, "Couldn't release this plan.");
    },
  });

  const stamp = useMutation({
    mutationFn: (allocationId: string) =>
      api.post<{ ok: boolean; already: boolean }>(`/api/period-allocations/${allocationId}/stamp`, {}),
    onMutate: (allocationId) => {
      // Optimistic stamp. Flip UI to paid immediately, roll back on error.
      setPaidIds((prev) => new Set([...prev, allocationId]));
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['plan'] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['allocations'] });
      if (!r.already) showSuccessToast('Marked paid.');
    },
    onError: (err, allocationId) => {
      setPaidIds((prev) => {
        const next = new Set(prev);
        next.delete(allocationId);
        return next;
      });
      toastErrorFrom(err, "Couldn't mark this paid.");
    },
  });

  const data = planQ.data;
  const plan = data?.plan;
  const allocsByDebt = new Map<string, { name: string; total: number; role: PlanAllocation['role']; min: number }>();
  if (plan) {
    for (const a of plan.next_paycheque_allocations) {
      const cur = allocsByDebt.get(a.debt_id);
      if (!cur) {
        allocsByDebt.set(a.debt_id, {
          name: a.debt_name,
          total: a.amount_cents,
          role: a.role,
          min: a.role === 'min' ? a.amount_cents : 0,
        });
      } else {
        cur.total += a.amount_cents;
        if (a.role === 'min') cur.min += a.amount_cents;
        if (a.role !== 'min') cur.role = a.role;
      }
    }
  }
  const debtIds = Array.from(allocsByDebt.keys());
  const isActive = !!data?.committed;

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        {/* Header */}
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-sigil" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">PAYOFF PLAN</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {plan ? `${debtIds.length} debts · capacity ${formatCents(plan.capacity_cents)}` : 'Loading…'}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 mt-1">
            <Link to="/paycheque" className="text-[color:var(--color-text-muted)] text-xs uppercase tracking-[0.18em]">
              Back
            </Link>
            {isActive && (
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--cat-savings)' }}>
                Active
              </div>
            )}
          </div>
        </header>

        {/* Interest hero — draft and active both show this */}
        {plan && (
          <div className="pt-3 flex flex-col gap-1" style={perf}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Total interest under this plan
            </div>
            <div className="hero-num">{formatCents(plan.total_interest_cents)}</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              vs minimums-only {formatCents(plan.baseline_total_interest_cents)} · saves{' '}
              <span style={{ color: 'var(--color-accent-gold)' }}>{formatCents(plan.savings_cents)}</span>
            </div>
          </div>
        )}

        {/* Active state: per-installment rows with PAID / pay-early */}
        {isActive && data?.committed && data.committed.installments.length > 0 && (
          <div className="pt-3 flex flex-col gap-2" style={perf}>
            <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              <span>This paycheque</span>
              <span className="font-mono">{data.committed.stamped_count}/{data.committed.installment_count} paid</span>
            </div>
            {data.committed.installments.map((inst) => {
              const isPaid = inst.status === 'paid' || paidIds.has(inst.allocation_id);
              return (
                <div key={inst.allocation_id} className="flex justify-between items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm">{inst.debt_name}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                      due {inst.due_date}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-sm">{formatCents(inst.amount_cents)}</span>
                    {isPaid ? (
                      <span className="stamp-paid-badge">Paid</span>
                    ) : (
                      <button
                        type="button"
                        className="ink-glyph commit"
                        style={{ fontSize: 14 }}
                        disabled={stamp.isPending}
                        title="Mark paid"
                        onClick={() => stamp.mutate(inst.allocation_id)}
                      >
                        ▸
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end">
              <button
                type="button"
                className="stamp stamp-square"
                style={{ fontSize: 10, padding: '4px 10px' }}
                disabled={release.isPending}
                onClick={() => { setCommitMsg(null); release.mutate(); }}
              >
                {release.isPending ? 'Releasing' : 'Release plan'}
              </button>
            </div>
            {commitMsg && (
              <div className="text-[11px] text-[color:var(--color-text-muted)] uppercase tracking-[0.18em]">
                {commitMsg}
              </div>
            )}
          </div>
        )}

        {/* Draft state: per-debt kernel rows with expandable schedule */}
        {!isActive && plan && debtIds.length > 0 && (
          <div className="pt-3 flex flex-col gap-2" style={perf}>
            <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              <span>Next paycheque</span>
              <span className="font-mono">
                {formatCents(plan.next_paycheque_allocations.reduce((s, a) => s + a.amount_cents, 0))}
              </span>
            </div>
            {debtIds.map((id) => {
              const d = allocsByDebt.get(id)!;
              const months = plan.payoff_months[id] ?? null;
              const isOpen = expanded === id;
              return (
                <div key={id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="flex justify-between items-baseline gap-3 text-left w-full"
                    onClick={() => setExpanded(isOpen ? null : id)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{d.name}</span>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                        {ROLE_LABEL[d.role]} · payoff {payoffLabel(months)}
                      </span>
                    </div>
                    <span className="font-mono shrink-0">{formatCents(d.total)}</span>
                  </button>
                  {isOpen && (
                    <div className="pl-3 mt-1 flex flex-col gap-0.5">
                      {plan.monthly_schedule.slice(0, 12).map((m) => (
                        <div key={m.month} className="flex justify-between text-[11px] text-[color:var(--color-text-muted)]">
                          <span>m{m.month}</span>
                          <span className="font-mono">
                            bal {formatCents(m.balances_cents[id] ?? 0)} · pay {formatCents(m.payments_cents[id] ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Payoff timeline — both states */}
        {plan && debtIds.length > 0 && (
          <PayoffTimeline plan={plan} debtIds={debtIds} allocsByDebt={allocsByDebt} />
        )}

        {/* Draft accept: tear-tab */}
        {!isActive && plan && debtIds.length > 0 && (
          <div className="pt-3 flex flex-col gap-2" style={perf}>
            <button
              type="button"
              className="tear-tab tear-tab-motion w-full"
              disabled={accept.isPending || !data?.current_period_id}
              onClick={() => { setCommitMsg(null); accept.mutate(); }}
            >
              <span className="tear-arrow" aria-hidden="true" />
              <span className="glyph">▸</span>
              {accept.isPending ? 'Stamping the plan' : 'Accept this plan'}
              <span className="cut-line left" aria-hidden="true" />
              <span className="cut-line right" aria-hidden="true" />
            </button>
            <p className="text-xs text-[color:var(--color-text-muted)] italic text-center">
              Stamp the plan to lock these installments. Today will surface them. Reconciliation will track them.
            </p>
            {commitMsg && (
              <div className="text-[11px] text-[color:var(--color-text-muted)] uppercase tracking-[0.18em] text-center">
                {commitMsg}
              </div>
            )}
          </div>
        )}

        {/* Rationale */}
        <div className="pt-3 flex flex-col gap-2" style={perf}>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            <span>Rationale</span>
            <button
              className="postage"
              style={{ minWidth: 100, padding: '10px 12px 8px', transform: 'rotate(1.4deg)' }}
              disabled={refresh.isPending}
              onClick={() => { setRefreshMsg(null); refresh.mutate(); }}
            >
              <span className="postage-denom" style={{ fontSize: 8 }}>AI</span>
              <span className="postage-art" style={{ width: 24, height: 24 }}><SeedArt /></span>
              <span className="postage-label" style={{ fontSize: 8 }}>
                {refresh.isPending ? 'Asking' : <>Refresh<br />rationale</>}
              </span>
            </button>
          </div>
          {data?.rationale ? (
            <p className="text-sm leading-snug">{data.rationale}</p>
          ) : (
            <p className="text-xs text-[color:var(--color-text-muted)] italic">
              No rationale yet. Tap Refresh to generate one.
            </p>
          )}
          {data?.rationale_generated_at && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              {data.rationale_source} · {data.rationale_generated_at.slice(0, 10)}
            </div>
          )}
          {refreshMsg && (
            <div className="text-[11px] text-[color:var(--color-text-muted)] uppercase tracking-[0.18em]">
              {refreshMsg}
            </div>
          )}
        </div>

        {/* Observations */}
        {data && data.observations.length > 0 && (
          <div className="pt-3 flex flex-col gap-1" style={perf}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Observations
            </div>
            <ul className="flex flex-col gap-1">
              {data.observations.map((o, i) => (
                <li key={i} className="text-sm leading-snug">· {o}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2 text-center text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
          ** recomputed live · refresh to ask **
        </div>
      </section>
    </div>
  );
}
