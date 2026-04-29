import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import ImportCsvButton from '../components/ImportCsvButton';
import LedgerHeader from '../components/LedgerHeader';
import Constellation, { type ConstellationBubble, type ConstellationCategory } from '../components/Constellation';

type CommittedSource = 'bill' | 'debt_min' | 'savings_goal' | 'savings_recurring';
interface CommittedLine {
  source: CommittedSource;
  label: string;
  amount_cents: number;
  due_date?: string;
  ref_id?: string;
}
interface PaycheckSnapshot {
  period: { id: string; start_date: string; end_date: string };
  paycheque_cents: number;
  committed: {
    bills_cents: number;
    debt_mins_cents: number;
    savings_cents: number;
    total_cents: number;
    lines: CommittedLine[];
  };
  available_for_debt_extra_cents: number;
  spending_money_cents: number;
  spent_so_far_cents: number;
}

interface PlanAllocation {
  debt_id: string;
  debt_name: string;
  role: 'priority' | 'avalanche' | 'min';
  amount_cents: number;
}
interface PlanResp {
  plan: {
    capacity_cents: number;
    savings_cents: number;
    next_paycheque_allocations: PlanAllocation[];
  };
}

interface MerchantRow {
  id: string;
  display_name: string;
  category_group: string | null;
  spend_90d_cents: number;
  txn_count: number;
}

interface Subscription {
  merchant_id: string;
  merchant_name: string;
  amount_cents: number;
  category_group: string;
  cadence_days: number;
  months_running: number;
}

interface Counterparty {
  id: string;
  name: string;
  net_cents: number;
  direction: 'owes_you' | 'you_owe' | 'settled';
  open_tab_count: number;
}

interface SpendHistoryRow {
  id: string;
  start_date: string;
  end_date: string;
  paycheque_cents: number;
  by_group: Record<string, number>;
}
interface PeriodSurplusRow {
  id: string;
  start_date: string;
  end_date: string;
  income_cents: number;
  expense_cents: number;
  surplus_cents: number;
}

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const m = (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).toUpperCase();
  return `${m(s)} → ${m(e)}`;
}

function daysUntil(iso: string): number {
  const end = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / 86400000));
}

