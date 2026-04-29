import { useState } from 'react';

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
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

interface Row {
  id: string;
  name: string;
  guess: string;
  group: 'lifestyle' | 'indulgence';
  spend: string;
}

const ROWS: Row[] = [
  { id: 'r1', name: 'Tokyo Smoke', guess: 'weed', group: 'indulgence', spend: '$340.00' },
  { id: 'r2', name: 'McDonald\'s', guess: 'fast food', group: 'indulgence', spend: '$84.50' },
  { id: 'r3', name: 'Bar Raval', guess: 'bars', group: 'indulgence', spend: '$220.00' },
  { id: 'r4', name: 'Loblaws', guess: 'food', group: 'lifestyle', spend: '$612.45' },
  { id: 'r5', name: 'TTC PRESTO', guess: 'transit', group: 'lifestyle', spend: '$156.00' },
  { id: 'r6', name: 'Netflix', guess: 'streaming', group: 'indulgence', spend: '$20.00' },
  { id: 'r7', name: 'Uber Eats', guess: 'takeout', group: 'indulgence', spend: '$172.30' },
];

const SUB_COLOR: Record<string, string> = {
  // lifestyle (warm-clay family)
  food: '#b88e7a',
  transit: '#7b8e9c',
  shopping: '#bf8a8a',
  home: '#9c8a6a',
  'personal care': '#c9a896',
  entertainment: '#a890b0',
  health: '#94a888',
  // indulgence (hotter family)
  bars: '#a85c4a',
  takeout: '#c97a4a',
  'fast food': '#d99a5a',
  weed: '#7a9c6a',
  streaming: '#5a7a9c',
  gaming: '#7c5aa8',
  treats: '#d4a4b8',
};

const ALL_SUBS = [
  'food',
  'transit',
  'shopping',
  'home',
  'personal care',
  'entertainment',
  'health',
  'bars',
  'takeout',
  'fast food',
  'weed',
  'streaming',
  'gaming',
  'treats',
];

const ROW_TILTS = [-1.4, 1.1, -0.9, 1.6, -1.8, 0.8, -1.2];

function PickedStamp({ tilt }: { tilt: number }) {
  return (
    <span
      style={{
        ...mono,
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#a13f37',
        border: '1.5px solid #a13f37',
        padding: '3px 8px',
        borderRadius: 2,
        transform: `rotate(${tilt}deg)`,
        display: 'inline-block',
        boxShadow:
          'inset 0 0 0 1px var(--color-paper), inset 0 0 0 2px #a13f37',
        background: 'transparent',
      }}
    >
      ✓ picked
    </span>
  );
}

function QueueRow({
  row,
  picked,
  tilt,
  onPress,
}: {
  row: Row;
  picked: boolean;
  tilt: number;
  onPress?: () => void;
}) {
  return (
    <div
      onClick={onPress}
      style={{
        padding: '12px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px dashed var(--color-hairline-ink)',
        transform: picked ? `rotate(${tilt * 0.15}deg)` : 'none',
        transition: 'transform 220ms cubic-bezier(.2,.8,.2,1)',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ ...mono, fontSize: 13, color: 'var(--color-ink)' }}>{row.name}</div>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
          guess · <span style={{ color: SUB_COLOR[row.guess] ?? '#000' }}>●</span> {row.guess} · {row.group}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {picked && <PickedStamp tilt={tilt} />}
        <span style={{ ...mono, fontSize: 12, color: 'var(--color-ink)' }}>{row.spend}</span>
      </div>
    </div>
  );
}

