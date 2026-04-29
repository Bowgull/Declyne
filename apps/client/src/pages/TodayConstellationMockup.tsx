import { useState } from 'react';
import { Link } from 'react-router-dom';

const PAYCHEQUE = 425000;
const PERIOD_LABEL = 'Apr 24 — May 7';

type BubbleKind = 'merchant' | 'drawer';
type Category = 'essentials' | 'lifestyle' | 'indulgence' | 'debt' | 'savings';

interface Bubble {
  id: string;
  name: string;
  cents: number;
  kind: BubbleKind;
  category: Category;
  members?: string[];
}

const MERCHANTS: Bubble[] = [
  { id: 'enbridge', name: 'Enbridge',    cents: 10800, kind: 'merchant', category: 'essentials' },
  { id: 'rogers',   name: 'Rogers',      cents:  9500, kind: 'merchant', category: 'essentials' },
  { id: 'loblaws',  name: 'Loblaws',     cents:  7900, kind: 'merchant', category: 'essentials' },
  { id: 'libretto', name: 'Libretto',    cents:  3420, kind: 'merchant', category: 'indulgence' },
  { id: 'indigo',   name: 'Indigo',      cents:  2899, kind: 'merchant', category: 'lifestyle' },
  { id: 'lcbo',     name: 'LCBO',        cents:  2384, kind: 'merchant', category: 'indulgence' },
  { id: 'uber',     name: 'Uber',        cents:  1830, kind: 'merchant', category: 'lifestyle' },
  { id: 'tims',     name: 'Tim Hortons', cents:   840, kind: 'merchant', category: 'lifestyle' },
  { id: 'ttc',      name: 'TTC',         cents:   340, kind: 'merchant', category: 'essentials' },
];

const DRAWERS: Bubble[] = [
  { id: 'bills',     name: 'Bills',      cents: 20300, kind: 'drawer', category: 'essentials', members: ['Rogers', 'Enbridge'] },
  { id: 'groceries', name: 'Groceries',  cents:  7900, kind: 'drawer', category: 'essentials', members: ['Loblaws'] },
  { id: 'eating',    name: 'Eating out', cents:  4260, kind: 'drawer', category: 'indulgence', members: ['Libretto', 'Tim Hortons'] },
  { id: 'shopping',  name: 'Shopping',   cents:  2899, kind: 'drawer', category: 'lifestyle',  members: ['Indigo'] },
  { id: 'booze',     name: 'Booze',      cents:  2384, kind: 'drawer', category: 'indulgence', members: ['LCBO'] },
  { id: 'rideshare', name: 'Rideshare',  cents:  2170, kind: 'drawer', category: 'lifestyle',  members: ['Uber', 'TTC'] },
];

