import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
};

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

export default function Plan() {
  const qc = useQueryClient();
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
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
          <Link to="/budget" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Back
          </Link>
        </header>

        {plan && (
          <div className="pt-3 flex flex-col gap-1" style={perforation}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Total interest under this plan
            </div>
            <div className="hero-num">{formatCents(plan.total_interest_cents)}</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              vs minimums-only baseline {formatCents(plan.baseline_total_interest_cents)} · saves{' '}
              <span style={{ color: 'var(--color-accent-gold)' }}>{formatCents(plan.savings_cents)}</span>
            </div>
          </div>
        )}

        {plan && debtIds.length > 0 && (
          <div className="pt-3 flex flex-col gap-2" style={perforation}>
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

        <div className="pt-3 flex flex-col gap-2" style={perforation}>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            <span>Rationale</span>
            <button
              className="stamp stamp-square text-[10px]"
              disabled={refresh.isPending}
              onClick={() => {
                setRefreshMsg(null);
                refresh.mutate();
              }}
            >
              {refresh.isPending ? 'Asking…' : 'Refresh'}
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

        {data && data.observations.length > 0 && (
          <div className="pt-3 flex flex-col gap-1" style={perforation}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Observations
            </div>
            <ul className="flex flex-col gap-1">
              {data.observations.map((o, i) => (
                <li key={i} className="text-sm leading-snug">
                  · {o}
                </li>
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
