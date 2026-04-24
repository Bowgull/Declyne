import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function Grow({ unlocked }: { unlocked: boolean }) {
  const holdings = useQuery({
    queryKey: ['holdings'],
    queryFn: () => api.get<{ holdings: Array<{ id: string; symbol: string; account_wrapper: string; units: number }> }>('/api/investment/holdings'),
    enabled: unlocked,
  });

  if (!unlocked) {
    return (
      <div className="flex flex-col gap-4 pb-6">
        <h1 className="text-2xl font-semibold">Grow</h1>
        <div className="card">
          <div className="text-sm text-[color:var(--color-text-muted)]">
            Locked until Phase 4.
          </div>
          <p className="mt-2">Buffer first. Markets do not care how early you start from zero.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="text-2xl font-semibold">Grow</h1>
      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Holdings</h2>
        {holdings.data?.holdings.length === 0 && (
          <div className="text-sm text-[color:var(--color-text-muted)]">No positions yet.</div>
        )}
        {holdings.data?.holdings.map((h) => (
          <div key={h.id} className="flex items-center justify-between">
            <div>
              <div>{h.symbol}</div>
              <div className="text-xs text-[color:var(--color-text-muted)]">{h.account_wrapper.toUpperCase()}</div>
            </div>
            <div className="num">{(h.units / 10_000).toFixed(4)} u</div>
          </div>
        ))}
      </section>
    </div>
  );
}
