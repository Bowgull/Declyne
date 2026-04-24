import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

type Holding = {
  id: string;
  symbol: string;
  account_wrapper: string;
  units: number;
  avg_cost_cents: number;
  latest_price_cents: number | null;
  price_date: string | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  momentum_30d: number | null;
};

type MarketSnapshot = {
  as_of: string;
  boc_overnight_bps: number | null;
  cad_usd: number | null;
  tsx_close: number | null;
  sp500_close: number | null;
};

type Recommendation = {
  action: string;
  symbol: string;
  wrapper: string;
  units: number;
  reason: string;
  cited_signals: string[];
};

function marketValue(h: Holding): number | null {
  if (h.latest_price_cents == null) return null;
  return Math.round((h.units * h.latest_price_cents) / 10_000);
}

function gainLoss(h: Holding): number | null {
  const mv = marketValue(h);
  if (mv == null) return null;
  const costBasis = Math.round((h.units * h.avg_cost_cents) / 10_000);
  return mv - costBasis;
}

function rsiLabel(rsi: number | null): string {
  if (rsi == null) return '';
  const v = rsi / 100;
  if (v > 70) return ' overbought';
  if (v < 30) return ' oversold';
  return '';
}

export default function Grow({ unlocked }: { unlocked: boolean }) {
  const qc = useQueryClient();
  const [recErr, setRecErr] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);

  const holdings = useQuery({
    queryKey: ['holdings'],
    queryFn: () => api.get<{ holdings: Holding[] }>('/api/investment/holdings'),
    enabled: unlocked,
  });

  const snapshot = useQuery({
    queryKey: ['market-snapshot'],
    queryFn: () => api.get<{ snapshot: MarketSnapshot | null }>('/api/market/snapshot'),
    enabled: unlocked,
  });

  const phase = useQuery({
    queryKey: ['phase'],
    queryFn: () => api.get<{ phase: number }>('/api/phase'),
    enabled: unlocked,
  });

  const fetchPrices = useMutation({
    mutationFn: () =>
      api.post<{ symbols_fetched: string[]; errors: string[]; snapshot: MarketSnapshot }>(
        '/api/market/fetch',
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holdings'] });
      qc.invalidateQueries({ queryKey: ['market-snapshot'] });
    },
  });

  const recommend = useMutation({
    mutationFn: () =>
      api.post<{ id: string; response: Recommendation }>('/api/investment/recommend', {
        phase: phase.data?.phase ?? 1,
      }),
    onSuccess: (data) => {
      setRecErr(null);
      setRec(data.response);
    },
    onError: (e: Error) => setRecErr(e.message),
  });

  if (!unlocked) {
    return (
      <div className="flex flex-col gap-4 pb-6">
        <h1 className="text-2xl font-semibold">Grow</h1>
        <div className="card">
          <div className="text-sm text-[color:var(--color-text-muted)]">Locked until Phase 4.</div>
          <p className="mt-2">Buffer first. Markets do not care how early you start from zero.</p>
        </div>
      </div>
    );
  }

  const snap = snapshot.data?.snapshot;
  const hs = holdings.data?.holdings ?? [];
  const totalMv = hs.reduce((sum, h) => sum + (marketValue(h) ?? 0), 0);
  const totalGl = hs.reduce((sum, h) => sum + (gainLoss(h) ?? 0), 0);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Grow</h1>
        <button
          className="btn-outline text-xs"
          onClick={() => fetchPrices.mutate()}
          disabled={fetchPrices.isPending}
        >
          {fetchPrices.isPending ? 'Fetching.' : 'Refresh prices'}
        </button>
      </header>

      {fetchPrices.data?.errors.length ? (
        <p className="text-xs text-[color:var(--color-danger,#b00)]">
          {fetchPrices.data.errors.join(', ')}
        </p>
      ) : null}

      {snap && (
        <section className="card flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Market
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {snap.boc_overnight_bps != null && (
              <>
                <span className="text-[color:var(--color-text-muted)]">BoC overnight</span>
                <span className="num text-right">{(snap.boc_overnight_bps / 100).toFixed(2)}%</span>
              </>
            )}
            {snap.cad_usd != null && (
              <>
                <span className="text-[color:var(--color-text-muted)]">USD/CAD</span>
                <span className="num text-right">{(snap.cad_usd / 10_000).toFixed(4)}</span>
              </>
            )}
            {snap.tsx_close != null && (
              <>
                <span className="text-[color:var(--color-text-muted)]">XIU (TSX proxy)</span>
                <span className="num text-right">{formatCents(snap.tsx_close)}</span>
              </>
            )}
            {snap.sp500_close != null && (
              <>
                <span className="text-[color:var(--color-text-muted)]">SPY (S&P proxy)</span>
                <span className="num text-right">{formatCents(snap.sp500_close)}</span>
              </>
            )}
          </div>
          <p className="text-xs text-[color:var(--color-text-muted)]">As of {snap.as_of}</p>
        </section>
      )}

      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Holdings
          </div>
          {hs.length > 0 && (
            <div className="text-right">
              <div className="num">{formatCents(totalMv)}</div>
              <div
                className={`text-xs num ${totalGl >= 0 ? 'text-[color:var(--color-text-muted)]' : 'text-[color:var(--color-danger,#b00)]'}`}
              >
                {totalGl >= 0 ? '+' : ''}{formatCents(totalGl)}
              </div>
            </div>
          )}
        </div>

        {hs.length === 0 && (
          <p className="text-sm text-[color:var(--color-text-muted)]">No positions yet.</p>
        )}

        {hs.map((h) => {
          const mv = marketValue(h);
          const gl = gainLoss(h);
          const rsiVal = h.rsi14 != null ? h.rsi14 / 100 : null;
          const momVal = h.momentum_30d != null ? h.momentum_30d / 100 : null;

          return (
            <div key={h.id} className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <div className="font-medium">{h.symbol}</div>
                <div className="text-xs text-[color:var(--color-text-muted)]">
                  {h.account_wrapper.toUpperCase()} · {(h.units / 10_000).toFixed(4)} u
                </div>
                {rsiVal != null && (
                  <div className="text-xs text-[color:var(--color-text-muted)] num">
                    RSI {rsiVal.toFixed(1)}{rsiLabel(h.rsi14)}
                    {momVal != null ? ` · mom ${momVal >= 0 ? '+' : ''}${momVal.toFixed(1)}%` : ''}
                  </div>
                )}
              </div>
              <div className="text-right flex flex-col gap-0.5">
                <div className="num">{mv != null ? formatCents(mv) : '—'}</div>
                {gl != null && (
                  <div
                    className={`text-xs num ${gl >= 0 ? 'text-[color:var(--color-text-muted)]' : 'text-[color:var(--color-danger,#b00)]'}`}
                  >
                    {gl >= 0 ? '+' : ''}{formatCents(gl)}
                  </div>
                )}
                {h.latest_price_cents != null && (
                  <div className="text-xs text-[color:var(--color-text-muted)] num">
                    {formatCents(h.latest_price_cents)}/u
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Recommendation
        </div>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Requires fresh prices and computed signals. Hit Refresh prices first.
        </p>
        <button
          className="btn-primary"
          onClick={() => recommend.mutate()}
          disabled={recommend.isPending}
        >
          {recommend.isPending ? 'Thinking.' : 'Get recommendation'}
        </button>
        {recErr && (
          <p className="text-xs text-[color:var(--color-danger,#b00)]">{recErr}</p>
        )}
        {rec && (
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium uppercase">{rec.action}</span>
              <span className="num">{rec.symbol}</span>
              <span className="text-xs text-[color:var(--color-text-muted)] uppercase">
                {rec.wrapper}
              </span>
            </div>
            <p>{rec.reason}</p>
            {rec.cited_signals?.length > 0 && (
              <p className="text-xs text-[color:var(--color-text-muted)]">
                Cited: {rec.cited_signals.join(', ')}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
