const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const kickerDark: React.CSSProperties = {
  ...mono,
  fontSize: 10,
  letterSpacing: '0.28em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

// Four distinct hues for the paycheque map.
// - bills: slate (existing --cat-essentials)
// - debt minimums: muted gold (existing --cat-debt). the floor
// - debt extras: brighter amber. the push
// - goal contributions: sage (existing --cat-savings)
const PAY_COLOR = {
  bills: '#7a8595',         // slate, foundational
  debt_min: '#c8a96a',      // muted gold, the floor
  debt_extra: '#e0b860',    // brighter amber, the push
  goal: '#94a888',          // sage, growing
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

function Swatch({ name, sub, color }: { name: string; sub: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 2,
          background: color,
          border: '1px solid var(--color-hairline-ink)',
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...mono, fontSize: 12, color: 'var(--color-ink)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {name}
        </div>
        <div style={{ ...mono, fontSize: 10, color: 'var(--color-ink-muted)' }}>
          {sub} · {color}
        </div>
      </div>
    </div>
  );
}

export default function PaychequeColorsMockup() {
  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...kickerDark, marginBottom: 4 }}>§ MOCKUP · PAYCHEQUE COLORS</div>
        <div className="display" style={{ fontSize: 30, color: 'var(--color-text-primary)' }}>
          Four roles. Four colors.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.6 }}>
          A credit card minimum is a different commitment from extra money pushed at debt.
          A bill is a different shape from a goal contribution. Each one earns its own color so the user reads the map at a glance.
        </div>
      </div>

      {/* 01. swatches */}
      <SectionLabel
        n="01"
        title="The four hues"
        note="Bills slate. Debt minimums muted gold; the floor you have to pay. Debt extras brighter amber; the push you choose to send. Goal contributions sage; money you keep."
      />
      <div className="receipt" style={{ padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <Swatch name="Bills" sub="essentials, recurring" color={PAY_COLOR.bills} />
          <Swatch name="Debt min" sub="the floor" color={PAY_COLOR.debt_min} />
          <Swatch name="Debt extra" sub="the push" color={PAY_COLOR.debt_extra} />
          <Swatch name="Goal" sub="growing" color={PAY_COLOR.goal} />
        </div>
      </div>

      {/* 02. sample money map */}
      <SectionLabel
        n="02"
        title="Sample money map · colors in context"
        note="Same network grammar as the live Paycheque map. Each commit dot is colored by its role, not just by category group."
      />
      <SampleMoneyMap />

      {/* 03. side-by-side comparison */}
      <SectionLabel
        n="03"
        title="Min vs extra · side by side"
        note="The two debt-toned bubbles next to each other. Min reads as restrained (muted), extra reads as active (brighter). The user sees the difference without reading a label."
      />
      <div className="receipt" style={{ padding: 24 }}>
        <svg viewBox="0 0 320 130" style={{ width: '100%', height: 130 }}>
          {/* min */}
          <circle cx={90} cy={65} r={26} fill={PAY_COLOR.debt_min} stroke="var(--color-paper)" strokeWidth={1.5} />
          <text x={90} y={70} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-ink)">$89</text>
          <text x={90} y={108} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-ink-muted)" letterSpacing="1.5">TD VISA · MIN</text>
          {/* extra */}
          <circle cx={230} cy={65} r={36} fill={PAY_COLOR.debt_extra} stroke="var(--color-paper)" strokeWidth={1.5} />
          <text x={230} y={70} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-ink)">$1,365</text>
          <text x={230} y={118} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-ink-muted)" letterSpacing="1.5">→ CAPITAL ONE</text>
        </svg>
      </div>

      {/* 04. full vocabulary recap */}
      <SectionLabel
        n="04"
        title="Full vocabulary on the paycheque side"
        note="These four sit alongside the existing income tone (mascot purple) on the core paystub and the institution gold on debt destination hubs. Five readable colors total without crowding."
      />
      <div className="receipt" style={{ padding: '20px' }}>
        <div style={{ ...mono, fontSize: 11, lineHeight: 1.9, color: 'var(--color-ink)' }}>
          <div><span style={{ color: '#9a8bc4' }}>●</span> mascot purple · income (paystub core)</div>
          <div><span style={{ color: PAY_COLOR.bills }}>●</span> slate · bills, essentials, recurring outflow</div>
          <div><span style={{ color: PAY_COLOR.debt_min }}>●</span> muted gold · debt minimums, the floor you must clear</div>
          <div><span style={{ color: PAY_COLOR.debt_extra }}>●</span> bright amber · debt extras, the push toward payoff</div>
          <div><span style={{ color: PAY_COLOR.goal }}>●</span> sage · goal contributions, money you keep</div>
          <div><span style={{ color: '#c8a96a' }}>●</span> institution gold · debt destination hubs (existing)</div>
        </div>
      </div>
    </div>
  );
}

