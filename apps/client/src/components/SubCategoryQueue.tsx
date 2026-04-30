import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

type Group = 'essentials' | 'lifestyle' | 'indulgence';

interface QueueRow {
  id: string;
  display_name: string;
  normalized_key: string;
  sub_category: string | null;
  category_group: Group | null;
  spend_90d_cents: number;
  txn_count_90d: number;
  /** True when sub_category was confirmed but no longer matches its group's
   *  allowed list (usually because category was changed after confirmation). */
  mismatch?: boolean;
}

const ESSENTIALS_SUBS = ['groceries', 'transit', 'health'] as const;

const LIFESTYLE_SUBS = [
  'shopping',
  'home',
  'personal_care',
  'entertainment',
] as const;

const INDULGENCE_SUBS = [
  'bars',
  'takeout',
  'delivery',
  'weed',
  'streaming',
  'gaming',
  'treats',
] as const;

const LABEL: Record<string, string> = {
  groceries: 'groceries',
  transit: 'transit',
  shopping: 'shopping',
  home: 'home',
  personal_care: 'personal care',
  entertainment: 'entertainment',
  health: 'health',
  bars: 'bars',
  takeout: 'takeout',
  delivery: 'delivery',
  weed: 'weed',
  streaming: 'streaming',
  gaming: 'gaming',
  treats: 'treats',
};

const SUB_VAR: Record<string, string> = {
  groceries: '--sub-groceries',
  transit: '--sub-transit',
  shopping: '--sub-shopping',
  home: '--sub-home',
  personal_care: '--sub-personal-care',
  entertainment: '--sub-entertainment',
  health: '--sub-health',
  bars: '--sub-bars',
  takeout: '--sub-takeout',
  delivery: '--sub-delivery',
  weed: '--sub-weed',
  streaming: '--sub-streaming',
  gaming: '--sub-gaming',
  treats: '--sub-treats',
};

function allSubs(): readonly string[] {
  return [...ESSENTIALS_SUBS, ...LIFESTYLE_SUBS, ...INDULGENCE_SUBS];
}

const ROW_TILTS = [-1.4, 1.1, -0.9, 1.6, -1.8, 0.8, -1.2, 1.3, -1.5, 0.6];

function tiltFor(idx: number): number {
  return ROW_TILTS[idx % ROW_TILTS.length] ?? 0;
}

