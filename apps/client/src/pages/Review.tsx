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
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review queue</h1>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            {items.isLoading ? 'Loading…' : `${list.length} to resolve`}
          </p>
        </div>
        <Link to="/today" className="btn-outline">Back</Link>
      </header>

      {!items.isLoading && list.length === 0 && (
        <section className="card">
          <p className="text-sm text-[color:var(--color-text-muted)]">Queue clear.</p>
        </section>
      )}

      <ul className="flex flex-col gap-3">
        {list.map((it) => (
          <li key={it.id}>
            <ReviewCard
              item={it}
              categories={cats}
              onResolve={(category_id) => resolve.mutate({ id: it.id, category_id })}
              pending={resolve.isPending}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewCard({
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
  return (
    <article className="receipt relative" aria-label={item.description_raw}>
      <span className="stub stub-top" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]">
            {REASON_LABEL[item.reason]} · {new Date(item.posted_at).toLocaleDateString('en-CA')}
          </div>
          <div className="mt-1 truncate text-base font-semibold">{item.description_raw}</div>
        </div>
        <div
          className="num text-lg shrink-0"
          style={{ color: item.amount_cents < 0 ? 'var(--color-danger)' : 'var(--color-ok)' }}
        >
          {formatCents(item.amount_cents)}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
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
      <span className="stub stub-bottom" aria-hidden />
    </article>
  );
}
