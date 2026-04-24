import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

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
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Credit snapshots</h1>
        <Link to="/settings" className="text-sm text-[color:var(--color-text-muted)]">Back</Link>
      </header>

      <section className="card flex flex-col gap-3">
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Log one per statement. Feeds utilization and on-time streaks used by phase progression.
        </p>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          Add snapshot
        </button>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
          {snaps.data ? `${rows.length} snapshots` : 'Loading.'}
        </h2>
        {rows.length === 0 && snaps.data ? (
          <p className="text-sm text-[color:var(--color-text-muted)]">No snapshots yet.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-1 border-b border-[color:var(--color-line)] pb-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium num">{s.as_of}</span>
                <span className="text-xs text-[color:var(--color-text-muted)]">{s.source}</span>
              </div>
              <div className="text-xs text-[color:var(--color-text-muted)] num">
                score {s.score} · util {(s.utilization_bps / 100).toFixed(1)}% · on-time {s.on_time_streak_days}d
              </div>
              <button
                className="text-xs text-[color:var(--color-text-muted)] self-start underline"
                onClick={() => {
                  if (confirm(`Delete snapshot ${s.as_of}?`)) del.mutate(s.id);
                }}
                disabled={del.isPending}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
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
            className="btn-primary flex-1"
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
