import { useState } from 'react';

const DEMO = {
  from: 'Bowgull',
  reason: 'Lady Marmalade brunch - Leslieville',
  amount_cents: 4750,
  email: 'bowgull@icloud.com',
  security_answer: 'brunch',
  created_at: '2026-04-27',
  settled: false,
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function CopyStamp({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className={`stamp stamp-square ${copied ? 'stamp-gold' : ''}`}
      style={{ fontSize: 11, minWidth: 64 }}
    >
      {copied ? 'copied' : label}
    </button>
  );
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const kicker: React.CSSProperties = { ...mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' };

export default function PaymentLinkMockup() {
  const [showSettled] = useState(DEMO.settled);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        overflowY: 'auto',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px 48px',
      }}
    >
      {/* Top wordmark */}
      <div style={{ ...kicker, marginBottom: 24, opacity: 0.6 }}>
        declyne · payment request
      </div>

      {/* Receipt */}
      <div
        className="receipt stub-top stub-bottom"
        style={{ width: '100%', maxWidth: 380, padding: '28px 24px 24px' }}
      >
        {/* Header row: FROM + mascot */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ ...kicker, marginBottom: 4 }}>from</div>
            <div className="display" style={{ fontSize: 28, marginBottom: 2, color: 'var(--color-ink)' }}>
              {DEMO.from}
            </div>
            <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink-muted)' }}>
              {DEMO.created_at}
            </div>
          </div>
          <img
            src="/brand/mascot-head.png"
            alt=""
            aria-hidden="true"
            style={{ width: 64, height: 64, objectFit: 'contain', opacity: 0.88, marginTop: 2 }}
          />
        </div>

        {/* Perf */}
        <div className="perf" style={{ marginBottom: 20 }} />

        {/* Amount */}
        <div style={{ ...kicker, marginBottom: 6 }}>amount owing</div>
        <div className="hero-num" style={{ color: 'var(--color-ink)', marginBottom: 4 }}>
          {formatCents(DEMO.amount_cents)}
          <span style={{ fontSize: 18, marginLeft: 4, opacity: 0.5 }}>CAD</span>
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink-muted)', marginBottom: 24 }}>
          {DEMO.reason}
        </div>

        {/* Perf */}
        <div className="perf" style={{ marginBottom: 20 }} />

        {showSettled ? (
          <div style={{ textAlign: 'center', ...mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-ink-muted)', padding: '16px 0' }}>
            ** this tab is settled **
          </div>
        ) : (
          <>
            <div style={{ ...kicker, marginBottom: 12 }}>send via interac e-transfer</div>

            {/* Email */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--color-hairline-ink)', padding: '10px 0' }}>
              <div>
                <div style={{ ...kicker, fontSize: 9, marginBottom: 2 }}>email</div>
                <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>{DEMO.email}</div>
              </div>
              <CopyStamp value={DEMO.email} label="copy" />
            </div>

            {/* Amount */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--color-hairline-ink)', padding: '10px 0' }}>
              <div>
                <div style={{ ...kicker, fontSize: 9, marginBottom: 2 }}>amount</div>
                <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>{formatCents(DEMO.amount_cents)}</div>
              </div>
              <CopyStamp value={(DEMO.amount_cents / 100).toFixed(2)} label="copy" />
            </div>

            {/* Security answer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--color-hairline-ink)', borderBottom: '1px dashed var(--color-hairline-ink)', padding: '10px 0', marginBottom: 24 }}>
              <div>
                <div style={{ ...kicker, fontSize: 9, marginBottom: 2 }}>security answer</div>
                <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>{DEMO.security_answer}</div>
              </div>
              <CopyStamp value={DEMO.security_answer} label="copy" />
            </div>

            {/* Instructions */}
            <div style={{ ...mono, fontSize: 11, lineHeight: 1.6, color: 'var(--color-ink-muted)' }}>
              Open your bank app, send via Interac e-Transfer, paste these in.
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 28, textAlign: 'center', ...mono, fontSize: 10, letterSpacing: '0.18em', color: 'var(--color-ink-muted)', opacity: 0.6 }}>
          ** sent via{' '}
          <span>
            <span style={{ color: 'var(--color-accent-purple, #7c5cbf)', fontWeight: 600 }}>D</span>eclyne
          </span>
          {' '}**
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: 16, ...mono, fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', opacity: 0.5, maxWidth: 320, lineHeight: 1.6 }}>
        This link expires in 90 days. Once the transfer is received, it marks automatically.
      </div>
    </div>
  );
}