function SampleMoneyMap() {
  const core = { x: 160, y: 175 };
  const commits: {
    label: string;
    color: string;
    x: number;
    y: number;
    r: number;
    hub?: { x: number; y: number; label: string; color: string };
  }[] = [
    { label: 'rogers', color: PAY_COLOR.bills, x: 60, y: 70, r: 16 },
    { label: 'enbridge', color: PAY_COLOR.bills, x: 130, y: 50, r: 14 },
    { label: 'rent', color: PAY_COLOR.bills, x: 220, y: 50, r: 22 },
    { label: 'td visa min', color: PAY_COLOR.debt_min, x: 75, y: 280, r: 14, hub: { x: 30, y: 320, label: 'TD VISA', color: '#c8a96a' } },
    { label: '→ cap one', color: PAY_COLOR.debt_extra, x: 240, y: 270, r: 22, hub: { x: 285, y: 315, label: 'CAPITAL ONE', color: '#c8a96a' } },
    { label: 'cap one min', color: PAY_COLOR.debt_min, x: 290, y: 250, r: 12, hub: { x: 285, y: 315, label: 'CAPITAL ONE', color: '#c8a96a' } },
    { label: 'emergency', color: PAY_COLOR.goal, x: 60, y: 180, r: 18 },
    { label: 'vacation', color: PAY_COLOR.goal, x: 280, y: 165, r: 14 },
  ];

  // dedupe hubs
  const hubMap = new Map<string, { x: number; y: number; label: string; color: string }>();
  commits.forEach((c) => {
    if (c.hub && !hubMap.has(c.hub.label)) hubMap.set(c.hub.label, c.hub);
  });

  return (
    <div className="receipt" style={{ padding: 12 }}>
      <svg viewBox="0 0 320 360" style={{ width: '100%', height: 360 }}>
        {/* edges to core */}
        {commits.map((c, i) => (
          <line
            key={`e-${i}`}
            x1={core.x}
            y1={core.y}
            x2={c.x}
            y2={c.y}
            stroke="var(--color-hairline-ink)"
            strokeDasharray="3 4"
            strokeWidth={1}
            opacity={0.4}
          />
        ))}
        {/* edges to hubs */}
        {commits.map((c, i) =>
          c.hub ? (
            <line
              key={`h-${i}`}
              x1={c.x}
              y1={c.y}
              x2={c.hub.x}
              y2={c.hub.y}
              stroke="var(--color-hairline-ink)"
              strokeDasharray="3 4"
              strokeWidth={1}
              opacity={0.4}
            />
          ) : null,
        )}
        {/* commits */}
        {commits.map((c, i) => (
          <g key={`c-${i}`}>
            <circle cx={c.x} cy={c.y} r={c.r} fill={c.color} stroke="var(--color-paper)" strokeWidth={1.5} />
            <text
              x={c.x}
              y={c.y + c.r + 12}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize={9}
              fill="var(--color-ink)"
              style={{ paintOrder: 'stroke', stroke: 'var(--color-paper)', strokeWidth: 3 } as React.CSSProperties}
            >
              {c.label}
            </text>
          </g>
        ))}
        {/* hubs */}
        {Array.from(hubMap.values()).map((h) => (
          <g key={h.label}>
            <rect x={h.x - 44} y={h.y - 14} width={88} height={28} fill="var(--color-paper-shade)" stroke="var(--color-hairline-ink)" rx={2} />
            <rect x={h.x - 44} y={h.y - 14} width={88} height={4} fill={h.color} />
            <text x={h.x} y={h.y + 5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-ink)" letterSpacing="1.3">
              {h.label}
            </text>
          </g>
        ))}
        {/* core paystub */}
        <g>
          <rect x={core.x - 56} y={core.y - 28} width={112} height={56} fill="var(--color-paper-shade)" stroke="var(--color-hairline-ink)" rx={2} />
          <rect x={core.x - 56} y={core.y - 28} width={112} height={5} fill="#9a8bc4" />
          <text x={core.x} y={core.y - 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-ink-muted)" letterSpacing="1.3">
            PAY SLIP
          </text>
          <text x={core.x} y={core.y + 14} textAnchor="middle" fontFamily="var(--font-display, serif)" fontSize={14} fill="var(--color-ink)">
            8d to payday
          </text>
        </g>
      </svg>
    </div>
  );
}
