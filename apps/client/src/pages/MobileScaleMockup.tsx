import { useState } from 'react';

const mono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
};
const kicker = (color = 'var(--color-text-muted)'): React.CSSProperties => ({
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  color,
  marginBottom: 6,
});

// ─── FAKE DATA SETS ────────────────────────────────────────────────────────

const LOW_COMMITMENTS = [
  { label: 'Capital One min', cents: 5000, role: 'debt', color: '#c8a96a' },
  { label: 'Vacation fund', cents: 4167, role: 'savings', color: '#94a888' },
  { label: 'Emergency fund', cents: 2500, role: 'savings', color: '#94a888' },
];

const MED_COMMITMENTS = [
  { label: 'Capital One min', cents: 5000, role: 'debt', color: '#c8a96a' },
  { label: 'TD Visa min', cents: 8940, role: 'debt', color: '#c8a96a' },
  { label: 'Luther min', cents: 10000, role: 'debt', color: '#c8a96a' },
  { label: 'Vacation fund', cents: 4167, role: 'savings', color: '#94a888' },
  { label: 'Emergency fund', cents: 2500, role: 'savings', color: '#94a888' },
  { label: 'Cash buffer', cents: 19546, role: 'savings', color: '#94a888' },
  { label: 'Rogers', cents: 9500, role: 'bill', color: '#7a8595' },
  { label: 'Enbridge', cents: 10800, role: 'bill', color: '#7a8595' },
];

const HIGH_COMMITMENTS = [
  ...MED_COMMITMENTS,
  { label: 'Netflix', cents: 2000, role: 'bill', color: '#7a8595' },
  { label: 'Spotify', cents: 1300, role: 'bill', color: '#7a8595' },
  { label: 'Apple iCloud', cents: 400, role: 'bill', color: '#7a8595' },
  { label: 'RRSP sweep', cents: 20000, role: 'savings', color: '#94a888' },
  { label: 'TFSA sweep', cents: 15000, role: 'savings', color: '#94a888' },
  { label: 'Car fund', cents: 5000, role: 'savings', color: '#94a888' },
  { label: 'Summer camping', cents: 9700, role: 'savings', color: '#94a888' },
  { label: 'Bell internet', cents: 8500, role: 'bill', color: '#7a8595' },
  { label: 'Amazon Prime', cents: 999, role: 'bill', color: '#7a8595' },
  { label: 'TD Visa extra', cents: 87912, role: 'debt', color: '#c8a96a' },
];

const LOW_HABITS = [
  { label: 'Tokyo Smoke', sub: 'weed', cents: 8400, vel: '+12%' },
  { label: 'McDonald\'s', sub: 'fast food', cents: 3200, vel: '-4%' },
];

const MED_HABITS = [
  { label: 'Tokyo Smoke', sub: 'weed', cents: 8400, vel: '+12%' },
  { label: 'McDonald\'s', sub: 'fast food', cents: 3200, vel: '-4%' },
  { label: 'LCBO', sub: 'bars', cents: 6100, vel: '+8%' },
  { label: 'Uber Eats', sub: 'takeout', cents: 5800, vel: '+22%' },
  { label: 'Starbucks', sub: 'treats', cents: 2100, vel: '+3%' },
  { label: 'Amazon.ca', sub: 'shopping', cents: 4400, vel: '-9%' },
  { label: 'Netflix', sub: 'streaming', cents: 2000, vel: '0%' },
];

const HIGH_HABITS = [
  ...MED_HABITS,
  { label: 'Loblaws', sub: 'food', cents: 14200, vel: '+2%' },
  { label: 'Shoppers', sub: 'health', cents: 3800, vel: '+6%' },
  { label: 'Bar Raval', sub: 'bars', cents: 2900, vel: '+18%' },
  { label: 'Steam', sub: 'gaming', cents: 1500, vel: '+44%' },
  { label: 'Apple TV', sub: 'streaming', cents: 900, vel: '0%' },
  { label: 'H&M', sub: 'shopping', cents: 2600, vel: '-15%' },
  { label: 'No Frills', sub: 'food', cents: 9100, vel: '-3%' },
  { label: 'TTC PRESTO', sub: 'transit', cents: 3400, vel: '0%' },
  { label: 'Dollarama', sub: 'shopping', cents: 1800, vel: '+31%' },
  { label: 'Beer Store', sub: 'bars', cents: 2200, vel: '+9%' },
  { label: 'Esso', sub: 'transit', cents: 6700, vel: '-7%' },
  { label: 'Pai Thai', sub: 'takeout', cents: 1900, vel: '+5%' },
];

function fmt(cents: number) {
  return '$' + (cents / 100).toFixed(0);
}

// ─── PAYCHEQUE BEFORE ──────────────────────────────────────────────────────

