import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
};

type PlPath = { path: string; amount_cents: number };

type PlResponse = {
  period_id: string | null;
  start_date: string;
  end_date: string;
  income_cents: number;
  expense_cents: number;
  surplus_cents: number;
  income_by_path: PlPath[];
  expense_by_path: PlPath[];
};

type Period = {
  id: string;
  start_date: string;
  end_date: string;
  paycheque_cents: number;
};

export default function PL() {
  const [periodId, setPeriodId] = useState<string | null>(null);

  const periods = useQuery({
    queryKey: ['periods-list'],
    queryFn: () => api.get<{ periods: Period[] }>('/api/periods'),
  });

  const recent = (periods.data?.periods ?? []).slice(0, 4);
  const activeId = periodId ?? recent[0]?.id ?? null;

  const pl = useQuery({
    queryKey: ['pl', activeId],
    queryFn: () =>
      api.get<PlResponse>(activeId ? `/api/gl/pl?period_id=${activeId}` : '/api/gl/pl'),
    enabled: !!activeId || recent.length === 0,
  });

  const data = pl.data;
  const surplus = data?.surplus_cents ?? 0;
  const surplusColor = surplus >= 0 ? 'var(--cat-savings)' : 'var(--cat-indulgence)';

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-sigil" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">INCOME STATEMENT</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {data ? `${data.start_date} → ${data.end_date}` : 'Loading…'}
              </div>
            </div>
          </div>
          <Link to="/paycheque" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Close
          </Link>
        </header>

        {recent.length > 1 && (
          <div className="pt-3 flex gap-2 flex-wrap" style={perforation}>
            {recent.map((p) => {
              const active = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => setPeriodId(p.id)}
                  className="stamp stamp-square"
                  style={{
                    fontSize: 10,
                    padding: '4px 8px',
                    opacity: active ? 1 : 0.55,
                  }}
                >
                  {p.start_date.slice(5)} – {p.end_date.slice(5)}
                </button>
              );
            })}
          </div>
        )}

        <div className="pt-3 flex flex-col gap-2" style={perforation}>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            <span>Income</span>
            <span className="font-mono" style={{ color: 'var(--cat-income)' }}>
              + {formatCents(data?.income_cents ?? 0)}
            </span>
          </div>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            <span>Expenses</span>
            <span className="font-mono" style={{ color: 'var(--cat-indulgence)' }}>
              − {formatCents(data?.expense_cents ?? 0)}
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              {surplus >= 0 ? 'Surplus' : 'Deficit'}
            </span>
            <span className="font-mono text-base" style={{ color: surplusColor }}>
              {surplus >= 0 ? '+ ' : '− '}
              {formatCents(Math.abs(surplus))}
            </span>
          </div>
        </div>

        {(data?.expense_by_path ?? []).length > 0 && (
          <div className="pt-3 flex flex-col gap-2" style={perforation}>
            <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              <span>Where it went</span>
              <span className="font-mono">{formatCents(data!.expense_cents)}</span>
            </div>
            {data!.expense_by_path.map((r) => (
              <div key={r.path} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{r.path}</span>
                <span className="font-mono shrink-0">{formatCents(r.amount_cents)}</span>
              </div>
            ))}
          </div>
        )}

        {(data?.income_by_path ?? []).length > 0 && (
          <div className="pt-3 flex flex-col gap-2" style={perforation}>
            <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              <span>Where it came from</span>
              <span className="font-mono">{formatCents(data!.income_cents)}</span>
            </div>
            {data!.income_by_path.map((r) => (
              <div key={r.path} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{r.path}</span>
                <span className="font-mono shrink-0">{formatCents(r.amount_cents)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 text-center text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
          ** end of statement **
        </div>
      </section>
    </div>
  );
}
