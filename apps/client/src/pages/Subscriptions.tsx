import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import LedgerHeader from '../components/LedgerHeader';
import SubscriptionVerdictLedger, {
  type SubscriptionRow,
} from '../components/SubscriptionVerdictLedger';

export default function Subscriptions() {
  const q = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.get<{ subscriptions: SubscriptionRow[] }>('/api/budget/subscriptions'),
  });

  const subs = (q.data?.subscriptions ?? []).filter((s) => s.verdict !== 'not_a_sub');
  const running = subs.filter((s) => s.verdict !== 'kill').length;

  return (
    <div className="ledger-page pb-20">
      <LedgerHeader
        kicker="Standing orders"
        title="Subscriptions"
        subtitle={
          subs.length > 0
            ? `${running} ${running === 1 ? 'hand' : 'hands'} in your wallet`
            : undefined
        }
        action={
          <Link to="/books?view=patterns" className="stamp stamp-square text-[10px]">
            Back
          </Link>
        }
      />

      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>01</span> Charges
        </span>
        <SubscriptionVerdictLedger
          subs={subs}
          emptyHint="Nothing found · import 6 months of activity to populate."
        />
      </section>
    </div>
  );
}
