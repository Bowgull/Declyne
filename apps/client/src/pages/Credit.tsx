import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
};

type Snapshot = {
  id: string;
  as_of: string;
  score: number;
  utilization_bps: number;
  on_time_streak_days: number;
  source: 'manual' | 'equifax';
};

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function Credit() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const snaps = useQuery({
    queryKey: ['credit-snapshots'],
    queryFn: () => api.get<{ snapshots: Snapshot[] }>('/api/credit/snapshots?limit=50'),
  });

  const rows = snaps.data?.snapshots ?? [];

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/credit/snapshots/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit-snapshots'] }),
  });

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-sigil" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">CREDIT</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {snaps.data ? `${rows.length} snapshots` : 'Loading…'}
              </div>
            </div>
          </div>
          <Link to="/settings" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Close
          </Link>
        </header>

        <div className="pt-3" style={perforation}>
          <button className="stamp stamp-square w-full" onClick={() => setAdding(true)}>
            Add snapshot
          </button>
        </div>

        {rows.length === 0 && snaps.data ? (
          <div className="pt-3 text-center text-xs text-[color:var(--color-text-muted)]" style={perforation}>
            No snapshots yet.
          </div>
        ) : (
          <div className="flex flex-col">
            {rows.map((s) => (
              <div key={s.id} className="pt-3 mt-3 flex flex-col gap-1" style={perforation}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm num">{s.as_of}</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                    {s.source}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-xs num text-[color:var(--color-text-muted)]">
                  <span>score {s.score}</span>
                  <span>util {(s.utilization_bps / 100).toFixed(1)}%</span>
                  <span>on-time {s.on_time_streak_days}d</span>
                </div>
                <button
                  className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] self-start underline"
                  onClick={() => {
                    if (confirm(`Delete snapshot ${s.as_of}?`)) del.mutate(s.id);
                  }}
                  disabled={del.isPending}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 text-center text-[11px] uppercase tracking-[0.32em] text-[color:var(--color-text-muted)]" style={perforation}>
          ** End of bureau **
        </div>
      </section>

      {adding && (
        <AddSheet
          onClose={() => setAdding(false)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['credit-snapshots'] });
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function AddSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [asOf, setAsOf] = useState(today());
  const [score, setScore] = useState('700');
  const [utilPct, setUtilPct] = useState('10');
  const [onTimeDays, setOnTimeDays] = useState('0');
  const [source, setSource] = useState<'manual' | 'equifax'>('manual');

  const save = useMutation({
    mutationFn: async () => {
      const utilPctNum = Number(utilPct);
      await api.post('/api/credit/snapshots', {
        as_of: asOf,
        score: Number(score),
        utilization_bps: Math.round(utilPctNum * 100),
        on_time_streak_days: Number(onTimeDays),
        source,
      });
    },
    onSuccess: () => onSaved(),
  });

  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(asOf) &&
    Number(score) >= 300 && Number(score) <= 900 &&
    Number(utilPct) >= 0 && Number(utilPct) <= 100 &&
    Number(onTimeDays) >= 0;

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="card w-full max-w-xl mx-auto stub-top flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">Add credit snapshot</h2>

        <label className="field-label">As of</label>
        <input className="field" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />

        <label className="field-label">Score (300..900)</label>
        <input
          className="field num"
          inputMode="numeric"
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />

        <label className="field-label">Utilization %</label>
        <input
          className="field num"
          inputMode="decimal"
          value={utilPct}
          onChange={(e) => setUtilPct(e.target.value)}
        />

        <label className="field-label">On-time streak (days)</label>
        <input
          className="field num"
          inputMode="numeric"
          value={onTimeDays}
          onChange={(e) => setOnTimeDays(e.target.value)}
        />

        <label className="field-label">Source</label>
        <select
          className="field"
          value={source}
          onChange={(e) => setSource(e.target.value as 'manual' | 'equifax')}
        >
          <option value="manual">manual</option>
          <option value="equifax">equifax</option>
        </select>

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
      </div>
    </div>
  );
}
