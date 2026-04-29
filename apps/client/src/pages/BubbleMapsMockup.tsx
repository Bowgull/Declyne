import { useState } from 'react';

/**
 * Bubble map polish mockups. Four variants exploring the four critiques:
 *   A — Story headline (marketer)
 *   B — Calibrated bubbles + press state (UX)
 *   C — Anchored Habits center (UX/user)
 *   D — Action whisper (user)
 *
 * Self-contained. Hard-coded seed data matching live numbers so the mockup is
 * stable regardless of API state. Routed at /mockup/bubblemaps.
 */

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

type Cat = 'essentials' | 'lifestyle' | 'indulgence' | 'savings' | 'debt' | 'income';

interface Bubble {
  id: string;
  label: string;
  cents: number;
  cat: Cat;
}

// Money map seed — matches session 86 live values
const moneyBubbles: Bubble[] = [
  { id: 'm1', label: 'TD Visa min', cents: 8940, cat: 'debt' },
  { id: 'm2', label: 'Capital One min', cents: 5000, cat: 'debt' },
  { id: 'm3', label: 'Luther min', cents: 10000, cat: 'debt' },
  { id: 'm4', label: '→ Capital One', cents: 136500, cat: 'debt' },
  { id: 'm5', label: '→ TD Visa', cents: 87900, cat: 'debt' },
  { id: 'm6', label: 'Vacation fund', cents: 4167, cat: 'savings' },
  { id: 'm7', label: 'Cash buffer', cents: 19546, cat: 'savings' },
  { id: 'm8', label: 'Summer camping', cents: 7353, cat: 'savings' },
];

// Habits seed — Tim Hortons clearly biggest
const habitsBubbles: Bubble[] = [
  { id: 'h1', label: 'Tim Hortons', cents: 32400, cat: 'indulgence' },
  { id: 'h2', label: 'McDonald’s', cents: 18700, cat: 'indulgence' },
  { id: 'h3', label: 'Uber Eats', cents: 24100, cat: 'indulgence' },
  { id: 'h4', label: 'Banh Mi Boys', cents: 12200, cat: 'lifestyle' },
  { id: 'h5', label: 'Tokyo Smoke', cents: 28000, cat: 'indulgence' },
  { id: 'h6', label: 'Amazon', cents: 15800, cat: 'lifestyle' },
  { id: 'h7', label: 'Netflix', cents: 6700, cat: 'lifestyle' },
  { id: 'h8', label: 'Spotify', cents: 3900, cat: 'lifestyle' },
];

const W = 380;

function radiusBy(cents: number, max: number, min: number, peak: number, log = false): number {
  if (max <= 0) return min;
  const ratio = log
    ? Math.log(1 + Math.max(0, cents)) / Math.log(1 + max)
    : Math.sqrt(Math.max(0, cents) / max);
  return min + ratio * (peak - min);
}

