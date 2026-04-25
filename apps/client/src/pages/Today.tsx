import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import { dismissFollowUpThisWeek } from '../native/notifications';

export default function Today() {
  const qc = useQueryClient();
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
  const completeReconciliation = useMutation({
    mutationFn: () => api.post<{ ok: true; reconciliation_streak: number }>('/api/reconciliation/complete', {}),
    onSuccess: async () => {
      await dismissFollowUpThisWeek().catch(() => {});
      qc.invalidateQueries({ queryKey: ['reconciliation-status'] });
    },
  });

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="mascot-mark" aria-hidden="true" />
          <div>
            <h1 className="display text-2xl tracking-tight">Today</h1>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
        <Link to="/settings" aria-label="Settings" className="text-[color:var(--color-text-muted)]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.18.43.6.94 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </header>

      <Link to="/phase" className="card card-hero block">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Phase</div>
        <div className="mt-1 text-3xl font-semibold">
          {phase.data ? `${phase.data.phase}. ${phase.data.name}` : '—'}
        </div>
        <div className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          {phase.data?.entered_at
            ? `Since ${new Date(phase.data.entered_at).toLocaleDateString('en-CA')} · tap for journey`
            : 'Bootstrap phase. No transitions yet.'}
        </div>
      </Link>

      <section className="card">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Vice ratio 30d</div>
        <div className="mt-1 num text-2xl">
          {vice.data ? `${(vice.data.ratio_bps / 100).toFixed(1)}%` : '—'}
        </div>
        <div className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          {vice.data
            ? `${formatCents(vice.data.vice_cents)} vice of ${formatCents(vice.data.vice_cents + vice.data.lifestyle_cents)}`
            : ''}
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Review queue</div>
            <div className="mt-1 num text-2xl">{review.data?.items.length ?? 0}</div>
          </div>
          <Link to="/review" className="btn-outline">Open</Link>
        </div>
      </section>

      <section className="card flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Reconciliation</div>
            <div className="mt-1 num text-2xl">
              {reconciliation.data ? `${reconciliation.data.reconciliation_streak} wk` : '—'}
            </div>
            <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
              {reconciliation.data?.last_reconciliation_at
                ? `Last ${new Date(reconciliation.data.last_reconciliation_at).toLocaleDateString('en-CA')}`
                : 'No completions yet.'}
            </div>
          </div>
          <button
            className="btn-outline text-xs"
            onClick={() => completeReconciliation.mutate()}
            disabled={
              completeReconciliation.isPending ||
              reconciliation.data?.completed_this_week === true
            }
          >
            {reconciliation.data?.completed_this_week
              ? 'Done this week'
              : completeReconciliation.isPending
                ? 'Saving.'
                : 'Mark done'}
          </button>
        </div>
      </section>

    </div>
  );
}
