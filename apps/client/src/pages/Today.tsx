import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

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

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <Link to="/settings" aria-label="Settings" className="text-[color:var(--color-text-muted)]">
          ⚙
        </Link>
      </header>

      <section className="card card-hero">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Phase</div>
        <div className="mt-1 text-3xl font-semibold">
          {phase.data ? `${phase.data.phase}. ${phase.data.name}` : '—'}
        </div>
        <div className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          {phase.data?.entered_at
            ? `Since ${new Date(phase.data.entered_at).toLocaleDateString('en-CA')}`
            : 'Bootstrap phase. No transitions yet.'}
        </div>
      </section>

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
          <Link to="/budget" className="btn-outline">Open</Link>
        </div>
      </section>
    </div>
  );
}
