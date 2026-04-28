import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import { MailArt } from '../components/PostageArt';

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

function daysSince(iso: string): number {
  const ms = Date.now() - Date.parse(iso);
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function ageColor(days: number): string {
  if (days > 30) return 'var(--cat-indulgence)';
  if (days >= 14) return 'var(--color-accent-gold)';
  return 'var(--color-ink-muted)';
}

export function CounterpartyReceipt({ id, onClose }: { id: string; onClose: () => void }) {
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

  const [preview, setPreview] = useState<{ amount: number; reason: string } | null>(null);

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

  const balanceParts: string[] = [];
  if (owesYou > 0) balanceParts.push(`owes you ${formatCents(owesYou)}`);
  if (youOwe > 0) balanceParts.push(`you owe ${formatCents(youOwe)}`);
  const balanceLine = balanceParts.length > 0 ? balanceParts.join(' · ') : 'no open chits';

  return (
    <>
    {preview && (
      <PaymentLinkPreview
        amount={preview.amount}
        reason={preview.reason}
        fromName="Bowgull"
        toName={cp.name}
        onClose={() => setPreview(null)}
      />
    )}
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="label-tag"
            style={{ color: 'var(--color-ink-muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
          >
            close
          </button>
        </header>

        <div className="perf pt-4">
          <div className="label-tag mb-2">Running balance</div>
          <div className="flex items-baseline justify-between">
            <div className="text-xs ink-muted">{balanceLine}</div>
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
                          {!s.closed_at && (() => {
                            const d = daysSince(s.created_at);
                            return (
                              <>
                                {' '}&middot;{' '}
                                <span style={{ color: ageColor(d) }}>{d}d open</span>
                              </>
                            );
                          })()}
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
                                style={{ minWidth: 64, padding: '8px 10px 6px', transform: 'rotate(-2deg)' }}
                                onClick={() => setPreview({ amount: s.remaining_cents, reason: s.reason })}
                              >
                                <span className="postage-art" style={{ width: 24, height: 24 }}><MailArt /></span>
                                <span className="postage-label" style={{ fontSize: 8 }}>Send<br />link</span>
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

        <div className="perf pt-4 text-center label-tag" style={{ letterSpacing: '0.32em' }}>
          * * end of tab * *
        </div>
      </section>
    </>
  );
}

export default function CounterpartyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  if (!id) {
    return <div className="px-4 pt-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>Tab not found.</div>;
  }
  return (
    <div className="px-3 pt-4 pb-6">
      <CounterpartyReceipt id={id} onClose={() => navigate('/today')} />
    </div>
  );
}

function PaymentLinkPreview({
  amount: amountCents,
  reason,
  fromName,
  toName: _toName,
  onClose,
}: {
  amount: number;
  reason: string;
  fromName: string;
  toName: string;
  onClose: () => void;
}) {
  const amount = `$${(amountCents / 100).toFixed(2)}`;
  const today = new Date().toISOString().slice(0, 10);
  const email = 'your.interac@email.com';
  const securityAnswer = 'yourpassword';
  const [copied, setCopied] = useState<string | null>(null);

  function copyVal(val: string, key: string) {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  const hairline = '1px dashed rgba(26,20,29,0.18)';
  const mono = 'var(--font-mono)';
  const display = 'var(--font-display)';
  const ink = '#1a141d';
  const inkMuted = '#6b6470';
  const paper = '#f2ece0';
  const tearMask = 'radial-gradient(circle at 4px 50%, transparent 3px, #000 3.5px)';
  const bg = 'rgba(26,20,29,0.96)';

  const rows = [
    { key: 'email', label: 'email', value: email },
    { key: 'amount', label: 'amount', value: (amountCents / 100).toFixed(2) },
    { key: 'sa', label: 'security answer', value: securityAnswer },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', overflowY: 'auto',
        padding: '24px 16px 64px',
      }}
      onClick={onClose}
    >
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
          declyne · payment request
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4, cursor: 'pointer',
            color: 'rgba(255,255,255,0.85)', fontFamily: mono,
            fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '6px 14px', lineHeight: 1,
          }}
        >
          × close
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380, padding: '28px 24px 24px',
          background: paper, color: ink,
          position: 'relative',
          boxShadow: '0 14px 28px rgba(0,0,0,0.45), 0 4px 8px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ position: 'absolute', left: -1, right: -1, top: -10, height: 10, background: bg, WebkitMaskImage: tearMask, maskImage: tearMask, WebkitMaskSize: '8px 10px', maskSize: '8px 10px' }} />
        <div style={{ position: 'absolute', left: -1, right: -1, bottom: -10, height: 10, background: bg, WebkitMaskImage: tearMask, maskImage: tearMask, WebkitMaskSize: '8px 10px', maskSize: '8px 10px', transform: 'scaleY(-1)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: inkMuted, marginBottom: 4 }}>from</div>
            <div style={{ fontFamily: display, fontSize: 28, fontWeight: 600, lineHeight: 1, color: ink, margin: '4px 0 2px' }}>{fromName}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: inkMuted }}>{today}</div>
          </div>
          <span className="mascot-sigil" aria-hidden="true" style={{ width: 64, height: 64, opacity: 0.88, marginTop: 2 }} />
        </div>

        <div style={{ borderTop: hairline, margin: '20px 0' }} />

        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: inkMuted, marginBottom: 6 }}>amount owing</div>
        <div style={{ fontFamily: display, fontWeight: 600, fontSize: 44, lineHeight: 1, letterSpacing: '-0.02em', color: ink, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
          {amount}<span style={{ fontSize: 18, marginLeft: 4, opacity: 0.5 }}>CAD</span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 11, color: inkMuted, marginBottom: 24 }}>{reason}</div>

        <div style={{ borderTop: hairline, margin: '20px 0' }} />

        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: inkMuted, marginBottom: 12 }}>send via interac e-transfer</div>

        {rows.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: hairline,
              ...(i === rows.length - 1 ? { borderBottom: hairline, marginBottom: 24 } : {}),
              padding: '10px 0',
            }}
          >
            <div>
              <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: inkMuted, marginBottom: 2 }}>{row.label}</div>
              <div style={{ fontFamily: mono, fontSize: 13, color: ink }}>{row.value}</div>
            </div>
            <button
              onClick={() => copyVal(row.value, row.key)}
              style={{
                fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
                background: copied === row.key ? '#c8a96a' : paper,
                color: copied === row.key ? paper : ink,
                border: 'none', borderRadius: 2, padding: '8px 12px', minWidth: 64, cursor: 'pointer',
                boxShadow: copied === row.key
                  ? `inset 0 0 0 1px rgba(26,20,29,0.55), inset 0 0 0 3px #c8a96a, inset 0 0 0 4px rgba(26,20,29,0.55)`
                  : `inset 0 0 0 1px rgba(26,20,29,0.55), inset 0 0 0 3px ${paper}, inset 0 0 0 4px rgba(26,20,29,0.55)`,
                transform: 'rotate(-0.6deg)',
              }}
            >
              {copied === row.key ? 'copied' : 'copy'}
            </button>
          </div>
        ))}

        <p style={{ fontFamily: mono, fontSize: 11, lineHeight: 1.6, color: inkMuted, margin: 0 }}>
          Open your bank app, send via Interac e-Transfer, paste these in.
        </p>

        <div style={{ marginTop: 28, textAlign: 'center', fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', color: inkMuted, opacity: 0.6 }}>
          ** sent via <span style={{ color: '#9e78b9', fontWeight: 600 }}>D</span>eclyne **
        </div>
      </div>

      <div style={{ marginTop: 16, fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
        This link expires in 90 days. Once the transfer is received, it marks automatically.
      </div>
      <div style={{ marginTop: 12, fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        demo preview · no link generated
      </div>
    </div>
  );
}
