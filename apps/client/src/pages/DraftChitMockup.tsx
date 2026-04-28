import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function DraftChitMockup() {
  return (
    <main className="ledger-page">
      <header style={{ marginBottom: 24 }}>
        <Link to="/paycheque" className="stamp stamp-square" style={{ marginBottom: 12 }}>
          BACK
        </Link>
        <h1 className="display" style={{ fontSize: 32, lineHeight: 1.1, margin: 0 }}>
          Draft + Chit · mockup
        </h1>
        <p className="ink-muted" style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Pick one per row. Or kill them both.
        </p>
      </header>

      <Section kicker="01" title="Draft this paycheque" sub="Currently a tear-tab. Once per period. Heavy commitment.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 28 }}>
          <Variant
            label="A · Date stamp (rubber)"
            note="Accountant's date stamp. Ceremonial press. Rotates -2deg on tap. Embossed shadow underneath."
          >
            <DateStampVariant />
          </Variant>

          <Variant
            label="B · Carbon pull"
            note="Corner of a fresh sheet peeks behind the period header. Tap the corner to pull a duplicate down."
          >
            <CarbonPullVariant />
          </Variant>

          <Variant
            label="C · Ledger-rule punch"
            note="A punch-hole reinforcement ring. Tap = ring darkens, hole punches through, draft drops in below."
          >
            <PunchVariant />
          </Variant>
        </div>
      </Section>

      <Section kicker="02" title="New chit" sub="Currently a hidden long-press. Lightweight. Many per period.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 28 }}>
          <Variant
            label="A · Visible chit pad"
            note="A real stack of blank chits sitting under Open Tabs. Top corner pre-lifted. Tap = peels off, lands as form."
          >
            <ChitPadVariant />
          </Variant>

          <Variant
            label="B · Per-row postage"
            note="Tiny + chit postage on every counterparty row. Long-press goes away. Affordance is on the page."
          >
            <PerRowPostageVariant />
          </Variant>

          <Variant
            label="C · Spike file"
            note="Vintage receipt spike. Blank chits impaled top-down. Tap the spike = top chit lifts off."
          >
            <SpikeVariant />
          </Variant>
        </div>
      </Section>

      <p className="ink-muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center', marginTop: 32 }}>
        ** mockup only · nothing wired **
      </p>
    </main>
  );
}

function Section({ kicker, title, sub, children }: { kicker: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="ledger-section" style={{ marginBottom: 40 }}>
      <span className="ledger-section-kicker">{kicker}</span>
      <h2 className="display" style={{ fontSize: 22, margin: '8px 0 4px' }}>{title}</h2>
      <p className="ink-muted" style={{ fontSize: 13, marginBottom: 20 }}>{sub}</p>
      {children}
    </section>
  );
}

function Variant({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }}>
        {label}
      </div>
      <div
        style={{
          background: 'var(--color-paper)',
          color: 'var(--color-ink)',
          padding: '32px 20px',
          borderRadius: 4,
          minHeight: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
      <p className="ink-muted" style={{ fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>{note}</p>
    </div>
  );
}

/* ---------- DRAFT VARIANTS ---------- */

function DateStampVariant() {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={() => setPressed(p => !p)}
      style={{
        position: 'relative',
        width: 180,
        height: 110,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: '3px double var(--color-ink)',
          borderRadius: 6,
          padding: '10px 14px',
          background: 'var(--color-paper-shade)',
          transform: pressed ? 'rotate(-2deg) translateY(2px) scale(0.98)' : 'rotate(-2deg)',
          boxShadow: pressed ? '0 1px 0 rgba(0,0,0,0.15)' : '0 4px 0 rgba(0,0,0,0.12), 0 6px 12px rgba(0,0,0,0.18)',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 10, opacity: 0.7 }}>declyne</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '0.04em', fontWeight: 600 }}>DRAFT</span>
        <span style={{ fontSize: 10 }}>2026 · per 19</span>
      </div>
    </button>
  );
}

function CarbonPullVariant() {
  const [pulled, setPulled] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 320, height: 140 }}>
      {/* duplicate sheet behind */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--color-paper-shade)',
          borderRadius: 2,
          transform: pulled ? 'translate(8px, 14px) rotate(0.6deg)' : 'translate(2px, 4px) rotate(0.4deg)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          transition: 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      />
      {/* main sheet */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--color-paper)',
          borderRadius: 2,
          padding: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, opacity: 0.6 }}>this paycheque</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginTop: 2 }}>$4,250.00</div>
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>apr 24 → may 7</div>
          </div>
          {/* corner pull tab */}
          <button
            onClick={() => setPulled(p => !p)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 44,
              height: 44,
              background: 'var(--color-paper-shade)',
              border: 'none',
              clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label="Pull to draft"
          />
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.18em',
              transform: 'rotate(45deg)',
              transformOrigin: 'center',
              pointerEvents: 'none',
            }}
          >
            pull
          </span>
        </div>
      </div>
    </div>
  );
}