function ApproveStripe({ count }: { count: number }) {
  return (
    <div
      style={{
        position: 'relative',
        marginTop: -8,
        background: 'var(--color-paper)',
        borderTop: '1px dashed var(--color-hairline-ink)',
        borderBottom: '1px dashed var(--color-hairline-ink)',
        padding: '14px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 -8px 14px -10px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ ...mono, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
        {count} picked · tap empty space to release
      </div>
      <button type="button" className="stamp stamp-purple" style={{ transform: 'rotate(-1.4deg)' }}>
        Approve stack
      </button>
    </div>
  );
}

function QueueReceipt({ pickedIds }: { pickedIds: Set<string> }) {
  return (
    <div className="receipt" style={{ padding: '16px 0 0', overflow: 'hidden' }}>
      <div style={{ padding: '0 16px 8px', ...mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
        sub-categories · 7 to confirm
      </div>
      {ROWS.map((r, i) => (
        <QueueRow key={r.id} row={r} picked={pickedIds.has(r.id)} tilt={ROW_TILTS[i] ?? 0} />
      ))}
      {pickedIds.size > 0 && <ApproveStripe count={pickedIds.size} />}
    </div>
  );
}

export default function HabitsStackMockup() {
  const [live, setLive] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setLive((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...kickerDark, marginBottom: 4 }}>§ MOCKUP · STACK MODE</div>
        <div className="display" style={{ fontSize: 30, color: 'var(--color-text-primary)' }}>
          Long-press to stack. One stamp clears them.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.6 }}>
          No checkboxes. Long-press a row to enter stack mode. The row tilts, a tilted ✓ PICKED rubber stamp lands on it.
          Tap other rows to add or remove from the stack. Slide-up strip shows count + APPROVE STACK. Tap empty space to release.
        </div>
      </div>

      {/* 01. idle */}
      <SectionLabel
        n="01"
        title="State A · idle queue, no rows picked"
        note="Each row shows the merchant, the detector's guess (with its sub-category color dot), the group, and 90d spend."
      />
      <QueueReceipt pickedIds={new Set()} />

      {/* 02. one picked */}
      <SectionLabel
        n="02"
        title="State B · one row long-pressed"
        note="Row tilts ~0.2deg. Red ink ✓ PICKED stamp at -1.4deg. Bottom strip slides up: 1 PICKED · APPROVE STACK."
      />
      <QueueReceipt pickedIds={new Set(['r1'])} />

      {/* 03. five picked */}
      <SectionLabel
        n="03"
        title="State C · five rows picked at varying tilts"
        note="Each PICKED stamp at a different rotation so the stack reads like a real bookkeeper marked them by hand. Strip count climbs: 5 PICKED."
      />
      <QueueReceipt pickedIds={new Set(['r1', 'r2', 'r4', 'r5', 'r7'])} />

      {/* 04. interactive */}
      <SectionLabel
        n="04"
        title="Live · tap any row to add/remove from your stack"
        note="This one's interactive. Try it. Tap a row to add it, tap again to release."
      />
      <div className="receipt" style={{ padding: '16px 0 0', overflow: 'hidden' }}>
        <div style={{ padding: '0 16px 8px', ...mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
          sub-categories · 7 to confirm
        </div>
        {ROWS.map((r, i) => (
          <QueueRow
            key={r.id}
            row={r}
            picked={live.has(r.id)}
            tilt={ROW_TILTS[i] ?? 0}
            onPress={() => toggle(r.id)}
          />
        ))}
        {live.size > 0 && <ApproveStripe count={live.size} />}
      </div>

      {/* 05. 14 sub-category colors */}
      <SectionLabel
        n="05"
        title="14 sub-category colors · earthy paper-pigment palette"
        note="Lifestyle family stays warm-muted (clay/slate/rose/olive/peach/lavender/sage). Indulgence family goes hotter (deep sienna, sienna, amber, moss, petrol blue, purple, pink-rose)."
      />
      <div className="receipt" style={{ padding: '18px' }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: 12 }}>
          lifestyle (7)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 18 }}>
          {ALL_SUBS.slice(0, 7).map((s) => (
            <Swatch key={s} name={s} color={SUB_COLOR[s] ?? '#000'} />
          ))}
        </div>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: 12 }}>
          indulgence (7)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {ALL_SUBS.slice(7).map((s) => (
            <Swatch key={s} name={s} color={SUB_COLOR[s] ?? '#000'} />
          ))}
        </div>
      </div>

      {/* 06. sample habits map */}
      <SectionLabel
        n="06"
        title="Sample habits map · colors in context"
        note="Each hub stripe takes its sub-category color. Same vocabulary as the live Habits map, just with the new palette applied."
      />
      <SampleHabitsMap />
    </div>
  );
}