function PaychequeBefore({ data }: { data: typeof LOW_COMMITMENTS }) {
  const W = 320, H = 260, cx = W / 2, cy = H / 2;
  const maxR = 28, minR = 10;
  const maxCents = Math.max(...data.map(d => d.cents));
  const nodes = data.map((d, i) => {
    const angle = (2 * Math.PI * i) / data.length - Math.PI / 2;
    const r = minR + (maxR - minR) * Math.sqrt(d.cents / maxCents);
    const dist = 85 + r;
    return { ...d, x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle), r };
  });

  return (
    <div style={{ background: '#1c1622', borderRadius: 8, padding: 12 }}>
      <div style={{ ...kicker(), marginBottom: 8 }}>
        <span style={{ color: '#c8a96a', marginRight: 6 }}>BEFORE</span>
        all nodes always visible
      </div>
      <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
        {/* center core */}
        <rect x={cx - 38} y={cy - 22} width={76} height={44} rx={3}
          fill="#2a2030" stroke="#9e78b9" strokeWidth={1.5} />
        <text x={cx} y={cy - 6} textAnchor="middle"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: '#9e78b9', letterSpacing: '0.15em' }}>
          PAY SLIP
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle"
          style={{ fontFamily: 'var(--font-display)', fontSize: 14, fill: '#f0eaf5', fontWeight: 600 }}>
          $4,250
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: '#6b6470', letterSpacing: '0.1em' }}>
          10d / TO PAYDAY
        </text>
        {/* edges */}
        {nodes.map((n, i) => (
          <line key={i} x1={cx} y1={cy} x2={n.x} y2={n.y}
            stroke="#9e78b9" strokeWidth={1} strokeDasharray="3 4" opacity={0.35} />
        ))}
        {/* nodes */}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity={0.85} />
            <text x={n.x} y={n.y + n.r + 11} textAnchor="middle"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: '#c8c0d0', letterSpacing: '0.05em' }}>
              {n.label.length > 13 ? n.label.slice(0, 12) + '…' : n.label}
            </text>
            <text x={n.x} y={n.y + n.r + 20} textAnchor="middle"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fill: n.color }}>
              {fmt(n.cents)}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ ...mono, fontSize: 10, color: '#6b6470', textAlign: 'center', marginTop: 4 }}>
        {data.length} nodes · labels always on
      </div>
    </div>
  );
}

// ─── PAYCHEQUE AFTER ───────────────────────────────────────────────────────

function PaychequeAfter({ data }: { data: typeof LOW_COMMITMENTS }) {
  const TOP_N = 5;
  const sorted = [...data].sort((a, b) => b.cents - a.cents);
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const total = data.reduce((s, d) => s + d.cents, 0);
  const free = 425000 - total;
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: '#1c1622', borderRadius: 8, padding: 16 }}>
      <div style={{ ...kicker(), marginBottom: 12 }}>
        <span style={{ color: '#94a888', marginRight: 6 }}>AFTER</span>
        ranked list · tap to expand
      </div>

      {/* hero */}
      <div style={{ marginBottom: 16, paddingBottom: 14,
        borderBottom: '1px dashed rgba(255,255,255,0.08)' }}>
        <div style={{ ...kicker('var(--color-text-muted)'), marginBottom: 4 }}>free this paycheque</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600,
          color: free > 0 ? '#94a888' : '#c97a4a', letterSpacing: '-0.02em' }}>
          {fmt(free)}
        </div>
        <div style={{ ...mono, fontSize: 10, color: '#6b6470', marginTop: 2 }}>
          of $4,250.00 paycheque · 10d left
        </div>
      </div>

      {/* top N rows */}
      <div style={{ ...kicker(), marginBottom: 8 }}>top commitments</div>
      {top.map((d, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <div>
              <div style={{ ...mono, fontSize: 12, color: '#f0eaf5' }}>{d.label}</div>
              <div style={{ ...mono, fontSize: 9, color: '#6b6470', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{d.role}</div>
            </div>
          </div>
          <div style={{ ...mono, fontSize: 13, color: d.color }}>{fmt(d.cents)}</div>
        </div>
      ))}

      {/* overflow */}
      {rest.length > 0 && (
        <>
          {expanded && rest.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <div style={{ ...mono, fontSize: 11, color: '#c8c0d0' }}>{d.label}</div>
              </div>
              <div style={{ ...mono, fontSize: 11, color: d.color }}>{fmt(d.cents)}</div>
            </div>
          ))}
          <button onClick={() => setExpanded(e => !e)}
            style={{ marginTop: 10, width: '100%', background: 'none', border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 3, padding: '7px 0', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em',
              textTransform: 'uppercase', color: '#6b6470' }}>
            {expanded ? '↑ show less' : `+ ${rest.length} more commitments`}
          </button>
        </>
      )}

      <button style={{ marginTop: 14, width: '100%', background: '#9e78b9', border: 'none',
        borderRadius: 3, padding: '11px 0', cursor: 'pointer',
        fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: '#1c1622', fontWeight: 700 }}>
        draft this paycheque
      </button>
    </div>
  );
}

