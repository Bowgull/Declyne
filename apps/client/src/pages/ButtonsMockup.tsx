import { useState } from 'react';
import { MailArt, SeedArt, BagArt } from '../components/PostageArt';

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const kicker: React.CSSProperties = {
  ...mono,
  fontSize: 10,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'var(--color-ink-muted)',
};
const kickerDark: React.CSSProperties = {
  ...mono,
  fontSize: 10,
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

function SectionLabel({ n, title, note }: { n: string; title: string; note: string }) {
  return (
    <div style={{ margin: '44px 0 16px' }}>
      <div style={{ ...kickerDark, marginBottom: 6 }}>
        <span style={{ color: 'var(--color-accent-gold, #c8a96a)', marginRight: 8 }}>§ {n}</span>
        {title}
      </div>
      <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        {note}
      </div>
    </div>
  );
}

export default function ButtonsMockup() {
  const [tornCount, setTornCount] = useState(0);
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const [voided, setVoided] = useState<Record<string, boolean>>({});
  const [linkSent, setLinkSent] = useState(false);
  const [planSent, setPlanSent] = useState(false);

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Page header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...kickerDark, marginBottom: 4 }}>§ MOCKUP · ACTION VOCABULARY V2</div>
        <div className="display" style={{ fontSize: 30, color: 'var(--color-text-primary)' }}>
          Icons + words. Mixed.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Four shapes. Each one earns its place.
        </div>
      </div>

      {/* ---------- 01 — TEAR-TAB v2 with motion glyph ---------- */}
      <SectionLabel
        n="01"
        title="Tear-tab v2 — motion glyph leads, label follows"
        note="Down-arrow in a ring sits on the perforation. Hover lifts the arrow 2px. Workhorse for 'produce a chit / draft' actions on receipts."
      />

      <div className="receipt stub-top" style={{ padding: '20px 18px 0' }}>
        <div style={{ ...kicker, marginBottom: 10 }}>open tabs · 4</div>

        {[
          { name: 'Marcus Chen', amt: '+$47.50', tone: 'pos' as const },
          { name: 'Luther', amt: '-$1,100', tone: 'neg' as const },
          { name: 'Priya Shah', amt: '-$82', tone: 'neg' as const },
          { name: 'Diego Alvarez', amt: '+$36', tone: 'pos' as const },
        ].map((l) => (
          <div
            key={l.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderTop: '1px dashed var(--color-hairline-ink)',
              ...mono,
              fontSize: 13,
              color: 'var(--color-ink)',
            }}
          >
            <span>{l.name}</span>
            <span className={l.tone === 'pos' ? 'tab-direction-pos' : 'tab-direction-neg'}>
              {l.amt}
            </span>
          </div>
        ))}

        <button
          className="tear-tab tear-tab-motion"
          onClick={() => setTornCount((n) => n + 1)}
        >
          <span className="cut-line" aria-hidden />
          <span className="tear-arrow" aria-hidden>↓</span>
          <span>Tear new chit</span>
          <span className="cut-line" aria-hidden />
        </button>
      </div>
      {tornCount > 0 && (
        <div style={{ ...kickerDark, marginTop: 8, color: 'var(--color-accent-gold, #c8a96a)' }}>
          torn × {tornCount}
        </div>
      )}

      <div style={{ height: 24 }} />

      <div className="receipt stub-top" style={{ padding: '20px 18px 0' }}>
        <div style={{ ...kicker, marginBottom: 6 }}>this paycheque · apr 24 → may 7</div>
        <div className="hero-num" style={{ color: 'var(--color-ink)' }}>$1,847</div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink-muted)', marginBottom: 12 }}>
          left to spend · 10d to payday
        </div>
        <div className="perf" />
        <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink-muted)', padding: '12px 0' }}>
          assigned $0 · unassigned $1,847
        </div>
        <button className="tear-tab tear-tab-motion">
          <span className="cut-line" aria-hidden />
          <span className="tear-arrow" aria-hidden>↓</span>
          <span>Draft this paycheque</span>
          <span className="cut-line" aria-hidden />
        </button>
      </div>

      {/* ---------- 02 — POSTAGE STAMPS ---------- */}
      <SectionLabel
        n="02"
        title="Postage stamps — ceremonial actions"
        note="Reserved for the few high-impact actions that deserve weight. Dashed perforation inset, slight tilt, drop shadow. Once 'sent', a gold cancellation stamp overlays. Use sparingly: Send payment link · Generate plan · Refresh prices · Get recommendation."
      />

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '12px 4px 8px', alignItems: 'flex-start' }}>
        <button
          className={`postage ${linkSent ? 'sent' : ''}`}
          data-cancel="sent · apr 27"
          onClick={() => setLinkSent(true)}
        >
          <span className="postage-denom">$0.47</span>
          <span className="postage-art"><MailArt /></span>
          <span className="postage-label">Send<br />payment link</span>
        </button>

        <button
          className={`postage ${planSent ? 'sent' : ''}`}
          data-cancel="cached · 10/hr"
          onClick={() => setPlanSent(true)}
          style={{ transform: 'rotate(1.4deg)' }}
        >
          <span className="postage-denom">AI</span>
          <span className="postage-art"><SeedArt /></span>
          <span className="postage-label">Generate<br />payoff plan</span>
        </button>

        <button className="postage" style={{ transform: 'rotate(-0.6deg)' }}>
          <span className="postage-denom">$1.20</span>
          <span className="postage-art"><BagArt /></span>
          <span className="postage-label">Refresh<br />prices</span>
        </button>
      </div>
      <div style={{ ...mono, fontSize: 10, color: 'var(--color-text-muted)', opacity: 0.6, marginTop: 8 }}>
        tap one to see the cancellation overlay
      </div>

      {/* ---------- 03 — INK MARGIN GLYPHS ---------- */}
      <SectionLabel
        n="03"
        title="Ink margin glyphs — hand-applied, not Material Design"
        note="Bigger glyphs in mascot purple, slight rotation per row so they feel pressed by hand rather than auto-laid-out. Same vocabulary as before but with personality: ✎ edit · ✦ commit · ⊘ void · ↺ undo · ▸ open."
      />

      <div className="receipt" style={{ padding: '20px 18px' }}>
        <div style={{ ...kicker, marginBottom: 8 }}>review queue · 5</div>

        {[
          { id: 'r1', glyph: '▸', desc: 'STARBUCKS #4421', amt: '$8.40', tag: 'tap to categorize', kind: '' },
          { id: 'r2', glyph: '▸', desc: 'PRESTO RELOAD', amt: '$40.00', tag: 'tap to categorize', kind: '' },
          { id: 'r3', glyph: '✦', desc: 'ENBRIDGE GAS', amt: '$108.00', tag: 'commit · essentials', kind: 'commit' },
          { id: 'r4', glyph: '↺', desc: 'AMZN MKTP CA', amt: '$23.99', tag: 'undo · was lifestyle', kind: '' },
          { id: 'r5', glyph: '⊘', desc: 'duplicate import', amt: '$95.00', tag: 'void this row', kind: 'danger' },
        ].map((r) => (
          <div key={r.id} className="row-with-margin">
            <button
              className={`ink-glyph ${r.kind}`}
              onClick={() => setVoided((v) => ({ ...v, [r.id]: !v[r.id] }))}
              aria-label={r.tag}
            >
              {r.glyph}
            </button>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  ...mono,
                  fontSize: 13,
                  color: 'var(--color-ink)',
                  textDecoration: voided[r.id] && r.kind === 'danger' ? 'line-through' : 'none',
                  opacity: voided[r.id] && r.kind === 'danger' ? 0.4 : 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {r.desc}
              </div>
              <div style={{ ...mono, fontSize: 10, color: 'var(--color-ink-muted)' }}>{r.tag}</div>
            </div>
            <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>{r.amt}</div>
          </div>
        ))}
      </div>

      {/* ---------- 04 — STICKER / APPLIQUÉ ---------- */}
      <SectionLabel
        n="04"
        title="Sticker / appliqué — sits on top, breaks the flatness"
        note="Post-it that Josh slapped on the receipt. Tape strip across the top. Yellow for ad-hoc adds, red for destructive, mint for chill/optional. Reserved for spots where the action is human-applied, not system-generated."
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '24px 4px 8px' }}>
        <button className="sticker">
          <span className="sticker-glyph">✎</span>
          Quick add
        </button>
        <button className="sticker sticker-cool">
          <span className="sticker-glyph">⤓</span>
          Export CSV
        </button>
        <button className="sticker sticker-warn">
          <span className="sticker-glyph">⊘</span>
          Purge all data
        </button>
      </div>

      {/* ---------- 05 — STAMPS (terminal) ---------- */}
      <SectionLabel
        n="05"
        title="Stamps — terminal states only (Paid · Sealed · Void)"
        note="The existing rotated rubber stamp. Kept for finality. Becomes the state marker after commit, not removed."
      />

      <div className="receipt" style={{ padding: '20px 18px' }}>
        <div style={{ ...kicker, marginBottom: 12 }}>luther · 3 chits</div>
        {[
          { id: 'a', label: 'etransfer · feb', amt: '-$367' },
          { id: 'b', label: 'etransfer · mar', amt: '-$367' },
          { id: 'c', label: 'etransfer · apr', amt: '-$366' },
        ].map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderTop: '1px dashed var(--color-hairline-ink)',
              opacity: paid[c.id] ? 0.55 : 1,
            }}
          >
            <div>
              <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>{c.label}</div>
              <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink-muted)' }}>{c.amt}</div>
            </div>
            <button
              className="stamp stamp-gold"
              style={{ fontSize: 11 }}
              onClick={() => setPaid((p) => ({ ...p, [c.id]: !p[c.id] }))}
            >
              {paid[c.id] ? 'Paid' : 'Mark paid'}
            </button>
          </div>
        ))}
      </div>

      {/* ---------- 06 — ALL FOUR ON ONE SCREEN ---------- */}
      <SectionLabel
        n="06"
        title="What Today actually looks like with all four"
        note="Same screen you have now, but every action speaks its own dialect. Tear-tab for new chit. Postage for payment link on a chit. Stamp for terminal state. Ink glyphs in the queue. No purple pills anywhere."
      />

      <div className="receipt stub-top stub-bottom" style={{ padding: '22px 20px', position: 'relative' }}>
        <div style={{ ...kicker, marginBottom: 4 }}>mon · apr 27 · rcpt 0081</div>
        <div className="display" style={{ fontSize: 28, color: 'var(--color-ink)' }}>Declyne</div>

        <div style={{ height: 18 }} />
        <div className="perf" />

        {/* Open tab with postage stamp inline */}
        <div style={{ ...kicker, marginTop: 14, marginBottom: 8 }}>open tabs · 1 of 4</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            borderTop: '1px dashed var(--color-hairline-ink)',
          }}
        >
          <div>
            <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>Priya Shah</div>
            <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink-muted)' }}>
              Bar Raval tapas · -$82
            </div>
          </div>
          <button className="postage" style={{ minWidth: 100, padding: '10px 12px 8px', transform: 'rotate(-2deg)' }}>
            <span className="postage-denom" style={{ fontSize: 8 }}>$0.47</span>
            <span className="postage-art" style={{ width: 24, height: 24 }}><MailArt /></span>
            <span className="postage-label" style={{ fontSize: 8 }}>Send<br />link</span>
          </button>
        </div>

        {/* Marcus row with stamp marking paid */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            borderTop: '1px dashed var(--color-hairline-ink)',
            opacity: 0.55,
          }}
        >
          <div>
            <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>Marcus Chen</div>
            <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink-muted)' }}>
              Lady Marmalade · +$47.50
            </div>
          </div>
          <span className="stamp stamp-gold" style={{ fontSize: 10, pointerEvents: 'none' }}>Paid</span>
        </div>

        {/* Tear-tab to add */}
        <button className="tear-tab tear-tab-motion" style={{ marginBottom: 6 }}>
          <span className="cut-line" aria-hidden />
          <span className="tear-arrow" aria-hidden>↓</span>
          <span>Tear new chit</span>
          <span className="cut-line" aria-hidden />
        </button>

        <div className="perf" style={{ marginTop: 18 }} />

        {/* Review queue with ink glyphs */}
        <div style={{ ...kicker, marginTop: 14, marginBottom: 4 }}>review · 2</div>

        <div className="row-with-margin">
          <button className="ink-glyph">▸</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>STARBUCKS #4421</div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--color-ink-muted)' }}>tap to categorize</div>
          </div>
          <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>$8.40</div>
        </div>

        <div className="row-with-margin">
          <button className="ink-glyph commit">✦</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>ENBRIDGE GAS</div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--color-ink-muted)' }}>commit · essentials</div>
          </div>
          <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>$108.00</div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center', ...kicker, opacity: 0.6 }}>
          ** still printing **
        </div>
      </div>

      <div style={{ height: 60 }} />
      <div style={{ ...kickerDark, textAlign: 'center', opacity: 0.5 }}>
        ** end of mockup **
      </div>
    </div>
  );
}
