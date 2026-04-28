import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import LedgerHeader from '../components/LedgerHeader';

type EventType = 'bill' | 'plan' | 'payday' | 'savings_recurring';

interface ForecastEvent {
  date: string;
  type: EventType;
  label: string;
  amount_cents: number;
  running_balance_cents: number;
  category_group?: string;
}

interface ForecastResp {
  today: string;
  days: number;
  starting_balance_cents: number;
  min_balance_cents: number;
  events: ForecastEvent[];
}

const TYPE_LABEL: Record<EventType, string> = {
  payday: 'payday',
  bill: 'bill',
  plan: 'installment',
  savings_recurring: 'savings',
};

function dotClass(e: ForecastEvent): string {
  if (e.type === 'payday') return 'cat-dot income';
  if (e.type === 'plan') return 'cat-dot debt';
  if (e.type === 'savings_recurring') return 'cat-dot savings';
  if (e.category_group === 'essentials') return 'cat-dot essentials';
  if (e.category_group === 'lifestyle') return 'cat-dot lifestyle';
  return 'cat-dot indulgence';
}

export default function Forecast() {
  const q = useQuery({
    queryKey: ['forecast', 30],
    queryFn: () => api.get<ForecastResp>('/api/forecast?days=30'),
  });

  const events = q.data?.events ?? [];
  const start = q.data?.starting_balance_cents ?? 0;
  const min = q.data?.min_balance_cents ?? 0;
  const willGoNegative = min < 0;

  return (
    <div className="ledger-page">
      <LedgerHeader
        kicker="§ FORECAST"
        title={formatCents(start)}
        subtitle="opening cash · next 30 days"
        action={<Link to="/paycheque" className="stamp stamp-square">Back</Link>}
      />

      {willGoNegative && (
        <div
          className="ledger-row"
          style={{
            borderTop: '1px dashed var(--cat-indulgence)',
            borderBottom: '1px dashed var(--cat-indulgence)',
            color: 'var(--cat-indulgence)',
          }}
        >
          <span className="ledger-row-main text-[10px] uppercase tracking-[0.18em]">
            Balance dips to {formatCents(min)} this window
          </span>
        </div>
      )}

      <section className="ledger-section">
        <span className="ledger-section-kicker">
          <span className="num">01</span>Events
        </span>
        <span className="ledger-section-meta">{events.length} ahead</span>

        {q.isLoading && (
          <div className="ledger-row">
            <span className="ledger-row-main text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Loading…
            </span>
          </div>
        )}

        {!q.isLoading && events.length === 0 && (
          <div className="ledger-row">
            <span className="ledger-row-main text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Nothing scheduled · import recent activity to populate
            </span>
          </div>
        )}

        {events.map((e, i) => {
          const negative = e.running_balance_cents < 0;
          const balanceColor = negative
            ? 'var(--cat-indulgence)'
            : 'var(--color-text-muted)';
          const amtColor =
            e.amount_cents > 0 ? 'var(--cat-savings)' : 'var(--color-text-primary)';
          return (
            <div key={`${e.date}-${i}`} className="ledger-row">
              <div className="flex items-center gap-3 ledger-row-main">
                <span className={dotClass(e)} />
                <div className="min-w-0">
                  <div className="text-sm truncate">{e.label}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                    {e.date} · {TYPE_LABEL[e.type]}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="num ledger-row-value" style={{ color: amtColor }}>
                  {e.amount_cents >= 0 ? '+' : '−'}
                  {formatCents(Math.abs(e.amount_cents))}
                </span>
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.14em]"
                  style={{ color: balanceColor }}
                >
                  bal {formatCents(e.running_balance_cents)}
                </span>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
