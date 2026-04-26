import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import { DeclyneWordmark } from '../components/DeclyneWordmark';

type TankResp = {
  period: { start_date: string; end_date: string } | null;
  paycheque_cents?: number;
  remaining_cents?: number;
  days_remaining?: number;
};

type Counterparty = {
  id: string;
  name: string;
  owes_you_cents: number;
  you_owe_cents: number;
  net_cents: number;
  direction: 'owes_you' | 'you_owe' | 'settled';
  open_tab_count: number;
  last_tab_at: string | null;
};

function pad(n: number, w: number) {
  return String(n).padStart(w, '0');
}

function daysUntilNextSunday(today: Date) {
  const d = today.getDay();
  if (d === 0) return 0;
  return 7 - d;
}

const LONG_PRESS_MS = 450;

export default function Today() {
  const qc = useQueryClient();
  const [heroIdx, setHeroIdx] = useState(0);

  // Chit state. `prefilledFor` is the counterparty id when tearing from a row;
  // null means "tear from scratch".
  const [chitOpen, setChitOpen] = useState<{ prefilledFor: string | null } | null>(null);
  const [chitCrumpling, setChitCrumpling] = useState(false);

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
  const counterparties = useQuery({
    queryKey: ['counterparties'],
    queryFn: () => api.get<{ counterparties: Counterparty[] }>('/api/counterparties'),
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
  const dateLabel = now
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();

  const rcpt = todayExtras.data?.rcpt_days ?? 0;
  const reviewCount = review.data?.items.length ?? 0;
  const streak = reconciliation.data?.reconciliation_streak ?? 0;
  const remaining = tank.data?.remaining_cents ?? 0;
  const daysLeft = tank.data?.days_remaining ?? 0;
  const paycheque = tank.data?.paycheque_cents ?? 0;
  const sundayDays = daysUntilNextSunday(now);

  // Burn-rate color for "Left in tank" hero. Reactive from day one: before any
  // spend daily_burn=0 → runway=infinity → green. First charge recomputes.
  function tankColor(): string {
    if (!tank.data?.period) return 'var(--color-ink)';
    if (remaining <= 0) return 'var(--cat-indulgence)';
    const periodStart = new Date(tank.data.period.start_date + 'T00:00:00');
    const periodEnd = new Date(tank.data.period.end_date + 'T00:00:00');
    const totalDays = Math.max(
      1,
      Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1,
    );
    const daysElapsed = Math.max(0, totalDays - daysLeft);
    const spent = Math.max(0, paycheque - remaining);
    if (daysElapsed === 0 || spent === 0) return 'var(--cat-savings)';
    if (daysLeft <= 0) return 'var(--cat-savings)';
    const dailyBurn = spent / daysElapsed;
    const runway = remaining / dailyBurn;
    const ratio = runway / daysLeft;
    if (ratio >= 1.15) return 'var(--cat-savings)';
    if (ratio >= 0.85) return 'var(--color-accent-gold)';
    return 'var(--cat-indulgence)';
  }
  const heroStates = [
    { label: 'Left in tank', value: formatCents(remaining), sub: `${daysLeft}d to payday` },
    { label: 'Days to payday', value: `${daysLeft}d`, sub: tank.data?.period?.end_date ?? '' },
    { label: 'Reconciliation streak', value: `${streak}`, sub: streak === 1 ? 'week kept' : 'weeks kept' },
  ];
  const hero = heroStates[heroIdx % heroStates.length]!;
  const activeHero = heroIdx % heroStates.length;

  // Streak color: gold ≥4 (locked-in), sage 1-3 (building), ink at 0 (reset).
  function streakColor(n: number): string {
    if (n >= 4) return 'var(--color-accent-gold)';
    if (n >= 1) return 'var(--cat-savings)';
    return 'var(--color-ink)';
  }
  const streakPillClass = streak >= 4 ? 'pill-gold' : streak >= 1 ? 'pill-sage' : '';

  // Days-till-payday color: ink at >7d (no signal yet), gold at 3-7d (warming),
  // mascot purple at ≤2d (inflow imminent — uses the brand income color).
  function paydayColor(d: number): string {
    if (d <= 2) return 'var(--cat-income)';
    if (d <= 7) return 'var(--color-accent-gold)';
    return 'var(--color-ink)';
  }

  let heroColor = 'var(--color-ink)';
  if (activeHero === 0) heroColor = tankColor();
  else if (activeHero === 1) heroColor = paydayColor(daysLeft);
  else if (activeHero === 2) heroColor = streakColor(streak);

  // Show counterparties with at least one open tab. Sort by absolute net cents
  // descending so the biggest open balance leads.
  const allCps = counterparties.data?.counterparties ?? [];
  const openCps = allCps
    .filter((c) => c.open_tab_count > 0)
    .sort((a, b) => Math.abs(b.net_cents) - Math.abs(a.net_cents));

  const lastInd = todayExtras.data?.last_indulgence ?? null;
  const nextBill = todayExtras.data?.next_bill ?? null;
  const printingAhead = todayExtras.data?.printing_ahead ?? [];

  // Long-press detection.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressingId, setPressingId] = useState<string | null>(null);

  function startPress(prefilledFor: string | null, idForVisual: string) {
    setPressingId(idForVisual);
    pressTimer.current = setTimeout(() => {
      setPressingId(null);
      setChitOpen({ prefilledFor });
      // Soft haptic if available.
      if ('vibrate' in navigator) navigator.vibrate?.(8);
    }, LONG_PRESS_MS);
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    setPressingId(null);
  }
  useEffect(() => () => { if (pressTimer.current) clearTimeout(pressTimer.current); }, []);

  function discardChit() {
    setChitCrumpling(true);
    setTimeout(() => {
      setChitOpen(null);
      setChitCrumpling(false);
    }, 220);
  }

  const createSplit = useMutation({
    mutationFn: (input: {
      counterparty_id?: string;
      counterparty_name?: string;
      direction: 'josh_owes' | 'owes_josh';
      amount_cents: number;
      reason: string;
    }) => api.post<{ id: string }>('/api/splits', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparties'] });
      qc.invalidateQueries({ queryKey: ['splits'] });
      setChitOpen(null);
    },
  });

  const prefilledCp =
    chitOpen?.prefilledFor ? allCps.find((c) => c.id === chitOpen.prefilledFor) ?? null : null;

  return (
    <div className="px-3 pt-4 pb-6">
      <section className="receipt paper-in flex flex-col gap-5">
        <header className="relative flex items-center" style={{ gap: 10, marginBottom: 4 }}>
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
          <span
            className="mascot-sigil"
            aria-hidden="true"
            style={{
              width: 116,
              height: 116,
              marginLeft: -14,
              flexShrink: 0,
            }}
          />
          <div className="flex flex-col flex-1 min-w-0" style={{ paddingRight: 28 }}>
            <DeclyneWordmark fontSize={44} />
          </div>
        </header>

        <div
          style={{
            marginTop: 4,
            borderTop: '3px double var(--color-ink-muted)',
            borderBottom: '3px double var(--color-ink-muted)',
            padding: '8px 0',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--color-ink)',
          }}
        >
          RCPT {pad(rcpt, 4)} &nbsp;&middot;&nbsp; JB &nbsp;&middot;&nbsp; {dateLabel}
        </div>

        <button
          type="button"
          onClick={() => setHeroIdx((i) => (i + 1) % heroStates.length)}
          className="perf pt-4 text-left"
          style={{ background: 'transparent', border: 0, padding: 0, paddingTop: '1rem', cursor: 'pointer' }}
        >
          <div className="section-label mb-2">{hero.label}</div>
          <div className="hero-num" style={{ color: heroColor, transition: 'color 240ms ease' }}>{hero.value}</div>
          {hero.sub && <div className="text-xs ink-muted mt-1">{hero.sub}</div>}
        </button>

        <div className="perf pt-4">
          <div className="section-label mb-2">Next</div>
          {nextBill ? (
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm" style={{ color: 'var(--color-ink)' }}>{nextBill.merchant_name}</div>
              <div className="num text-sm" style={{ color: 'var(--color-ink)' }}>
                {formatCents(nextBill.amount_cents)} &middot; {nextBill.days_until === 0 ? 'today' : `${nextBill.days_until}d`}
              </div>
            </div>
          ) : (
            <div className="text-sm ink-muted">No bills inside the 14d horizon.</div>
          )}
        </div>

        <div className="perf pt-3 pb-1 flex items-baseline justify-between">
          <div className="section-label">Next reconciliation</div>
          <div className="num text-xs" style={{ color: 'var(--color-ink)' }}>
            sunday &middot; {sundayDays === 0 ? 'today' : `${sundayDays}d`}
          </div>
        </div>

        <div className="perf pt-4">
          <div className="section-label mb-2">Printing ahead</div>
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
                    <div className="num label-tag" style={{ width: 36, color: 'var(--color-ink-muted)' }}>+{row.days_until}d</div>
                    <div className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-ink)' }}>
                      {row.kind === 'payday' && <span className="cat-dot income" />}
                      {row.label}
                    </div>
                  </div>
                  <div className="num text-sm" style={{ color: row.kind === 'payday' ? 'var(--cat-income)' : 'var(--color-ink)' }}>
                    {row.kind === 'payday' ? '+' : ''}{formatCents(row.amount_cents)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* OPEN TABS — per-counterparty. Long-press to tear a new chit. */}
        <div className="perf pt-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="section-label">Open tabs</div>
            <div className="label-tag">{openCps.length}</div>
          </div>

          {chitOpen && (
            <ChitForm
              prefilledCounterparty={prefilledCp}
              crumpling={chitCrumpling}
              onDiscard={discardChit}
              onSubmit={(payload) => createSplit.mutate(payload)}
              submitting={createSplit.isPending}
            />
          )}

          {openCps.length === 0 ? (
            <div className="text-sm ink-muted">No open tabs. Long-press the row below to tear from scratch.</div>
          ) : (
            <ul className="flex flex-col">
              {openCps.map((cp) => {
                const isPressing = pressingId === cp.id;
                const dirLabel = cp.direction === 'owes_you' ? 'owes you' : cp.direction === 'you_owe' ? 'you owe' : 'settled';
                const colorClass =
                  cp.direction === 'owes_you' ? 'tab-direction-pos' : cp.direction === 'you_owe' ? 'tab-direction-neg' : '';
                return (
                  <li
                    key={cp.id}
                    className={`chit-trigger ${isPressing ? 'pressing' : ''}`}
                    style={{ borderTop: '1px dashed var(--color-hairline-ink)' }}
                  >
                    <div
                      className="flex items-baseline justify-between py-2 px-1"
                      onPointerDown={() => startPress(cp.id, cp.id)}
                      onPointerUp={cancelPress}
                      onPointerLeave={cancelPress}
                      onPointerCancel={cancelPress}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <div className="flex flex-col">
                        <Link to={`/budget/tabs/${cp.id}`} style={{ color: 'var(--color-ink)' }} className="text-sm">
                          {cp.name}
                        </Link>
                        <div className="label-tag mt-0.5">
                          {dirLabel} &middot; {cp.open_tab_count} {cp.open_tab_count === 1 ? 'chit' : 'chits'}
                        </div>
                      </div>
                      <div className={`num text-sm ${colorClass}`}>
                        {cp.direction === 'owes_you' ? '+' : cp.direction === 'you_owe' ? '−' : ''}
                        {formatCents(Math.abs(cp.net_cents))}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setChitOpen({ prefilledFor: null })}
            className="label-tag mt-3 inline-block"
            style={{ color: 'var(--color-ink-muted)', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
          >
            + tear from scratch
          </button>
          <div className="label-tag mt-1" style={{ color: 'var(--color-ink-muted)', opacity: 0.6 }}>
            long-press a name to tear a new chit
          </div>
        </div>

        <Link to="/phase" className="row-tap perf">
          <div className="flex items-baseline justify-between gap-3">
            <div className="section-label">Phase</div>
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
              {streak > 0 && <span className={streakPillClass}>{streak} wk</span>}
              {streak === 0 && (
                <div className="num text-base" style={{ color: 'var(--color-ink)' }}>reset</div>
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

function ChitForm({
  prefilledCounterparty,
  crumpling,
  onDiscard,
  onSubmit,
  submitting,
}: {
  prefilledCounterparty: Counterparty | null;
  crumpling: boolean;
  onDiscard: () => void;
  onSubmit: (input: {
    counterparty_id?: string;
    counterparty_name?: string;
    direction: 'josh_owes' | 'owes_josh';
    amount_cents: number;
    reason: string;
  }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(prefilledCounterparty?.name ?? '');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  // Default direction: if prefilled, repeat their existing balance direction;
  // else owes_josh (positive — they owe you).
  const [direction, setDirection] = useState<'owes_josh' | 'josh_owes'>(
    prefilledCounterparty?.direction === 'you_owe' ? 'josh_owes' : 'owes_josh',
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return;
    if (!reason.trim()) return;
    if (prefilledCounterparty) {
      onSubmit({
        counterparty_id: prefilledCounterparty.id,
        direction,
        amount_cents: cents,
        reason: reason.trim(),
      });
    } else {
      if (!name.trim()) return;
      onSubmit({
        counterparty_name: name.trim(),
        direction,
        amount_cents: cents,
        reason: reason.trim(),
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`chit ${crumpling ? 'crumpling' : ''} mb-3 flex flex-col gap-3`}
    >
      <button type="button" onClick={onDiscard} className="chit-discard" aria-label="Discard chit">×</button>
      <div className="flex items-baseline justify-between">
        <div className="label-tag">New chit</div>
        <div className="label-tag">{direction === 'owes_josh' ? 'owes you' : 'you owe'}</div>
      </div>

      {prefilledCounterparty ? (
        <div className="text-base" style={{ color: 'var(--color-ink)' }}>
          {prefilledCounterparty.name}
        </div>
      ) : (
        <input
          autoFocus
          type="text"
          className="chit-field"
          placeholder="Counterparty name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDirection('owes_josh')}
          className={`stamp ${direction === 'owes_josh' ? 'stamp-purple' : ''}`}
          style={{ flex: 1 }}
        >
          owes you
        </button>
        <button
          type="button"
          onClick={() => setDirection('josh_owes')}
          className={`stamp ${direction === 'josh_owes' ? 'stamp-purple' : ''}`}
          style={{ flex: 1 }}
        >
          you owe
        </button>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="num" style={{ color: 'var(--color-ink-muted)' }}>$</span>
        <input
          autoFocus={!!prefilledCounterparty}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className="chit-field num"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <input
        type="text"
        className="chit-field"
        placeholder="What for?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={120}
      />

      <button type="submit" disabled={submitting} className="btn-primary mt-1" style={{ alignSelf: 'flex-start' }}>
        {submitting ? 'tearing…' : 'tear it'}
      </button>
    </form>
  );
}
