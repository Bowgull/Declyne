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

interface ViceTrend {
  weeks: { week_start: string; vice_cents: number; lifestyle_cents: number; ratio_bps: number }[];
  top_categories: { id: string; name: string; spend_cents: number }[];
  peak_weekday: number | null;
  peak_weekday_cents: number;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Budget() {
  const variance = useQuery({
    queryKey: ['budget-variance'],
    queryFn: () => api.get<{ period: unknown | null; rows: VarianceRow[] }>('/api/budget/variance'),
  });
  const vice = useQuery({
    queryKey: ['vice'],
    queryFn: () => api.get<{ vice_cents: number; lifestyle_cents: number; ratio_bps: number }>('/api/budget/vice'),
  });
  const trend = useQuery({
    queryKey: ['vice-trend'],
    queryFn: () => api.get<ViceTrend>('/api/budget/vice/trend'),
  });

  const rows = variance.data?.rows ?? [];
  const groups = Array.from(new Set(rows.map((r) => r.group)));
  const trendWeeks = trend.data?.weeks ?? [];
  const latestBps = trendWeeks.at(-1)?.ratio_bps ?? 0;
  const priorBps = trendWeeks.at(-2)?.ratio_bps ?? latestBps;
  const delta = latestBps - priorBps;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budget</h1>
        <div className="flex gap-2">
          <Link to="/budget/routing" className="btn-outline">Routing</Link>
          <ImportCsvButton />
        </div>
      </header>

      <section className="card flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Vice ratio, 30d</div>
            <div className="num mt-1 text-3xl">
              {vice.data ? `${(vice.data.ratio_bps / 100).toFixed(1)}%` : '—'}
            </div>
            <div className="text-sm text-[color:var(--color-text-muted)]">
              {vice.data ? `${formatCents(vice.data.vice_cents)} of ${formatCents(vice.data.vice_cents + vice.data.lifestyle_cents)}` : ''}
            </div>
          </div>
          {trendWeeks.length > 0 && (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Week delta</div>
              <div
                className="num mt-1 text-lg"
                style={{ color: delta > 0 ? 'var(--color-danger)' : 'var(--color-success, var(--color-text))' }}
              >
                {delta === 0 ? 'flat' : `${delta > 0 ? '+' : ''}${(delta / 100).toFixed(1)}pp`}
              </div>
            </div>
          )}
        </div>

        {trendWeeks.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)] mb-2">8 week trend</div>
            <div className="flex items-end gap-1 h-16">
              {trendWeeks.map((w, i) => {
                const pct = Math.min(100, w.ratio_bps / 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${w.week_start}: ${pct.toFixed(1)}%`}>
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${Math.max(2, pct)}%`,
                        background: pct >= 25 ? 'var(--color-danger)' : 'var(--color-text)',
                        opacity: i === trendWeeks.length - 1 ? 1 : 0.5,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {trend.data?.peak_weekday !== null && trend.data?.peak_weekday !== undefined && (
          <div className="text-sm text-[color:var(--color-text-muted)]">
            Peak day: {WEEKDAY[trend.data.peak_weekday]} · {formatCents(trend.data.peak_weekday_cents)} over 90d
          </div>
        )}

        {trend.data && trend.data.top_categories.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)] mb-2">Top vice, 30d</div>
            <div className="flex flex-col gap-1">
              {trend.data.top_categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="num">{formatCents(c.spend_cents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