// ─── HABITS BEFORE ─────────────────────────────────────────────────────────

const HUB_COLORS: Record<string, string> = {
  weed: '#7a9a6a', bars: '#8a5a4a', 'fast food': '#c8a96a', takeout: '#c97a4a',
  treats: '#c48a9a', shopping: '#b88e7a', streaming: '#5a8a9a', gaming: '#9e78b9',
  food: '#7a8595', health: '#94a888', transit: '#7a8595',
};

function HabitsBefore({ data }: { data: typeof LOW_HABITS }) {
  const W = 320, H = 260;
  const subGroups = [...new Set(data.map(d => d.sub))];
  const hubPositions: Record<string, { x: number; y: number }> = {};
  subGroups.forEach((sub, i) => {
    const angle = (2 * Math.PI * i) / subGroups.length - Math.PI / 2;
    hubPositions[sub] = { x: W / 2 + 80 * Math.cos(angle), y: H / 2 + 80 * Math.sin(angle) };
  });

  return (
    <div style={{ background: '#1c1622', borderRadius: 8, padding: 12 }}>
      <div style={{ ...kicker(), marginBottom: 8 }}>
        <span style={{ color: '#c8a96a', marginRight: 6 }}>BEFORE</span>
        map first · labels always on
      </div>
      <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
        {/* hub nodes */}
        {subGroups.map(sub => {
          const pos = hubPositions[sub]!;
          const color = HUB_COLORS[sub] || '#7a8595';
          return (
            <g key={sub}>
              <rect x={pos.x - 26} y={pos.y - 14} width={52} height={28} rx={3}
                fill="#2a2030" stroke={color} strokeWidth={1.5} />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: color,
                  letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {sub.toUpperCase()}
              </text>
            </g>
          );
        })}
        {/* merchant nodes + edges + labels */}
        {data.map((d, i) => {
          const hub = hubPositions[d.sub]!;
          const angle = (2 * Math.PI * i) / data.length;
          const mx = hub.x + 38 * Math.cos(angle + i * 0.7);
          const my = hub.y + 38 * Math.sin(angle + i * 0.7);
          const color = HUB_COLORS[d.sub] || '#7a8595';
          return (
            <g key={i}>
              <line x1={hub.x} y1={hub.y} x2={mx} y2={my}
                stroke={color} strokeWidth={0.8} strokeDasharray="2 3" opacity={0.3} />
              <circle cx={mx} cy={my} r={8} fill={color} opacity={0.7} />
              <text x={mx} y={my + 16} textAnchor="middle"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fill: '#c8c0d0' }}>
                {d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ ...mono, fontSize: 10, color: '#6b6470', textAlign: 'center', marginTop: 4 }}>
        {data.length} merchants · {subGroups.length} hubs · labels always on
      </div>
    </div>
  );
}

// ─── HABITS AFTER ──────────────────────────────────────────────────────────

function HabitsAfter({ data }: { data: typeof LOW_HABITS }) {
  const TOP_N = 5;
  const sorted = [...data].sort((a, b) => b.cents - a.cents);
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const [showMap, setShowMap] = useState(false);

  return (
    <div style={{ background: '#1c1622', borderRadius: 8, padding: 16 }}>
      <div style={{ ...kicker(), marginBottom: 12 }}>
        <span style={{ color: '#94a888', marginRight: 6 }}>AFTER</span>
        triage first · map on demand
      </div>

      <div style={{ ...kicker(), marginBottom: 8 }}>habits by spend · last 30d</div>

      {top.map((d, i) => {
        const color = HUB_COLORS[d.sub] || '#7a8595';
        const velColor = d.vel.startsWith('+') ? '#c97a4a' : '#94a888';
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 32, borderRadius: 2, background: color, flexShrink: 0 }} />
              <div>
                <div style={{ ...mono, fontSize: 12, color: '#f0eaf5' }}>{d.label}</div>
                <div style={{ ...mono, fontSize: 9, color: '#6b6470', letterSpacing: '0.1em' }}>
                  {d.sub.toUpperCase()}
                  <span style={{ color: velColor, marginLeft: 6 }}>{d.vel}</span>
                </div>
              </div>
            </div>
            <div style={{ ...mono, fontSize: 13, color: color }}>{fmt(d.cents)}</div>
          </div>
        );
      })}

      {rest.length > 0 && (
        <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ ...mono, fontSize: 11, color: '#6b6470' }}>
              + {rest.length} other merchants
            </div>
            <div style={{ ...mono, fontSize: 11, color: '#6b6470' }}>
              {fmt(rest.reduce((s, d) => s + d.cents, 0))}
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setShowMap(m => !m)}
        style={{ marginTop: 12, width: '100%', background: 'none',
          border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 3,
          padding: '7px 0', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: '#6b6470' }}>
        {showMap ? '↑ hide map' : '↓ view habit map'}
      </button>

      {showMap && (
        <div style={{ marginTop: 12, opacity: 0.85 }}>
          <HabitsBefore data={data} />
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

type Density = 'low' | 'medium' | 'high';

export default function MobileScaleMockup() {
  const [density, setDensity] = useState<Density>('medium');

  const commitments = density === 'low' ? LOW_COMMITMENTS
    : density === 'medium' ? MED_COMMITMENTS
    : HIGH_COMMITMENTS;

  const habits = density === 'low' ? LOW_HABITS
    : density === 'medium' ? MED_HABITS
    : HIGH_HABITS;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0a10', padding: 20,
      fontFamily: 'var(--font-mono)' }}>

      {/* header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
          color: '#9e78b9', marginBottom: 6 }}>§ MOBILE SCALE MOCKUP</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600,
          color: '#f0eaf5', marginBottom: 8 }}>
          Before vs After
        </div>
        <div style={{ fontSize: 11, color: '#6b6470', lineHeight: 1.6, maxWidth: 520 }}>
          Simulates what the Paycheque and Habits graphs look like as transaction volume grows.
          Switch density to see how each pattern handles scale.
        </div>
      </div>

      {/* density toggle */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#6b6470', marginBottom: 10 }}>dataset density</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['low', 'medium', 'high'] as Density[]).map(d => (
            <button key={d} onClick={() => setDensity(d)}
              style={{ padding: '7px 16px', borderRadius: 3, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em',
                textTransform: 'uppercase',
                background: density === d ? '#9e78b9' : 'transparent',
                color: density === d ? '#1c1622' : '#6b6470',
                border: density === d ? 'none' : '1px solid rgba(255,255,255,0.12)',
                fontWeight: density === d ? 700 : 400 }}>
              {d}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: '#6b6470' }}>
          {density === 'low' && `${commitments.length} commitments · ${habits.length} habits — early user`}
          {density === 'medium' && `${commitments.length} commitments · ${habits.length} habits — typical user after 3 months`}
          {density === 'high' && `${commitments.length} commitments · ${habits.length} habits — power user with full history`}
        </div>
      </div>

      {/* paycheque section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
          color: '#c8a96a', marginBottom: 4 }}>§ 01</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
          color: '#f0eaf5', marginBottom: 4 }}>Paycheque graph</div>
        <div style={{ fontSize: 11, color: '#6b6470', marginBottom: 16, lineHeight: 1.5 }}>
          At <strong style={{ color: '#c8c0d0' }}>low density</strong> the constellation is fine.
          At <strong style={{ color: '#c8c0d0' }}>high density</strong>, the before state gets unreadable — too many nodes and labels compete for space.
          The after state stays clear at any density.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <PaychequeBefore data={commitments} />
          <PaychequeAfter data={commitments} />
        </div>
      </div>

      {/* habits section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
          color: '#c8a96a', marginBottom: 4 }}>§ 02</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
          color: '#f0eaf5', marginBottom: 4 }}>Habits graph</div>
        <div style={{ fontSize: 11, color: '#6b6470', marginBottom: 16, lineHeight: 1.5 }}>
          At <strong style={{ color: '#c8c0d0' }}>high density</strong> the map becomes unreadable node soup.
          The after state surfaces the top merchants as a ranked action list — with the map available on demand, not as default.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <HabitsBefore data={habits} />
          <HabitsAfter data={habits} />
        </div>
      </div>

      {/* summary */}
      <div style={{ background: '#1c1622', borderRadius: 8, padding: 20, marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#6b6470', marginBottom: 12 }}>summary · what this means</div>
        {[
          ['Graph stays', 'The constellation and habits map don\'t go away. They earn their place as context, not primary navigation.'],
          ['List becomes default at scale', 'When data grows, ranked lists are faster to scan on mobile than node graphs.'],
          ['Map on demand', 'Habits map moves behind a "View map" tap — visible when useful, not blocking the action path.'],
          ['Top-N + collapse', 'Show the 5 highest-impact items. Collapse the rest. Never drop data — just deprioritize it.'],
          ['Density switch is automatic', 'Not a user setting. The app decides based on how many items exist.'],
        ].map(([title, desc]) => (
          <div key={title} style={{ marginBottom: 14, paddingBottom: 14,
            borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 12, color: '#f0eaf5', marginBottom: 3 }}>{title}</div>
            <div style={{ fontSize: 11, color: '#6b6470', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
