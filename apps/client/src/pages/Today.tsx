import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import { DeclyneWordmark } from '../components/DeclyneWordmark';
import { CounterpartyReceipt } from './Counterparty';

type TankResp = {
  period: { start_date: string; end_date: string } | null;
  paycheque_cents?: number;
  remaining_cents?: number;
  days_remaining?: number;
  committed_cents?: number;
  truly_free_cents?: number;
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

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

const LONG_PRESS_MS = 450;

type Glyph = '↻' | '▸' | '+' | '?' | null;
type HistoryRef =
  | { kind: 'bill'; merchant_id: string }
  | { kind: 'payday' }
  | { kind: 'plan'; label: string };
type QueueItem = {
  key: string;
  label: string;
  meta: string;
  days_until: number;
  // Priority tier for ordering: 0 ritual (reconcile/review) > 1 bill >
  // 2 installment > 3 payday. Within tier, sort by days_until ascending.
  tier: 0 | 1 | 2 | 3;
  href?: string;
  glyph?: Glyph;
  glyphTone?: 'income' | 'debt' | 'muted' | null;
  history?: HistoryRef;
};

function historyQuery(ref: HistoryRef): string {
  const params = new URLSearchParams({ kind: ref.kind });
  if (ref.kind === 'bill') params.set('merchant_id', ref.merchant_id);
  if (ref.kind === 'plan') params.set('label', ref.label);
  return `/api/today/history?${params.toString()}`;
}

function QueueRow({ item }: { item: QueueItem }) {
  const [open, setOpen] = useState(false);
  const dayLabel = item.days_until === 0 ? 'today' : `${item.days_until}d`;
  const expandable = !!item.history;
  const history = useQuery({
    queryKey: ['today-history', item.history],
    queryFn: () =>
      api.get<{ occurrences: Array<{ posted_at: string; amount_cents: number; description: string }> }>(
        historyQuery(item.history!),
      ),
    enabled: open && expandable,
  });

  const inner = (
    <div className="flex items-baseline justify-between py-2 px-1" style={{ gap: 12 }}>
      <div className="flex items-baseline gap-3">
        <div className="num label-tag" style={{ width: 44, color: 'var(--color-ink-muted)' }}>{dayLabel}</div>
        <div className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-ink)' }}>
          {item.glyph && (
            <span className={`row-glyph${item.glyphTone ? ' ' + item.glyphTone : ''}`}>
              {item.glyph}
            </span>
          )}
          {item.label}
        </div>
      </div>
      <div className="num text-sm" style={{ color: 'var(--color-ink)' }}>
        {item.meta}
        {(item.href || expandable) && <span style={{ color: 'var(--color-ink-muted)' }}> &rsaquo;</span>}
      </div>
    </div>
  );

  return (
    <li style={{ borderTop: '1px dashed var(--color-hairline-ink)' }}>
      {item.href ? (
        <Link to={item.href} className="row-tap block">{inner}</Link>
      ) : expandable ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="row-tap block w-full text-left"
          style={{ background: 'transparent', border: 0, padding: 0 }}
        >
          {inner}
        </button>
      ) : (
        inner
      )}
      {open && expandable && (
        <div className="px-1 pb-3" style={{ paddingLeft: 60 }}>
          {history.isLoading ? (
            <div className="label-tag ink-muted">loading.</div>
          ) : history.data && history.data.occurrences.length > 0 ? (
            <ul className="flex flex-col">
              {history.data.occurrences.map((o, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between py-1"
                  style={{ gap: 12 }}
                >
                  <div className="num label-tag" style={{ color: 'var(--color-ink-muted)' }}>
                    {o.posted_at}
                  </div>
                  <div className="num text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                    {formatCents(o.amount_cents)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="label-tag ink-muted">no prior occurrences yet.</div>
          )}
        </div>
      )}
    </li>
  );
}

export default function Today() {
  const qc = useQueryClient();
  const [heroIdx, setHeroIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ settings: Record<string, string> }>('/api/settings'),
  });
  const vocabLevel = parseInt(settings.data?.settings.vocabulary_level ?? '0', 10);

  // Chit state. `prefilledFor` is the counterparty id when tearing from a row;
  // null means "tear from scratch".
  const [chitOpen, setChitOpen] = useState<{ prefilledFor: string | null } | null>(null);
  const [chitCrumpling, setChitCrumpling] = useState(false);

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
          kind: 'bill' | 'payday' | 'plan';
          label: string;
          amount_cents: number;
          due_date: string;
          days_until: number;
          category_group?: string;
          merchant_id?: string;
        }>;
        active_plan: {
          total_pending_cents: number;
          installment_count: number;
          period_end: string;
        } | null;
        last_paid_installment: {
          label: string;
          amount_cents: number;
          stamped_at: string;
        } | null;
      }>('/api/today'),
  });

  const now = new Date();
  const dateLabel = now
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();

  const rcpt = todayExtras.data?.rcpt_days ?? 0;
  const userName = settings.data?.settings?.user_display_name ?? '';
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
  const activePlan = todayExtras.data?.active_plan ?? null;
  type HeroState = { label: string; value: string; sub: string; kind: 'plan' | 'tank' | 'payday' | 'streak'; href?: string };
  const baseHeroStates: HeroState[] = [
    { kind: 'tank', label: 'Left in tank', value: formatCents(remaining), sub: '' },
    { kind: 'payday', label: 'Days to payday', value: `${daysLeft}d`, sub: tank.data?.period?.end_date ?? '' },
    { kind: 'streak', label: 'Reconciliation streak', value: `${streak}`, sub: streak === 1 ? 'week kept' : 'weeks kept' },
  ];
  const heroStates: HeroState[] = activePlan
    ? [{ kind: 'plan', label: 'Plan installments due', value: formatCents(activePlan.total_pending_cents), sub: `${activePlan.installment_count} pending · due ${activePlan.period_end}`, href: '/paycheque/plan' }, ...baseHeroStates]
    : baseHeroStates;
  const hero = heroStates[heroIdx % heroStates.length]!;

  // Streak color: gold ≥4 (locked-in), sage 1-3 (building), ink at 0 (reset).
  function streakColor(n: number): string {
    if (n >= 2) return 'var(--color-accent-gold)';
    if (n >= 1) return 'var(--cat-savings)';
    return 'var(--color-ink)';
  }
  function paydayColor(d: number): string {
    if (d <= 7) return 'var(--cat-income)';
    if (d <= 14) return 'var(--color-accent-gold)';
    return 'var(--color-ink)';
  }

  const heroColor =
    hero.kind === 'plan' ? 'var(--cat-debt)' :
    hero.kind === 'tank' ? tankColor() :
    hero.kind === 'payday' ? paydayColor(daysLeft) :
    streakColor(streak);

  // Show counterparties with at least one open tab. Sort by absolute net cents
  // descending so the biggest open balance leads.
  const allCps = counterparties.data?.counterparties ?? [];
  const openCps = allCps
    .filter((c) => c.open_tab_count > 0)
    .sort((a, b) => Math.abs(b.net_cents) - Math.abs(a.net_cents));

  const printingAhead = todayExtras.data?.printing_ahead ?? [];
  const lastPaid = todayExtras.data?.last_paid_installment ?? null;
  const committedCents = tank.data?.committed_cents ?? 0;
  const committedExceedsRemaining = committedCents > 0 && committedCents > remaining;
  const footerCopy = lastPaid
    ? `* ${lastPaid.label} — done *`
    : vocabLevel >= 2
      ? '* still printing *'
      : '* still counting *';

  // Long-press detection.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressingId, setPressingId] = useState<string | null>(null);
  const [liftedCpId, setLiftedCpId] = useState<string | null>(null);

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
      direction: 'i_owe' | 'they_owe';
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
    <>
    {liftedCpId && (
      <div
        onClick={() => setLiftedCpId(null)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 150,
          background: 'rgba(26,20,29,0.72)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '24px 12px 32px',
          overflowY: 'auto',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 420 }}
        >
          <CounterpartyReceipt id={liftedCpId} onClose={() => setLiftedCpId(null)} />
        </div>
      </div>
    )}
    {chitOpen && (
      <div
        onClick={discardChit}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 150,
          background: 'rgba(26,20,29,0.72)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '24px 12px 32px',
          overflowY: 'auto',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 420 }}
        >
          <ChitForm
            prefilledCounterparty={prefilledCp}
            crumpling={chitCrumpling}
            onDiscard={discardChit}
            onSubmit={(payload) => createSplit.mutate(payload)}
            submitting={createSplit.isPending}
          />
        </div>
      </div>
    )}
    <div className="ledger-page">
      <section className="receipt paper-in flex flex-col gap-5">
        <header className="flex flex-col" style={{ marginBottom: 4 }}>
          <div style={{ height: 3, background: 'var(--color-ink)' }} />
          <div className="flex items-center justify-between" style={{ padding: '14px 0 12px' }}>
            <span
              className="mascot-sigil"
              aria-hidden="true"
              style={{ width: 64, height: 64, flexShrink: 0 }}
            />
            <DeclyneWordmark fontSize={28} />
            <Link
              to="/settings"
              aria-label="Settings"
              style={{ color: 'var(--color-ink-muted)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.18.43.6.94 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </Link>
          </div>
          <div style={{ height: 1, background: 'rgba(26,20,29,0.25)' }} />
          <div
            style={{
              padding: '10px 0 0',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-muted)',
            }}
          >
            {dateLabel} &nbsp;&middot;&nbsp; {userName || `RCPT ${pad(rcpt, 4)}`} &nbsp;&middot;&nbsp; WK {pad(isoWeek(now), 2)}
          </div>
        </header>

        <button
          type="button"
          onClick={() => setHeroIdx((i) => (i + 1) % heroStates.length)}
          className="perf pt-4 text-left"
          style={{ background: 'transparent', border: 0, padding: 0, paddingTop: '1rem', cursor: 'pointer' }}
        >
          <div className="section-label mb-2">{hero.label}</div>
          <div className="hero-num" style={{ color: heroColor, transition: 'color 240ms ease' }}>{hero.value}</div>
          {hero.sub && <div className="text-xs ink-muted mt-1">{hero.sub}</div>}
          {hero.href && (
            <Link
              to={hero.href}
              className="text-[10px] uppercase tracking-[0.18em] mt-2 inline-block"
              style={{ color: 'var(--cat-debt)' }}
              onClick={(e) => e.stopPropagation()}
            >
              View plan ▸
            </Link>
          )}
        </button>

        {/* TODAY queue — actionable items + upcoming bills, sorted chronologically. */}
        {(() => {
          // Row-type glyph vocabulary. See lib/rowGlyph.ts for the full set.
          // Today's queue uses: ↻ bill, ▸ plan installment, + payday,
          // ? review queue. Reconcile action stays glyph-free (it's a ritual,
          // not a money row).
          const queue: QueueItem[] = [];
          if (sundayDays === 0 && !reconciliation.data?.completed_this_week) {
            queue.push({ key: 'reconcile', label: 'Reconcile this week', meta: 'now', days_until: 0, tier: 0, href: '/reconcile' });
          }
          if (reviewCount > 0) {
            queue.push({
              key: 'review',
              label: `${reviewCount} to categorize`,
              meta: 'now',
              days_until: 0,
              tier: 0,
              href: '/review',
              glyph: '?',
              glyphTone: 'muted',
            });
          }
          for (const row of printingAhead) {
            let glyph: Glyph;
            let tone: QueueItem['glyphTone'] = null;
            let history: HistoryRef | undefined;
            let tier: QueueItem['tier'];
            if (row.kind === 'payday') {
              glyph = '+';
              tone = 'income';
              history = { kind: 'payday' };
              tier = 3;
            } else if (row.kind === 'plan') {
              glyph = '▸';
              tone = 'debt';
              history = { kind: 'plan', label: row.label };
              tier = 2;
            } else {
              glyph = '↻';
              if (row.merchant_id) history = { kind: 'bill', merchant_id: row.merchant_id };
              tier = 1;
            }
            queue.push({
              key: `${row.kind}-${row.due_date}-${row.label}`,
              label: row.label,
              meta: `${row.kind === 'payday' ? '+' : ''}${formatCents(row.amount_cents)}`,
              days_until: row.days_until,
              tier,
              glyph,
              glyphTone: tone,
              ...(history ? { history } : {}),
            });
          }
          queue.sort((a, b) => a.tier - b.tier || a.days_until - b.days_until);
          const visible = expanded ? queue.slice(0, 5) : queue.slice(0, 3);
          const hiddenCount = Math.min(queue.length, 5) - visible.length;
          const overflowToPaycheque = queue.length > 5;
          return (
            <div className="perf pt-4">
              <div className="section-label mb-2">Up next</div>
              {committedExceedsRemaining && (
                <div
                  className="flex items-baseline justify-between py-2 px-1 mb-1"
                  style={{
                    borderTop: '1px dashed var(--cat-indulgence)',
                    borderBottom: '1px dashed var(--cat-indulgence)',
                    color: 'var(--cat-indulgence)',
                  }}
                >
                  <div className="text-sm">
                    Committed {formatCents(committedCents)} exceeds {formatCents(remaining)} left.
                  </div>
                </div>
              )}
              {queue.length === 0 ? (
                <div className="text-sm ink-muted">Nothing up next.</div>
              ) : (
                <ul className="flex flex-col">
                  {visible.map((item) => (
                    <QueueRow key={item.key} item={item} />
                  ))}
                  {!expanded && hiddenCount > 0 && (
                    <li style={{ borderTop: '1px dashed var(--color-hairline-ink)' }}>
                      <button
                        type="button"
                        onClick={() => setExpanded(true)}
                        className="row-tap block w-full text-left"
                        style={{ background: 'transparent', border: 0, padding: 0 }}
                      >
                        <div className="flex items-baseline justify-between py-2 px-1" style={{ gap: 12 }}>
                          <div className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                            + {hiddenCount} more
                          </div>
                          <div className="num text-sm" style={{ color: 'var(--color-ink-muted)' }}>&rsaquo;</div>
                        </div>
                      </button>
                    </li>
                  )}
                  {(expanded || queue.length <= 5) && overflowToPaycheque && (
                    <li style={{ borderTop: '1px dashed var(--color-hairline-ink)' }}>
                      <Link to="/paycheque" className="row-tap block">
                        <div className="flex items-baseline justify-between py-2 px-1" style={{ gap: 12 }}>
                          <div className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                            see all in paycheque
                          </div>
                          <div className="num text-sm" style={{ color: 'var(--color-ink-muted)' }}>&rsaquo;</div>
                        </div>
                      </Link>
                    </li>
                  )}
                  {expanded && queue.length > 3 && (
                    <li style={{ borderTop: '1px dashed var(--color-hairline-ink)' }}>
                      <button
                        type="button"
                        onClick={() => setExpanded(false)}
                        className="row-tap block w-full text-left"
                        style={{ background: 'transparent', border: 0, padding: 0 }}
                      >
                        <div className="flex items-baseline justify-between py-2 px-1" style={{ gap: 12 }}>
                          <div className="text-sm" style={{ color: 'var(--color-ink-muted)' }}>
                            show less
                          </div>
                          <div className="num text-sm" style={{ color: 'var(--color-ink-muted)' }}>&lsaquo;</div>
                        </div>
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })()}

        {/* OPEN TABS — per-counterparty. Long-press to tear a new chit. */}
        <div className="perf pt-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="section-label">Open tabs</div>
            <div className="label-tag">{openCps.length}</div>
          </div>

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
                      className="flex items-center justify-between py-2 px-1"
                      onPointerDown={() => startPress(cp.id, cp.id)}
                      onPointerUp={cancelPress}
                      onPointerLeave={cancelPress}
                      onPointerCancel={cancelPress}
                      onContextMenu={(e) => e.preventDefault()}
                      style={{ gap: 12 }}
                    >
                      <div className="flex flex-col" style={{ minWidth: 0 }}>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelPress();
                            setChitOpen(null);
                            setLiftedCpId(cp.id);
                          }}
                          style={{ color: 'var(--color-ink)', background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}
                          className="text-sm"
                        >
                          {cp.name}
                        </button>
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
            className="chit-pad"
            aria-label="Open a new tab"
          >
            <span className="chit-pad-layer l3" aria-hidden />
            <span className="chit-pad-layer l2" aria-hidden />
            <span className="chit-pad-top">+ new tab</span>
          </button>
        </div>

        <div className="perf pt-4 text-center label-tag" style={{ letterSpacing: '0.32em' }}>
          {footerCopy}
        </div>
      </section>
    </div>
    </>
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
    direction: 'i_owe' | 'they_owe';
    amount_cents: number;
    reason: string;
  }) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(prefilledCounterparty?.name ?? '');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  // Default direction: if prefilled, repeat their existing balance direction;
  // else they_owe (positive — they owe you).
  const [direction, setDirection] = useState<'they_owe' | 'i_owe'>(
    prefilledCounterparty?.direction === 'you_owe' ? 'i_owe' : 'they_owe',
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
        <div className="label-tag">{direction === 'they_owe' ? 'they owe me' : 'i owe them'}</div>
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
          onClick={() => setDirection('they_owe')}
          className={`stamp stamp-square ${direction === 'they_owe' ? 'stamp-filled' : ''}`}
          style={{ flex: 1 }}
        >
          They owe me
        </button>
        <button
          type="button"
          onClick={() => setDirection('i_owe')}
          className={`stamp stamp-square ${direction === 'i_owe' ? 'stamp-filled' : ''}`}
          style={{ flex: 1 }}
        >
          I owe them
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

      <button
        type="submit"
        disabled={submitting}
        className="stamp stamp-purple"
        style={{ alignSelf: 'center', minWidth: 160 }}
      >
        {submitting ? 'opening' : 'Open tab'}
      </button>
    </form>
  );
}