function fmtCompact(cents: number): string {
  const a = Math.abs(cents);
  if (a >= 100000) return `$${Math.round(a / 100).toLocaleString('en-CA')}`;
  return `$${(a / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function categoryFromGroup(group: string | null | undefined): ConstellationCategory {
  if (group === 'lifestyle' || group === 'indulgence' || group === 'essentials' || group === 'debt' || group === 'savings' || group === 'income') {
    return group;
  }
  return 'lifestyle';
}

function moneyMapBubbles(snapshot: PaycheckSnapshot | null, plan: PlanResp['plan'] | null): ConstellationBubble[] {
  const out: ConstellationBubble[] = [];
  if (snapshot) {
    for (const line of snapshot.committed.lines) {
      let category: ConstellationCategory;
      let to: string | undefined;
      if (line.source === 'bill') {
        category = 'essentials';
        to = '/paycheque/forecast';
      } else if (line.source === 'debt_min') {
        category = 'debt';
        to = '/paycheque/plan';
      } else {
        category = 'savings';
        to = '/goals';
      }
      out.push({
        id: `${line.source}-${line.ref_id ?? line.label}`,
        label: line.label,
        amount_cents: line.amount_cents,
        category,
        to,
      });
    }
  }
  if (plan) {
    const extras = plan.next_paycheque_allocations.filter((a) => a.role !== 'min');
    const byDebt = new Map<string, { name: string; cents: number }>();
    for (const a of extras) {
      const cur = byDebt.get(a.debt_id) ?? { name: a.debt_name, cents: 0 };
      cur.cents += a.amount_cents;
      byDebt.set(a.debt_id, cur);
    }
    for (const [id, v] of byDebt) {
      if (v.cents <= 0) continue;
      out.push({
        id: `extra-${id}`,
        label: `→ ${v.name}`,
        amount_cents: v.cents,
        category: 'debt',
        to: '/paycheque/plan',
        hint: 'recommended',
      });
    }
  }
  return out;
}

export default function Budget() {
  const qc = useQueryClient();

  const paycheque = useQuery({
    queryKey: ['paycheque-snapshot'],
    queryFn: () => api.get<{ snapshot: PaycheckSnapshot | null }>('/api/paycheque'),
  });
  const plan = useQuery({
    queryKey: ['plan'],
    queryFn: () => api.get<PlanResp>('/api/plan'),
  });
  const merchants = useQuery({
    queryKey: ['merchants', 'habits'],
    queryFn: () => api.get<{ merchants: MerchantRow[] }>('/api/merchants?limit=200'),
  });
  const subscriptions = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.get<{ subscriptions: Subscription[] }>('/api/budget/subscriptions'),
  });
  const counterparties = useQuery({
    queryKey: ['counterparties'],
    queryFn: () => api.get<{ counterparties: Counterparty[] }>('/api/counterparties'),
  });
  const spendHistory = useQuery({
    queryKey: ['budget-spend-history'],
    queryFn: () => api.get<{ rows: SpendHistoryRow[] }>('/api/budget/history?periods=6'),
  });
  const periodHistory = useQuery({
    queryKey: ['periods-history'],
    queryFn: () => api.get<{ rows: PeriodSurplusRow[] }>('/api/periods/history?limit=8'),
  });

  const draft = useMutation({
    mutationFn: () => api.post<{ inserted: number }>('/api/allocations/draft'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paycheque-snapshot'] });
      qc.invalidateQueries({ queryKey: ['plan'] });
    },
  });

  const snapshot = paycheque.data?.snapshot ?? null;
  const planData = plan.data?.plan ?? null;
  const period = snapshot?.period ?? null;

  const paychequeCents = snapshot?.paycheque_cents ?? 0;
  const committedTotal = snapshot?.committed.total_cents ?? 0;
  const planExtras = planData
    ? planData.next_paycheque_allocations
        .filter((a) => a.role !== 'min')
        .reduce((s, a) => s + a.amount_cents, 0)
    : 0;
  const totalPlanned = committedTotal + planExtras;
  const free = Math.max(0, paychequeCents - totalPlanned);

  const moneyBubbles = moneyMapBubbles(snapshot, planData);

  const habitsMerchants = (merchants.data?.merchants ?? [])
    .filter((m) => m.spend_90d_cents > 0)
    .filter((m) => m.category_group === 'lifestyle' || m.category_group === 'indulgence')
    .slice(0, 8);
  const habitsBubbles: ConstellationBubble[] = habitsMerchants.map((m) => ({
    id: `m-${m.id}`,
    label: m.display_name,
    amount_cents: m.spend_90d_cents,
    category: categoryFromGroup(m.category_group),
    to: '/settings/merchants',
    hint: '90d',
  }));
  const habitsTotal = habitsMerchants.reduce((s, m) => s + m.spend_90d_cents, 0);

  const subs = subscriptions.data?.subscriptions ?? [];
  const subsBubbles: ConstellationBubble[] = subs.slice(0, 12).map((s) => ({
    id: `s-${s.merchant_id}`,
    label: s.merchant_name,
    amount_cents: s.amount_cents,
    category: categoryFromGroup(s.category_group),
    to: '/paycheque/subscriptions',
  }));
  const subsMonthly = subs.reduce(
    (acc, s) => acc + Math.round((s.amount_cents * 30) / Math.max(1, s.cadence_days)),
    0,
  );

  const openTabs = (counterparties.data?.counterparties ?? []).filter((c) => c.direction !== 'settled');
  const spendHistoryRows = spendHistory.data?.rows ?? [];
  const periodHistoryRows = periodHistory.data?.rows ?? [];

  const subtitle = period ? fmtRange(period.start_date, period.end_date) : 'No paycheque yet';
  const daysLeft = period ? daysUntil(period.end_date) : 0;

  return (
    <div className="ledger-page flex flex-col gap-6 pb-8">
      <LedgerHeader
        kicker="This paycheque"
        title={subtitle}
        subtitle={period ? `${daysLeft}d left · ${fmtCompact(free)} free` : undefined}
        action={<ImportCsvButton />}
      />

      {!period && (
        <section className="card">
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Import a paycheque to see where it goes.
          </p>
        </section>
      )}

      {period && (
        <section className="ledger-section pt-2">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>01</span> Where it goes
          </span>
          <span className="ledger-section-meta">tap a bubble &rsaquo;</span>
          <div className="pt-3">
            <Constellation
              mode="centered"
              bubbles={moneyBubbles}
              center={{
                primary: fmtCompact(paychequeCents),
                secondary: 'PAYCHEQUE',
              }}
              empty="Nothing committed yet · draft below"
              footerLeft={`COMMITTED ${fmtCompact(totalPlanned)}`}
              footerRight={`FREE ${fmtCompact(free)}`}
              height={400}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
            <button
              type="button"
              className="draft-stamp"
              onClick={() => draft.mutate()}
              disabled={draft.isPending}
            >
              {draft.isPending ? 'drafting…' : 'draft paycheque'}
            </button>
          </div>
        </section>
      )}

      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>02</span> Books
        </span>
        <Link to="/paycheque/pl" className="ledger-row tap">
          <div className="ledger-row-main">
            <span className="ledger-row-label">Income statement</span>
            <span className="ledger-row-hint">Income · expenses · surplus</span>
          </div>
          <span className="ledger-row-chevron">&rsaquo;</span>
        </Link>
        <Link to="/paycheque/net-worth" className="ledger-row tap">
          <div className="ledger-row-main">
            <span className="ledger-row-label">Net worth trend</span>
            <span className="ledger-row-hint">Assets − liabilities, per close</span>
          </div>
          <span className="ledger-row-chevron">&rsaquo;</span>
        </Link>
        <Link to="/paycheque/forecast" className="ledger-row tap">
          <div className="ledger-row-main">
            <span className="ledger-row-label">Next 30 days</span>
            <span className="ledger-row-hint">Cash forecast · running balance</span>
          </div>
          <span className="ledger-row-chevron">&rsaquo;</span>
        </Link>
      </section>

      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>03</span> Habits
        </span>
        <span className="ledger-section-meta">last 90 days</span>
        <div className="pt-3">
          <Constellation
            mode="cluster"
            bubbles={habitsBubbles}
            empty="Spend a couple weeks to populate"
            footerLeft={habitsBubbles.length > 0 ? `${habitsBubbles.length} merchants` : ''}
            footerRight={habitsTotal > 0 ? `${fmtCompact(habitsTotal)} spent` : ''}
            height={280}
          />
        </div>
      </section>

      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>04</span> Subscriptions
        </span>
        <Link to="/paycheque/subscriptions" className="ledger-section-meta hover:underline">
          open &rsaquo;
        </Link>
        <div className="pt-3">
          <Constellation
            mode="cluster"
            outlined
            bubbles={subsBubbles}
            empty="Nothing detected · need 6 months of activity"
            footerLeft={subs.length > 0 ? `${subs.length} running` : ''}
            footerRight={subsMonthly > 0 ? `~${fmtCompact(subsMonthly)}/mo` : ''}
            height={260}
          />
        </div>
      </section>

      {openTabs.length > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>05</span> Open tabs
          </span>
          <div className="flex flex-col">
            {openTabs.slice(0, 4).map((c) => (
              <Link key={c.id} to={`/paycheque/tabs/${c.id}`} className="ledger-row">
                <div className="flex items-center gap-3 ledger-row-main">
                  <span
                    className="cat-rule"
                    style={{
                      background:
                        c.direction === 'owes_you' ? 'var(--cat-savings)' : 'var(--cat-indulgence)',
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{c.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                      {c.open_tab_count} {c.open_tab_count === 1 ? 'chit' : 'chits'} ·{' '}
                      {c.direction === 'owes_you' ? 'owes you' : 'you owe'}
                    </div>
                  </div>
                </div>
                <span
                  className="num ledger-row-value"
                  style={{
                    color: c.direction === 'owes_you' ? 'var(--cat-savings)' : 'var(--cat-indulgence)',
                  }}
                >
                  {c.direction === 'owes_you' ? '+' : '-'}
                  {formatCents(Math.abs(c.net_cents))}
                </span>
                <span className="ledger-row-chevron">&rsaquo;</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {spendHistoryRows.length > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>06</span> Spending history
          </span>
          <span className="ledger-section-meta">{spendHistoryRows.length} periods</span>
          <SpendHistoryTable rows={spendHistoryRows} />
        </section>
      )}

      {periodHistoryRows.length > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>07</span> Period surplus
          </span>
          <div className="flex flex-col">
            {periodHistoryRows.map((r) => {
              const surplus = r.surplus_cents;
              const color = surplus >= 0 ? 'var(--cat-savings)' : 'var(--cat-indulgence)';
              return (
                <div key={r.id} className="ledger-row">
                  <div className="ledger-row-main">
                    <span className="ledger-row-label">{fmtRange(r.start_date, r.end_date)}</span>
                    <span className="ledger-row-hint">
                      {formatCents(r.income_cents)} in · {formatCents(r.expense_cents)} out
                    </span>
                  </div>
                  <span className="ledger-row-value font-mono text-sm" style={{ color }}>
                    {surplus >= 0 ? '+' : ''}{formatCents(surplus)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

const SPEND_GROUPS = ['essentials', 'lifestyle', 'debt', 'savings', 'indulgence'] as const;
const GROUP_LABELS: Record<string, string> = {
  essentials: 'Essentials',
  lifestyle: 'Lifestyle',
  debt: 'Debt',
  savings: 'Savings',
  indulgence: 'Indulgence',
};
const GROUP_COLORS: Record<string, string> = {
  essentials: 'var(--cat-essentials)',
  lifestyle: 'var(--cat-lifestyle)',
  debt: 'var(--cat-debt)',
  savings: 'var(--cat-savings)',
  indulgence: 'var(--cat-indulgence)',
};

function SpendHistoryTable({ rows }: { rows: SpendHistoryRow[] }) {
  return (
    <div className="pt-2 overflow-x-auto">
      <table className="w-full font-mono text-[10px] border-collapse">
        <thead>
          <tr>
            <td className="pr-3 pb-1 text-[color:var(--color-text-muted)] uppercase tracking-[0.14em] whitespace-nowrap">
              Category
            </td>
            {rows.map((r) => (
              <td
                key={r.id}
                className="pb-1 text-right text-[color:var(--color-text-muted)] uppercase tracking-[0.12em] whitespace-nowrap pl-2"
              >
                {new Date(r.start_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {SPEND_GROUPS.map((g) => (
            <tr key={g} style={{ borderTop: '1px solid var(--color-hairline)' }}>
              <td className="pr-3 py-1 whitespace-nowrap flex items-center gap-2">
                <span className="cat-dot" style={{ background: GROUP_COLORS[g] }} />
                <span style={{ color: 'var(--color-text-primary)' }}>{GROUP_LABELS[g]}</span>
              </td>
              {rows.map((r) => {
                const v = r.by_group[g] ?? 0;
                return (
                  <td
                    key={r.id}
                    className="py-1 pl-2 text-right"
                    style={{ color: v > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
                  >
                    {v > 0 ? formatCents(v) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
