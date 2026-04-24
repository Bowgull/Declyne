import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

type CoachMessage = {
  id: string;
  generated_at: string;
  phase: number;
  response_text: string;
  model: string;
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
  const coach = useQuery({
    queryKey: ['coach-latest'],
    queryFn: () => api.get<{ message: CoachMessage | null }>('/api/coach/latest'),
  });
  const [coachErr, setCoachErr] = useState<string | null>(null);
  const refreshCoach = useMutation({
    mutationFn: () => api.post<{ id: string; text: string }>('/api/coach/summary', {}),
    onSuccess: () => {
      setCoachErr(null);
      qc.invalidateQueries({ queryKey: ['coach-latest'] });
    },
    onError: (e: Error) => setCoachErr(e.message),
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
          <Link to="/review" className="btn-outline">Open</Link>
        </div>
      </section>

      <section className="card flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Coach</div>
          <button
            className="btn-outline text-xs"
            onClick={() => refreshCoach.mutate()}
            disabled={refreshCoach.isPending}
          >
            {refreshCoach.isPending ? 'Thinking.' : 'Refresh'}
          </button>
        </div>
        {coach.data?.message ? (
          <>
            <p className="text-sm leading-snug">{coach.data.message.response_text}</p>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {new Date(coach.data.message.generated_at).toLocaleString('en-CA')} · {coach.data.message.model}
            </p>
          </>
        ) : (
          <p className="text-sm text-[color:var(--color-text-muted)]">
            No coach summary yet. Hit Refresh once signals have computed.
          </p>
        )}
        {coachErr && <p className="text-xs text-[color:var(--color-danger,#b00)]">{coachErr}</p>}
      </section>
    </div>
  );
}
