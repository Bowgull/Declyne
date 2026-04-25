import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import ImportCsvButton from '../components/ImportCsvButton';

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
  vice_cents: number;
  other_cents: number;
}
interface PlanRow {
  id: string;
  target_type: 'account' | 'category' | 'debt';
  target_id: string;
  target_name: string | null;
  amount_cents: number;
  executed_at: string | null;
}
interface Goal {
  id: string;
  name: string;
  target_cents: number;
  progress_cents: number;
  archived: number;
}

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const m = (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).toUpperCase();
  return `${m(s)} -> ${m(e)}`;
}

function MiniTank({ row }: { row: HistoryRow }) {
  const denom = Math.max(row.paycheque_cents, row.vice_cents + row.other_cents, 1);
  const otherPct = (row.other_cents / denom) * 100;
  const vicePct = (row.vice_cents / denom) * 100;
  const fillPct = Math.max(0, 100 - otherPct - vicePct);
  return (
    <div className="flex flex-col gap-1">
      <div className="mini-tank">
        <div className="mini-tank-fill">
          <div className="tank-band-fill" style={{ height: `${fillPct}%` }} />
          <div className="tank-band-vice" style={{ height: `${vicePct}%` }} />
          <div className="tank-band-other" style={{ height: `${otherPct}%` }} />
        </div>
      </div>
      <div className="text-[9px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] text-center font-mono">
        {new Date(row.start_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}

export default function Budget() {
  const tank = useQuery({
    queryKey: ['budget-tank'],
    queryFn: () => api.get<TankResp>('/api/budget/tank'),
  });
  const history = useQuery({
    queryKey: ['budget-tank-history'],
    queryFn: () => api.get<{ rows: HistoryRow[] }>('/api/budget/tank/history?limit=4'),
  });
  const plan = useQuery({
    queryKey: ['routing'],
    queryFn: () => api.get<{ period: TankPeriod | null; rows: PlanRow[] }>('/api/routing'),
  });
  const goals = useQuery({
    queryKey: ['goals-active'],
    queryFn: () => api.get<{ goals: Goal[] }>('/api/goals'),
  });

  const t = tank.data;
  const period = t?.period ?? null;
  const paycheque = t?.paycheque_cents ?? 0;
  const vice = t?.by_group.vice ?? 0;
  const otherSpend =
    (t?.by_group.essentials ?? 0) +
    (t?.by_group.lifestyle ?? 0) +
    (t?.by_group.debt ?? 0) +
    (t?.by_group.uncategorized ?? 0);
  const remaining = t?.remaining_cents ?? 0;

  const denom = Math.max(paycheque, otherSpend + vice + remaining, 1);
  const otherPct = (otherSpend / denom) * 100;
  const vicePct = (vice / denom) * 100;
  const fillPct = Math.max(0, 100 - otherPct - vicePct);

  const planRows = plan.data?.rows ?? [];
  const planTotal = planRows.reduce((s, r) => s + r.amount_cents, 0);
  const activeGoals = (goals.data?.goals ?? []).filter((g) => !g.archived).slice(0, 3);
  const historyRows = history.data?.rows ?? [];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] font-mono">
            The Plan
          </div>
          <div className="display text-xl mt-0.5">
            {period ? fmtRange(period.start_date, period.end_date) : 'No pay period yet'}
          </div>
        </div>
        <ImportCsvButton />
      </header>

      {!period && (
        <section className="card">
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Import a paycheque to fill the tank.
          </p>
        </section>
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
              <div className="tank-band-fill" style={{ height: `${fillPct}%`, transition: 'height 600ms ease' }} />
              <div className="tank-band-vice" style={{ height: `${vicePct}%`, transition: 'height 600ms ease' }} />
              <div className="tank-band-other" style={{ height: `${otherPct}%`, transition: 'height 600ms ease' }} />
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
                <div className="tank-overlay-bottom mt-3">
                  <span style={{ color: vice > 0 ? 'var(--color-danger)' : '#2a2228' }}>
                    Vice {formatCents(vice)}
                  </span>
                  <span>Spent {formatCents(otherSpend + vice)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {period && planRows.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] font-mono flex items-center justify-between">
            <span>Where it goes</span>
            <Link to="/budget/routing" className="underline-offset-2 hover:underline">
              {formatCents(planTotal)} / {formatCents(paycheque)} {'>'}
            </Link>
          </div>
          <div className="card flex flex-col gap-2">
            {planRows.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {r.target_name ?? r.target_id}
                  {r.executed_at && (
                    <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-ok)]">
                      sent
                    </span>
                  )}
                </span>
                <span className="num">{formatCents(r.amount_cents)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {period && planRows.length === 0 && (
        <section className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] font-mono">
            Where it goes
          </div>
          <Link to="/budget/routing" className="card text-sm text-[color:var(--color-text-muted)]">
            No plan yet for this paycheque. Tap to build one.
          </Link>
        </section>
      )}

      {historyRows.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] font-mono">
            Last {historyRows.length} {historyRows.length === 1 ? 'period' : 'periods'}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {historyRows.map((r) => (
              <MiniTank key={r.id} row={r} />
            ))}
          </div>
        </section>
      )}

      {activeGoals.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] font-mono flex items-center justify-between">
            <span>Goals</span>
            <Link to="/goals" className="hover:underline">all {'>'}</Link>
          </div>
          <div className="card flex flex-col gap-3">
            {activeGoals.map((g) => {
              const pct = g.target_cents > 0 ? Math.min(100, (g.progress_cents / g.target_cents) * 100) : 0;
              return (
                <div key={g.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{g.name}</span>
                    <span className="num text-xs text-[color:var(--color-text-muted)]">
                      {formatCents(g.progress_cents)} / {formatCents(g.target_cents)}
                    </span>
                  </div>
                  <div className="h-px bg-[color:var(--color-hairline)] relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-[color:var(--color-accent-purple-soft)]"
                      style={{ width: `${pct}%`, height: 1 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
