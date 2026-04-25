import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

type Snapshot = {
  id: string;
  debt_id: string;
  statement_date: string;
  statement_balance_cents: number;
  min_payment_cents: number;
  due_date: string;
  paid_in_full: number;
  created_at: string;
};

type Debt = {
  id: string;
  name: string;
  account_id_linked: string | null;
};

type Account = {
  id: string;
  type: string;
};

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function CcStatements() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Snapshot | null>(null);

  const snaps = useQuery({
    queryKey: ['cc-statements'],
    queryFn: () => api.get<{ snapshots: Snapshot[] }>('/api/cc-statements?limit=100'),
  });
  const debts = useQuery({
    queryKey: ['debts-all'],
    queryFn: () => api.get<{ debts: Debt[] }>('/api/debts'),
  });
  const accounts = useQuery({
    queryKey: ['accounts-all'],
    queryFn: () => api.get<{ accounts: Account[] }>('/api/accounts'),
  });

  const ccAccountIds = useMemo(
    () => new Set((accounts.data?.accounts ?? []).filter((a) => a.type === 'credit').map((a) => a.id)),
    [accounts.data],
  );
  const ccDebts = useMemo(
    () => (debts.data?.debts ?? []).filter((d) => d.account_id_linked && ccAccountIds.has(d.account_id_linked)),
    [debts.data, ccAccountIds],
  );
  const debtName = (id: string) => ccDebts.find((d) => d.id === id)?.name ?? id;

  const rows = snaps.data?.snapshots ?? [];

  const derive = useMutation({
    mutationFn: () =>
      api.post<{ debts_considered: number; inserted: number }>('/api/cc-statements/derive', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cc-statements'] }),
  });

  const perforation: React.CSSProperties = {
    borderTop: '1px dashed var(--color-hairline)',
  };

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-mark" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">STATEMENTS</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {snaps.data ? `${rows.length} on file` : 'Loading…'}
              </div>
            </div>
          </div>
          <Link to="/settings" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Close
          </Link>
        </header>

        <div className="pt-3 flex flex-col gap-2" style={perforation}>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Log one per cycle per card. Paid-in-full statements drive the CC payoff streak used by phase progression.
          </p>
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              onClick={() => setAdding(true)}
              disabled={ccDebts.length === 0}
            >
              Add statement
            </button>
            <button
              className="btn-outline flex-1"
              onClick={() => derive.mutate()}
              disabled={ccDebts.length === 0 || derive.isPending}
            >
              {derive.isPending ? 'Deriving…' : 'Derive from txns'}
            </button>
          </div>
          {derive.data ? (
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {derive.data.inserted} new statements derived from {derive.data.debts_considered} cards.
            </p>
          ) : null}
          {ccDebts.length === 0 && debts.data ? (
            <p className="text-xs text-[color:var(--color-text-muted)]">
              No CC debts. Link a debt to a credit account first.
            </p>
          ) : null}
        </div>

        {rows.length === 0 && snaps.data ? (
          <div className="pt-3 text-center text-xs text-[color:var(--color-text-muted)]" style={perforation}>
            No statements yet.
          </div>
        ) : (
          <div className="flex flex-col">
            {rows.map((s) => (
              <button
                key={s.id}
                type="button"
                className="pt-3 mt-3 flex flex-col gap-1 text-left"
                style={perforation}
                onClick={() => setEditing(s)}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium truncate">{debtName(s.debt_id)}</span>
                  <span className="num text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] shrink-0">
                    {s.statement_date}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
                    Min {formatCents(s.min_payment_cents)} · Due {s.due_date}
                    {s.paid_in_full === 1 ? ' · PAID' : ''}
                  </span>
                  <span className="num text-sm shrink-0">{formatCents(s.statement_balance_cents)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="pt-3 text-center text-[11px] uppercase tracking-[0.32em] text-[color:var(--color-text-muted)]" style={perforation}>
          ** End of statements **
        </div>
      </section>

      {adding && (
        <StatementSheet
          mode="add"
          ccDebts={ccDebts}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['cc-statements'] });
            setAdding(false);
          }}
        />
      )}
      {editing && (
        <StatementSheet
          mode="edit"
          snapshot={editing}
          ccDebts={ccDebts}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['cc-statements'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function StatementSheet({
  mode,
  snapshot,
  ccDebts,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  snapshot?: Snapshot;
  ccDebts: Debt[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [debtId, setDebtId] = useState(snapshot?.debt_id ?? ccDebts[0]?.id ?? '');
  const [stmtDate, setStmtDate] = useState(snapshot?.statement_date ?? today());
  const [dueDate, setDueDate] = useState(snapshot?.due_date ?? today());
  const [balDollars, setBalDollars] = useState(
    snapshot ? (snapshot.statement_balance_cents / 100).toFixed(2) : '',
  );
  const [minDollars, setMinDollars] = useState(
    snapshot ? (snapshot.min_payment_cents / 100).toFixed(2) : '',
  );
  const [paidInFull, setPaidInFull] = useState(snapshot?.paid_in_full === 1);

  useEffect(() => {
    if (snapshot) {
      setDebtId(snapshot.debt_id);
      setStmtDate(snapshot.statement_date);
      setDueDate(snapshot.due_date);
      setBalDollars((snapshot.statement_balance_cents / 100).toFixed(2));
      setMinDollars((snapshot.min_payment_cents / 100).toFixed(2));
      setPaidInFull(snapshot.paid_in_full === 1);
    }
  }, [snapshot]);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        debt_id: debtId,
        statement_date: stmtDate,
        due_date: dueDate,
        statement_balance_cents: Math.round(Number(balDollars) * 100),
        min_payment_cents: Math.round(Number(minDollars) * 100),
        paid_in_full: paidInFull ? 1 : 0,
      };
      if (mode === 'add') {
        await api.post('/api/cc-statements', body);
      } else if (snapshot) {
        await api.patch(`/api/cc-statements/${snapshot.id}`, body);
      }
    },
    onSuccess: () => onSaved(),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!snapshot) return;
      await api.del(`/api/cc-statements/${snapshot.id}`);
    },
    onSuccess: () => onSaved(),
  });

  const valid =
    !!debtId &&
    /^\d{4}-\d{2}-\d{2}$/.test(stmtDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(dueDate) &&
    Number(balDollars) >= 0 &&
    Number(minDollars) >= 0;

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="card w-full max-w-xl mx-auto stub-top flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">{mode === 'add' ? 'Add statement' : 'Edit statement'}</h2>

        <label className="field-label">Card</label>
        <select className="field" value={debtId} onChange={(e) => setDebtId(e.target.value)}>
          {ccDebts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <label className="field-label">Statement date</label>
        <input className="field" type="date" value={stmtDate} onChange={(e) => setStmtDate(e.target.value)} />

        <label className="field-label">Due date</label>
        <input className="field" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        <label className="field-label">Statement balance ($)</label>
        <input
          className="field num"
          inputMode="decimal"
          value={balDollars}
          onChange={(e) => setBalDollars(e.target.value)}
        />

        <label className="field-label">Min payment ($)</label>
        <input
          className="field num"
          inputMode="decimal"
          value={minDollars}
          onChange={(e) => setMinDollars(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={paidInFull}
            onChange={(e) => setPaidInFull(e.target.checked)}
          />
          Paid in full by due date
        </label>

        {save.error && (
          <p className="text-xs text-[color:var(--color-danger,#b00)]">{String(save.error)}</p>
        )}

        <div className="flex gap-2">
          <button className="btn-outline flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid}
          >
            {save.isPending ? 'Saving.' : 'Save'}
          </button>
        </div>
        {mode === 'edit' && (
          <button
            className="btn-outline text-[color:var(--color-danger,#b00)]"
            onClick={() => {
              if (confirm('Delete this statement?')) del.mutate();
            }}
            disabled={del.isPending}
          >
            {del.isPending ? 'Deleting.' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  );
}
