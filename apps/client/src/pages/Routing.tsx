import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import LedgerHeader from '../components/LedgerHeader';

interface RoutingRow {
  id: string;
  pay_period_id: string;
  target_type: 'account' | 'category' | 'debt';
  target_id: string;
  target_name: string | null;
  amount_cents: number;
  executed_at: string | null;
}

interface Period {
  id: string;
  start_date: string;
  end_date: string;
  paycheque_cents: number;
}

export default function Routing() {
  const qc = useQueryClient();
  const plan = useQuery({
    queryKey: ['routing'],
    queryFn: () => api.get<{ period: Period | null; rows: RoutingRow[] }>('/api/routing'),
  });

  const generate = useMutation({
    mutationFn: () => api.post<{ period_id: string; rows: number }>('/api/routing/generate'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  });
  const execute = useMutation({
    mutationFn: (id: string) => api.post<{ ok: true }>(`/api/routing/${id}/execute`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing'] }),
  });

  const period = plan.data?.period ?? null;
  const rows = plan.data?.rows ?? [];
  const total = rows.reduce((sum, r) => sum + r.amount_cents, 0);

  return (
    <div className="ledger-page">
      <LedgerHeader
        kicker="§ THE PLAN"
        title="The Plan"
        subtitle={
          period
            ? `${period.start_date} → ${period.end_date} · ${formatCents(period.paycheque_cents)}`
            : 'No pay period yet'
        }
        action={<Link to="/budget" className="stamp">Back</Link>}
      />

      {period && (
        <div className="pb-4">
          <button
            className="stamp stamp-purple"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Building…' : 'Rebuild the plan'}
          </button>
        </div>
      )}

      {!period && (
        <p className="text-sm text-[color:var(--color-text-muted)] py-4">
          Import a pay deposit to build a plan.
        </p>
      )}

      {period && rows.length === 0 && (
        <p className="text-sm text-[color:var(--color-text-muted)] py-4">
          No plan yet. Tap Rebuild.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id}>
            <article className="receipt relative">
              <span className="stub stub-top" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
                    {r.target_type} {r.executed_at ? '· sent' : ''}
                  </div>
                  <div className="mt-1 truncate text-base font-semibold">
                    {r.target_name ?? r.target_id}
                  </div>
                </div>
                <div className="num text-lg shrink-0">{formatCents(r.amount_cents)}</div>
              </div>
              {!r.executed_at && (
                <div className="mt-3">
                  <button
                    className="btn-primary px-4 py-2 text-sm"
                    onClick={() => execute.mutate(r.id)}
                    disabled={execute.isPending}
                  >
                    Mark sent
                  </button>
                </div>
              )}
              <span className="stub stub-bottom" aria-hidden />
            </article>
          </li>
        ))}
      </ul>

      {rows.length > 0 && period && (
        <div className="ledger-section">
          <span className="ledger-section-kicker"><span className="num">Σ</span>Planned</span>
          <div className="ledger-row">
            <span className="ledger-row-label" style={{ color: 'var(--color-text-muted)' }}>Total routed</span>
            <span className="ledger-row-value" style={{ color: 'var(--color-text-primary)', fontSize: 14 }}>
              {formatCents(total)} / {formatCents(period.paycheque_cents)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
