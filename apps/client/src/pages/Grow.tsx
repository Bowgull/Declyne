import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import LedgerHeader from '../components/LedgerHeader';

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
      <div className="ledger-page">
        <LedgerHeader kicker="§ GROW" title="Locked" subtitle="unlocks at phase 4" />
        <section className="ledger-section">
          <span className="ledger-section-kicker"><span className="num">×</span>Sealed</span>
          <p className="text-sm text-[color:var(--color-text-muted)] pt-4 pb-2">
            Buffer first. Markets do not care how early you start from zero.
          </p>
        </section>
      </div>
    );
  }

  const snap = snapshot.data?.snapshot;
  const hs = holdings.data?.holdings ?? [];
  const totalMv = hs.reduce((sum, h) => sum + (marketValue(h) ?? 0), 0);
  const totalGl = hs.reduce((sum, h) => sum + (gainLoss(h) ?? 0), 0);

  return (
    <div className="ledger-page">
      <LedgerHeader
        kicker="§ GROW"
        title="Portfolio"
        subtitle={snap ? `as of ${snap.as_of}` : undefined}
        action={
          <button
            className="stamp"
            onClick={() => fetchPrices.mutate()}
            disabled={fetchPrices.isPending}
          >
            {fetchPrices.isPending ? 'Fetching.' : 'Refresh'}
          </button>
        }
      />

      {fetchPrices.data?.errors.length ? (
        <p className="text-xs text-[color:var(--color-danger,#b00)] pb-2">
          {fetchPrices.data.errors.join(', ')}
        </p>
      ) : null}

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">Σ</span>Total value</span>
        <div className="pt-5 pb-5">
          <div className="hero-num-dark gold">{formatCents(totalMv)}</div>
          <div
            className="num mt-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: totalGl >= 0 ? 'var(--color-ok)' : 'var(--color-danger)',
            }}
          >
            {totalGl >= 0 ? '+' : ''}{formatCents(totalGl)} unrealized
          </div>
        </div>
      </section>

      {snap && (
        <section className="ledger-section">
          <span className="ledger-section-kicker"><span className="num">01</span>Market</span>
          <div className="pt-3 pb-2">
            {snap.boc_overnight_bps != null && (
              <div className="ledger-row">
                <span className="ledger-row-label" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>BoC overnight</span>
                <span className="ledger-row-value" style={{ color: 'var(--color-text-primary)' }}>{(snap.boc_overnight_bps / 100).toFixed(2)}%</span>
              </div>
            )}
            {snap.cad_usd != null && (
              <div className="ledger-row">
                <span className="ledger-row-label" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>USD/CAD</span>
                <span className="ledger-row-value" style={{ color: 'var(--color-text-primary)' }}>{(snap.cad_usd / 10_000).toFixed(4)}</span>
              </div>
            )}
            {snap.tsx_close != null && (
              <div className="ledger-row">
                <span className="ledger-row-label" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>XIU (TSX proxy)</span>
                <span className="ledger-row-value" style={{ color: 'var(--color-text-primary)' }}>{formatCents(snap.tsx_close)}</span>
              </div>
            )}
            {snap.sp500_close != null && (
              <div className="ledger-row">
                <span className="ledger-row-label" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>SPY (S&P proxy)</span>
                <span className="ledger-row-value" style={{ color: 'var(--color-text-primary)' }}>{formatCents(snap.sp500_close)}</span>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">02</span>Holdings</span>

        {hs.length === 0 && (
          <p className="text-sm text-[color:var(--color-text-muted)] pt-4">No positions yet.</p>
        )}

        <div className="pt-3 pb-2">
          {hs.map((h) => {
            const mv = marketValue(h);
            const gl = gainLoss(h);
            const rsiVal = h.rsi14 != null ? h.rsi14 / 100 : null;
            const momVal = h.momentum_30d != null ? h.momentum_30d / 100 : null;

            return (
              <div key={h.id} className="ledger-row">
                <div className="ledger-row-main">
                  <span className="ledger-row-label">
                    {h.symbol}
                    <span className="ml-2 text-xs ink-muted" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}>
                      {h.account_wrapper.toUpperCase()}
                    </span>
                  </span>
                  <span className="ledger-row-hint">
                    {(h.units / 10_000).toFixed(4)} u
                    {rsiVal != null && (
                      <> · RSI {rsiVal.toFixed(1)}{rsiLabel(h.rsi14)}</>
                    )}
                    {momVal != null && (
                      <> · mom {momVal >= 0 ? '+' : ''}{momVal.toFixed(1)}%</>
                    )}
                  </span>
                </div>
                <div className="text-right flex flex-col gap-0.5">
                  <div className="num" style={{ color: 'var(--color-text-primary)' }}>{mv != null ? formatCents(mv) : '—'}</div>
                  {gl != null && (
                    <div
                      className="text-xs num"
                      style={{ color: gl >= 0 ? 'var(--color-ok)' : 'var(--color-danger)' }}
                    >
                      {gl >= 0 ? '+' : ''}{formatCents(gl)}
                    </div>
                  )}
                  {h.latest_price_cents != null && (
                    <div className="text-xs num" style={{ color: 'var(--color-text-muted)' }}>
                      {formatCents(h.latest_price_cents)}/u
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">03</span>Recommendation</span>
        <div className="pt-4 pb-2 flex flex-col gap-3">
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Requires fresh prices and computed signals. Hit Refresh first.
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
        </div>
      </section>
    </div>
  );
}
