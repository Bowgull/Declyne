import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import { dismissFollowUpThisWeek } from '../native/notifications';

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
};

type Txn = {
  id: string;
  posted_at: string;
  amount_cents: number;
  description_raw: string;
  merchant_name: string;
  account_name: string;
  category_name: string | null;
  category_group: string | null;
};

type WeekResponse = {
  week_starts_on: string;
  today: string;
  completed_this_week: boolean;
  last_reconciliation_at: string | null;
  reconciliation_streak: number;
  totals: {
    income_cents: number;
    essentials_cents: number;
    lifestyle_cents: number;
    indulgence_cents: number;
    debt_cents: number;
    transfer_cents: number;
    uncategorized_cents: number;
    count: number;
  };
  transactions: Txn[];
};

type TabSplit = {
  id: string;
  direction: 'they_owe' | 'i_owe';
  remaining_cents: number;
  created_at: string;
  reason: string;
  counterparty_name: string;
};

type TabCandidate = {
  id: string;
  posted_at: string;
  amount_cents: number;
  description_raw: string;
  account_name: string;
};

type TabsResponse = {
  tabs: Array<{ split: TabSplit; candidates: TabCandidate[] }>;
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return `${dayNames[d.getUTCDay()]} ${iso.slice(8, 10)}`;
}

function fmtRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const month = s.toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' });
  const monthEnd = e.toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' });
  if (month === monthEnd) {
    return `${month} ${s.getUTCDate()}–${e.getUTCDate()}`;
  }
  return `${month} ${s.getUTCDate()} – ${monthEnd} ${e.getUTCDate()}`;
}

