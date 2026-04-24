import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

interface Debt {
  id: string;
  name: string;
  principal_cents: number;
  interest_rate_bps: number;
  min_payment_type: string;
  min_payment_value: number;
  payment_due_date: number;
}

interface Split {
  id: string;
  counterparty: string;
  direction: 'josh_owes' | 'owes_josh';
  remaining_cents: number;
  reason: string;
}

export default function Debts() {
  const debts = useQuery({
    queryKey: ['debts'],
    queryFn: () => api.get<{ debts: Debt[] }>('/api/debts'),
  });
  const splits = useQuery({
    queryKey: ['splits'],
    queryFn: () => api.get<{ splits: Split[] }>('/api/splits'),
  });

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="text-2xl font-semibold">Debts</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Balances</h2>
        <div className="card flex flex-col gap-3">
          {debts.data?.debts.length === 0 && (
            <div className="text-sm text-[color:var(--color-text-muted)]">No debts tracked.</div>
          )}
          {debts.data?.debts.map((d) => (
            <div key={d.id} className="flex items-center justify-between">
              <div>
                <div>{d.name}</div>
                <div className="text-xs text-[color:var(--color-text-muted)]">
                  {(d.interest_rate_bps / 100).toFixed(2)}% · due day {d.payment_due_date}
                </div>
              </div>
              <div className="num text-lg">{formatCents(d.principal_cents)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Splits</h2>
        <div className="card flex flex-col gap-3">
          {splits.data?.splits.length === 0 && (
            <div className="text-sm text-[color:var(--color-text-muted)]">Nothing outstanding.</div>
          )}
          {splits.data?.splits.map((s) => (
            <div key={s.id} className="flex items-center justify-between">
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
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
