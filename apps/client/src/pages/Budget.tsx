import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import ImportCsvButton from '../components/ImportCsvButton';
import LedgerHeader from '../components/LedgerHeader';
import AllocationSheet, { type AllocationRow } from '../components/AllocationSheet';

interface TankPeriod {
  id: string;
  start_date: string;
  end_date: string;
  paycheque_cents: number;
}
interface TankResp {
  period: TankPeriod | null;
  paycheque_cents: number;
  by_group: Record<string, number>;
  total_spent_cents: number;
  remaining_cents: number;
  committed_cents: number;
  truly_free_cents: number;
  days_remaining: number;
}
interface HistoryRow {
  id: string;
  start_date: string;
  end_date: string;
  paycheque_cents: number;
  indulgence_cents: number;
  other_cents: number;
}
interface TrendResp {
  weeks: { week_start: string; indulgence_cents: number; lifestyle_cents: number; ratio_bps: number }[];
}
interface VarianceRow {
  group: 'essentials' | 'lifestyle' | 'debt' | 'savings' | 'indulgence';
  planned_cents: number;
  spent_cents: number;
  delta_cents: number;
}
interface VarianceResp {
  period: TankPeriod | null;
  rows: VarianceRow[];
}
interface AllocationsResp {
  period: TankPeriod | null;
  rows: AllocationRow[];
  totals: {
    paycheque_cents: number;
    assigned_cents: number;
    unassigned_cents: number;
    stamped_cents: number;
  } | null;
}
interface Counterparty {
  id: string;
  name: string;
  net_cents: number;
  direction: 'owes_you' | 'you_owe' | 'settled';
  open_tab_count: number;
}

type CommittedSource = 'bill' | 'debt_min' | 'savings_goal' | 'savings_recurring';
interface CommittedLine {
  source: CommittedSource;
  label: string;
  amount_cents: number;
  due_date?: string;
  ref_id?: string;
}
interface PaycheckSnapshot {
  period: { id: string; start_date: string; end_date: string };
  paycheque_cents: number;
  committed: {
    bills_cents: number;
    debt_mins_cents: number;
    savings_cents: number;
    total_cents: number;
    lines: CommittedLine[];
  };
  available_for_debt_extra_cents: number;
  spending_money_cents: number;
  baseline: {
    lifestyle_per_paycheque_cents: number;
    indulgence_per_paycheque_cents: number;
  };
  spent_so_far_cents: number;
}

type AllocGroup = AllocationRow['category_group'];

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const m = (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).toUpperCase();
  return `${m(s)} → ${m(e)}`;
}

function pct(num: number, denom: number): number {
  return denom <= 0 ? 0 : Math.max(0, Math.min(100, (num / denom) * 100));
}

function fmtDay(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).toUpperCase();
}

function ruleClassFor(source: CommittedSource): string {
  if (source === 'bill') return 'cat-rule essentials';
  if (source === 'debt_min') return 'cat-rule debt';
  return 'cat-rule savings';
}