function PunchVariant() {
  const [punched, setPunched] = useState(false);
  return (
    <button
      onClick={() => setPunched(p => !p)}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '2px solid var(--color-ink)',
          background: punched ? 'var(--color-ink)' : 'transparent',
          position: 'relative',
          transition: 'background 200ms ease, transform 200ms ease',
          transform: punched ? 'scale(0.94)' : 'scale(1)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 8,
            borderRadius: '50%',
            border: '1px dashed',
            borderColor: punched ? 'var(--color-paper)' : 'var(--color-ink)',
            opacity: 0.5,
          }}
        />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        {punched ? '· drafted ·' : 'punch to draft'}
      </span>
    </button>
  );
}

/* ---------- CHIT VARIANTS ---------- */

function ChitPadVariant() {
  const [torn, setTorn] = useState(false);
  return (
    <div style={{ position: 'relative', width: 160, height: 140 }}>
      {/* layer 3 */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--color-paper-shade)', transform: 'translate(6px, 6px) rotate(1.5deg)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
      {/* layer 2 */}
      <div style={{ position: 'absolute', inset: 0, background: '#ebe4d4', transform: 'translate(3px, 3px) rotate(-0.8deg)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
      {/* top chit (lifted) */}
      <button
        onClick={() => setTorn(t => !t)}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--color-paper)',
          border: 'none',
          padding: '14px 16px',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          transform: torn ? 'translate(-12px, -28px) rotate(-6deg) scale(1.03)' : 'rotate(-1.5deg)',
          transformOrigin: 'top left',
          transition: 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--color-ink)',
        }}
      >
        <div style={{ position: 'absolute', top: -4, left: 16, right: 16, height: 8, background: 'var(--color-paper)', clipPath: 'polygon(0 100%, 5% 0, 12% 100%, 19% 0, 26% 100%, 33% 0, 40% 100%, 47% 0, 54% 100%, 61% 0, 68% 100%, 75% 0, 82% 100%, 89% 0, 96% 100%, 100% 100%)' }} />
        <div style={{ fontSize: 9, opacity: 0.6 }}>blank chit</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginTop: 4, letterSpacing: 0 }}>+ new tab</div>
        <div style={{ fontSize: 9, opacity: 0.6, marginTop: 8 }}>tear ↗</div>
      </button>
    </div>
  );
}

function PerRowPostageVariant() {
  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      {[
        { name: 'Marcus Chen', amount: '+$47.50', tone: 'pos' as const },
        { name: 'Priya Shah', amount: '−$82.00', tone: 'neg' as const },
        { name: 'Diego Alvarez', amount: '+$36.00', tone: 'pos' as const },
      ].map((cp, i) => (
        <div
          key={cp.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 4px',
            borderTop: i === 0 ? 'none' : '1px dashed var(--color-hairline)',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>{cp.name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.6 }}>1 chit · 0d open</div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: cp.tone === 'pos' ? 'var(--cat-savings)' : 'var(--cat-indulgence)' }}>{cp.amount}</div>
          <button
            style={{
              minWidth: 56,
              padding: '6px 8px 4px',
              background: 'var(--color-paper-shade)',
              border: '1px dashed var(--color-ink)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              transform: `rotate(${i % 2 === 0 ? -2 : 1.4}deg)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1.1,
              color: 'var(--color-ink)',
            }}
          >
            <span style={{ fontSize: 14, fontFamily: 'var(--font-display)' }}>+</span>
            <span style={{ marginTop: 2 }}>chit</span>
          </button>
        </div>
      ))}
      <div
        style={{
          marginTop: 16,
          padding: '10px 12px',
          background: 'var(--color-paper-shade)',
          border: '1px dashed var(--color-ink)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          textAlign: 'center',
          transform: 'rotate(-0.6deg)',
          cursor: 'pointer',
        }}
      >
        + chit · from scratch
      </div>
    </div>
  );
}

function SpikeVariant() {
  const [lifted, setLifted] = useState(false);
  return (
    <div style={{ position: 'relative', width: 160, height: 180, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      {/* base */}
      <div style={{ width: 120, height: 8, background: 'var(--color-ink)', borderRadius: 1 }} />
      {/* spike rod */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 2,
          height: 150,
          background: 'var(--color-ink)',
        }}
      />
      {/* spike tip */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)',
          width: 6,
          height: 6,
          background: 'var(--color-ink)',
        }}
      />
      {/* impaled chits */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: 10 + i * 4,
            left: '50%',
            transform: `translateX(-50%) rotate(${i % 2 === 0 ? -2 : 2}deg)`,
            width: 110,
            height: 26,
            background: i === 0 ? '#ebe4d4' : 'var(--color-paper-shade)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
        />
      ))}
      {/* top chit (the liftable one) */}
      <button
        onClick={() => setLifted(l => !l)}
        style={{
          position: 'absolute',
          bottom: lifted ? 90 : 22,
          left: '50%',
          transform: `translateX(-50%) rotate(${lifted ? -8 : 1}deg)`,
          width: 120,
          height: 50,
          background: 'var(--color-paper)',
          border: 'none',
          padding: '8px 10px',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--color-ink)',
          transition: 'bottom 320ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          textAlign: 'left',
        }}
      >
        <div style={{ opacity: 0.6 }}>blank chit</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginTop: 2, letterSpacing: 0 }}>+ new tab</div>
      </button>
    </div>
  );
}
