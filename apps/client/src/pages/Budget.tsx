import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import ImportCsvButton from '../components/ImportCsvButton';

interface VarianceRow {
  category_id: string;
  name: string;
  group: string;
  allocation_cents: number;
  spent_cents: number;
}

export default function Budget() {
  const variance = useQuery({
    queryKey: ['budget-variance'],
    queryFn: () => api.get<{ period: unknown | null; rows: VarianceRow[] }>('/api/budget/variance'),
  });
  const vice = useQuery({
    queryKey: ['vice'],
    queryFn: () => api.get<{ vice_cents: number; lifestyle_cents: number; ratio_bps: number }>('/api/budget/vice'),
  });

  const rows = variance.data?.rows ?? [];
  const groups = Array.from(new Set(rows.map((r) => r.group)));

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budget</h1>
        <div className="flex gap-2">
          <Link to="/budget/routing" className="btn-outline">Routing</Link>
          <ImportCsvButton />
        </div>
      </header>

      <section className="card">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Vice</div>
        <div className="num mt-1 text-2xl">
          {vice.data ? `${(vice.data.ratio_bps / 100).toFixed(1)}%` : '—'}
        </div>
        <div className="text-sm text-[color:var(--color-text-muted)]">
          {vice.data ? `${formatCents(vice.data.vice_cents)} of ${formatCents(vice.data.vice_cents + vice.data.lifestyle_cents)}` : ''}
        </div>
      </section>

      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">{group}</h2>
          <div className="card flex flex-col gap-3">
            {rows
              .filter((r) => r.group === group)
              .map((r) => {
                const over = r.allocation_cents > 0 && r.spent_cents > r.allocation_cents;
                return (
                  <div key={r.category_id} className="flex items-center justify-between">
                    <span>{r.name}</span>
                    <span className="num" style={over ? { color: 'var(--color-danger)' } : undefined}>
                      {formatCents(r.spent_cents)}
                      {r.allocation_cents > 0 ? ` / ${formatCents(r.allocation_cents)}` : ''}
                    </span>
                  </div>
                );
              })}
            {rows.filter((r) => r.group === group).length === 0 && (
              <div className="text-sm text-[color:var(--color-text-muted)]">No activity.</div>
            )}
          </div>
        </section>
      ))}

      {rows.length === 0 && (
        <div className="card text-sm text-[color:var(--color-text-muted)]">
          No pay period yet. Import CSVs to begin.
        </div>
      )}
    </div>
  );
}
