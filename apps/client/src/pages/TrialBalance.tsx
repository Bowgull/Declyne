import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
};

type TbLine = {
  account_id: string;
  path: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  debit_cents: number;
  credit_cents: number;
  balance_cents: number;
};

type TbResponse = {
  as_of: string | null;
  lines: TbLine[];
  totals: { debit_cents: number; credit_cents: number; delta_cents: number };
};

type CloseRow = {
  id: string;
  period_start: string;
  period_end: string;
  closed_at: string;
  closed_by: 'user' | 'auto' | 'system';
  trial_balance_debits_cents: number;
  trial_balance_credits_cents: number;
};

export default function TrialBalance() {
  const qc = useQueryClient();
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  const tb = useQuery({
    queryKey: ['trial-balance'],
    queryFn: () => api.get<TbResponse>('/api/gl/trial-balance'),
  });
  const closes = useQuery({
    queryKey: ['period-close'],
    queryFn: () => api.get<{ closes: CloseRow[] }>('/api/gl/period-close'),
  });

  const closeWeek = useMutation({
    mutationFn: () => api.post<{ ok: true; period_end: string; already: boolean }>('/api/gl/period-close', {}),
    onSuccess: (out) => {
      setCloseMsg(out.already ? `already closed: ${out.period_end}` : `closed week ending ${out.period_end}`);
      qc.invalidateQueries({ queryKey: ['period-close'] });
      qc.invalidateQueries({ queryKey: ['trial-balance'] });
    },
    onError: (err) => setCloseMsg(err instanceof Error ? err.message : 'close failed'),
  });

  const lines = tb.data?.lines ?? [];
  const totals = tb.data?.totals ?? { debit_cents: 0, credit_cents: 0, delta_cents: 0 };
  const balanced = totals.delta_cents === 0;

  // Group by type for display.
  const byType = lines.reduce<Record<string, TbLine[]>>((acc, l) => {
    (acc[l.type] ??= []).push(l);
    return acc;
  }, {});
  const TYPE_ORDER: TbLine['type'][] = ['asset', 'liability', 'equity', 'income', 'expense'];
  const TYPE_LABEL: Record<TbLine['type'], string> = {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    income: 'Income',
    expense: 'Expenses',
  };

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-sigil" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">TRIAL BALANCE</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {tb.data ? `${lines.length} accounts` : 'Loading…'}
              </div>
            </div>
          </div>
          <Link to="/settings" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Close
          </Link>
        </header>

        <div className="pt-3 flex flex-col gap-2" style={perforation}>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            <span>Debits</span>
            <span className="font-mono">{formatCents(totals.debit_cents)}</span>
          </div>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            <span>Credits</span>
            <span className="font-mono">{formatCents(totals.credit_cents)}</span>
          </div>
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">Delta</span>
            <span className={`font-mono text-base ${balanced ? '' : 'text-[color:var(--cat-indulgence)]'}`}>
              {balanced ? '$0.00 — equal' : formatCents(totals.delta_cents)}
            </span>
          </div>
        </div>

        <div className="pt-3" style={perforation}>
          <button
            className="stamp stamp-square w-full"
            disabled={!balanced || closeWeek.isPending}
            onClick={() => closeWeek.mutate()}
          >
            {closeWeek.isPending ? 'Closing…' : 'Close this week'}
          </button>
          {!balanced && (
            <div className="text-[11px] text-center pt-2 text-[color:var(--cat-indulgence)] uppercase tracking-[0.18em]">
              books are unbalanced; close refused
            </div>
          )}
          {closeMsg && (
            <div className="text-[11px] text-center pt-2 text-[color:var(--color-text-muted)] uppercase tracking-[0.18em]">
              {closeMsg}
            </div>
          )}
        </div>

        {TYPE_ORDER.map((t) => {
          const rows = byType[t] ?? [];
          if (rows.length === 0) return null;
          const subtotal = rows.reduce((s, r) => s + r.balance_cents, 0);
          return (
            <div key={t} className="pt-3 flex flex-col gap-2" style={perforation}>
              <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                <span>{TYPE_LABEL[t]}</span>
                <span className="font-mono">{formatCents(subtotal)}</span>
              </div>
              {rows.map((r) => (
                <div key={r.account_id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{r.path}</span>
                  <span className="font-mono shrink-0">{formatCents(r.balance_cents)}</span>
                </div>
              ))}
            </div>
          );
        })}

        <div className="pt-3 flex flex-col gap-2" style={perforation}>
          <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            <span>Recent closes</span>
            <span>{closes.data ? `${closes.data.closes.length}` : '—'}</span>
          </div>
          {(closes.data?.closes ?? []).slice(0, 8).map((c) => (
            <div key={c.id} className="flex justify-between text-sm">
              <span>{c.period_start} → {c.period_end}</span>
              <span className="font-mono text-[color:var(--color-text-muted)] text-xs uppercase tracking-[0.14em]">
                {c.closed_by}
              </span>
            </div>
          ))}
          {closes.data && closes.data.closes.length === 0 && (
            <div className="text-xs text-center text-[color:var(--color-text-muted)] py-2">
              no closed periods yet
            </div>
          )}
        </div>

        <div className="pt-2 text-center text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
          ** end of trial **
        </div>
      </section>
    </div>
  );
}