function fmt(c: number) {
  const a = Math.abs(c);
  if (a >= 100000) return `$${Math.round(a / 100).toLocaleString('en-CA')}`;
  return `$${(a / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Placed extends Bubble {
  x: number;
  y: number;
  r: number;
}

function placeCentered(bubbles: Bubble[], height: number): Placed[] {
  const sorted = [...bubbles].sort((a, b) => b.cents - a.cents).slice(0, 8);
  const cx = W / 2;
  const cy = height / 2;
  const max = Math.max(...sorted.map((b) => b.cents), 1);
  const inner = sorted.slice(0, 4);
  const outer = sorted.slice(4);
  const placed: Placed[] = [];
  inner.forEach((b, i) => {
    const angle = -Math.PI / 2 + (i / inner.length) * Math.PI * 2;
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * 100,
      y: cy + Math.sin(angle) * 100,
      r: radiusBy(b.cents, max, 13, 28),
    });
  });
  outer.forEach((b, i) => {
    const offset = Math.PI / 4;
    const angle = -Math.PI / 2 + offset + (i / outer.length) * Math.PI * 2;
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * 148,
      y: cy + Math.sin(angle) * 148,
      r: radiusBy(b.cents, max, 13, 28),
    });
  });
  return placed;
}

function placeCluster(bubbles: Bubble[], height: number, log = false): Placed[] {
  const sorted = [...bubbles].sort((a, b) => b.cents - a.cents).slice(0, 8);
  const cx = W / 2;
  const cy = height / 2;
  const max = Math.max(...sorted.map((b) => b.cents), 1);
  const placed: Placed[] = [];
  placed.push({
    ...sorted[0]!,
    x: cx,
    y: cy - 14,
    r: radiusBy(sorted[0]!.cents, max, 16, 36, log),
  });
  const ring1 = sorted.slice(1, 7);
  ring1.forEach((b, i) => {
    const angle = -Math.PI / 2 + ((i + 0.5) / ring1.length) * Math.PI * 2;
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * 88,
      y: cy - 14 + Math.sin(angle) * 88,
      r: radiusBy(b.cents, max, 12, 26, log),
    });
  });
  const ring2 = sorted.slice(7);
  ring2.forEach((b, i) => {
    const angle = i * (Math.PI * 2);
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * 138,
      y: cy - 14 + Math.sin(angle) * 138,
      r: radiusBy(b.cents, max, 10, 18, log),
    });
  });
  return placed;
}

// ---------- shared chrome ----------

function MapShell({ children, height = 340 }: { children: React.ReactNode; height?: number }) {
  return (
    <section
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(158,120,185,0.08) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
        borderRadius: 4,
        position: 'relative',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: 'block' }}>
        {children}
      </svg>
    </section>
  );
}

function VariantWrap({
  letter,
  title,
  premise,
  children,
}: {
  letter: string;
  title: string;
  premise: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 56 }}>
      <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
          <span style={{ color: '#c8a96a', marginRight: 8 }}>§ {letter}</span>
          {title}
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 1.55 }}>
          {premise}
        </div>
      </div>
      {children}
    </section>
  );
}

// ---------- Variant A — Story headline ----------

function VariantA() {
  const placed = placeCentered(moneyBubbles, 340);
  const cx = W / 2;
  const cy = 170;
  return (
    <VariantWrap
      letter="A"
      title="Story headline"
      premise="Lead with the question, not the answer. The number proves the story instead of being the headline."
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          01 · MONEY MAP
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)', lineHeight: 1.25, letterSpacing: '-0.005em' }}>
          Your $2,700 paycheque, mapped.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          $2,194 committed · <span style={{ color: '#9e78b9' }}>$506 free to spend</span>
        </div>
      </div>
      <MapShell height={340}>
        {placed.map((b) => (
          <line key={`l-${b.id}`} x1={cx} y1={cy} x2={b.x} y2={b.y} stroke={`var(--cat-${b.cat})`} strokeOpacity={0.18} strokeWidth="0.8" />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="var(--font-display)" fontSize="20" fontWeight="600" fill="rgba(255,255,255,0.94)">
          $2,700
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" letterSpacing="1.6" fill="rgba(255,255,255,0.45)">
          PAYCHEQUE
        </text>
        {placed.map((b) => (
          <g key={b.id}>
            <circle cx={b.x} cy={b.y} r={b.r} fill={`var(--cat-${b.cat})`} stroke="#0e0a10" strokeWidth="1.5" />
            <text x={b.x} y={b.y + b.r + 13} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.85)">
              {b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label}
            </text>
            <text x={b.x} y={b.y + b.r + 24} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.5)">
              {fmt(b.cents)}
            </text>
          </g>
        ))}
      </MapShell>
    </VariantWrap>
  );
}

// ---------- Variant B — Calibrated bubbles + press state ----------

function VariantB() {
  const [pressed, setPressed] = useState<string | null>(null);
  const placed = placeCluster(habitsBubbles, 340, true); // log-scale
  return (
    <VariantWrap
      letter="B"
      title="Calibrated bubbles + press state"
      premise="Log-scale sizing so $324 reads visibly bigger than $187. Tap-press flips paper-shade so bubbles feel like instruments, not decoration."
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          01 · HABITS · LAST 90 DAYS
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.005em' }}>
          Where $1,380 went.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
          tap a bubble for last 5 charges
        </div>
      </div>
      <MapShell height={340}>
        {/* Calibration ring at canvas edge — visual y-axis */}
        <g opacity={0.18}>
          <circle cx={W / 2} cy={156} r={88} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="2 4" />
          <text x={W / 2 + 88 + 4} y={156} fontFamily="ui-monospace, Menlo" fontSize="8" fill="rgba(255,255,255,0.4)">$100</text>
        </g>
        {placed.map((b) => {
          const isPressed = pressed === b.id;
          return (
            <g
              key={b.id}
              onMouseDown={() => setPressed(b.id)}
              onMouseUp={() => setPressed(null)}
              onMouseLeave={() => setPressed(null)}
              onTouchStart={() => setPressed(b.id)}
              onTouchEnd={() => setPressed(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill={isPressed ? '#f2ece0' : `var(--cat-${b.cat})`}
                stroke={isPressed ? `var(--cat-${b.cat})` : '#0e0a10'}
                strokeWidth={isPressed ? 2 : 1.5}
                style={{ transition: 'fill 100ms, stroke 100ms' }}
              />
              {isPressed && (
                <text x={b.x} y={b.y + 4} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="10" fontWeight="600" fill="#1a141d">
                  {fmt(b.cents)}
                </text>
              )}
              <text x={b.x} y={b.y + b.r + 13} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.85)">
                {b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label}
              </text>
              <text x={b.x} y={b.y + b.r + 24} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.5)">
                {fmt(b.cents)}
              </text>
            </g>
          );
        })}
      </MapShell>
      <div style={{ ...mono, fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', marginTop: 10, textAlign: 'center' }}>
        {pressed ? `→ ${habitsBubbles.find((b) => b.id === pressed)?.label.toUpperCase()} pressed` : '· try pressing a bubble ·'}
      </div>
    </VariantWrap>
  );
}

// ---------- Variant C — Anchored Habits ----------

function VariantC() {
  const placed = placeCluster(habitsBubbles, 340).slice(1); // skip head, keep ring
  // re-place around an anchored center
  const cx = W / 2;
  const cy = 170;
  const max = Math.max(...habitsBubbles.map((b) => b.cents), 1);
  const sorted = [...habitsBubbles].sort((a, b) => b.cents - a.cents).slice(0, 7);
  const arranged = sorted.map((b, i) => {
    const angle = -Math.PI / 2 + ((i + 0.5) / sorted.length) * Math.PI * 2;
    const dist = i === 0 ? 78 : 96 + (i % 2) * 30;
    return {
      ...b,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: radiusBy(b.cents, max, 12, 26, true),
    };
  });
  void placed;
  return (
    <VariantWrap
      letter="C"
      title="Anchored Habits"
      premise="Cluster needs gravity. Center label gives the eye a starting point and frames the whole picture as 'you' vs 'these merchants.'"
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          01 · HABITS
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.005em' }}>
          What pulled at you.
        </div>
      </div>
      <MapShell height={340}>
        {arranged.map((b) => (
          <line key={`l-${b.id}`} x1={cx} y1={cy} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        ))}
        {/* anchor */}
        <circle cx={cx} cy={cy} r={36} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontFamily="var(--font-display)" fontSize="20" fontWeight="600" fill="rgba(255,255,255,0.92)">
          $1,380
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="8" letterSpacing="1.6" fill="rgba(255,255,255,0.4)">
          90 DAYS
        </text>
        {arranged.map((b) => (
          <g key={b.id}>
            <circle cx={b.x} cy={b.y} r={b.r} fill={`var(--cat-${b.cat})`} stroke="#0e0a10" strokeWidth="1.5" />
            <text x={b.x} y={b.y + b.r + 13} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.85)">
              {b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label}
            </text>
            <text x={b.x} y={b.y + b.r + 24} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.5)">
              {fmt(b.cents)}
            </text>
          </g>
        ))}
      </MapShell>
    </VariantWrap>
  );
}

// ---------- Variant D — Action whisper ----------

function VariantD() {
  const placed = placeCluster(habitsBubbles, 340, true);
  const top = [...habitsBubbles].sort((a, b) => b.cents - a.cents)[0]!;
  return (
    <VariantWrap
      letter="D"
      title="Action whisper"
      premise="Maps are diagnostic. After the picture, one whispered next step turns 'huh' into 'oh.' One row, ink-only, dismissible."
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          01 · HABITS
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)' }}>
          Where $1,380 went.
        </div>
      </div>
      <MapShell height={340}>
        {placed.map((b) => (
          <g key={b.id}>
            <circle cx={b.x} cy={b.y} r={b.r} fill={`var(--cat-${b.cat})`} stroke="#0e0a10" strokeWidth="1.5" />
            <text x={b.x} y={b.y + b.r + 13} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.85)">
              {b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label}
            </text>
            <text x={b.x} y={b.y + b.r + 24} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.5)">
              {fmt(b.cents)}
            </text>
          </g>
        ))}
      </MapShell>
      <div
        style={{
          marginTop: 14,
          padding: '12px 14px',
          border: '1px dashed rgba(255,255,255,0.18)',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--cat-${top.cat})` }} />
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.85)', flex: 1, lineHeight: 1.55 }}>
          <strong style={{ fontWeight: 600 }}>{top.label}</strong> leads at {fmt(top.cents)}.
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> Cap it next paycheque?</span>
        </div>
        <button
          style={{
            ...mono,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#9e78b9',
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            cursor: 'pointer',
          }}
        >
          set cap ›
        </button>
      </div>
    </VariantWrap>
  );
}

