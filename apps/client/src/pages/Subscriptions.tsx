import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import LedgerHeader from '../components/LedgerHeader';

interface Subscription {
  merchant_id: string;
  merchant_name: string;
  amount_cents: number;
  category_group: string;
  first_seen: string;
  last_seen: string;
  cadence_days: number;
  occurrences: number;
  months_running: number;
}

const GROUP_COLORS: Record<string, string> = {
  lifestyle: 'var(--cat-lifestyle)',
  indulgence: 'var(--cat-indulgence)',
};

export default function Subscriptions() {
  const q = useQuery({
    queryKey: ['budget-subscriptions'],
    queryFn: () => api.get<{ subscriptions: Subscription[] }>('/api/budget/subscriptions'),
  });

  const subs = q.data?.subscriptions ?? [];
  const totalMonthly = subs.reduce((s, sub) => s + sub.amount_cents, 0);

  return (
    <div className="ledger-page pb-20">
      <LedgerHeader
        kicker="Recurring"
        title="Subscriptions"
        subtitle={
          subs.length > 0
            ? `${subs.length} recurring · ${formatCents(totalMonthly)}/mo`
            : undefined
        }
        action={
          <Link to="/paycheque" className="stamp stamp-square text-[10px]">
            Back
          </Link>
        }
      />

      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>01</span> Charges
        </span>
        {subs.length === 0 ? (
          <p className="font-mono text-[11px] text-[color:var(--color-text-muted)] uppercase tracking-[0.14em] pt-3 pb-1">
            Nothing found · import 6 months of activity to populate.
          </p>
        ) : (
          <div className="flex flex-col">
            {subs.map((sub) => (
              <div key={sub.merchant_id} className="ledger-row">
                <div className="flex items-center gap-3 ledger-row-main">
                  <span
                    className="cat-rule"
                    style={{ background: GROUP_COLORS[sub.category_group] ?? 'var(--cat-lifestyle)' }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{sub.merchant_name}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
                      {sub.category_group} · every ~{sub.cadence_days}d · {sub.months_running}mo running
                    </div>
                  </div>
                </div>
                <span className="ledger-row-value num text-sm">
                  {formatCents(sub.amount_cents)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {subs.length > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>02</span> Summary
          </span>
          <div className="ledger-row">
            <div className="ledger-row-main">
              <span className="ledger-row-label">Per month</span>
            </div>
            <span className="ledger-row-value">{formatCents(totalMonthly)}</span>
          </div>
          <div className="ledger-row">
            <div className="ledger-row-main">
              <span className="ledger-row-label">Per year</span>
            </div>
            <span className="ledger-row-value">{formatCents(totalMonthly * 12)}</span>
          </div>
        </section>
      )}
    </div>
  );
}