export default function Reconciliation() {
  const qc = useQueryClient();
  const week = useQuery({
    queryKey: ['reconciliation-week'],
    queryFn: () => api.get<WeekResponse>('/api/reconciliation/week'),
  });

  const tabs = useQuery({
    queryKey: ['reconciliation-tabs-to-match'],
    queryFn: () => api.get<TabsResponse>('/api/reconciliation/tabs-to-match'),
  });

  const matchTab = useMutation({
    mutationFn: ({ split_id, transaction_id }: { split_id: string; transaction_id: string }) =>
      api.post<{ ok: true }>(`/api/reconciliation/tabs-to-match/${split_id}/match`, { transaction_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation-tabs-to-match'] });
      qc.invalidateQueries({ queryKey: ['splits'] });
      qc.invalidateQueries({ queryKey: ['counterparties'] });
    },
  });

  const complete = useMutation({
    mutationFn: () => api.post<{ ok: true; reconciliation_streak: number }>('/api/reconciliation/complete', {}),
    onSuccess: async () => {
      await dismissFollowUpThisWeek().catch(() => {});
      qc.invalidateQueries({ queryKey: ['reconciliation-week'] });
      qc.invalidateQueries({ queryKey: ['reconciliation-status'] });
    },
  });

  if (!week.data) {
    return (
      <div className="pb-6">
        <section className="receipt stub-top stub-bottom">
          <div className="text-center text-sm text-[color:var(--color-text-muted)]">Loading…</div>
        </section>
      </div>
    );
  }

  const w = week.data;
  const txns = w.transactions;
  const totals = w.totals;

  // Group transactions by date for receipt sections.
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    const day = t.posted_at.slice(0, 10);
    const arr = groups.get(day) ?? [];
    arr.push(t);
    groups.set(day, arr);
  }
  const orderedDays = Array.from(groups.keys()).sort();

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-sigil" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">RECONCILIATION</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                Week of {fmtRange(w.week_starts_on, w.today)}
              </div>
            </div>
          </div>
          <Link to="/today" aria-label="Back" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Close
          </Link>
        </header>

        <div className="pt-3" style={perforation}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">Streak</div>
            <div className="num text-base">
              {w.reconciliation_streak} {w.reconciliation_streak === 1 ? 'wk' : 'wks'}
            </div>
          </div>
          <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            {w.completed_this_week
              ? 'This week is sealed.'
              : w.last_reconciliation_at
                ? `Last sealed ${new Date(w.last_reconciliation_at).toLocaleDateString('en-CA')}.`
                : 'No completions yet.'}
          </div>
        </div>

        <div className="pt-3" style={perforation}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-2">
            Summary
          </div>
          <SummaryRow label="Income" value={totals.income_cents} sign="in" hue="income" />
          <SummaryRow label="Essentials" value={totals.essentials_cents} sign="out" hue="essentials" />
          <SummaryRow label="Lifestyle" value={totals.lifestyle_cents} sign="out" hue="lifestyle" />
          <SummaryRow label="Indulgence" value={totals.indulgence_cents} sign="out" hue="indulgence" />
          <SummaryRow label="Debt" value={totals.debt_cents} sign="out" hue="debt" />
          {totals.transfer_cents > 0 && (
            <SummaryRow label="Transfer" value={totals.transfer_cents} sign="out" hue="savings" />
          )}
          {totals.uncategorized_cents > 0 && (
            <SummaryRow label="Uncategorized" value={totals.uncategorized_cents} sign="out" hue="uncategorized" />
          )}
          <div className="mt-2 flex items-baseline justify-between text-xs uppercase tracking-[0.14em]">
            <span className="text-[color:var(--color-text-muted)]">Net</span>
            <span className="num">
              {formatCents(
                totals.income_cents -
                  totals.essentials_cents -
                  totals.lifestyle_cents -
                  totals.indulgence_cents -
                  totals.debt_cents -
                  totals.transfer_cents -
                  totals.uncategorized_cents,
              )}
            </span>
          </div>
        </div>

        {tabs.data && tabs.data.tabs.length > 0 && (
          <div className="pt-3" style={perforation}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-2">
              Tabs to match ({tabs.data.tabs.length})
            </div>
            <div className="text-[11px] text-[color:var(--color-text-muted)] mb-3">
              Multiple transactions match these open tabs. Pick the one that settled it.
            </div>
            <div className="flex flex-col gap-4">
              {tabs.data.tabs.map(({ split, candidates }) => (
                <TabToMatch
                  key={split.id}
                  split={split}
                  candidates={candidates}
                  pending={matchTab.isPending && matchTab.variables?.split_id === split.id}
                  onMatch={(transaction_id) => matchTab.mutate({ split_id: split.id, transaction_id })}
                />
              ))}
            </div>
          </div>
        )}

        <div className="pt-3" style={perforation}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-2">
            Line items ({totals.count})
          </div>
          {totals.count === 0 ? (
            <div className="text-xs text-[color:var(--color-text-muted)]">
              Nothing posted yet this week.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orderedDays.map((day) => (
                <div key={day}>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)] mb-1">
                    {dayLabel(day)}
                  </div>
                  <div className="flex flex-col gap-1">
                    {groups.get(day)!.map((t) => (
                      <LineItem key={t.id} t={t} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 flex flex-col gap-2" style={perforation}>
          {w.completed_this_week ? (
            <div className="text-center text-xs uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">
              Sealed {w.last_reconciliation_at ? new Date(w.last_reconciliation_at).toLocaleDateString('en-CA') : ''}
            </div>
          ) : (
            <button
              className="btn-primary"
              onClick={() => complete.mutate()}
              disabled={complete.isPending}
            >
              {complete.isPending ? 'Sealing…' : 'I kept the receipts'}
            </button>
          )}
        </div>

        <div className="pt-3 text-center text-[11px] uppercase tracking-[0.32em] text-[color:var(--color-text-muted)]" style={perforation}>
          ** End of week **
        </div>
      </section>
    </div>
  );
}

type Hue = 'income' | 'essentials' | 'lifestyle' | 'indulgence' | 'debt' | 'savings' | 'uncategorized';

function hueFor(group: string | null): Hue {
  switch (group) {
    case 'income':
      return 'income';
    case 'essentials':
      return 'essentials';
    case 'lifestyle':
      return 'lifestyle';
    case 'indulgence':
      return 'indulgence';
    case 'debt':
      return 'debt';
    case 'transfer':
      return 'savings';
    default:
      return 'uncategorized';
  }
}

function SummaryRow({
  label,
  value,
  sign,
  hue,
}: {
  label: string;
  value: number;
  sign: 'in' | 'out';
  hue: Hue;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-sm flex items-center gap-2">
        <span className={`cat-dot ${hue}`} />
        {label}
      </span>
      <span className="num text-sm">
        {sign === 'in' ? '+' : '−'}
        {formatCents(value)}
      </span>
    </div>
  );
}

function TabToMatch({
  split,
  candidates,
  pending,
  onMatch,
}: {
  split: TabSplit;
  candidates: TabCandidate[];
  pending: boolean;
  onMatch: (transaction_id: string) => void;
}) {
  const directionLabel = split.direction === 'they_owe' ? 'owes you' : 'you owe';
  const hue = split.direction === 'they_owe' ? 'savings' : 'indulgence';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <span className={`cat-dot ${hue}`} />
          <div className="min-w-0">
            <div className="truncate text-sm">{split.counterparty_name}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              {directionLabel} · {split.reason}
            </div>
          </div>
        </div>
        <div className="num text-sm shrink-0">{formatCents(split.remaining_cents)}</div>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {candidates.map((t) => (
          <button
            key={t.id}
            disabled={pending}
            onClick={() => onMatch(t.id)}
            className="row-tap flex items-baseline justify-between gap-3 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs">{t.description_raw}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
                {t.posted_at.slice(0, 10)} · {t.account_name}
              </div>
            </div>
            <div className="num text-xs shrink-0">
              {t.amount_cents > 0 ? '+' : '−'}
              {formatCents(Math.abs(t.amount_cents))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LineItem({ t }: { t: Txn }) {
  const isIncome = t.amount_cents > 0;
  const hue = hueFor(t.category_group);
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        <span className={`cat-dot ${hue}`} style={{ marginTop: 4 }} />
        <div className="min-w-0 flex-1">
          <div className="truncate">{t.merchant_name}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
            {t.account_name}
            {t.category_name ? ` · ${t.category_name}` : ' · uncategorized'}
          </div>
        </div>
      </div>
      <div className="num shrink-0">
        {isIncome ? '+' : '−'}
        {formatCents(Math.abs(t.amount_cents))}
      </div>
    </div>
  );
}