function MiniTank({ row }: { row: HistoryRow }) {
  const denom = Math.max(row.paycheque_cents, row.indulgence_cents + row.other_cents, 1);
  const otherPct = pct(row.other_cents, denom);
  const indulgencePct = pct(row.indulgence_cents, denom);
  const fillPct = Math.max(0, 100 - otherPct - indulgencePct);
  return (
    <div className="flex flex-col gap-1">
      <div className="mini-tank">
        <div className="mini-tank-fill">
          <div className="tank-band-fill" style={{ height: `${fillPct}%` }} />
          <div className="tank-band-essentials" style={{ height: `${otherPct}%` }} />
          <div className="tank-band-indulgence" style={{ height: `${indulgencePct}%` }} />
        </div>
      </div>
      <div className="text-[9px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] text-center font-mono">
        {new Date(row.start_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}

export default function Budget() {
  const qc = useQueryClient();
  const [openGroup, setOpenGroup] = useState<AllocGroup | null>(null);

  const tank = useQuery({
    queryKey: ['budget-tank'],
    queryFn: () => api.get<TankResp>('/api/budget/tank'),
  });
  const history = useQuery({
    queryKey: ['budget-tank-history'],
    queryFn: () => api.get<{ rows: HistoryRow[] }>('/api/budget/tank/history?limit=4'),
  });
  const trend = useQuery({
    queryKey: ['budget-indulgence-trend'],
    queryFn: () => api.get<TrendResp>('/api/budget/indulgence/trend'),
  });
  const allocations = useQuery({
    queryKey: ['allocations'],
    queryFn: () => api.get<AllocationsResp>('/api/allocations'),
  });
  const paycheque = useQuery({
    queryKey: ['paycheque-snapshot'],
    queryFn: () => api.get<{ snapshot: PaycheckSnapshot | null }>('/api/paycheque'),
  });
  const variance = useQuery({
    queryKey: ['budget-variance'],
    queryFn: () => api.get<VarianceResp>('/api/budget/variance'),
  });
  const counterparties = useQuery({
    queryKey: ['counterparties'],
    queryFn: () => api.get<{ counterparties: Counterparty[] }>('/api/counterparties'),
  });

  const draft = useMutation({
    mutationFn: () => api.post<{ inserted: number }>('/api/allocations/draft'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocations'] });
      qc.invalidateQueries({ queryKey: ['paycheque-snapshot'] });
      qc.invalidateQueries({ queryKey: ['budget-variance'] });
    },
  });

  const t = tank.data;
  const period = t?.period ?? null;
  const paycheque_cents = t?.paycheque_cents ?? 0;
  const essentialsSpend = t?.by_group.essentials ?? 0;
  const lifestyleSpend = t?.by_group.lifestyle ?? 0;
  const indulgenceSpend = t?.by_group.indulgence ?? 0;
  const debtSpend = t?.by_group.debt ?? 0;
  const transferSpend = t?.by_group.transfer ?? 0;
  const uncatSpend = t?.by_group.uncategorized ?? 0;
  const totalSpend =
    essentialsSpend + lifestyleSpend + indulgenceSpend + debtSpend + transferSpend + uncatSpend;
  const remaining = t?.remaining_cents ?? 0;

  const denom = Math.max(paycheque_cents, totalSpend + remaining, 1);
  const fillPctV = pct(remaining, denom);
  const savingsPctV = pct(transferSpend, denom);
  const essentialsPctV = pct(essentialsSpend, denom);
  const debtPctV = pct(debtSpend, denom);
  const lifestylePctV = pct(lifestyleSpend, denom);
  const uncatPctV = pct(uncatSpend, denom);
  const indulgencePctV = pct(indulgenceSpend, denom);

  // Velocity: last 4 weeks vs prior 4 weeks.
  const weeks = trend.data?.weeks ?? [];
  const recent4 = weeks.slice(-4);
  const prior4 = weeks.slice(-8, -4);
  const sumIndulgence = (rows: typeof weeks) => rows.reduce((s, w) => s + w.indulgence_cents, 0);
  const sumDenom = (rows: typeof weeks) => rows.reduce((s, w) => s + w.indulgence_cents + w.lifestyle_cents, 0);
  const recentRatio = sumDenom(recent4) > 0 ? sumIndulgence(recent4) / sumDenom(recent4) : 0;
  const priorRatio = sumDenom(prior4) > 0 ? sumIndulgence(prior4) / sumDenom(prior4) : 0;
  const deltaPts = (recentRatio - priorRatio) * 100;
  const recentPct = recentRatio * 100;
  const indulgenceDollars = sumIndulgence(recent4);

  const allocRows = allocations.data?.rows ?? [];
  const totals = allocations.data?.totals ?? null;
  const assigned = totals?.assigned_cents ?? 0;
  const unassigned = totals?.unassigned_cents ?? 0;
  const historyRows = history.data?.rows ?? [];
  const openTabs = (counterparties.data?.counterparties ?? []).filter((c) => c.direction !== 'settled');

  const snapshot = paycheque.data?.snapshot ?? null;
  const committedLines = snapshot?.committed.lines ?? [];
  const committedTotal = snapshot?.committed.total_cents ?? 0;

  const subtitle = period ? fmtRange(period.start_date, period.end_date) : 'No paycheque yet';

  return (
    <div className="ledger-page flex flex-col gap-6 pb-8">
      <LedgerHeader
        kicker="This paycheque"
        title={subtitle}
        action={<ImportCsvButton />}
      />

      {!period && (
        <section className="card">
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Import a paycheque to fill the tank.
          </p>
        </section>
      )}

      {period && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>01</span> Income
          </span>
          <div className="ledger-row">
            <div className="flex items-center gap-3 ledger-row-main">
              <span className="cat-rule income" />
              <div className="min-w-0">
                <div className="text-sm">Paycheque</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                  {fmtRange(period.start_date, period.end_date)}
                </div>
              </div>
            </div>
            <span className="num ledger-row-value" style={{ color: 'var(--cat-income)' }}>
              + {formatCents(paycheque_cents)}
            </span>
          </div>
          {totals && unassigned > 0 && (
            <div className="ledger-row">
              <span
                className="ledger-row-main text-[10px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--cat-indulgence)' }}
              >
                {formatCents(unassigned)} unassigned · give every dollar a job
              </span>
            </div>
          )}
        </section>
      )}

      {period && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>02</span> Committed
          </span>
          <span className="ledger-section-meta">
            {formatCents(committedTotal)}
          </span>
          {committedLines.length === 0 ? (
            <div className="ledger-row">
              <span className="ledger-row-main text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                Nothing yet · bills, debt mins and savings sweeps land here
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {committedLines.map((line, i) => (
                <div key={`${line.source}-${line.ref_id ?? i}-${i}`} className="ledger-row">
                  <div className="flex items-center gap-3 ledger-row-main">
                    <span className={ruleClassFor(line.source)} />
                    <div className="min-w-0">
                      <div className="text-sm truncate">{line.label}</div>
                      {line.due_date && (
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                          due {fmtDay(line.due_date)}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="num ledger-row-value">{formatCents(line.amount_cents)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {(() => {
        // Aggregate by group so the section is stable even if the worker
        // hasn't yet shipped the new per-group response shape.
        const agg = new Map<string, { planned: number; spent: number }>();
        for (const r of variance.data?.rows ?? []) {
          if (!r?.group) continue;
          const cur = agg.get(r.group) ?? { planned: 0, spent: 0 };
          const p = Number(r.planned_cents);
          const s = Number(r.spent_cents);
          cur.planned += Number.isFinite(p) ? p : 0;
          cur.spent += Number.isFinite(s) ? s : 0;
          agg.set(r.group, cur);
        }
        const visible = Array.from(agg.entries()).filter(([, v]) => v.planned > 0 || v.spent > 0);
        if (!period || visible.length === 0) return null;
        return (
          <section className="ledger-section pt-4">
            <span className="ledger-section-kicker">
              <span className="num" style={{ color: 'var(--color-accent-gold)' }}>02b</span> Budget vs. actual
            </span>
            <div className="flex flex-col">
              {visible.map(([group, v]) => {
                const delta = v.planned - v.spent;
                const over = delta < 0;
                const deltaColor = over ? 'var(--cat-indulgence)' : 'var(--cat-savings)';
                const deltaPrefix = over ? '−' : '+';
                return (
                  <div key={group} className="ledger-row">
                    <div className="flex items-center gap-3 ledger-row-main">
                      <span className={`cat-rule ${group}`} />
                      <div className="min-w-0">
                        <div className="text-sm capitalize">{group}</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                          planned {formatCents(v.planned)} · spent {formatCents(v.spent)}
                        </div>
                      </div>
                    </div>
                    <span className="num ledger-row-value" style={{ color: deltaColor }}>
                      {deltaPrefix}{formatCents(Math.abs(delta))}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      <PlanRow />

      {period && (
        <section style={{ height: '40vh', minHeight: 280 }}>
          <div className="tank h-full">
            <div className="tank-grid" />
            <span className="tank-tick" style={{ top: '25%' }} />
            <span className="tank-tick right" style={{ top: '25%' }} />
            <span className="tank-tick" style={{ top: '50%' }} />
            <span className="tank-tick right" style={{ top: '50%' }} />
            <span className="tank-tick" style={{ top: '75%' }} />
            <span className="tank-tick right" style={{ top: '75%' }} />
            <div className="tank-fill">
              <div className="tank-band-fill" style={{ height: `${fillPctV}%`, transition: 'height 600ms ease' }} />
              <button
                aria-label="Open savings"
                className="tank-band-savings tank-band-tap"
                style={{ height: `${savingsPctV}%`, transition: 'height 600ms ease' }}
                onClick={() => setOpenGroup('savings')}
              />
              <button
                aria-label="Open essentials"
                className="tank-band-essentials tank-band-tap"
                style={{ height: `${essentialsPctV}%`, transition: 'height 600ms ease' }}
                onClick={() => setOpenGroup('essentials')}
              />
              <button
                aria-label="Open debt"
                className="tank-band-debt tank-band-tap"
                style={{ height: `${debtPctV}%`, transition: 'height 600ms ease' }}
                onClick={() => setOpenGroup('debt')}
              />
              <button
                aria-label="Open lifestyle"
                className="tank-band-lifestyle tank-band-tap"
                style={{ height: `${lifestylePctV}%`, transition: 'height 600ms ease' }}
                onClick={() => setOpenGroup('lifestyle')}
              />
              <div className="tank-band-uncategorized" style={{ height: `${uncatPctV}%`, transition: 'height 600ms ease' }} />
              <button
                aria-label="Open indulgence"
                className="tank-band-indulgence tank-band-tap"
                style={{ height: `${indulgencePctV}%`, transition: 'height 600ms ease' }}
                onClick={() => setOpenGroup('indulgence')}
              />
            </div>
            <div className="tank-overlay">
              <div className="tank-overlay-top">
                <span>In {formatCents(paycheque_cents)}</span>
                <span>{t?.days_remaining ?? 0}d left</span>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] tank-number-label font-mono">
                  Available
                </div>
                <div className="tank-number text-5xl mt-1">{formatCents(remaining)}</div>
                {totals && (
                  <div className="tank-overlay-bottom mt-2 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: '#2a2228' }}>
                    <span>Assigned {formatCents(assigned)}</span>
                    <span style={{ color: unassigned < 0 ? 'var(--cat-indulgence)' : '#2a2228' }}>
                      Unassigned {formatCents(unassigned)}
                    </span>
                  </div>
                )}
                {(t?.committed_cents ?? 0) > 0 && (
                  <div className="tank-overlay-bottom mt-1 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: '#2a2228' }}>
                    <span>Free {formatCents(t?.truly_free_cents ?? 0)}</span>
                    <span style={{ color: 'var(--cat-debt)' }}>Committed {formatCents(t?.committed_cents ?? 0)}</span>
                  </div>
                )}
                <div className="tank-overlay-bottom mt-2">
                  <span style={{ color: indulgenceSpend > 0 ? 'var(--cat-indulgence)' : '#2a2228' }}>
                    Indulgence {formatCents(indulgenceSpend)}
                  </span>
                  <span>Spent {formatCents(totalSpend)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {period && (
        <button
          className="tear-tab tear-tab-motion"
          onClick={() => draft.mutate()}
          disabled={draft.isPending}
          style={{ opacity: draft.isPending ? 0.5 : 1 }}
        >
          <span className="cut-line" aria-hidden />
          <span className="tear-arrow" aria-hidden>↓</span>
          <span>{draft.isPending ? 'Drafting.' : 'Draft this paycheque'}</span>
          <span className="cut-line" aria-hidden />
        </button>
      )}

      {(weeks.length > 0 || historyRows.length > 0) && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>05</span> Trends
          </span>
          {weeks.length > 0 && (
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] flex items-center gap-2 flex-wrap pt-3">
              <span className="cat-dot indulgence" />
              <span>Indulgence 30d</span>
              <span style={{ color: 'var(--cat-indulgence)' }}>{recentPct.toFixed(0)}%</span>
              <span>·</span>
              <span>{formatCents(indulgenceDollars)}</span>
              {prior4.length > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {deltaPts >= 0 ? '↑' : '↓'} {Math.abs(deltaPts).toFixed(1)}pt vs prior
                  </span>
                </>
              )}
            </div>
          )}
          {historyRows.length > 0 && (
            <div className="grid grid-cols-4 gap-2 pt-3">
              {historyRows.map((r) => (
                <MiniTank key={r.id} row={r} />
              ))}
            </div>
          )}
        </section>
      )}

      {openTabs.length > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>06</span> Open tabs
          </span>
          <div className="flex flex-col">
            {openTabs.slice(0, 4).map((c) => (
              <Link key={c.id} to={`/paycheque/tabs/${c.id}`} className="ledger-row">
                <div className="flex items-center gap-3 ledger-row-main">
                  <span
                    className="cat-rule"
                    style={{
                      background:
                        c.direction === 'owes_you' ? 'var(--cat-savings)' : 'var(--cat-indulgence)',
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{c.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                      {c.open_tab_count} {c.open_tab_count === 1 ? 'chit' : 'chits'} ·{' '}
                      {c.direction === 'owes_you' ? 'owes you' : 'you owe'}
                    </div>
                  </div>
                </div>
                <span
                  className="num ledger-row-value"
                  style={{
                    color: c.direction === 'owes_you' ? 'var(--cat-savings)' : 'var(--cat-indulgence)',
                  }}
                >
                  {c.direction === 'owes_you' ? '+' : '-'}
                  {formatCents(Math.abs(c.net_cents))}
                </span>
                <span className="ledger-row-chevron">&rsaquo;</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {openGroup && (
        <AllocationSheet
          group={openGroup}
          rows={allocRows}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </div>
  );
}

type PlanRowResp = {
  plan: {
    capacity_cents: number;
    savings_cents: number;
    next_paycheque_allocations: Array<{ amount_cents: number }>;
  };
};

function PlanRow() {
  const p = useQuery({
    queryKey: ['plan'],
    queryFn: () => api.get<PlanRowResp>('/api/plan'),
  });
  const data = p.data?.plan;
  const total = data?.next_paycheque_allocations.reduce((s, a) => s + a.amount_cents, 0) ?? 0;
  return (
    <section className="ledger-section pt-4">
      <span className="ledger-section-kicker">
        <span className="num" style={{ color: 'var(--color-accent-gold)' }}>03</span> Recommended
      </span>
      <Link to="/paycheque/plan" className="ledger-section-meta hover:underline">open &rsaquo;</Link>
      <Link to="/paycheque/plan" className="ledger-row tap">
        <div className="ledger-row-main">
          <span className="ledger-row-label">Toward debt next paycheque</span>
          <span className="ledger-row-hint">
            {data ? `capacity ${formatCents(data.capacity_cents)} · saves ${formatCents(data.savings_cents)}` : '—'}
          </span>
        </div>
        <span className="ledger-row-value">{data ? formatCents(total) : '—'}</span>
        <span className="ledger-row-chevron">&rsaquo;</span>
      </Link>
    </section>
  );
}
