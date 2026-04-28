import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

type SearchRow = {
  id: string;
  posted_at: string;
  description_raw: string;
  amount_cents: number;
  account_id: string;
  account_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_group: string | null;
  merchant_name: string | null;
};

type Account = { id: string; name: string };

const GROUPS = ['essentials', 'lifestyle', 'indulgence', 'debt', 'transfer', 'income'] as const;

interface Props {
  onClose: () => void;
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).toUpperCase();
}

export default function SearchSheet({ onClose }: Props) {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [accountId, setAccountId] = useState('');
  const [group, setGroup] = useState('');

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ accounts: Account[] }>('/api/accounts'),
  });

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set('q', q.trim());
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    if (accountId) sp.set('account_id', accountId);
    if (group) sp.set('category_group', group);
    sp.set('limit', '100');
    return sp.toString();
  }, [q, from, to, accountId, group]);

  const hasFilter = q.trim().length > 0 || !!from || !!to || !!accountId || !!group;

  const results = useQuery({
    queryKey: ['transactions-search', params],
    queryFn: () => api.get<{ rows: SearchRow[] }>(`/api/transactions/search?${params}`),
    enabled: hasFilter,
  });

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        className="receipt stub-top stub-bottom w-full max-w-md flex flex-col gap-3 p-5 max-h-[88vh] overflow-y-auto"
        style={{ borderRadius: '12px 12px 0 0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <span className="label-tag">Search</span>
          <button onClick={onClose} className="ink-muted" aria-label="Close">×</button>
        </div>
        <input
          autoFocus
          className="field"
          placeholder="merchant, description.."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="field flex-1"
            type="date"
            value={from}
            placeholder="From"
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            className="field flex-1"
            type="date"
            value={to}
            placeholder="To"
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <select className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All accounts</option>
          {(accounts.data?.accounts ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select className="field" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All categories</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <div className="perf pt-3">
          {!hasFilter && <div className="text-sm ink-muted">Type to search.</div>}
          {hasFilter && results.isLoading && <div className="text-sm ink-muted">Searching..</div>}
          {hasFilter && !results.isLoading && (results.data?.rows.length ?? 0) === 0 && (
            <div className="text-sm ink-muted">No matches.</div>
          )}
          {(results.data?.rows ?? []).map((r) => {
            const sign = r.amount_cents < 0 ? '-' : '+';
            const color = r.amount_cents < 0 ? 'var(--color-text-primary)' : 'var(--cat-income)';
            return (
              <div key={r.id} className="row-tap flex items-baseline justify-between py-2">
                <div className="min-w-0">
                  <div className="text-sm truncate">{r.merchant_name ?? r.description_raw}</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] ink-muted">
                    {fmtDay(r.posted_at)} · {r.account_name ?? ''}
                    {r.category_name ? ` · ${r.category_name}` : ''}
                  </div>
                </div>
                <span className="num" style={{ color }}>
                  {sign}{formatCents(Math.abs(r.amount_cents))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