export default function SubCategoryQueue() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<string, string>>({});

  // Stack-mode state. Long-press a row to pick it; tap others to add/remove.
  // Tap empty space (or the release button) to clear the stack and exit.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const pressTimer = useRef<number | null>(null);
  // When the long-press fires, the user is still holding the button. The
  // pointerup that follows will trigger a `click`, which would then run
  // handleRowClick and *toggle off* the row we just picked. This ref lets
  // the click handler suppress that one trailing click.
  const longPressFiredFor = useRef<string | null>(null);
  // The document-level tap-empty-desk listener releases the stack on the
  // very tap that opens the next editor. This ref lets us swallow the click
  // that follows that release-tap.
  const releasedAt = useRef<number>(0);

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

  const approveStack = useMutation({
    mutationFn: async (rows: QueueRow[]) => {
      // Each row keeps its detector guess (or the inline override if user
      // edited it). Run sequentially so a single failure surfaces clearly
      // instead of silent partial success.
      let count = 0;
      for (const r of rows) {
        const sub = override[r.id] ?? r.sub_category;
        if (!sub) continue;
        await api.patch(`/api/merchants/${r.id}`, {
          sub_category: sub,
          sub_category_confirmed: 1,
        });
        count++;
      }
      return count;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sub-category-queue'] });
      qc.invalidateQueries({ queryKey: ['merchants', 'habits'] });
      setPicked(new Set());
      setOverride({});
    },
  });

  // Tap-empty-desk listener: any pointerdown outside a row releases the stack.
  useEffect(() => {
    if (picked.size === 0) return;
    function onTap(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-stack-row]') || target.closest('[data-stack-strip]')) return;
      releasedAt.current = Date.now();
      setPicked(new Set());
    }
    document.addEventListener('pointerdown', onTap);
    return () => document.removeEventListener('pointerdown', onTap);
  }, [picked.size]);

  const rows = queue.data?.merchants ?? [];
  if (rows.length === 0) return null;

  const stackedRows = rows.filter((r) => picked.has(r.id));

  function startPress(id: string) {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      // Long-press fires: enter stack mode with this row picked. Mark the
      // row so the trailing click (after pointerup) is swallowed instead of
      // toggling it back off.
      longPressFiredFor.current = id;
      setPicked((prev) => {
        const n = new Set(prev);
        n.add(id);
        return n;
      });
      pressTimer.current = null;
    }, 450);
  }

  function cancelPress() {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handleRowClick(id: string) {
    // 1. Click that immediately follows a long-press trigger: the row is
    //    already in `picked`. Swallow this click so we don't toggle it off.
    if (longPressFiredFor.current === id) {
      longPressFiredFor.current = null;
      return;
    }
    // 2. Click on a row immediately after a tap-empty-desk release. The
    //    pointerdown released the stack; this click would now open the
    //    inline editor — which feels like the row "ate" the release. Eat
    //    the click for ~250ms instead.
    if (Date.now() - releasedAt.current < 250) {
      return;
    }
    // 3. Already in stack mode — tap toggles membership.
    if (picked.size > 0) {
      setPicked((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      return;
    }
    // 4. Default: tap opens the inline editor.
    setOpen((cur) => (cur === id ? null : id));
  }

  return (
    <section className="ledger-section pt-2" style={{ position: 'relative' }}>
      <span className="ledger-section-kicker">
        <span className="num" style={{ color: 'var(--color-accent-gold)' }}>
          01
        </span>{' '}
        Sub-categories
      </span>
      <span className="ledger-section-meta">
        {rows.length} to confirm
        {picked.size === 0 && (
          <span className="ml-2" style={{ color: 'var(--color-text-muted)' }}>
            · long-press to stack
          </span>
        )}
      </span>

      <div className="flex flex-col">
        {rows.map((r, idx) => {
          const isOpen = open === r.id;
          const isPicked = picked.has(r.id);
          const guess = r.sub_category;
          const choice = override[r.id] ?? guess ?? '';
          const opts = allSubs();
          const guessVar = guess ? SUB_VAR[guess] : null;
          const tilt = tiltFor(idx);
          return (
            <div
              key={r.id}
              data-stack-row="1"
              className="ledger-row"
              style={{
                flexDirection: 'column',
                alignItems: 'stretch',
                transform: isPicked ? `rotate(${tilt * 0.18}deg)` : 'none',
                transition: 'transform 200ms cubic-bezier(.2,.8,.2,1)',
              }}
            >
              <button
                type="button"
                className="row-tap"
                onPointerDown={() => startPress(r.id)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onClick={() => handleRowClick(r.id)}
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
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'manipulation',
                }}
              >
                <div className="ledger-row-main">
                  <span className="ledger-row-label">
                    {r.display_name}
                    {r.mismatch && (
                      <span
                        className="label-tag"
                        style={{
                          marginLeft: 8,
                          color: 'var(--cat-indulgence)',
                          letterSpacing: '0.16em',
                        }}
                      >
                        STALE
                      </span>
                    )}
                  </span>
                  <span className="ledger-row-hint">
                    {guess ? (
                      <>
                        guess ·{' '}
                        {guessVar && (
                          <span
                            aria-hidden="true"
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: `var(${guessVar})`,
                              marginRight: 4,
                              verticalAlign: 'baseline',
                            }}
                          />
                        )}
                        {LABEL[guess] ?? guess}
                      </>
                    ) : (
                      'unrecognized'
                    )}
                    {' · '}
                    {r.category_group ?? '?'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isPicked && <PickedStamp tilt={tilt} />}
                  <span className="ledger-row-value font-mono text-sm">
                    {formatCents(r.spend_90d_cents)}
                  </span>
                </div>
              </button>

              {isOpen && picked.size === 0 && (
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
                      style={!choice ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
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

      {picked.size > 0 && (
        <ApproveStripe
          count={picked.size}
          allConfirmable={stackedRows.every(
            (r) => override[r.id] ?? r.sub_category,
          )}
          pending={approveStack.isPending}
          onApprove={() => approveStack.mutate(stackedRows)}
          onRelease={() => setPicked(new Set())}
        />
      )}
    </section>
  );
}

function PickedStamp({ tilt }: { tilt: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#c45b5b',
        border: '1.5px solid #c45b5b',
        padding: '2px 6px',
        borderRadius: 2,
        transform: `rotate(${tilt}deg)`,
        display: 'inline-block',
        background: 'transparent',
      }}
    >
      ✓ picked
    </span>
  );
}

function ApproveStripe({
  count,
  allConfirmable,
  pending,
  onApprove,
  onRelease,
}: {
  count: number;
  allConfirmable: boolean;
  pending: boolean;
  onApprove: () => void;
  onRelease: () => void;
}) {
  return (
    <div
      data-stack-strip="1"
      style={{
        position: 'sticky',
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        left: 0,
        right: 0,
        marginTop: 12,
        marginLeft: -18, // reach the page edges through .ledger-page padding
        marginRight: -18,
        padding: '12px 18px',
        background: 'rgba(20, 16, 26, 0.92)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--rule-ink-strong)',
        borderBottom: '1px solid var(--rule-ink-strong)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--color-text-primary)',
          }}
        >
          {count} picked
        </span>
        <button
          type="button"
          onClick={onRelease}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          tap empty space to release
        </button>
      </div>
      <button
        type="button"
        className="stamp stamp-purple"
        disabled={!allConfirmable || pending}
        onClick={onApprove}
        style={{ transform: 'rotate(-1.4deg)' }}
      >
        {pending ? 'Stamping.' : 'Approve stack'}
      </button>
    </div>
  );
}
