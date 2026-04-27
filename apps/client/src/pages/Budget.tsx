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
interface Goal {
  id: string;
  name: string;
  target_cents: number;
  progress_cents: number;
  archived: number;
}
interface Debt {
  id: string;
  name: string;
  principal_cents: number;
  archived: number;
}
interface Counterparty {
  id: string;
  name: string;
  net_cents: number;
  direction: 'owes_you' | 'you_owe' | 'settled';
  open_tab_count: number;
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
  const goals = useQuery({
    queryKey: ['goals-active'],
    queryFn: () => api.get<{ goals: Goal[] }>('/api/goals'),
  });
  const debts = useQuery({
    queryKey: ['debts'],
    queryFn: () => api.get<{ debts: Debt[] }>('/api/debts'),
  });
  const counterparties = useQuery({
    queryKey: ['counterparties'],
    queryFn: () => api.get<{ counterparties: Counterparty[] }>('/api/counterparties'),
  });

  const draft = useMutation({
    mutationFn: () => api.post<{ inserted: number }>('/api/allocations/draft'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allocations'] }),
  });

  const t = tank.data;
  const period = t?.period ?? null;
  const paycheque = t?.paycheque_cents ?? 0;
  const essentialsSpend = t?.by_group.essentials ?? 0;
  const lifestyleSpend = t?.by_group.lifestyle ?? 0;
  const indulgenceSpend = t?.by_group.indulgence ?? 0;
  const debtSpend = t?.by_group.debt ?? 0;
  const transferSpend = t?.by_group.transfer ?? 0;
  const uncatSpend = t?.by_group.uncategorized ?? 0;
  const totalSpend =
    essentialsSpend + lifestyleSpend + indulgenceSpend + debtSpend + transferSpend + uncatSpend;
  const remaining = t?.remaining_cents ?? 0;

  const denom = Math.max(paycheque, totalSpend + remaining, 1);
  const fillPctV = pct(remaining, denom);
  const savingsPctV = pct(transferSpend, denom);
  const essentialsPctV = pct(essentialsSpend, denom);
  const debtPctV = pct(debtSpend, denom);
  const lifestylePctV = pct(lifestyleSpend, denom);
  const uncatPctV = pct(uncatSpend, denom);
  const indulgencePctV = pct(indulgenceSpend, denom);

  // Velocity: last 4 weeks vs prior 4 weeks (cents — what the trend route gives us).
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
  const activeGoals = (goals.data?.goals ?? []).filter((g) => !g.archived).slice(0, 3);
  const historyRows = history.data?.rows ?? [];
  const activeDebts = (debts.data?.debts ?? []).filter((d) => !d.archived);
  const totalOwed = activeDebts.reduce((s, d) => s + d.principal_cents, 0);
  const openTabs = (counterparties.data?.counterparties ?? []).filter((c) => c.direction !== 'settled');

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

      {period && weeks.length > 0 && (
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] flex items-center gap-2 flex-wrap">
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

      {period && (
        <section style={{ height: '60vh', minHeight: 380 }}>
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
                <span>In {formatCents(paycheque)}</span>
                <span>{t?.days_remaining ?? 0}d left</span>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] tank-number-label font-mono">
                  Left to spend
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

      <NetWorthRow />

      {historyRows.length > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>04</span> Last {historyRows.length} {historyRows.length === 1 ? 'period' : 'periods'}
          </span>
          <div className="grid grid-cols-4 gap-2 pt-3">
            {historyRows.map((r) => (
              <MiniTank key={r.id} row={r} />
            ))}
          </div>
        </section>
      )}

      {activeGoals.length > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>05</span> Goals
          </span>
          <Link to="/goals" className="ledger-section-meta hover:underline">all &rsaquo;</Link>
          <div className="flex flex-col">
            {activeGoals.map((g) => {
              const p = g.target_cents > 0 ? Math.min(100, (g.progress_cents / g.target_cents) * 100) : 0;
              return (
                <div key={g.id} className="ledger-row">
                  <div className="flex items-center gap-3 ledger-row-main">
                    <span className="cat-rule savings" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{g.name}</div>
                      <div className="h-px bg-[color:var(--rule-ink)] relative mt-1.5">
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{ width: `${p}%`, height: 1, background: 'var(--cat-savings)' }}
                        />
                      </div>
                    </div>
                  </div>
                  <span className="num ledger-row-value text-xs text-[color:var(--color-text-muted)]">
                    {formatCents(g.progress_cents)} / {formatCents(g.target_cents)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeDebts.length > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>06</span> Debts
          </span>
          <Link to="/debts" className="ledger-section-meta hover:underline">manage &rsaquo;</Link>
          <div className="flex flex-col">
            {activeDebts.slice(0, 4).map((d) => (
              <Link key={d.id} to="/debts" className="ledger-row">
                <div className="flex items-center gap-3 ledger-row-main">
                  <span className="cat-rule debt" />
                  <div className="text-sm truncate">{d.name}</div>
                </div>
                <span className="num ledger-row-value">{formatCents(d.principal_cents)}</span>
                <span className="ledger-row-chevron">&rsaquo;</span>
              </Link>
            ))}
            <div className="ledger-row">
              <span className="ledger-row-main text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                Total owed
              </span>
              <span className="num ledger-row-value">{formatCents(totalOwed)}</span>
            </div>
          </div>
        </section>
      )}

      {openTabs.length > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>07</span> Open tabs
          </span>
          <div className="flex flex-col">
            {openTabs.slice(0, 4).map((c) => (
              <Link key={c.id} to={`/budget/tabs/${c.id}`} className="ledger-row">
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

interface NetWorthResp {
  assets_cents: number;
  liabilities_cents: number;
  net_worth_cents: number;
}

function NetWorthRow() {
  const nw = useQuery({
    queryKey: ['net-worth'],
    queryFn: () => api.get<NetWorthResp>('/api/gl/net-worth'),
  });
  const data = nw.data;
  return (
    <section className="ledger-section pt-4">
      <span className="ledger-section-kicker">
        <span className="num" style={{ color: 'var(--color-accent-gold)' }}>03</span> Net worth
      </span>
      <Link to="/settings/trial-balance" className="ledger-section-meta hover:underline">trial &rsaquo;</Link>
      <Link to="/settings/trial-balance" className="ledger-row tap">
        <div className="ledger-row-main">
          <span className="ledger-row-label">Assets − Liabilities</span>
          <span className="ledger-row-hint">
            {data
              ? `${formatCents(data.assets_cents)} − ${formatCents(data.liabilities_cents)}`
              : '—'}
          </span>
        </div>
        <span className="ledger-row-value">{data ? formatCents(data.net_worth_cents) : '—'}</span>
        <span className="ledger-row-chevron">&rsaquo;</span>
      </Link>
    </section>
  );
}
