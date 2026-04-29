import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

type Group = 'lifestyle' | 'indulgence';

interface QueueRow {
  id: string;
  display_name: string;
  normalized_key: string;
  sub_category: string | null;
  category_group: Group | null;
  spend_90d_cents: number;
  txn_count_90d: number;
}

const LIFESTYLE_SUBS = [
  'food',
  'transit',
  'shopping',
  'home',
  'personal_care',
  'entertainment',
  'health',
] as const;

const INDULGENCE_SUBS = [
  'bars',
  'takeout',
  'fast_food',
  'weed',
  'streaming',
  'gaming',
  'treats',
] as const;

const LABEL: Record<string, string> = {
  food: 'food',
  transit: 'transit',
  shopping: 'shopping',
  home: 'home',
  personal_care: 'personal care',
  entertainment: 'entertainment',
  health: 'health',
  bars: 'bars',
  takeout: 'takeout',
  fast_food: 'fast food',
  weed: 'weed',
  streaming: 'streaming',
  gaming: 'gaming',
  treats: 'treats',
};

// Show every option regardless of merchant group. The category_group on a
// merchant is sometimes wrong in source data (e.g. Uber Eats coming in as
// lifestyle when it's really takeout), and forcing the user into the wrong
// half of the menu just leaves them stuck.
function allSubs(): readonly string[] {
  return [...LIFESTYLE_SUBS, ...INDULGENCE_SUBS];
}

export default function SubCategoryQueue() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<string, string>>({});

  const queue = useQuery({
    queryKey: ['sub-category-queue'],
    queryFn: () =>
      api.get<{ merchants: QueueRow[] }>(
        '/api/merchants/sub-categories/queue?limit=50',
      ),
  });

  const approve = useMutation({
    mutationFn: ({ id, sub }: { id: string; sub: string }) =>
      api.patch(`/api/merchants/${id}`, {
        sub_category: sub,
        sub_category_confirmed: 1,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sub-category-queue'] });
      qc.invalidateQueries({ queryKey: ['merchants', 'habits'] });
    },
  });

  const rows = queue.data?.merchants ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="ledger-section pt-2">
      <span className="ledger-section-kicker">
        <span className="num" style={{ color: 'var(--color-accent-gold)' }}>
          01
        </span>{' '}
        Sub-categories
      </span>
      <span className="ledger-section-meta">
        {rows.length} to confirm
      </span>

      <div className="flex flex-col">
        {rows.map((r) => {
          const isOpen = open === r.id;
          const guess = r.sub_category;
          const choice = override[r.id] ?? guess ?? '';
          const opts = allSubs();
          return (
            <div key={r.id} className="ledger-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <button
                type="button"
                className="row-tap"
                onClick={() => setOpen(isOpen ? null : r.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 0',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div className="ledger-row-main">
                  <span className="ledger-row-label">{r.display_name}</span>
                  <span className="ledger-row-hint">
                    {guess ? `guess · ${LABEL[guess] ?? guess}` : 'unrecognized'}
                    {' · '}
                    {r.category_group ?? '?'}
                  </span>
                </div>
                <span className="ledger-row-value font-mono text-sm">
                  {formatCents(r.spend_90d_cents)}
                </span>
              </button>

              {isOpen && (
                <div
                  className="flex flex-col gap-2 pt-2 pb-3"
                  style={{ borderTop: '1px dashed var(--rule-ink)' }}
                >
                  <div className="flex flex-wrap gap-2 pt-2">
                    {opts.map((s) => {
                      const active = choice === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setOverride((p) => ({ ...p, [r.id]: s }))
                          }
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            padding: '6px 10px',
                            borderRadius: 2,
                            border: `1px solid ${
                              active
                                ? 'var(--color-accent-purple)'
                                : 'var(--rule-ink-strong)'
                            }`,
                            background: active
                              ? 'var(--color-accent-purple)'
                              : 'transparent',
                            color: active
                              ? 'var(--color-paper)'
                              : 'var(--color-text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          {LABEL[s] ?? s}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      className="stamp stamp-purple"
                      disabled={!choice || approve.isPending}
                      onClick={() => {
                        if (!choice) return;
                        approve.mutate(
                          { id: r.id, sub: choice },
                          {
                            onSuccess: () => {
                              setOpen(null);
                              setOverride((p) => {
                                const n = { ...p };
                                delete n[r.id];
                                return n;
                              });
                            },
                          },
                        );
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="stamp stamp-square"
                      onClick={() => setOpen(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
