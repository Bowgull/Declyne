import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import { dismissFollowUpThisWeek } from '../native/notifications';
import { SealArt } from '../components/PostageArt';
import { glyphForCategory } from '../lib/rowGlyph';

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

type AccountReconciliation = {
  account_id: string;
  path: string;
  name: string;
  type: 'asset' | 'liability';
  summary: {
    gl_balance_cents: number;
    cleared_balance_cents: number;
    uncleared_count: number;
    uncleared_cents: number;
  };
  uncleared_lines: Array<{
    id: string;
    journal_entry_id: string;
    posted_at: string;
    debit_cents: number;
    credit_cents: number;
    source_type: string | null;
    memo: string | null;
  }>;
};

type AccountsResponse = {
  week_starts_on: string;
  today: string;
  accounts: AccountReconciliation[];
};

type MissedInstallment = {
  id: string;
  label: string;
  planned_cents: number;
  committed_at: string | null;
  plan_id: string;
  period_id: string;
  start_date: string;
  end_date: string;
};

type MissedResponse = {
  today: string;
  count: number;
  total_cents: number;
  installments: MissedInstallment[];
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

  const accounts = useQuery({
    queryKey: ['reconciliation-accounts'],
    queryFn: () => api.get<AccountsResponse>('/api/reconciliation/accounts'),
  });

  const missed = useQuery({
    queryKey: ['reconciliation-missed-installments'],
    queryFn: () => api.get<MissedResponse>('/api/reconciliation/missed-installments'),
  });

  const clearLine = useMutation({
    mutationFn: (line_id: string) =>
      api.post<{ ok: true }>(`/api/reconciliation/lines/${line_id}/clear`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation-accounts'] });
    },
  });

  const unclearLine = useMutation({
    mutationFn: (line_id: string) =>
      api.post<{ ok: true }>(`/api/reconciliation/lines/${line_id}/unclear`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation-accounts'] });
    },
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
    mutationFn: (acknowledge_outstanding: boolean) =>
      api.post<{ ok: true; reconciliation_streak: number; acknowledged_outstanding?: boolean }>(
        '/api/reconciliation/complete',
        { acknowledge_outstanding },
      ),
    onSuccess: async () => {
      await dismissFollowUpThisWeek().catch(() => {});
      qc.invalidateQueries({ queryKey: ['reconciliation-week'] });
      qc.invalidateQueries({ queryKey: ['reconciliation-status'] });
      qc.invalidateQueries({ queryKey: ['reconciliation-accounts'] });
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

  const totalUncleared = (accounts.data?.accounts ?? []).reduce(
    (sum, a) => sum + a.summary.uncleared_count,
    0,
  );

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

        {missed.data && missed.data.count > 0 && (
          <div className="pt-3" style={perforation}>
            <div
              className="text-[11px] uppercase tracking-[0.18em] mb-2"
              style={{ color: 'var(--cat-indulgence)' }}
            >
              Missed installments ({missed.data.count})
            </div>
            <div className="text-[11px] text-[color:var(--color-text-muted)] mb-3">
              Past pay periods committed a payoff plan but these installments were never marked paid.
            </div>
            <div className="flex flex-col gap-1">
              {missed.data.installments.map((m) => (
                <Link
                  key={m.id}
                  to="/budget/plan"
                  className="row-tap flex items-baseline justify-between gap-3 text-left"
                >
                  <div className="min-w-0 flex-1 flex items-baseline gap-2">
                    <span className="cat-dot debt" />
                    <div className="min-w-0">
                      <div className="truncate text-sm">{m.label}</div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
                        period ended {m.end_date}
                      </div>
                    </div>
                  </div>
                  <span
                    className="num text-sm shrink-0"
                    style={{ color: 'var(--cat-indulgence)' }}
                  >
                    {formatCents(m.planned_cents)}
                  </span>
                </Link>
              ))}
              <div className="mt-2 flex items-baseline justify-between text-xs uppercase tracking-[0.14em]">
                <span className="text-[color:var(--color-text-muted)]">Outstanding</span>
                <span className="num" style={{ color: 'var(--cat-indulgence)' }}>
                  {formatCents(missed.data.total_cents)}
                </span>
              </div>
            </div>
          </div>
        )}

        {accounts.data && accounts.data.accounts.length > 0 && (
          <div className="pt-3" style={perforation}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] mb-2">
              Accounts ({accounts.data.accounts.length})
            </div>
            <div className="text-[11px] text-[color:var(--color-text-muted)] mb-3">
              Mark each posted line as cleared once you see it on the statement.
            </div>
            <div className="flex flex-col gap-4">
              {accounts.data.accounts.map((a) => (
                <AccountRec
                  key={a.account_id}
                  acct={a}
                  pendingClearId={clearLine.isPending ? (clearLine.variables as string | undefined) : undefined}
                  onClear={(id) => clearLine.mutate(id)}
                />
              ))}
            </div>
          </div>
        )}

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
            <div className="flex flex-col items-center gap-2 pt-2 pb-1">
              {totalUncleared > 0 && (
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                  {totalUncleared} uncleared {totalUncleared === 1 ? 'line' : 'lines'} · seal acknowledges them outstanding
                </div>
              )}
              <button
                className="postage"
                onClick={() => complete.mutate(totalUncleared > 0)}
                disabled={complete.isPending}
                style={{ opacity: complete.isPending ? 0.5 : 1 }}
              >
                <span className="postage-denom">SEAL</span>
                <span className="postage-art"><SealArt /></span>
                <span className="postage-label">
                  {complete.isPending ? 'Sealing.' : <>I kept<br />the receipts</>}
                </span>
              </button>
            </div>
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

function AccountRec({
  acct,
  pendingClearId,
  onClear,
}: {
  acct: AccountReconciliation;
  pendingClearId: string | undefined;
  onClear: (id: string) => void;
}) {
  const hue = acct.type === 'asset' ? 'income' : 'debt';
  const reconciled = acct.summary.uncleared_count === 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <span className={`cat-dot ${hue}`} />
          <div className="min-w-0">
            <div className="truncate text-sm">{acct.path}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
              GL {formatCents(acct.summary.gl_balance_cents)} · cleared {formatCents(acct.summary.cleared_balance_cents)}
            </div>
          </div>
        </div>
        <div
          className="text-[10px] uppercase tracking-[0.18em] shrink-0"
          style={{ color: reconciled ? 'var(--cat-savings)' : 'var(--cat-indulgence)' }}
        >
          {reconciled ? 'reconciled' : `${acct.summary.uncleared_count} uncleared`}
        </div>
      </div>
      {acct.uncleared_lines.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {acct.uncleared_lines.map((l) => {
            const debit = l.debit_cents > 0;
            const amount = debit ? l.debit_cents : l.credit_cents;
            const pending = pendingClearId === l.id;
            return (
              <button
                key={l.id}
                disabled={pending}
                onClick={() => onClear(l.id)}
                className="row-tap flex items-baseline justify-between gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{l.memo || l.source_type || 'journal entry'}</div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
                    {l.posted_at.slice(0, 10)} · tap to clear
                  </div>
                </div>
                <div className="num text-xs shrink-0">
                  {debit ? 'DR' : 'CR'} {formatCents(amount)}
                </div>
              </button>
            );
          })}
        </div>
      )}
      {acct.uncleared_lines.length === 0 && acct.summary.gl_balance_cents !== 0 && (
        <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]">
          No uncleared lines this week. Clear history at <Link to="/settings/edit-log?entity_type=journal_line" className="underline">audit log</Link>.
        </div>
      )}
    </div>
  );
}

function LineItem({ t }: { t: Txn }) {
  const isIncome = t.amount_cents > 0;
  const hue = hueFor(t.category_group);
  const glyph = glyphForCategory(t.category_group, t.amount_cents);
  const tone =
    glyph === '+' ? 'income' : glyph === '▸' ? 'debt' : glyph === '?' ? 'muted' : '';
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <div className="min-w-0 flex-1 flex items-baseline gap-2">
        <span className={`row-glyph${tone ? ' ' + tone : ''}`}>{glyph}</span>
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