function fmt(c: number) {
  const a = Math.abs(c);
  return `$${(a / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function TodayConstellationMockup() {
  const [view, setView] = useState<'merchants' | 'drawers'>('merchants');
  const data = view === 'merchants' ? MERCHANTS : DRAWERS;
  const total = data.reduce((s, b) => s + b.cents, 0);

  return (
    <main className="ledger-page" style={{ paddingTop: 4 }}>
      <Link to="/today" className="stamp stamp-square" style={{ marginBottom: 12, display: 'inline-block' }}>
        BACK
      </Link>

      <header style={{ marginBottom: 16 }}>
        <div className="ink-muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase' }}>
          Today · where it went
        </div>
        <h1 className="display" style={{ fontSize: 26, lineHeight: 1.05, margin: '4px 0 0' }}>
          {PERIOD_LABEL}
        </h1>
        <p
          className="ink-muted"
          style={{
            margin: '10px 0 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.5,
          }}
        >
          Mockup for the Today hero. Map of where this paycheque already left your account.
        </p>
      </header>

      <ViewToggle view={view} setView={setView} />
      <Constellation data={data} total={total} />

      <p
        style={{
          marginTop: 14,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.55)',
          lineHeight: 1.6,
        }}
      >
        Tap a bubble for history. {view === 'drawers' ? 'Tap a drawer to see what is filed in it.' : 'A drawer groups merchants you spend at often.'}
      </p>

      <Legend view={view} />
    </main>
  );
}

function ViewToggle({
  view,
  setView,
}: {
  view: 'merchants' | 'drawers';
  setView: (v: 'merchants' | 'drawers') => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        marginBottom: 12,
        borderTop: '1px solid rgba(255,255,255,0.18)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {(['merchants', 'drawers'] as const).map((k) => (
        <button
          key={k}
          onClick={() => setView(k)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '12px 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: view === k ? '#9e78b9' : 'rgba(255,255,255,0.42)',
            fontWeight: view === k ? 600 : 400,
            cursor: 'pointer',
            borderBottom: view === k ? '2px solid #9e78b9' : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function Constellation({ data, total }: { data: Bubble[]; total: number }) {
  const sorted = [...data].sort((a, b) => b.cents - a.cents).slice(0, 8);
  const W = 380;
  const H = 400;
  const cx = W / 2;
  const cy = H / 2;

  const inner = sorted.slice(0, 4);
  const outer = sorted.slice(4);
  const orbitInner = 105;
  const orbitOuter = 152;

  const max = Math.max(...sorted.map((b) => b.cents));
  const minR = 13;
  const maxR = 22;
  const radiusFor = (cents: number) =>
    Math.max(minR, Math.min(maxR, minR + Math.sqrt(cents / max) * (maxR - minR)));

  const placed = [
    ...inner.map((b, i) => {
      const angle = -Math.PI / 2 + (i / inner.length) * Math.PI * 2;
      return {
        ...b,
        x: cx + Math.cos(angle) * orbitInner,
        y: cy + Math.sin(angle) * orbitInner,
        bubbleR: radiusFor(b.cents),
      };
    }),
    ...outer.map((b, i) => {
      const angle = -Math.PI / 2 + Math.PI / Math.max(1, inner.length) + (i / Math.max(1, outer.length)) * Math.PI * 2;
      return {
        ...b,
        x: cx + Math.cos(angle) * orbitOuter,
        y: cy + Math.sin(angle) * orbitOuter,
        bubbleR: radiusFor(b.cents),
      };
    }),
  ];

  return (
    <section
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(158,120,185,0.10) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
        borderRadius: 4,
        padding: '6px',
        position: 'relative',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="mascotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#9e78b9" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#9e78b9" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#9e78b9" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r="115" fill="url(#mascotGlow)" />
        {[orbitInner, orbitOuter].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 5" />
        ))}

        {placed.map((b) => (
          <line
            key={`l-${b.id}`}
            x1={cx}
            y1={cy}
            x2={b.x}
            y2={b.y}
            stroke={`var(--cat-${b.category})`}
            strokeOpacity="0.10"
            strokeWidth="0.8"
          />
        ))}

        {placed.map((b) => (
          <BubbleMark key={b.id} b={b} />
        ))}

        {/* mascot core */}
        <circle cx={cx} cy={cy} r="38" fill="#1a141d" />
        <circle cx={cx} cy={cy} r="38" fill="none" stroke="#9e78b9" strokeWidth="1.5" />
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          fontFamily="Fraunces, ui-serif, Georgia"
          fontWeight="600"
          fontSize="32"
          fill="#9e78b9"
        >
          D
        </text>
      </svg>

      <div
        style={{
          padding: '4px 14px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        <span>SPENT {fmt(total)}</span>
        <span>OF {fmt(PAYCHEQUE)}</span>
      </div>
    </section>
  );
}

function BubbleMark({ b }: { b: Bubble & { x: number; y: number; bubbleR: number } }) {
  const color = `var(--cat-${b.category})`;
  const labelY = b.y + b.bubbleR + 13;
  const amountY = labelY + 11;
  return (
    <g>
      {b.kind === 'merchant' ? (
        <circle cx={b.x} cy={b.y} r={b.bubbleR} fill={color} stroke="#0e0a10" strokeWidth="1.5" />
      ) : (
        <>
          <circle cx={b.x} cy={b.y} r={b.bubbleR} fill={color} stroke="#0e0a10" strokeWidth="1.5" />
          <circle
            cx={b.x}
            cy={b.y}
            r={Math.max(4, b.bubbleR - 4)}
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1"
            strokeDasharray="1 2"
          />
        </>
      )}
      <text x={b.x} y={labelY} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" letterSpacing="0.5" fill="rgba(255,255,255,0.85)">
        {b.name}
      </text>
      <text x={b.x} y={amountY} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.5)">
        {fmt(b.cents)}
      </text>
    </g>
  );
}

function Legend({ view }: { view: 'merchants' | 'drawers' }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="ledger-section" style={{ marginBottom: 14 }}>
        <span className="ledger-section-kicker">
          <span className="num">§</span> Legend
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LegendRow kind="merchant" label="Merchant" note="A place that took your money" />
        {view === 'drawers' && (
          <LegendRow kind="drawer" label="Drawer" note="A group of merchants you spend at often" />
        )}
      </div>
    </div>
  );
}

function LegendRow({ kind, label, note }: { kind: BubbleKind; label: string; note: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg viewBox="0 0 50 50" width="40" height="40">
        {kind === 'merchant' ? (
          <circle cx="25" cy="25" r="14" fill="var(--cat-essentials)" stroke="#0e0a10" strokeWidth="1.5" />
        ) : (
          <>
            <circle cx="25" cy="25" r="14" fill="var(--cat-lifestyle)" stroke="#0e0a10" strokeWidth="1.5" />
            <circle cx="25" cy="25" r="10" fill="none" stroke="rgba(255,255,255,0.6)" strokeDasharray="1 2" />
          </>
        )}
      </svg>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
          {note}
        </div>
      </div>
    </div>
  );
}
