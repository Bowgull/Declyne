import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import { dismissFollowUpThisWeek } from '../native/notifications';

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
};

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

  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const reviewCount = review.data?.items.length ?? 0;

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-mark" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">DECLYNE</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {today}
              </div>
            </div>
          </div>
          <Link to="/settings" aria-label="Settings" className="text-[color:var(--color-text-muted)] mt-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.18.43.6.94 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </header>

        <Link to="/phase" className="block pt-3" style={perforation}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">Phase</div>
            <div className="num text-base">{phase.data ? `${phase.data.phase}. ${phase.data.name}` : '--'}</div>
          </div>
          <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            {phase.data?.entered_at
              ? `Since ${new Date(phase.data.entered_at).toLocaleDateString('en-CA')} -> tap for journey`
              : 'Bootstrap phase. No transitions yet.'}
          </div>
        </Link>

        <div className="pt-3" style={perforation}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">Vice 30d</div>
            <div className="num text-base">
              {vice.data ? `${(vice.data.ratio_bps / 100).toFixed(1)}%` : '--'}
            </div>
          </div>
          <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            {vice.data
              ? `${formatCents(vice.data.vice_cents)} vice of ${formatCents(vice.data.vice_cents + vice.data.lifestyle_cents)}`
              : ''}
          </div>
        </div>

        <Link to="/review" className="block pt-3" style={perforation}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">Review queue</div>
            <div className="num text-base">
              {reviewCount} {reviewCount === 1 ? 'item' : 'items'} &gt;
            </div>
          </div>
          <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            {reviewCount === 0 ? 'Nothing to triage.' : 'Tap to resolve uncategorized.'}
          </div>
        </Link>

        <div className="pt-3" style={perforation}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">Reconciliation</div>
            <div className="num text-base">
              {reconciliation.data ? `${reconciliation.data.reconciliation_streak} wk` : '--'}
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="text-xs text-[color:var(--color-text-muted)]">
              {reconciliation.data?.last_reconciliation_at
                ? `Last ${new Date(reconciliation.data.last_reconciliation_at).toLocaleDateString('en-CA')}`
                : 'No completions yet.'}
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
        </div>

        <div className="pt-3 text-center text-[11px] uppercase tracking-[0.32em] text-[color:var(--color-text-muted)]" style={perforation}>
          ** End of day **
        </div>
      </section>
    </div>
  );
}
