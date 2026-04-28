import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import { glyphForCategory } from '../lib/rowGlyph';
import { showVocabularyToast } from '../lib/vocabularyToast';

export type AllocationRow = {
  id: string;
  pay_period_id: string;
  category_group: 'essentials' | 'lifestyle' | 'debt' | 'savings' | 'indulgence';
  label: string;
  planned_cents: number;
  matched_txn_id: string | null;
  stamped_at: string | null;
  stamped_by: string | null;
};

const GROUP_LABELS: Record<AllocationRow['category_group'], string> = {
  essentials: 'Essentials',
  lifestyle: 'Lifestyle',
  debt: 'Debt',
  savings: 'Savings',
  indulgence: 'Indulgence',
};

type Props = {
  group: AllocationRow['category_group'];
  rows: AllocationRow[];
  onClose: () => void;
};

export default function AllocationSheet({ group, rows, onClose }: Props) {
  const qc = useQueryClient();
  const groupRows = rows.filter((r) => r.category_group === group);
  const planned = groupRows.reduce((s, r) => s + r.planned_cents, 0);
  const stamped = groupRows.filter((r) => r.stamped_at).reduce((s, r) => s + r.planned_cents, 0);

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');

  const stamp = useMutation({
    mutationFn: (id: string) =>
      api.post<{ ok: boolean; vocabulary_unlock?: { level: number; message: string } }>(
        `/api/allocations/${id}/stamp`,
      ),
    onSuccess: (data) => {
      if (data.vocabulary_unlock) showVocabularyToast(data.vocabulary_unlock.message);
      qc.invalidateQueries({ queryKey: ['allocations'] });
    },
  });
  const unstamp = useMutation({
    mutationFn: (id: string) => api.post(`/api/allocations/${id}/unstamp`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allocations'] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/allocations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allocations'] }),
  });
  const add = useMutation({
    mutationFn: () =>
      api.post('/api/allocations', {
        category_group: group,
        label: label.trim(),
        planned_cents: Math.round(Number(amount) * 100),
      }),
    onSuccess: () => {
      setAdding(false);
      setLabel('');
      setAmount('');
      qc.invalidateQueries({ queryKey: ['allocations'] });
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <section
        className="receipt stub-top stub-bottom w-full max-w-xl"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="label-tag" style={{ color: `var(--cat-${group})` }}>
              <span className="cat-dot" style={{ background: `var(--cat-${group})` }} />{' '}
              {GROUP_LABELS[group]}
            </div>
            <div className="hero-num mt-1">{formatCents(planned)}</div>
            <div className="text-xs ink-muted">
              {formatCents(stamped)} paid · {formatCents(planned - stamped)} pending
            </div>
          </div>
          <button className="stamp stamp-square" onClick={onClose}>
            Close
          </button>
        </div>

        <ul className="mt-4 flex flex-col">
          {groupRows.length === 0 && (
            <li className="text-sm ink-muted py-3">Nothing assigned here yet.</li>
          )}
          {groupRows.map((r) => {
            const glyph = glyphForCategory(r.category_group, -r.planned_cents);
            const tone = glyph === '▸' ? 'debt' : '';
            return (
            <li key={r.id} className="row-tap py-3 perf flex items-center justify-between gap-3">
              <span className={`row-glyph${tone ? ' ' + tone : ''}`}>{glyph}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{r.label}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] ink-muted">
                  {r.stamped_at
                    ? `paid · ${r.stamped_by === 'csv_match' ? 'auto' : 'manual'}`
                    : 'pending'}
                </div>
              </div>
              <div className="num text-base shrink-0">{formatCents(r.planned_cents)}</div>
              {r.stamped_at ? (
                <button
                  className="stamp stamp-square"
                  onClick={() => unstamp.mutate(r.id)}
                  disabled={unstamp.isPending}
                >
                  Undo
                </button>
              ) : (
                <button
                  className="stamp stamp-gold"
                  onClick={() => stamp.mutate(r.id)}
                  disabled={stamp.isPending}
                >
                  Paid
                </button>
              )}
              <button
                className="text-xs underline ink-muted"
                onClick={() => del.mutate(r.id)}
                disabled={del.isPending}
                aria-label="Delete"
              >
                ×
              </button>
            </li>
            );
          })}
        </ul>

        {adding ? (
          <div className="mt-4 flex flex-col gap-2 perf pt-4">
            <input
              className="chit-field"
              placeholder="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <input
              className="chit-field"
              placeholder="Amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="stamp stamp-purple"
                onClick={() => add.mutate()}
                disabled={!label.trim() || !amount || add.isPending}
              >
                Save
              </button>
              <button className="stamp stamp-square" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="stamp stamp-purple mt-4" onClick={() => setAdding(true)}>
            + Add line
          </button>
        )}
      </section>
    </div>
  );
}
