import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import LedgerHeader from '../components/LedgerHeader';
import { Link } from 'react-router-dom';

type Point = {
  period_start: string;
  period_end: string;
  assets_cents: number;
  liabilities_cents: number;
  net_worth_cents: number;
};

export default function NetWorthTrend() {
  const hist = useQuery({
    queryKey: ['net-worth-history'],
    queryFn: () => api.get<{ points: Point[] }>('/api/gl/net-worth/history'),
  });

  const live = useQuery({
    queryKey: ['net-worth-live'],
    queryFn: () => api.get<{ assets_cents: number; liabilities_cents: number; net_worth_cents: number }>(
      '/api/gl/net-worth',
    ),
  });

  const points = (hist.data?.points ?? []).slice().reverse();
  const latest = live.data?.net_worth_cents ?? 0;

  return (
    <div className="ledger-page">
      <LedgerHeader
        kicker="§ NET WORTH"
        title={formatCents(latest)}
        subtitle="assets − liabilities · live"
        action={<Link to="/paycheque" className="stamp stamp-square">Back</Link>}
      />

      <section className="ledger-section">
        <span className="ledger-section-kicker">
          <span className="num">01</span>Trend
        </span>
        <span className="ledger-section-meta">{points.length} closes</span>

        {hist.isLoading && (
          <div className="ledger-row">
            <span className="ledger-row-main text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Loading…
            </span>
          </div>
        )}

        {!hist.isLoading && points.length === 0 && (
          <div className="ledger-row">
            <span className="ledger-row-main text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              No closed periods yet · seal a week to start the trend
            </span>
          </div>
        )}

        {points.map((p, i) => {
          const prev = points[i + 1];
          const delta = prev ? p.net_worth_cents - prev.net_worth_cents : 0;
          const deltaColor =
            delta > 0
              ? 'var(--cat-savings)'
              : delta < 0
                ? 'var(--cat-indulgence)'
                : 'var(--color-text-muted)';
          return (
            <div key={p.period_end} className="ledger-row">
              <div className="ledger-row-main">
                <span className="ledger-row-label">{p.period_end}</span>
                <span className="ledger-row-hint">
                  assets {formatCents(p.assets_cents)} · liab {formatCents(p.liabilities_cents)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="num ledger-row-value">{formatCents(p.net_worth_cents)}</span>
                {prev && (
                  <span className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: deltaColor }}>
                    {delta >= 0 ? '+' : '−'} {formatCents(Math.abs(delta))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
