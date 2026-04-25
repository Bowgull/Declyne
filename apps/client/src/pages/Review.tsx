import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

interface ReviewItem {
  id: string;
  transaction_id: string;
  reason: 'uncategorized' | 'new_merchant' | 'unusual_amount' | 'split_candidate';
  resolved_at: string | null;
  description_raw: string;
  amount_cents: number;
  posted_at: string;
}

interface Category {
  id: string;
  name: string;
  group: string;
}

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
};

const REASON_LABEL: Record<ReviewItem['reason'], string> = {
  uncategorized: 'Uncategorized',
  new_merchant: 'New merchant',
  unusual_amount: 'Unusual amount',
  split_candidate: 'Split candidate',
};

export default function Review() {
  const qc = useQueryClient();
  const items = useQuery({
    queryKey: ['review'],
    queryFn: () => api.get<{ items: ReviewItem[] }>('/api/review'),
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ categories: Category[] }>('/api/categories'),
  });

  const list = items.data?.items ?? [];
  const cats = categories.data?.categories ?? [];

  const resolve = useMutation({
    mutationFn: ({ id, category_id }: { id: string; category_id: string }) =>
      api.post<{ ok: true }>(`/api/review/${id}/resolve`, { category_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review'] }),
  });

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-sigil" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">REVIEW</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {items.isLoading ? 'Loading…' : `${list.length} unfiled`}
              </div>
            </div>
          </div>
          <Link to="/today" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Close
          </Link>
        </header>

        {!items.isLoading && list.length === 0 ? (
          <div className="pt-3 text-center text-xs text-[color:var(--color-text-muted)]" style={perforation}>
            Queue clear.
          </div>
        ) : (
          <div className="flex flex-col">
            {list.map((it) => (
              <ReviewLine
                key={it.id}
                item={it}
                categories={cats}
                onResolve={(category_id) => resolve.mutate({ id: it.id, category_id })}
                pending={resolve.isPending}
              />
            ))}
          </div>
        )}

        <div className="pt-3 text-center text-[11px] uppercase tracking-[0.32em] text-[color:var(--color-text-muted)]" style={perforation}>
          {list.length === 0 ? '** Queue clear **' : `** ${list.length} unfiled **`}
        </div>
      </section>
    </div>
  );
}

function ReviewLine({
  item,
  categories,
  onResolve,
  pending,
}: {
  item: ReviewItem;
  categories: Category[];
  onResolve: (category_id: string) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState('');
  const isOut = item.amount_cents < 0;
  return (
    <div className="pt-3 mt-3 flex flex-col gap-2" style={perforation}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
          {REASON_LABEL[item.reason]} · {new Date(item.posted_at).toLocaleDateString('en-CA')}
        </div>
        <div className="num text-base shrink-0">
          {isOut ? '−' : '+'}
          {formatCents(Math.abs(item.amount_cents))}
        </div>
      </div>
      <div className="text-sm truncate">{item.description_raw}</div>
      <div className="flex gap-2">
        <select
          className="field flex-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Category"
        >
          <option value="">Choose category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.group} · {c.name}
            </option>
          ))}
        </select>
        <button
          className="btn-primary px-4 text-sm"
          onClick={() => selected && onResolve(selected)}
          disabled={!selected || pending}
        >
          Resolve
        </button>
      </div>
    </div>
  );
}
