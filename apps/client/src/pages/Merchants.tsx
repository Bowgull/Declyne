import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import LedgerHeader from '../components/LedgerHeader';

type Merchant = {
  id: string;
  display_name: string;
  normalized_key: string;
  category_default_id: string | null;
  category_name: string | null;
  verified: number;
  txn_count: number;
  last_seen_at: string | null;
  uncategorized_txn_count: number;
  spend_90d_cents: number;
};

type Category = {
  id: string;
  name: string;
  group: string;
};

export default function Merchants() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'unverified' | 'all' | 'verified'>('unverified');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Merchant | null>(null);

  const merchants = useQuery({
    queryKey: ['merchants', status, q],
    queryFn: () => {
      const params = new URLSearchParams({ status, limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      return api.get<{ merchants: Merchant[] }>(`/api/merchants?${params}`);
    },
  });

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: Category[] }>('/api/categories'),
  });

  const rows = merchants.data?.merchants ?? [];

  return (
    <div className="ledger-page">
      <LedgerHeader
        kicker="§ MERCHANTS"
        title="Merchants"
        subtitle="verify + recategorize"
        action={<Link to="/settings" className="stamp">Back</Link>}
      />

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">01</span>Filter</span>
        <div className="flex gap-2 pt-4 pb-2">
          {(['unverified', 'all', 'verified'] as const).map((s) => (
            <button
              key={s}
              className={status === s ? 'stamp stamp-filled flex-1' : 'stamp stamp-square flex-1'}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <input
          className="field"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or key"
        />
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">02</span>Merchants</span>
        <span className="ledger-section-meta text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
          {merchants.data ? `${rows.length}` : '—'}
        </span>
        {rows.length === 0 && merchants.data ? (
          <p className="text-sm text-[color:var(--color-text-muted)] pt-4">Nothing here.</p>
        ) : null}
        <div className="flex flex-col pt-2">
          {rows.map((m) => (
            <button
              key={m.id}
              className="ledger-row text-left w-full"
              onClick={() => setEditing(m)}
            >
              <div className="ledger-row-main">
                <span className="ledger-row-label">{m.display_name}</span>
                <span className="ledger-row-hint num">{m.normalized_key}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="num text-xs" style={{ color: m.verified ? 'var(--color-ok)' : 'var(--color-text-muted)' }}>
                  {m.verified ? 'verified' : 'unverified'}
                </span>
                <span className="num text-[10px] text-[color:var(--color-text-muted)]">
                  {m.txn_count} txns
                  {m.uncategorized_txn_count > 0 ? ` · ${m.uncategorized_txn_count} unc.` : ''}
                  {m.spend_90d_cents > 0 ? ` · ${formatCents(m.spend_90d_cents)} 90d` : ''}
                </span>
              </div>
              <span className="ledger-row-chevron">&rsaquo;</span>
            </button>
          ))}
        </div>
      </section>

      {editing && (
        <EditSheet
          merchant={editing}
          categories={categories.data?.categories ?? []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['merchants'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditSheet({
  merchant,
  categories,
  onClose,
  onSaved,
}: {
  merchant: Merchant;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(merchant.display_name);
  const [categoryId, setCategoryId] = useState(merchant.category_default_id ?? '');
  const [verified, setVerified] = useState<boolean>(!!merchant.verified);
  const [backfill, setBackfill] = useState<boolean>(merchant.uncategorized_txn_count > 0);

  const grouped = useMemo(() => {
    const by: Record<string, Category[]> = {};
    for (const c of categories) {
      (by[c.group] ||= []).push(c);
    }
    return by;
  }, [categories]);

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/merchants/${merchant.id}`, {
        display_name: name,
        category_default_id: categoryId || null,
        verified,
        apply_to_uncategorized: backfill && !!categoryId,
      });
    },
    onSuccess: () => onSaved(),
  });

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="card w-full max-w-xl mx-auto stub-top flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">Edit merchant</h2>

        <label className="field-label">Display name</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="field-label">Default category</label>
        <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">None</option>
          {Object.entries(grouped).map(([g, cats]) => (
            <optgroup key={g} label={g}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          Verified
        </label>

        {merchant.uncategorized_txn_count > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={backfill}
              onChange={(e) => setBackfill(e.target.checked)}
              disabled={!categoryId}
            />
            Apply category to {merchant.uncategorized_txn_count} uncategorized txns
          </label>
        )}

        {save.error && (
          <p className="text-xs text-[color:var(--color-danger,#b00)]">{String(save.error)}</p>
        )}

        <div className="flex gap-2">
          <button className="stamp stamp-square flex-1" onClick={onClose}>Cancel</button>
          <button
            className="stamp stamp-square flex-1"
            onClick={() => save.mutate()}
            disabled={save.isPending || !name.trim()}
          >
            {save.isPending ? 'Saving.' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