function Swatch({ name, color }: { name: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 2,
          background: color,
          border: '1px solid var(--color-hairline-ink)',
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...mono, fontSize: 12, color: 'var(--color-ink)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {name}
        </div>
        <div style={{ ...mono, fontSize: 10, color: 'var(--color-ink-muted)' }}>
          {color}
        </div>
      </div>
    </div>
  );
}

function SampleHabitsMap() {
  // Hubs to render: weed, fast food, takeout, bars, food, streaming
  const hubs: { id: string; label: string; sub: string; x: number; y: number; merchants: { label: string; mx: number; my: number }[] }[] = [
    { id: 'h1', label: 'WEED', sub: 'weed', x: 80, y: 70, merchants: [{ label: 'tokyo smoke', mx: 30, my: 40 }] },
    { id: 'h2', label: 'FAST FOOD', sub: 'fast food', x: 230, y: 60, merchants: [{ label: 'mcdonald\'s', mx: 280, my: 30 }] },
    { id: 'h3', label: 'BARS', sub: 'bars', x: 70, y: 200, merchants: [{ label: 'bar raval', mx: 30, my: 240 }] },
    { id: 'h4', label: 'TAKEOUT', sub: 'takeout', x: 230, y: 200, merchants: [{ label: 'uber eats', mx: 290, my: 230 }] },
    { id: 'h5', label: 'STREAMING', sub: 'streaming', x: 155, y: 270, merchants: [{ label: 'netflix', mx: 200, my: 305 }] },
    { id: 'h6', label: 'FOOD', sub: 'food', x: 155, y: 130, merchants: [{ label: 'loblaws', mx: 110, my: 100 }] },
  ];

  return (
    <div className="receipt" style={{ padding: 12 }}>
      <svg viewBox="0 0 320 340" style={{ width: '100%', height: 340 }}>
        {/* edges */}
        {hubs.map((h) =>
          h.merchants.map((m, i) => (
            <line
              key={`${h.id}-${i}`}
              x1={h.x}
              y1={h.y}
              x2={m.mx}
              y2={m.my}
              stroke="var(--color-hairline-ink)"
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.5}
            />
          )),
        )}
        {/* merchants */}
        {hubs.map((h) =>
          h.merchants.map((m) => (
            <g key={`${h.id}-m-${m.label}`}>
              <circle
                cx={m.mx}
                cy={m.my}
                r={9}
                fill={SUB_COLOR[h.sub] ?? '#000'}
                stroke="var(--color-paper)"
                strokeWidth={1}
              />
              <text
                x={m.mx}
                y={m.my + 22}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={9}
                fill="var(--color-ink)"
                style={{ paintOrder: 'stroke', stroke: 'var(--color-paper)', strokeWidth: 3 } as React.CSSProperties}
              >
                {m.label}
              </text>
            </g>
          )),
        )}
        {/* hubs (paper index card) */}
        {hubs.map((h) => (
          <g key={h.id}>
            <rect
              x={h.x - 38}
              y={h.y - 14}
              width={76}
              height={28}
              fill="var(--color-paper-shade)"
              stroke="var(--color-hairline-ink)"
              strokeWidth={1}
              rx={2}
            />
            {/* top stripe in sub color */}
            <rect
              x={h.x - 38}
              y={h.y - 14}
              width={76}
              height={4}
              fill={SUB_COLOR[h.sub] ?? '#000'}
            />
            <text
              x={h.x}
              y={h.y + 5}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={9}
              fill="var(--color-ink)"
              letterSpacing="1.3"
            >
              {h.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