// ---------- Variant E — Combined (A + B + D applied to both maps) ----------

function VariantE() {
  const [pressedM, setPressedM] = useState<string | null>(null);
  const [pressedH, setPressedH] = useState<string | null>(null);
  const moneyPlaced = placeCentered(moneyBubbles, 340);
  const habitsPlaced = placeCluster(habitsBubbles, 340, true);
  const cx = W / 2;
  const cy = 170;
  const topHabit = [...habitsBubbles].sort((a, b) => b.cents - a.cents)[0]!;
  const topDebt = [...moneyBubbles]
    .filter((b) => b.cat === 'debt' && b.label.startsWith('→'))
    .sort((a, b) => b.cents - a.cents)[0]!;

  return (
    <VariantWrap
      letter="E"
      title="Combined · A + B + D, applied to both maps"
      premise="Story headline above. Picture in the middle (log-scale + press to inspect). Whisper row below, one next step."
    >
      {/* MONEY MAP */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          01 · MONEY MAP
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.005em' }}>
          Your $2,700 paycheque, mapped.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          $2,194 committed · <span style={{ color: '#9e78b9' }}>$506 free to spend</span>
        </div>
      </div>
      <MapShell height={340}>
        {moneyPlaced.map((b) => (
          <line key={`l-${b.id}`} x1={cx} y1={cy} x2={b.x} y2={b.y} stroke={`var(--cat-${b.cat})`} strokeOpacity={0.18} strokeWidth="0.8" />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontFamily="var(--font-display)" fontSize="20" fontWeight="600" fill="rgba(255,255,255,0.94)">
          $2,700
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" letterSpacing="1.6" fill="rgba(255,255,255,0.45)">
          PAYCHEQUE
        </text>
        {moneyPlaced.map((b) => {
          const isPressed = pressedM === b.id;
          return (
            <g
              key={b.id}
              onMouseDown={() => setPressedM(b.id)}
              onMouseUp={() => setPressedM(null)}
              onMouseLeave={() => setPressedM(null)}
              onTouchStart={() => setPressedM(b.id)}
              onTouchEnd={() => setPressedM(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill={isPressed ? '#f2ece0' : `var(--cat-${b.cat})`}
                stroke={isPressed ? `var(--cat-${b.cat})` : '#0e0a10'}
                strokeWidth={isPressed ? 2 : 1.5}
                style={{ transition: 'fill 100ms, stroke 100ms' }}
              />
              {isPressed && (
                <text x={b.x} y={b.y + 4} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="10" fontWeight="600" fill="#1a141d">
                  {fmt(b.cents)}
                </text>
              )}
              <text x={b.x} y={b.y + b.r + 13} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.85)">
                {b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label}
              </text>
              <text x={b.x} y={b.y + b.r + 24} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.5)">
                {fmt(b.cents)}
              </text>
            </g>
          );
        })}
      </MapShell>
      <div
        style={{
          marginTop: 14,
          padding: '12px 14px',
          border: '1px dashed rgba(255,255,255,0.18)',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--cat-${topDebt.cat})` }} />
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.85)', flex: 1, lineHeight: 1.55 }}>
          <strong style={{ fontWeight: 600 }}>{topDebt.label.replace('→ ', '')}</strong> takes the biggest push at {fmt(topDebt.cents)}.
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> Stamp the plan?</span>
        </div>
        <button
          style={{
            ...mono,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#9e78b9',
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            cursor: 'pointer',
          }}
        >
          draft ›
        </button>
      </div>

      {/* HABITS MAP */}
      <div style={{ margin: '36px 0 14px' }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          02 · HABITS · LAST 90 DAYS
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.005em' }}>
          Where $1,380 went.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          $432 in last 30 days · tap a bubble to inspect
        </div>
      </div>
      <MapShell height={340}>
        {habitsPlaced.map((b) => {
          const isPressed = pressedH === b.id;
          return (
            <g
              key={b.id}
              onMouseDown={() => setPressedH(b.id)}
              onMouseUp={() => setPressedH(null)}
              onMouseLeave={() => setPressedH(null)}
              onTouchStart={() => setPressedH(b.id)}
              onTouchEnd={() => setPressedH(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill={isPressed ? '#f2ece0' : `var(--cat-${b.cat})`}
                stroke={isPressed ? `var(--cat-${b.cat})` : '#0e0a10'}
                strokeWidth={isPressed ? 2 : 1.5}
                style={{ transition: 'fill 100ms, stroke 100ms' }}
              />
              {isPressed && (
                <text x={b.x} y={b.y + 4} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="10" fontWeight="600" fill="#1a141d">
                  {fmt(b.cents)}
                </text>
              )}
              <text x={b.x} y={b.y + b.r + 13} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.85)">
                {b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label}
              </text>
              <text x={b.x} y={b.y + b.r + 24} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.5)">
                {fmt(b.cents)}
              </text>
            </g>
          );
        })}
      </MapShell>
      <div
        style={{
          marginTop: 14,
          padding: '12px 14px',
          border: '1px dashed rgba(255,255,255,0.18)',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--cat-${topHabit.cat})` }} />
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.85)', flex: 1, lineHeight: 1.55 }}>
          <strong style={{ fontWeight: 600 }}>{topHabit.label}</strong> leads at {fmt(topHabit.cents)}.
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> Cap it next paycheque?</span>
        </div>
        <button
          style={{
            ...mono,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#9e78b9',
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            cursor: 'pointer',
          }}
        >
          set cap ›
        </button>
      </div>
    </VariantWrap>
  );
}

// ---------- page ----------

export default function BubbleMapsMockup() {
  return (
    <div className="ledger-page">
      <header className="ledger-header">
        <div className="ledger-header-title">
          <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#c8a96a' }}>
            § MOCKUP
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, margin: '4px 0 0', color: 'rgba(255,255,255,0.95)' }}>
            Bubble map polish
          </h1>
          <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
            five directions · build none until you pick
          </div>
        </div>
      </header>
      <div style={{ marginTop: 32 }}>
        <VariantE />
        <VariantA />
        <VariantB />
        <VariantC />
        <VariantD />
      </div>
    </div>
  );
}
