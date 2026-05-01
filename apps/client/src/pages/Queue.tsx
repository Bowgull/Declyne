import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import LedgerHeader from '../components/LedgerHeader';

type QueueKind =
  | 'reconcile'
  | 'bill'
  | 'plan_installment'
  | 'payday'
  | 'review_uncategorized'
  | 'sub_category_unconfirmed'
  | 'sub_category_stale'
  | 'tab_to_match'
  | 'uncleared_line'
  | 'subscription_pending_verdict'
  | 'statement_mismatch'
  | 'counterparty_stale';

interface QueueItem {
  kind: QueueKind;
  id: string;
  label: string;
  meta?: string;
  due_date: string | null;
  tier: number;
  href: string;
  amount_cents?: number;
}

interface QueueResp {
  items: QueueItem[];
  total: number;
  by_kind: Record<QueueKind, number>;
}

const KIND_LABEL: Record<QueueKind, string> = {
  reconcile: 'reconcile',
  bill: 'bill',
  plan_installment: 'installment',
  payday: 'payday',
  review_uncategorized: 'review',
  sub_category_unconfirmed: 'sub-category',
  sub_category_stale: 'sub-category stale',
  tab_to_match: 'tab to match',
  uncleared_line: 'uncleared',
  subscription_pending_verdict: 'subscription',
  statement_mismatch: 'statement',
  counterparty_stale: 'counterparty stale',
};

function dotClass(kind: QueueKind): string {
  switch (kind) {
    case 'payday': return 'cat-dot income';
    case 'plan_installment': return 'cat-dot debt';
    case 'bill': return 'cat-dot essentials';
    case 'subscription_pending_verdict': return 'cat-dot indulgence';
    case 'statement_mismatch': return 'cat-dot debt';
    case 'sub_category_stale': return 'cat-dot indulgence';
    case 'tab_to_match':
    case 'counterparty_stale': return 'cat-dot lifestyle';
    default: return 'cat-dot uncategorized';
  }
}

function daysUntil(due_date: string | null, today: string): string | null {
  if (!due_date) return null;
  const ms = Date.parse(due_date) - Date.parse(today);
  const d = Math.round(ms / 86_400_000);
  if (d <= 0) return 'today';
  return `${d}d`;
}

export default function Queue() {
  const q = useQuery({
    queryKey: ['queue'],
    queryFn: () => api.get<QueueResp>('/api/queue'),
  });

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="ledger-page">
      <LedgerHeader
        kicker="§ QUEUE"
        title={String(total)}
        subtitle={total === 1 ? 'open loop' : 'open loops'}
        action={<Link to="/today" className="stamp stamp-square">Back</Link>}
      />

      <section className="ledger-section">
        <span className="ledger-section-kicker">
          <span className="num">01</span>Up next
        </span>
        <span className="ledger-section-meta">{items.length} total</span>

        {q.isLoading && (
          <div className="ledger-row">
            <span className="ledger-row-main text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Loading…
            </span>
          </div>
        )}

        {!q.isLoading && items.length === 0 && (
          <div className="ledger-row">
            <span className="ledger-row-main text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              Books are clear · nothing up next
            </span>
          </div>
        )}

        {items.map((it) => {
          const due = daysUntil(it.due_date, today);
          const kindLabel = KIND_LABEL[it.kind];
          const sub = due ? `${kindLabel} · ${due}` : it.meta ? `${kindLabel} · ${it.meta}` : kindLabel;
          return (
            <Link
              to={it.href}
              key={it.id}
              className="ledger-row tap"
            >
              <div className="flex items-center gap-3 ledger-row-main">
                <span className={dotClass(it.kind)} />
                <div className="min-w-0">
                  <div className="text-sm truncate">{it.label}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                    {sub}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {it.amount_cents !== undefined && it.amount_cents > 0 && (
                  <span className="num ledger-row-value">
                    {it.kind === 'payday' ? '+' : ''}
                    {formatCents(it.amount_cents)}
                  </span>
                )}
                <span className="ledger-row-chevron">&rsaquo;</span>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
