import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

type Detail = {
  counterparty: {
    id: string;
    name: string;
    default_settlement_method: string | null;
    archived_at: string | null;
    created_at: string;
  };
  splits: Array<{
    id: string;
    direction: 'i_owe' | 'they_owe';
    original_cents: number;
    remaining_cents: number;
    reason: string;
    created_at: string;
    closed_at: string | null;
  }>;
  events: Array<{
    id: string;
    split_id: string;
    delta_cents: number;
    transaction_id: string | null;
    note: string | null;
    created_at: string;
  }>;
};

function fmtDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CounterpartyPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['counterparty', id],
    queryFn: () => api.get<Detail>(`/api/counterparties/${id}`),
    enabled: !!id,
  });

  const settle = useMutation({
    mutationFn: ({ splitId, amount }: { splitId: string; amount: number }) =>
      api.post(`/api/splits/${splitId}/event`, { delta_cents: -amount, note: 'marked paid' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparty', id] });
      qc.invalidateQueries({ queryKey: ['counterparties'] });
    },
  });

  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [linkErr, setLinkErr] = useState<string | null>(null);

  async function sendPaymentLink(splitId: string, amount: number, recipientName: string) {
    setLinkBusy(splitId);
    setLinkErr(null);
    try {
      const res = await api.post<{ url: string }>('/api/payment-links', { split_id: splitId });
      const message = `Hey ${recipientName} — here's the tab. ${formatCents(amount)} my way: ${res.url}`;
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'Payment request', text: message, url: res.url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(res.url);
        setLinkErr('Link copied to clipboard.');
      } else {
        setLinkErr(res.url);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Send failed.';
      setLinkErr(/interac_email/i.test(msg) ? 'Set your Interac email in Settings first.' : 'Send failed.');
    } finally {
      setLinkBusy(null);
    }
  }

  if (detail.isLoading) {
    return <div className="px-4 pt-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>;
  }
  if (detail.isError || !detail.data) {
    return <div className="px-4 pt-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>Tab not found.</div>;
  }
  const { counterparty: cp, splits, events } = detail.data;

  const owesYou = splits
    .filter((s) => s.closed_at === null && s.direction === 'they_owe')
    .reduce((a, s) => a + s.remaining_cents, 0);
  const youOwe = splits
    .filter((s) => s.closed_at === null && s.direction === 'i_owe')
    .reduce((a, s) => a + s.remaining_cents, 0);
  const net = owesYou - youOwe;

  return (
    <div className="px-3 pt-4 pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-sigil" aria-hidden="true" style={{ width: 56, height: 56 }} />
            <div>
              <div className="display tracking-tight" style={{ color: 'var(--color-ink)', fontSize: 28, lineHeight: 1 }}>
                {cp.name.toUpperCase()}
              </div>
              <div className="label-tag mt-2">
                tab opened {fmtDate(cp.created_at)} &middot; {splits.length} {splits.length === 1 ? 'chit' : 'chits'}
              </div>
            </div>
          </div>
          <Link to="/today" aria-label="Back" className="label-tag" style={{ color: 'var(--color-ink-muted)' }}>
            close
          </Link>
        </header>

        <div className="perf pt-4">
          <div className="label-tag mb-2">Running balance</div>
          <div className="flex items-baseline justify-between">
            <div className="text-xs ink-muted">
              owes you {formatCents(owesYou)} &middot; you owe {formatCents(youOwe)}
            </div>
            <div
              className="hero-num"
              style={{ color: net > 0 ? 'var(--cat-savings)' : net < 0 ? 'var(--cat-indulgence)' : 'var(--color-ink)' }}
            >
              {net > 0 ? '+' : net < 0 ? '−' : ''}
              {formatCents(Math.abs(net))}
            </div>
          </div>
          <div className="text-xs ink-muted mt-1">
            {net > 0 ? 'they owe you' : net < 0 ? 'you owe them' : 'settled — clean slate'}
          </div>
        </div>

        <div className="perf pt-4">
          <div className="label-tag mb-2">Chits</div>
          {splits.length === 0 ? (
            <div className="text-sm ink-muted">No chits yet.</div>
          ) : (
            <ul className="flex flex-col">
              {splits.map((s) => {
                const sEvents = events.filter((e) => e.split_id === s.id);
                const dirLabel = s.direction === 'they_owe' ? 'owes you' : 'you owe';
                return (
                  <li
                    key={s.id}
                    className="py-3"
                    style={{ borderTop: '1px dashed var(--color-hairline-ink)' }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex flex-col">
                        <div className="text-sm" style={{ color: 'var(--color-ink)' }}>{s.reason}</div>
                        <div className="label-tag mt-0.5">
                          {dirLabel} &middot; {fmtDate(s.created_at)}
                          {s.closed_at && <> &middot; settled {fmtDate(s.closed_at)}</>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div
                          className="num text-sm"
                          style={{
                            color: s.closed_at
                              ? 'var(--color-ink-muted)'
                              : s.direction === 'they_owe'
                              ? 'var(--cat-savings)'
                              : 'var(--cat-indulgence)',
                            textDecoration: s.closed_at ? 'line-through' : 'none',
                          }}
                        >
                          {formatCents(s.remaining_cents)}
                        </div>
                        {s.original_cents !== s.remaining_cents && (
                          <div className="label-tag" style={{ color: 'var(--color-ink-muted)' }}>
                            of {formatCents(s.original_cents)}
                          </div>
                        )}
                        {!s.closed_at && (
                          <div className="flex gap-1.5">
                            {s.direction === 'they_owe' && (
                              <button
                                className="postage"
                                style={{ minWidth: 76, padding: '6px 8px 4px', transform: 'rotate(-2deg)' }}
                                disabled={linkBusy === s.id}
                                onClick={() => sendPaymentLink(s.id, s.remaining_cents, cp.name)}
                              >
                                <span className="postage-denom" style={{ fontSize: 8 }}>$0.47</span>
                                <span className="postage-label" style={{ fontSize: 9 }}>
                                  {linkBusy === s.id ? 'Sending' : <>Send<br />link</>}
                                </span>
                              </button>
                            )}
                            <button
                              className="stamp stamp-gold"
                              style={{ padding: '3px 8px', fontSize: 10 }}
                              disabled={settle.isPending}
                              onClick={() => settle.mutate({ splitId: s.id, amount: s.remaining_cents })}
                            >
                              Paid
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {sEvents.length > 0 && (
                      <ul className="mt-2 ml-3 flex flex-col gap-1">
                        {sEvents.map((ev) => (
                          <li key={ev.id} className="flex items-baseline justify-between text-xs ink-muted">
                            <div>
                              {ev.note ?? 'payment'} &middot; {fmtDate(ev.created_at)}
                            </div>
                            <div className="num">
                              {ev.delta_cents > 0 ? '+' : ''}{formatCents(ev.delta_cents)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {linkErr && (
          <div className="text-xs ink-muted text-center" style={{ wordBreak: 'break-all' }}>
            {linkErr}
          </div>
        )}

        <div className="perf pt-4 text-center label-tag" style={{ letterSpacing: '0.32em' }}>
          * * end of tab * *
        </div>
      </section>
    </div>
  );
}
