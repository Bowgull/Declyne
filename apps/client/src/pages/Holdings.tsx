import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
};

type Holding = {
  id: string;
  symbol: string;
  account_wrapper: string;
  units: number;
  avg_cost_cents: number;
  updated_at: string;
};

const WRAPPERS = ['tfsa', 'fhsa', 'rrsp', 'nonreg'] as const;

export default function Holdings() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);

  const holdings = useQuery({
    queryKey: ['holdings-raw'],
    queryFn: () => api.get<{ holdings: Holding[] }>('/api/holdings'),
  });

  const rows = holdings.data?.holdings ?? [];

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-sigil" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">HOLDINGS</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {holdings.data ? `${rows.length} lots` : 'Loading…'}
              </div>
            </div>
          </div>
          <Link to="/grow" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Close
          </Link>
        </header>

        <div className="pt-3" style={perforation}>
          <button className="stamp stamp-square w-full" onClick={() => setAdding(true)}>Add holding</button>
        </div>

        {rows.length === 0 && holdings.data ? (
          <div className="pt-3 text-center text-xs text-[color:var(--color-text-muted)]" style={perforation}>
            No holdings yet.
          </div>
        ) : (
          <div className="flex flex-col">
            {rows.map((h) => (
              <div
                key={h.id}
                className="pt-3 mt-3 flex flex-col gap-1 cursor-pointer"
                style={perforation}
                onClick={() => setEditing(h)}
                role="button"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{h.symbol}</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                    {h.account_wrapper.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-xs num text-[color:var(--color-text-muted)]">
                  <span>{(h.units / 10_000).toFixed(4)} units</span>
                  <span>avg {formatCents(h.avg_cost_cents)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 text-center text-[11px] uppercase tracking-[0.32em] text-[color:var(--color-text-muted)]" style={perforation}>
          ** End of book **
        </div>
      </section>

      {adding && (
        <HoldingSheet
          mode="add"
          onClose={() => setAdding(false)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['holdings-raw'] });
            await qc.invalidateQueries({ queryKey: ['holdings'] });
            setAdding(false);
          }}
        />
      )}
      {editing && (
        <HoldingSheet
          mode="edit"
          holding={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['holdings-raw'] });
            await qc.invalidateQueries({ queryKey: ['holdings'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function HoldingSheet({
  mode,
  holding,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  holding?: Holding;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [symbol, setSymbol] = useState(holding?.symbol ?? '');
  const [wrapper, setWrapper] = useState<string>(holding?.account_wrapper ?? 'tfsa');
  const [unitsStr, setUnitsStr] = useState(
    holding ? (holding.units / 10_000).toFixed(4) : '',
  );
  const [avgDollars, setAvgDollars] = useState(
    holding ? (holding.avg_cost_cents / 100).toFixed(2) : '',
  );

  useEffect(() => {
    if (holding) {
      setSymbol(holding.symbol);
      setWrapper(holding.account_wrapper);
      setUnitsStr((holding.units / 10_000).toFixed(4));
      setAvgDollars((holding.avg_cost_cents / 100).toFixed(2));
    }
  }, [holding]);

  const save = useMutation({
    mutationFn: async () => {
      const units = Math.round(Number(unitsStr) * 10_000);
      const avg_cost_cents = Math.round(Number(avgDollars) * 100);
      if (mode === 'add') {
        await api.post('/api/holdings', {
          symbol: symbol.trim().toUpperCase(),
          account_wrapper: wrapper,
          units,
          avg_cost_cents,
        });
      } else if (holding) {
        await api.patch(`/api/holdings/${holding.id}`, {
          symbol: symbol.trim().toUpperCase(),
          account_wrapper: wrapper,
          units,
          avg_cost_cents,
        });
      }
    },
    onSuccess: () => onSaved(),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!holding) return;
      await api.del(`/api/holdings/${holding.id}`);
    },
    onSuccess: () => onSaved(),
  });

  const valid =
    symbol.trim().length > 0 &&
    Number(unitsStr) > 0 &&
    Number(avgDollars) >= 0;

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="card w-full max-w-xl mx-auto stub-top flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">{mode === 'add' ? 'Add holding' : 'Edit holding'}</h2>

        <label className="field-label">Symbol</label>
        <input
          className="field"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="XIU.TO"
        />

        <label className="field-label">Wrapper</label>
        <select
          className="field"
          value={wrapper}
          onChange={(e) => setWrapper(e.target.value)}
        >
          {WRAPPERS.map((w) => (
            <option key={w} value={w}>{w.toUpperCase()}</option>
          ))}
        </select>

        <label className="field-label">Units (4 decimals)</label>
        <input
          className="field num"
          inputMode="decimal"
          value={unitsStr}
          onChange={(e) => setUnitsStr(e.target.value)}
          placeholder="100.0000"
        />

        <label className="field-label">Avg cost ($)</label>
        <input
          className="field num"
          inputMode="decimal"
          value={avgDollars}
          onChange={(e) => setAvgDollars(e.target.value)}
          placeholder="32.50"
        />

        {save.error && (
          <p className="text-xs text-[color:var(--color-danger,#b00)]">{String(save.error)}</p>
        )}

        <div className="flex gap-2">
          <button className="btn-outline flex-1" onClick={onClose}>Cancel</button>
          <button
            className="stamp stamp-square flex-1"
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid}
          >
            {save.isPending ? 'Saving.' : 'Save'}
          </button>
        </div>
        {mode === 'edit' && (
          <button
            className="btn-outline text-[color:var(--color-danger,#b00)]"
            onClick={() => {
              if (confirm('Delete this holding?')) del.mutate();
            }}
            disabled={del.isPending}
          >
            {del.isPending ? 'Deleting.' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  );
}
