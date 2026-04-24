import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents, parseMoneyToCents } from '@declyne/shared';
import type { Account } from './Accounts';

interface Debt {
  id: string;
  name: string;
  principal_cents: number;
  interest_rate_bps: number;
  min_payment_type: 'fixed' | 'percent';
  min_payment_value: number;
  statement_date: number;
  payment_due_date: number;
  account_id_linked: string | null;
  archived: number;
}

interface Split {
  id: string;
  counterparty: string;
  direction: 'josh_owes' | 'owes_josh';
  remaining_cents: number;
  reason: string;
}

export default function Debts() {
  const [editing, setEditing] = useState<Debt | 'new' | null>(null);
  const [splitEditing, setSplitEditing] = useState<'new' | null>(null);
  const [settling, setSettling] = useState<Split | null>(null);
  const debts = useQuery({
    queryKey: ['debts'],
    queryFn: () => api.get<{ debts: Debt[] }>('/api/debts'),
  });
  const splits = useQuery({
    queryKey: ['splits'],
    queryFn: () => api.get<{ splits: Split[] }>('/api/splits'),
  });
  const accounts = useQuery({
    queryKey: ['accounts', false],
    queryFn: () => api.get<{ accounts: Account[] }>('/api/accounts'),
  });

  const qc = useQueryClient();
  const list = debts.data?.debts ?? [];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Debts</h1>
        <button className="btn-primary px-4 py-2 text-sm" onClick={() => setEditing('new')}>
          Add debt
        </button>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Balances</h2>
        {list.length === 0 && !debts.isLoading && (
          <div className="card">
            <p className="text-sm text-[color:var(--color-text-muted)]">No debts tracked.</p>
          </div>
        )}
        <ul className="flex flex-col gap-3">
          {list.map((d) => (
            <li key={d.id}>
              <DebtCard debt={d} onClick={() => setEditing(d)} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Splits</h2>
          <button className="btn-outline px-3 py-1 text-xs" onClick={() => setSplitEditing('new')}>
            Add split
          </button>
        </div>
        <div className="card flex flex-col gap-3">
          {splits.data?.splits.length === 0 && (
            <div className="text-sm text-[color:var(--color-text-muted)]">Nothing outstanding.</div>
          )}
          {splits.data?.splits.map((s) => (
            <button
              key={s.id}
              onClick={() => setSettling(s)}
              className="flex items-center justify-between text-left"
              aria-label={`Settle ${s.counterparty}`}
            >
              <div>
                <div>{s.counterparty}</div>
                <div className="text-xs text-[color:var(--color-text-muted)]">
                  {s.direction === 'josh_owes' ? 'You owe' : 'Owes you'} · {s.reason}
                </div>
              </div>
              <div
                className="num text-lg"
                style={{ color: s.direction === 'josh_owes' ? 'var(--color-danger)' : 'var(--color-ok)' }}
              >
                {formatCents(s.remaining_cents)}
              </div>
            </button>
          ))}
        </div>
      </section>

      {editing && (
        <DebtSheet
          initial={editing === 'new' ? null : editing}
          accounts={(accounts.data?.accounts ?? []).filter((a) => a.archived === 0)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['debts'] });
          }}
        />
      )}

      {splitEditing && (
        <SplitSheet
          onClose={() => setSplitEditing(null)}
          onSaved={() => {
            setSplitEditing(null);
            qc.invalidateQueries({ queryKey: ['splits'] });
          }}
        />
      )}

      {settling && (
        <SettleSheet
          split={settling}
          onClose={() => setSettling(null)}
          onSaved={() => {
            setSettling(null);
            qc.invalidateQueries({ queryKey: ['splits'] });
          }}
        />
      )}
    </div>
  );
}

function SplitSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [counterparty, setCounterparty] = useState('');
  const [direction, setDirection] = useState<'josh_owes' | 'owes_josh'>('josh_owes');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!counterparty.trim()) throw new Error('Counterparty required.');
      if (!reason.trim()) throw new Error('Reason required.');
      const amount_cents = parseMoneyToCents(amount);
      if (amount_cents <= 0) throw new Error('Amount must be greater than zero.');
      return api.post<{ id: string }>('/api/splits', {
        counterparty: counterparty.trim(),
        direction,
        amount_cents,
        reason: reason.trim(),
      });
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Add split"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-t-[16px] border border-[color:var(--color-hairline)] bg-[color:var(--color-bg-card)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add split</h2>
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
            <span className="field-label">Counterparty</span>
            <input
              className="field"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Lindsay"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Direction</span>
            <select
              className="field"
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'josh_owes' | 'owes_josh')}
            >
              <option value="josh_owes">You owe them</option>
              <option value="owes_josh">They owe you</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Amount ($)</span>
            <input
              className="field num"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Reason</span>
            <input
              className="field"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Mexico trip"
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
              {save.isPending ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SettleSheet({
  split,
  onClose,
  onSaved,
}: {
  split: Split;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const settle = useMutation({
    mutationFn: async (full: boolean) => {
      const payment_cents = full ? split.remaining_cents : parseMoneyToCents(amount);
      if (payment_cents <= 0) throw new Error('Amount must be greater than zero.');
      if (payment_cents > split.remaining_cents) throw new Error('Amount exceeds remaining.');
      return api.post<{ remaining_cents: number; closed: boolean }>(`/api/splits/${split.id}/event`, {
        delta_cents: -payment_cents,
        note: note.trim() || null,
      });
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  const verb = split.direction === 'josh_owes' ? 'Paid' : 'Received';

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Settle ${split.counterparty}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-t-[16px] border border-[color:var(--color-hairline)] bg-[color:var(--color-bg-card)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{split.counterparty}</h2>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              Remaining {formatCents(split.remaining_cents)} · {split.reason}
            </p>
          </div>
          <button className="text-[color:var(--color-text-muted)]" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            settle.mutate(false);
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="field-label">{verb} ($)</span>
            <input
              className="field num"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Note (optional)</span>
            <input
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="etransfer"
            />
          </label>

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn-outline flex-1"
              onClick={() => {
                setError(null);
                settle.mutate(true);
              }}
              disabled={settle.isPending}
            >
              Settle full
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={settle.isPending}>
              {settle.isPending ? 'Saving…' : 'Log payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DebtCard({ debt, onClick }: { debt: Debt; onClick: () => void }) {
  const rate = (debt.interest_rate_bps / 100).toFixed(2);
  const min =
    debt.min_payment_type === 'fixed'
      ? formatCents(debt.min_payment_value)
      : `${(debt.min_payment_value / 100).toFixed(2)}%`;
  return (
    <button
      onClick={onClick}
      className="receipt relative block w-full text-left"
      aria-label={`Edit ${debt.name}`}
    >
      <span className="stub stub-top" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
            {rate}% APR · min {min} · stmt {debt.statement_date} · due {debt.payment_due_date}
          </div>
          <div className="mt-1 truncate text-base font-semibold">{debt.name}</div>
        </div>
        <div className="num text-lg shrink-0">{formatCents(debt.principal_cents)}</div>
      </div>
      <span className="stub stub-bottom" aria-hidden />
    </button>
  );
}

function DebtSheet({
  initial,
  accounts,
  onClose,
  onSaved,
}: {
  initial: Debt | null;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [principal, setPrincipal] = useState(
    initial ? (initial.principal_cents / 100).toFixed(2) : '',
  );
  const [rate, setRate] = useState(
    initial ? (initial.interest_rate_bps / 100).toFixed(2) : '',
  );
  const [minType, setMinType] = useState<'fixed' | 'percent'>(
    initial?.min_payment_type ?? 'fixed',
  );
  const [minValue, setMinValue] = useState(
    initial ? (initial.min_payment_value / 100).toFixed(2) : '',
  );
  const [statementDate, setStatementDate] = useState(String(initial?.statement_date ?? 1));
  const [dueDate, setDueDate] = useState(String(initial?.payment_due_date ?? 21));
  const [linkedAccount, setLinkedAccount] = useState(initial?.account_id_linked ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Name required.');
      const principal_cents = parseMoneyToCents(principal);
      if (principal_cents < 0) throw new Error('Principal cannot be negative.');
      const interest_rate_bps = Math.round(Number(rate) * 100);
      if (!Number.isFinite(interest_rate_bps) || interest_rate_bps < 0) {
        throw new Error('Interest rate must be a non-negative number.');
      }
      const min_payment_value =
        minType === 'fixed'
          ? parseMoneyToCents(minValue)
          : Math.round(Number(minValue) * 100);
      if (!Number.isFinite(min_payment_value) || min_payment_value < 0) {
        throw new Error('Minimum payment must be non-negative.');
      }
      const stmt = Number(statementDate);
      const due = Number(dueDate);
      if (!inRange(stmt, 1, 31) || !inRange(due, 1, 31)) {
        throw new Error('Dates must be between 1 and 31.');
      }
      const body = {
        name: name.trim(),
        principal_cents,
        interest_rate_bps,
        min_payment_type: minType,
        min_payment_value,
        statement_date: stmt,
        payment_due_date: due,
        account_id_linked: linkedAccount || null,
      };
      if (initial) return api.patch<{ ok: true }>(`/api/debts/${initial.id}`, body);
      return api.post<{ id: string }>('/api/debts', body);
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  const archive = useMutation({
    mutationFn: async () => {
      if (!initial) return;
      return api.patch<{ ok: true }>(`/api/debts/${initial.id}`, { archived: 1 });
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? 'Edit debt' : 'Add debt'}
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-[16px] border border-[color:var(--color-hairline)] bg-[color:var(--color-bg-card)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? 'Edit debt' : 'Add debt'}</h2>
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
              placeholder="TD Visa"
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="field-label">Principal ($)</span>
              <input
                className="field num"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="field-label">Rate (%)</span>
              <input
                className="field num"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                placeholder="19.99"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="field-label">Min payment type</span>
              <select
                className="field"
                value={minType}
                onChange={(e) => setMinType(e.target.value as 'fixed' | 'percent')}
              >
                <option value="fixed">Fixed ($)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="field-label">Min value {minType === 'fixed' ? '($)' : '(%)'}</span>
              <input
                className="field num"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                inputMode="decimal"
                placeholder={minType === 'fixed' ? '50.00' : '3.00'}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="field-label">Statement day</span>
              <input
                className="field num"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="field-label">Due day</span>
              <input
                className="field num"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                inputMode="numeric"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="field-label">Linked account (optional)</span>
            <select
              className="field"
              value={linkedAccount ?? ''}
              onChange={(e) => setLinkedAccount(e.target.value)}
            >
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.institution} — {a.name}
                </option>
              ))}
            </select>
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

          {initial && (
            <button
              type="button"
              className="btn-outline mt-2 text-sm"
              style={{ color: 'var(--color-danger)' }}
              onClick={() => {
                if (confirm(`Archive ${initial.name}? Balance stays on the ledger for history.`)) {
                  archive.mutate();
                }
              }}
            >
              Archive debt
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function inRange(n: number, lo: number, hi: number): boolean {
  return Number.isFinite(n) && n >= lo && n <= hi;
}
