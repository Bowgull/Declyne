import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

function useCountUp(target: number, durationMs = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

export default function Today() {
  const phase = useQuery({
    queryKey: ['phase'],
    queryFn: () => api.get<{ phase: number; name: string; entered_at: string | null }>('/api/phase'),
  });
  const vice = useQuery({
    queryKey: ['vice'],
    queryFn: () => api.get<{ vice_cents: number; lifestyle_cents: number; ratio_bps: number }>('/api/budget/vice'),
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
        week_starts_on: string;
      }>('/api/reconciliation/status'),
  });
  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const reviewCount = review.data?.items.length ?? 0;
  const viceRatioPct = vice.data ? vice.data.ratio_bps / 100 : 0;
  const animatedVice = useCountUp(viceRatioPct);
  const streak = reconciliation.data?.reconciliation_streak ?? 0;

  return (
    <div className="px-3 pt-4 pb-6">
      <section className="receipt paper-in flex flex-col gap-5">
        <header className="relative flex flex-col items-center text-center">
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
          <img
            src="/brand/mascot-charcoal.png"
            alt=""
            aria-hidden="true"
            style={{
              width: 180,
              height: 180,
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 6px rgba(26, 20, 29, 0.18))',
            }}
          />
          <div
            className="display tracking-tight mt-2"
            style={{ color: 'var(--color-ink)', fontSize: 36, lineHeight: 1 }}
          >
            Declyne
          </div>
          <div className="label-tag mt-2">{today}</div>
        </header>

        <div className="perf pt-4 flex items-end justify-between gap-3">
          <div>
            <div className="label-tag mb-1">Vice 30d</div>
            <div className="hero-num">
              {animatedVice.toFixed(1)}<span style={{ fontSize: 24, opacity: 0.55 }}>%</span>
            </div>
            <div className="text-xs ink-muted mt-1">
              {vice.data
                ? `${formatCents(vice.data.vice_cents)} of ${formatCents(vice.data.vice_cents + vice.data.lifestyle_cents)}`
                : ''}
            </div>
          </div>
          <span className="pill-purple">30 day</span>
        </div>

        <Link to="/phase" className="row-tap perf">
          <div className="flex items-baseline justify-between gap-3">
            <div className="label-tag">Phase</div>
            <div className="num text-base" style={{ color: 'var(--color-ink)' }}>
              {phase.data ? `${phase.data.phase}. ${phase.data.name}` : '--'}
            </div>
          </div>
          <div className="mt-1 text-xs ink-muted">
            {phase.data?.entered_at
              ? `Since ${new Date(phase.data.entered_at).toLocaleDateString('en-CA')} -> tap for journey`
              : 'Bootstrap phase. No transitions yet.'}
          </div>
        </Link>

        <Link to="/review" className="row-tap perf">
          <div className="flex items-baseline justify-between gap-3">
            <div className="label-tag">Review queue</div>
            <div className="num text-base" style={{ color: 'var(--color-ink)' }}>
              {reviewCount} {reviewCount === 1 ? 'item' : 'items'} &gt;
            </div>
          </div>
          <div className="mt-1 text-xs ink-muted">
            {reviewCount === 0 ? 'Nothing to triage.' : 'Tap to resolve uncategorized.'}
          </div>
        </Link>

        <Link to="/reconcile" className="row-tap perf">
          <div className="flex items-baseline justify-between gap-3">
            <div className="label-tag">Reconciliation</div>
            <div className="flex items-center gap-2">
              {streak > 0 && <span className="pill-gold">{streak} wk</span>}
              <div className="num text-base" style={{ color: 'var(--color-ink)' }}>&gt;</div>
            </div>
          </div>
          <div className="mt-1 text-xs ink-muted">
            {reconciliation.data?.completed_this_week
              ? 'Sealed for the week. Tap to review.'
              : reconciliation.data?.last_reconciliation_at
                ? `Last ${new Date(reconciliation.data.last_reconciliation_at).toLocaleDateString('en-CA')} -> tap to seal`
                : 'Tap to walk the week.'}
          </div>
        </Link>

        <div className="perf pt-4 text-center label-tag" style={{ letterSpacing: '0.32em' }}>
          ** End of day **
        </div>
      </section>
    </div>
  );
}
