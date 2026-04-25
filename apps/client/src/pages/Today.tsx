import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

type TankResp = {
  period: { start_date: string; end_date: string } | null;
  paycheque_cents?: number;
  remaining_cents?: number;
  days_remaining?: number;
};

type SplitRow = {
  id: string;
  counterparty: string;
  direction: 'josh_owes' | 'owes_josh';
  remaining_cents: number;
  created_at: string;
};

function pad(n: number, w: number) {
  return String(n).padStart(w, '0');
}

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function daysUntilNextSunday(today: Date) {
  const d = today.getDay(); // 0 = Sunday
  if (d === 0) return 0;
  return 7 - d;
}

function daysSince(iso: string, today: Date) {
  const ms = today.getTime() - Date.parse(iso.slice(0, 10));
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default function Today() {
  const [heroIdx, setHeroIdx] = useState(0);

  const phase = useQuery({
    queryKey: ['phase'],
    queryFn: () => api.get<{ phase: number; name: string; entered_at: string | null }>('/api/phase'),
  });
  const review = useQuery({
    queryKey: ['review'],
    queryFn: () => api.get<{ items: Array<unknown> }>('/api/review'),
  });
  const reconciliation = useQuery({
    queryKey: ['reconciliation-status'],
    queryFn: () =>
      api.get<{
        last_reconciliation_at: string | null;
        reconciliation_streak: number;
        completed_this_week: boolean;
      }>('/api/reconciliation/status'),
  });
  const tank = useQuery({
    queryKey: ['budget-tank'],
    queryFn: () => api.get<TankResp>('/api/budget/tank'),
  });
  const splits = useQuery({
    queryKey: ['splits'],
    queryFn: () => api.get<{ splits: SplitRow[] }>('/api/splits'),
  });
  const todayExtras = useQuery({
    queryKey: ['today-extras'],
    queryFn: () =>
      api.get<{
        rcpt_days: number;
        last_indulgence: {
          posted_at: string;
          amount_cents: number;
          description_raw: string;
          days_ago: number;
        } | null;
        next_bill: {
          merchant_name: string;
          amount_cents: number;
          next_due: string;
          days_until: number;
        } | null;
        printing_ahead: Array<{
          kind: 'bill' | 'payday';
          label: string;
          amount_cents: number;
          due_date: string;
          days_until: number;
        }>;
      }>('/api/today'),
  });

  const now = new Date();
  const today = new Date(now.toISOString().slice(0, 10));
  const wk = isoWeek(now);
  const dateLabel = now
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();

  const rcpt = todayExtras.data?.rcpt_days ?? 0;
  const reviewCount = review.data?.items.length ?? 0;
  const streak = reconciliation.data?.reconciliation_streak ?? 0;
  const remaining = tank.data?.remaining_cents ?? 0;
  const daysLeft = tank.data?.days_remaining ?? 0;
  const sundayDays = daysUntilNextSunday(now);

  const heroStates = [
    {
      label: 'Left in tank',
      value: formatCents(remaining),
      sub: `${daysLeft}d to payday`,
    },
    {
      label: 'Days to payday',
      value: `${daysLeft}d`,
      sub: tank.data?.period?.end_date ?? '',
    },
    {
      label: 'Reconciliation streak',
      value: `${streak}`,
      sub: streak === 1 ? 'week kept' : 'weeks kept',
    },
  ];
  const hero = heroStates[heroIdx % heroStates.length]!;

  const openSplits = splits.data?.splits ?? [];
  const lastInd = todayExtras.data?.last_indulgence ?? null;
  const nextBill = todayExtras.data?.next_bill ?? null;
  const printingAhead = todayExtras.data?.printing_ahead ?? [];

  return (
    <div className="px-3 pt-4 pb-6">
      <section className="receipt paper-in flex flex-col gap-5">
        {/* Header */}
        <header className="relative flex flex-col items-start">
          <Link
            to="/settings"
            aria-label="Settings"
            style={{ color: 'var(--color-ink-muted)', position: 'absolute', top: 0, right: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.18.43.6.94 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          <div
            className="display tracking-tight"
            style={{ color: 'var(--color-ink)', fontSize: 30, lineHeight: 1 }}
          >
            DECLYNE
          </div>
          <div className="label-tag mt-2">
            RCPT {pad(rcpt, 4)} &middot; WK {pad(wk, 2)} &middot; {dateLabel}
          </div>
        </header>

        {/* Hero (tap-cycle) */}
        <button
          type="button"
          onClick={() => setHeroIdx((i) => (i + 1) % heroStates.length)}
          className="perf pt-4 text-left"
          style={{ background: 'transparent', border: 0, padding: 0, paddingTop: '1rem', cursor: 'pointer' }}
        >
          <div className="label-tag mb-1">{hero.label}</div>
          <div className="hero-num" style={{ color: 'var(--color-ink)' }}>
            {hero.value}
          </div>
          {hero.sub && <div className="text-xs ink-muted mt-1">{hero.sub}</div>}
        </button>

        {/* NEXT block */}
        <div className="perf pt-4">
          <div className="label-tag mb-1">Next</div>
          {nextBill ? (
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm" style={{ color: 'var(--color-ink)' }}>
                {nextBill.merchant_name}
              </div>
              <div className="num text-sm" style={{ color: 'var(--color-ink)' }}>
                {formatCents(nextBill.amount_cents)} &middot; {nextBill.days_until === 0 ? 'today' : `${nextBill.days_until}d`}
              </div>
            </div>
          ) : (
            <div className="text-sm ink-muted">No bills inside the 14d horizon.</div>
          )}
        </div>

        {/* Single line: next reconciliation */}
        <div className="perf pt-3 pb-1 flex items-baseline justify-between">
          <div className="label-tag">Next reconciliation</div>
          <div className="num text-xs" style={{ color: 'var(--color-ink)' }}>
            sunday &middot; {sundayDays === 0 ? 'today' : `${sundayDays}d`}
          </div>
        </div>

        {/* PRINTING AHEAD */}
        <div className="perf pt-4">
          <div className="label-tag mb-2">Printing ahead</div>
          {printingAhead.length === 0 ? (
            <div className="text-sm ink-muted">Nothing inside the 14d horizon.</div>
          ) : (
            <ul className="flex flex-col">
              {printingAhead.map((row) => (
                <li
                  key={`${row.kind}-${row.due_date}-${row.label}`}
                  className="flex items-baseline justify-between py-2"
                  style={{ borderTop: '1px dashed var(--color-hairline-ink)' }}
                >
                  <div className="flex items-baseline gap-3">
                    <div
                      className="num label-tag"
                      style={{ width: 36, color: 'var(--color-ink-muted)' }}
                    >
                      +{row.days_until}d
                    </div>
                    <div className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-ink)' }}>
                      {row.kind === 'payday' && <span className="cat-dot income" />}
                      {row.label}
                    </div>
                  </div>
                  <div
                    className="num text-sm"
                    style={{ color: row.kind === 'payday' ? 'var(--cat-income)' : 'var(--color-ink)' }}
                  >
                    {row.kind === 'payday' ? '+' : ''}{formatCents(row.amount_cents)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* OPEN TABS */}
        <div className="perf pt-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="label-tag">Open tabs</div>
            <div className="label-tag">{openSplits.length}</div>
          </div>
          {openSplits.length === 0 ? (
            <div className="text-sm ink-muted">No open tabs. Clean slate.</div>
          ) : (
            <ul className="flex flex-col">
              {openSplits.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between py-2"
                  style={{ borderTop: '1px dashed var(--color-hairline-ink)' }}
                >
                  <div className="flex flex-col">
                    <div className="text-sm" style={{ color: 'var(--color-ink)' }}>{s.counterparty}</div>
                    <div className="label-tag mt-0.5">
                      {s.direction === 'josh_owes' ? 'you owe' : 'owes you'} &middot; {daysSince(s.created_at, today)}d
                    </div>
                  </div>
                  <div className="num text-sm" style={{ color: 'var(--color-ink)' }}>
                    {formatCents(s.remaining_cents)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/debts"
            className="label-tag mt-2 inline-block"
            style={{ color: 'var(--color-ink-muted)' }}
          >
            + tear from scratch
          </Link>
        </div>

        {/* Signals */}
        <Link to="/phase" className="row-tap perf">
          <div className="flex items-baseline justify-between gap-3">
            <div className="label-tag">Phase</div>
            <div className="num text-base" style={{ color: 'var(--color-ink)' }}>
              {phase.data ? `${phase.data.phase}. ${phase.data.name}` : '--'} &rsaquo;
            </div>
          </div>
        </Link>

        <Link to="/budget" className="row-tap perf">
          <div className="flex items-baseline justify-between gap-3">
            <div className="label-tag flex items-center gap-1.5">
              <span className="cat-dot indulgence" /> Indulgence
            </div>
            <div className="num text-base" style={{ color: 'var(--color-ink)' }}>
              {lastInd
                ? `last ${lastInd.days_ago === 0 ? 'today' : `${lastInd.days_ago}d ago`} · ${formatCents(lastInd.amount_cents)}`
                : 'none recorded'}{' '}
              &rsaquo;
            </div>
          </div>
        </Link>

        <Link to="/review" className="row-tap perf">
          <div className="flex items-baseline justify-between gap-3">
            <div className="label-tag">Review</div>
            <div className="num text-base" style={{ color: 'var(--color-ink)' }}>
              {reviewCount} {reviewCount === 1 ? 'item' : 'items'} &rsaquo;
            </div>
          </div>
        </Link>

        <Link to="/reconcile" className="row-tap perf">
          <div className="flex items-baseline justify-between gap-3">
            <div className="label-tag">Streak</div>
            <div className="flex items-center gap-2">
              {streak > 0 && <span className="pill-gold">{streak} wk</span>}
              {streak === 0 && (
                <div className="num text-base" style={{ color: 'var(--color-ink)' }}>
                  reset
                </div>
              )}
              <div className="num text-base" style={{ color: 'var(--color-ink)' }}>&rsaquo;</div>
            </div>
          </div>
        </Link>

        <div className="perf pt-4 text-center label-tag" style={{ letterSpacing: '0.32em' }}>
          * * between receipts * *
        </div>
      </section>
    </div>
  );
}
