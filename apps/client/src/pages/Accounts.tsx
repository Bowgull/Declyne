import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import LedgerHeader from '../components/LedgerHeader';

export type AccountType = 'chequing' | 'savings' | 'credit' | 'loan';

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  currency: string;
  last_import_at: string | null;
  archived: number;
}

const TYPE_LABEL: Record<AccountType, string> = {
  chequing: 'Chequing',
  savings: 'Savings',
  credit: 'Credit',
  loan: 'Loan',
};

export default function Accounts() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Account | 'new' | null>(null);

  const accounts = useQuery({
    queryKey: ['accounts', showArchived],
    queryFn: () =>
      api.get<{ accounts: Account[] }>(`/api/accounts${showArchived ? '?archived=1' : ''}`),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
  const unarchive = useMutation({
    mutationFn: (id: string) => api.patch<{ ok: true }>(`/api/accounts/${id}`, { archived: 0 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const list = accounts.data?.accounts ?? [];

  return (
    <div className="ledger-page">
      <LedgerHeader
        kicker="§ ACCOUNTS"
        title="Accounts"
        subtitle="ledgers feeding the pipeline"
        action={<Link to="/settings" className="stamp">Back</Link>}
      />

      <div className="flex items-center gap-2 pb-3">
        <button className="btn-primary flex-1" onClick={() => setEditing('new')}>
          Add account
        </button>
        <button
          className="stamp"
          onClick={() => setShowArchived((v) => !v)}
          aria-pressed={showArchived}
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
      </div>

      {accounts.isLoading && <p className="text-sm text-[color:var(--color-text-muted)]">Loading…</p>}
      {accounts.isError && (
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
          {(accounts.error as Error).message}
        </p>
      )}
      {!accounts.isLoading && list.length === 0 && (
        <section className="card">
          <p className="text-sm text-[color:var(--color-text-muted)]">
            No accounts yet. Add one before importing a CSV.
          </p>
        </section>
      )}

      <ul className="flex flex-col gap-3">
        {list.map((a) => (
          <li key={a.id}>
            <AccountCard
              account={a}
              onEdit={() => setEditing(a)}
              onArchive={() => archive.mutate(a.id)}
              onUnarchive={() => unarchive.mutate(a.id)}
            />
          </li>
        ))}
      </ul>

      {editing && (
        <AccountSheet
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['accounts'] });
          }}
        />
      )}
    </div>
  );
}

function AccountCard({
  account,
  onEdit,
  onArchive,
  onUnarchive,
}: {
  account: Account;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}) {
  const archived = account.archived === 1;
  return (
    <article
      className="receipt relative"
      style={archived ? { opacity: 0.55 } : undefined}
      aria-label={`Account ${account.name}`}
    >
      <span className="stub stub-top" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
            {account.institution} · {TYPE_LABEL[account.type]} · {account.currency}
          </div>
          <div className="mt-1 truncate text-base font-semibold">{account.name}</div>
          <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            {account.last_import_at
              ? `Last import ${new Date(account.last_import_at).toLocaleDateString('en-CA')}`
              : 'No imports yet'}
          </div>
          <div className="mt-2 font-mono text-[11px] text-[color:var(--color-text-muted)]">
            {account.id}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button className="btn-outline px-3 py-2 text-xs" onClick={onEdit} disabled={archived}>
            Edit
          </button>
          {archived ? (
            <button className="btn-outline px-3 py-2 text-xs" onClick={onUnarchive}>
              Restore
            </button>
          ) : (
            <button
              className="btn-outline px-3 py-2 text-xs"
              onClick={() => {
                if (confirm(`Archive ${account.name}? Transactions stay linked.`)) onArchive();
              }}
            >
              Archive
            </button>
          )}
        </div>
      </div>
      <span className="stub stub-bottom" aria-hidden />
    </article>
  );
}

function AccountSheet({
  initial,
  onClose,
  onSaved,
}: {
  initial: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [institution, setInstitution] = useState(initial?.institution ?? '');
  const [type, setType] = useState<AccountType>(initial?.type ?? 'chequing');
  const [currency, setCurrency] = useState(initial?.currency ?? 'CAD');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), institution: institution.trim(), type, currency: currency.trim() || 'CAD' };
      if (!body.name || !body.institution) throw new Error('Name and institution required.');
      if (initial) return api.patch<{ ok: true }>(`/api/accounts/${initial.id}`, body);
      return api.post<{ id: string }>('/api/accounts', body);
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? 'Edit account' : 'Add account'}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-t-[16px] border border-[color:var(--color-hairline)] bg-[color:var(--color-bg-card)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? 'Edit account' : 'Add account'}</h2>
          <button className="text-[color:var(--color-text-muted)]" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="field-label">Name</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="TD Visa ·· 4429"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Institution</span>
            <input
              className="field"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="TD"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Type</span>
            <select
              className="field"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            >
              <option value="chequing">Chequing</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit</option>
              <option value="loan">Loan</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Currency</span>
            <input
              className="field"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="CAD"
              maxLength={3}
            />
          </label>

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : initial ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
