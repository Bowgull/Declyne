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
  /** Audit-tape observation revealed on press (Variant F). */
  obs?: string;
  /** Stripe tag on the artifact (Variant F). */
  tag?: string;
}

// Money map seed — matches session 86 live values
const moneyBubbles: Bubble[] = [
  { id: 'm1', label: 'TD Visa min', cents: 8940, cat: 'debt', tag: 'MIN', obs: 'TD VISA MIN · 26 PAYCHEQUES IN A ROW · NEVER MISSED' },
  { id: 'm2', label: 'Capital One min', cents: 5000, cat: 'debt', tag: 'MIN', obs: 'CAPITAL ONE MIN · 24 PAYCHEQUES IN A ROW · STILL HOLDING' },
  { id: 'm3', label: 'Luther min', cents: 10000, cat: 'debt', tag: 'MIN', obs: 'LUTHER · INFORMAL · LAST PAID FEB 14' },
  { id: 'm4', label: '→ Capital One', cents: 136500, cat: 'debt', tag: 'PUSH', obs: 'CAPITAL ONE · BIGGEST PUSH · CLEARS IN 8 WEEKS AT THIS RATE' },
  { id: 'm5', label: '→ TD Visa', cents: 87900, cat: 'debt', tag: 'PUSH', obs: 'TD VISA · SECOND PUSH · CLEARS BY OCT IF YOU HOLD' },
  { id: 'm6', label: 'Vacation fund', cents: 4167, cat: 'savings', tag: 'GOAL', obs: 'VACATION · $1,750 OF $4,000 · ON PACE FOR JULY' },
  { id: 'm7', label: 'Cash buffer', cents: 19546, cat: 'savings', tag: 'AUTO', obs: 'CASH BUFFER · AUTOPILOT · 3 MONTHS RUNNING' },
  { id: 'm8', label: 'Summer camping', cents: 7353, cat: 'savings', tag: 'GOAL', obs: 'SUMMER CAMPING · $580 OF $1,200 · TIGHT BY JUNE' },
];

// Habits seed — Tim Hortons clearly biggest
const habitsBubbles: Bubble[] = [
  { id: 'h1', label: 'Tim Hortons', cents: 32400, cat: 'indulgence', tag: 'RCPT', obs: 'TIM HORTONS · 24 CHARGES · TWICE A DAY, WEEKDAYS · LAST YESTERDAY 2PM' },
  { id: 'h2', label: 'McDonald’s', cents: 18700, cat: 'indulgence', tag: 'RCPT', obs: 'MCDONALD’S · 11 CHARGES · ALL FRIDAY/SATURDAY · LATE NIGHT' },
  { id: 'h3', label: 'Uber Eats', cents: 24100, cat: 'indulgence', tag: 'RCPT', obs: 'UBER EATS · 14 CHARGES · SUNDAY EVENINGS · AVG $17' },
  { id: 'h4', label: 'Banh Mi Boys', cents: 12200, cat: 'lifestyle', tag: 'CHIT', obs: 'BANH MI BOYS · 6 CHARGES · LUNCH WEDNESDAYS' },
  { id: 'h5', label: 'Tokyo Smoke', cents: 28000, cat: 'indulgence', tag: 'RCPT', obs: 'TOKYO SMOKE · 9 CHARGES · EVERY 10 DAYS · AVG $31' },
  { id: 'h6', label: 'Amazon', cents: 15800, cat: 'lifestyle', tag: 'CHIT', obs: 'AMAZON · 7 CHARGES · TWO BIG ORDERS · REST UNDER $20' },
  { id: 'h7', label: 'Netflix', cents: 6700, cat: 'lifestyle', tag: 'AUTO', obs: 'NETFLIX · MONTHLY · 14 MONTHS RUNNING · AUTOPILOT' },
  { id: 'h8', label: 'Spotify', cents: 3900, cat: 'lifestyle', tag: 'AUTO', obs: 'SPOTIFY · MONTHLY · 22 MONTHS RUNNING · AUTOPILOT' },
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

// ---------- Variant H — Network, on-brand + iPhone-native ----------

interface HNode {
  id: string;
  label: string;
  cents?: number;
  cat?: Cat;
  kind: 'merchant' | 'hub' | 'core';
  obs?: string;
}

interface HEdge {
  a: string;
  b: string;
  weight?: 'primary' | 'faint';
}

const habitsHNodes: HNode[] = [
  { id: 'h1', label: 'Tim Hortons', cents: 32400, cat: 'indulgence', kind: 'merchant', obs: '24 charges · twice a day, weekdays · last yesterday 2pm' },
  { id: 'h2', label: 'McDonald’s', cents: 18700, cat: 'indulgence', kind: 'merchant', obs: '11 charges · all friday/saturday · late night' },
  { id: 'h3', label: 'Uber Eats', cents: 24100, cat: 'indulgence', kind: 'merchant', obs: '14 charges · sunday evenings · avg $17' },
  { id: 'h4', label: 'Banh Mi Boys', cents: 12200, cat: 'lifestyle', kind: 'merchant', obs: '6 charges · lunch wednesdays' },
  { id: 'h5', label: 'Tokyo Smoke', cents: 28000, cat: 'indulgence', kind: 'merchant', obs: '9 charges · every 10 days · avg $31' },
  { id: 'h6', label: 'Amazon', cents: 15800, cat: 'lifestyle', kind: 'merchant', obs: '7 charges · two big orders · rest under $20' },
  { id: 'h7', label: 'Netflix', cents: 6700, cat: 'lifestyle', kind: 'merchant', obs: 'monthly · 14 months running · autopilot' },
  { id: 'h8', label: 'Spotify', cents: 3900, cat: 'lifestyle', kind: 'merchant', obs: 'monthly · 22 months running · autopilot' },
  { id: 'p_morning', label: 'MORNING', kind: 'hub' },
  { id: 'p_weekdays', label: 'WEEKDAYS', kind: 'hub' },
  { id: 'p_weekend', label: 'WEEKEND', kind: 'hub' },
  { id: 'p_autopilot', label: 'AUTOPILOT', kind: 'hub' },
  { id: 'p_evening', label: 'EVENING', kind: 'hub' },
];

const habitsHEdges: HEdge[] = [
  { a: 'h1', b: 'p_morning', weight: 'primary' },
  { a: 'h1', b: 'p_weekdays', weight: 'primary' },
  { a: 'h2', b: 'p_evening' },
  { a: 'h2', b: 'p_weekend', weight: 'primary' },
  { a: 'h3', b: 'p_evening', weight: 'primary' },
  { a: 'h3', b: 'p_weekend' },
  { a: 'h4', b: 'p_weekdays' },
  { a: 'h5', b: 'p_evening' },
  { a: 'h7', b: 'p_autopilot', weight: 'primary' },
  { a: 'h8', b: 'p_autopilot', weight: 'primary' },
];

const moneyHNodes: HNode[] = [
  { id: 'core', label: '$2,700', kind: 'core', obs: 'paycheque · cycle 18 · apr 24 · deposited' },
  { id: 'm1', label: 'TD Visa min', cents: 8940, cat: 'debt', kind: 'merchant', obs: 'min · 26 paycheques in a row · never missed' },
  { id: 'm2', label: 'Cap One min', cents: 5000, cat: 'debt', kind: 'merchant', obs: 'min · 24 paycheques in a row' },
  { id: 'm3', label: 'Luther min', cents: 10000, cat: 'debt', kind: 'merchant', obs: 'informal · last paid feb 14' },
  { id: 'm4', label: '→ Cap One', cents: 136500, cat: 'debt', kind: 'merchant', obs: 'biggest push · clears in 8 weeks' },
  { id: 'm5', label: '→ TD Visa', cents: 87900, cat: 'debt', kind: 'merchant', obs: 'second push · clears by oct' },
  { id: 'm6', label: 'Vacation', cents: 4167, cat: 'savings', kind: 'merchant', obs: 'on pace for july · $1,750/$4,000' },
  { id: 'm7', label: 'Buffer', cents: 19546, cat: 'savings', kind: 'merchant', obs: 'autopilot · 3 months running' },
  { id: 'm8', label: 'Camping', cents: 7353, cat: 'savings', kind: 'merchant', obs: 'tight by june · $580/$1,200' },
  { id: 'd_capone', label: 'CAPITAL ONE', kind: 'hub' },
  { id: 'd_tdvisa', label: 'TD VISA', kind: 'hub' },
  { id: 'd_luther', label: 'LUTHER', kind: 'hub' },
  { id: 'd_goals', label: 'GOALS', kind: 'hub' },
];

const moneyHEdges: HEdge[] = [
  { a: 'core', b: 'm1', weight: 'primary' },
  { a: 'core', b: 'm2', weight: 'primary' },
  { a: 'core', b: 'm3' },
  { a: 'core', b: 'm4', weight: 'primary' },
  { a: 'core', b: 'm5', weight: 'primary' },
  { a: 'core', b: 'm6' },
  { a: 'core', b: 'm7', weight: 'primary' },
  { a: 'core', b: 'm8' },
  { a: 'm1', b: 'd_tdvisa' },
  { a: 'm5', b: 'd_tdvisa', weight: 'primary' },
  { a: 'm2', b: 'd_capone' },
  { a: 'm4', b: 'd_capone', weight: 'primary' },
  { a: 'm3', b: 'd_luther' },
  { a: 'm6', b: 'd_goals' },
  { a: 'm8', b: 'd_goals' },
  { a: 'm7', b: 'd_goals' },
];

interface HPlaced extends HNode {
  x: number;
  y: number;
  /** visual radius for circles, or paper card width/height for hubs */
  r: number;
  cardW?: number;
  cardH?: number;
}

/**
 * Effective bounding radius of a placed node for collision relaxation.
 * Merchants reserve room for their two-line label below; hubs/core use card extents.
 */
function effectiveR(n: HPlaced): number {
  if (n.cardW != null && n.cardH != null) {
    return Math.max(n.cardW, n.cardH) / 2 + 4;
  }
  return n.r + 14; // r + label clearance
}

/** Pairwise repulsion. Movable nodes only — hubs and core stay anchored. */
function relaxH(placed: HPlaced[], padding = 4, iters = 80): void {
  const movable = (n: HPlaced) => n.kind === 'merchant';
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        const aMov = movable(a);
        const bMov = movable(b);
        if (!aMov && !bMov) continue;
        const ra = effectiveR(a);
        const rb = effectiveR(b);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = ra + rb + padding;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < minDist) {
          const overlap = (minDist - dist) / (aMov && bMov ? 2 : 1);
          const nx = dx / dist;
          const ny = dy / dist;
          if (aMov) { a.x -= nx * overlap; a.y -= ny * overlap; }
          if (bMov) { b.x += nx * overlap; b.y += ny * overlap; }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

function placeMoneyH(nodes: HNode[], height: number): HPlaced[] {
  const cx = W / 2;
  const cy = height / 2;
  const merchants = nodes.filter((n) => n.kind === 'merchant');
  const max = Math.max(...merchants.map((n) => n.cents ?? 1), 1);
  const placed: HPlaced[] = [];
  // core (pay slip card) at center
  placed.push({ ...nodes.find((n) => n.id === 'core')!, x: cx, y: cy, r: 0, cardW: 104, cardH: 52 });
  // destination index cards on outer ring (pushed further out for breathing room)
  const dests = ['d_capone', 'd_tdvisa', 'd_luther', 'd_goals'];
  dests.forEach((id, i) => {
    const node = nodes.find((n) => n.id === id)!;
    const angle = -Math.PI / 2 + (i / dests.length) * Math.PI * 2 + Math.PI / 4;
    const w = 80;
    const h = 22;
    placed.push({ ...node, x: cx + Math.cos(angle) * 168, y: cy + Math.sin(angle) * 148, r: 0, cardW: w, cardH: h });
  });
  // commitments placed between core and primary destination
  const destOf: Record<string, string> = { m1: 'd_tdvisa', m2: 'd_capone', m3: 'd_luther', m4: 'd_capone', m5: 'd_tdvisa', m6: 'd_goals', m7: 'd_goals', m8: 'd_goals' };
  const commits = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'];
  commits.forEach((id) => {
    const node = merchants.find((n) => n.id === id)!;
    const dest = placed.find((p) => p.id === destOf[id])!;
    const dx = dest.x - cx;
    const dy = dest.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const sameDest = commits.filter((c) => destOf[c] === destOf[id]);
    const idx = sameDest.indexOf(id);
    const spread =
      sameDest.length === 1 ? 0 :
      sameDest.length === 2 ? (idx === 0 ? -28 : 28) :
      (idx - (sameDest.length - 1) / 2) * 40;
    const t = Math.log(1 + (node.cents ?? 1)) / Math.log(1 + max);
    placed.push({ ...node, x: cx + dx * 0.6 + px * spread, y: cy + dy * 0.6 + py * spread, r: 11 + t * 13 });
  });
  relaxH(placed, 6, 100);
  return placed;
}

function placeHabitsH(nodes: HNode[], height: number): HPlaced[] {
  const merchants = nodes.filter((n) => n.kind === 'merchant');
  const hubs = nodes.filter((n) => n.kind === 'hub');
  const cx = W / 2;
  const cy = height / 2;
  const max = Math.max(...merchants.map((n) => n.cents ?? 1), 1);
  const placed: HPlaced[] = [];
  hubs.forEach((h, i) => {
    const angle = -Math.PI / 2 + (i / hubs.length) * Math.PI * 2;
    const w = 80;
    const ht = 22;
    placed.push({ ...h, x: cx + Math.cos(angle) * 168, y: cy + Math.sin(angle) * 148, r: 0, cardW: w, cardH: ht });
  });
  // merchants in inner cluster — wider start ring + relaxation does the rest
  merchants.forEach((m, i) => {
    const angle = -Math.PI / 2 + (i / merchants.length) * Math.PI * 2 + 0.3;
    const dist = 60 + (i % 2) * 22;
    const t = Math.log(1 + (m.cents ?? 1)) / Math.log(1 + max);
    placed.push({ ...m, x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, r: 12 + t * 16 });
  });
  relaxH(placed, 6, 100);
  return placed;
}

interface HGraphProps {
  nodes: HPlaced[];
  edges: HEdge[];
  pinned: string | null;
  setPinned: (id: string | null) => void;
  height: number;
  showAmount?: boolean;
}

function HGraph({ nodes, edges, pinned, setPinned, height, showAmount }: HGraphProps) {
  const neighbors = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!neighbors.has(e.a)) neighbors.set(e.a, new Set());
    if (!neighbors.has(e.b)) neighbors.set(e.b, new Set());
    neighbors.get(e.a)!.add(e.b);
    neighbors.get(e.b)!.add(e.a);
  }
  const isLit = (id: string) => {
    if (!pinned) return true;
    if (id === pinned) return true;
    return neighbors.get(pinned)?.has(id) ?? false;
  };
  const isLitEdge = (e: HEdge) => pinned !== null && (e.a === pinned || e.b === pinned);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const tap = (id: string) => (ev: React.MouseEvent | React.TouchEvent) => {
    ev.stopPropagation();
    setPinned(pinned === id ? null : id);
  };

  return (
    <section
      style={{
        background:
          'radial-gradient(ellipse at 50% 50%, rgba(158,120,185,0.10) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0a070c 100%)',
        borderRadius: 4,
        position: 'relative',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
        overflow: 'hidden',
        touchAction: 'manipulation',
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        style={{ display: 'block' }}
        onClick={() => setPinned(null)}
      >
        {/* edges — paper perforations */}
        {edges.map((e, i) => {
          const a = nodeById.get(e.a);
          const b = nodeById.get(e.b);
          if (!a || !b) return null;
          const lit = isLitEdge(e);
          const dim = pinned !== null && !lit;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={lit ? 'var(--cat-income)' : 'rgba(255,255,255,0.45)'}
              strokeWidth={lit ? 1.4 : e.weight === 'primary' ? 0.8 : 0.5}
              strokeOpacity={dim ? 0.04 : lit ? 0.85 : e.weight === 'primary' ? 0.13 : 0.06}
              strokeDasharray="3 4"
              style={{ transition: 'stroke 160ms, stroke-opacity 160ms, stroke-width 160ms' }}
            />
          );
        })}

        {/* nodes */}
        {nodes.map((n) => {
          const lit = isLit(n.id);
          const isPinned = pinned === n.id;
          const opacity = lit ? 1 : 0.18;
          if (n.kind === 'core') {
            // PAY SLIP stamp at center
            const w = n.cardW!;
            const h = n.cardH!;
            return (
              <g key={n.id} onClick={tap(n.id)} style={{ cursor: 'pointer', transition: 'opacity 160ms' }} opacity={opacity}>
                {/* hit pad */}
                <rect x={n.x - w / 2 - 6} y={n.y - h / 2 - 6} width={w + 12} height={h + 12} fill="transparent" />
                {/* shadow */}
                <rect x={n.x - w / 2 + 2} y={n.y - h / 2 + 3} width={w} height={h} fill="#000" opacity={0.32} rx={1} />
                {/* paper */}
                <rect x={n.x - w / 2} y={n.y - h / 2} width={w} height={h} fill="#f2ece0" stroke={isPinned ? 'var(--cat-income)' : '#1a141d'} strokeWidth={isPinned ? 1.6 : 1.2} rx={1} />
                {/* mascot purple top stripe */}
                <rect x={n.x - w / 2} y={n.y - h / 2} width={w} height={11} fill="var(--cat-income)" />
                <text x={n.x - w / 2 + 5} y={n.y - h / 2 + 8} fontFamily="ui-monospace, Menlo" fontSize={6.5} letterSpacing={1.4} fontWeight={700} fill="#1a141d" opacity={0.8}>
                  PAY SLIP
                </text>
                {/* amount */}
                <text x={n.x} y={n.y + 11} textAnchor="middle" fontFamily="var(--font-display)" fontSize={18} fontWeight={600} fill="#1a141d">
                  {n.label}
                </text>
                {/* wax mark */}
                <g transform={`translate(${n.x + w / 2 - 32} ${n.y + h / 2 - 16}) rotate(-10)`} opacity={0.7}>
                  <rect width={28} height={11} fill="none" stroke="var(--cat-income)" strokeWidth={0.7} />
                  <text x={14} y={8} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize={5.5} letterSpacing={1.2} fontWeight={700} fill="var(--cat-income)">
                    DEPOSITED
                  </text>
                </g>
              </g>
            );
          }
          if (n.kind === 'hub') {
            // index card
            const w = n.cardW!;
            const h = n.cardH!;
            return (
              <g key={n.id} onClick={tap(n.id)} style={{ cursor: 'pointer', transition: 'opacity 160ms' }} opacity={opacity}>
                {/* hit pad — generous tap area */}
                <rect x={n.x - w / 2 - 10} y={n.y - h / 2 - 10} width={w + 20} height={h + 20} fill="transparent" />
                {/* shadow */}
                <rect x={n.x - w / 2 + 1} y={n.y - h / 2 + 2} width={w} height={h} fill="#000" opacity={0.28} rx={1} />
                {/* paper */}
                <rect x={n.x - w / 2} y={n.y - h / 2} width={w} height={h} fill="#f2ece0" stroke={isPinned ? 'var(--cat-income)' : '#1a141d'} strokeWidth={isPinned ? 1.5 : 1} rx={1} />
                {/* perforated bottom hairline */}
                <line x1={n.x - w / 2 + 4} x2={n.x + w / 2 - 4} y1={n.y + h / 2 - 4} y2={n.y + h / 2 - 4} stroke="#1a141d" strokeWidth={0.4} strokeDasharray="1.5 2" opacity={0.5} />
                <text x={n.x} y={n.y + 3} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize={9} letterSpacing={1.4} fontWeight={700} fill={isPinned ? 'var(--cat-income)' : '#1a141d'} opacity={isPinned ? 1 : 0.75}>
                  {n.label}
                </text>
              </g>
            );
          }
          // merchant — stamped coin (label rendered in second pass below)
          const fill = n.cat ? `var(--cat-${n.cat})` : 'rgba(255,255,255,0.12)';
          return (
            <g key={n.id} onClick={tap(n.id)} style={{ cursor: 'pointer', transition: 'opacity 160ms' }} opacity={opacity}>
              {/* hit pad — minimum 22px radius */}
              <circle cx={n.x} cy={n.y} r={Math.max(n.r + 12, 22)} fill="transparent" />
              {/* halo when pinned */}
              {isPinned && <circle cx={n.x} cy={n.y} r={n.r + 12} fill="rgba(158,120,185,0.18)" />}
              {/* the coin */}
              <circle cx={n.x} cy={n.y} r={n.r} fill={fill} stroke={isPinned ? 'var(--cat-income)' : 'rgba(255,255,255,0.14)'} strokeWidth={isPinned ? 1.8 : 0.8} style={{ transition: 'stroke 160ms, stroke-width 160ms' }} />
            </g>
          );
        })}

        {/* labels — second pass so they always sit on top of every shape */}
        {nodes.filter((n) => n.kind === 'merchant').map((n) => {
          const lit = isLit(n.id);
          const opacity = lit ? 1 : 0.18;
          return (
            <g key={`lbl-${n.id}`} style={{ pointerEvents: 'none', transition: 'opacity 160ms' }} opacity={opacity}>
              {/* faint shadow plate behind the label so it stays legible over neighbors */}
              <rect
                x={n.x - 50}
                y={n.y + n.r + 2}
                width={100}
                height={showAmount && n.cents != null ? 26 : 14}
                fill="#0a070c"
                opacity={0.55}
                rx={1}
              />
              <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize={9} fill="rgba(255,255,255,0.92)">
                {n.label.length > 14 ? `${n.label.slice(0, 13)}…` : n.label}
              </text>
              {showAmount && n.cents != null && (
                <text x={n.x} y={n.y + n.r + 23} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize={9} fill="rgba(255,255,255,0.55)">
                  {fmt(n.cents)}
                </text>
              )}
            </g>
          );
        })}

        {/* PINNED stamp top right when active */}
        {pinned !== null && (
          <g transform={`translate(${W - 60} 18) rotate(-8)`}>
            <rect x={0} y={0} width={48} height={14} fill="none" stroke="var(--cat-income)" strokeWidth={0.9} />
            <text x={24} y={10} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize={7} letterSpacing={1.6} fontWeight={700} fill="var(--cat-income)">
              PINNED
            </text>
          </g>
        )}
      </svg>
    </section>
  );
}

function HAuditTape({ obs }: { obs: string | null }) {
  return (
    <div
      style={{
        marginTop: 10,
        height: 42,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 10px',
        background: '#f2ece0',
        color: '#1a141d',
        position: 'relative',
        boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: -3,
          height: 4,
          background: 'radial-gradient(circle at 4px 4px, #1a141d 1.2px, transparent 1.4px) 0 0/10px 8px',
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -3,
          height: 4,
          background: 'radial-gradient(circle at 4px 0px, #1a141d 1.2px, transparent 1.4px) 0 0/10px 8px',
          opacity: 0.55,
        }}
      />
      <div style={{ ...mono, fontSize: 7, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'rgba(26,20,29,0.55)', marginBottom: 2 }}>
        AUDIT TAPE
      </div>
      <div style={{ ...mono, fontSize: 11, letterSpacing: '0.06em', color: '#1a141d', minHeight: 14 }}>
        {obs ?? <span style={{ opacity: 0.4 }}>· tap to pin ·</span>}
      </div>
    </div>
  );
}

function VariantH() {
  const [pinnedM, setPinnedM] = useState<string | null>(null);
  const [pinnedH, setPinnedH] = useState<string | null>(null);
  const moneyHeight = 410;
  const habitsHeight = 410;
  const moneyPlaced = placeMoneyH(moneyHNodes, moneyHeight);
  const habitsPlaced = placeHabitsH(habitsHNodes, habitsHeight);

  const obsFor = (pinned: string | null, nodes: HNode[], edges: HEdge[]): string | null => {
    if (!pinned) return null;
    const n = nodes.find((x) => x.id === pinned);
    if (!n) return null;
    if (n.kind === 'hub') {
      const linked = edges
        .filter((e) => e.a === pinned || e.b === pinned)
        .map((e) => (e.a === pinned ? e.b : e.a))
        .map((id) => nodes.find((m) => m.id === id))
        .filter((x): x is HNode => Boolean(x));
      if (linked.some((x) => x.cents != null)) {
        const total = linked.reduce((s, x) => s + (x.cents ?? 0), 0);
        return `${n.label} · ${linked.length} flows · ${fmt(total)}/paycheque`;
      }
      const names = linked.map((x) => x.label).join(', ');
      return `${n.label} · ${linked.length} merchants · ${names}`;
    }
    if (n.kind === 'core') return `${n.obs?.toUpperCase() ?? n.label}`;
    return `${n.label.toUpperCase()} · ${n.obs ?? ''}`;
  };

  return (
    <VariantWrap
      letter="H"
      title="Network · on-brand, iPhone-native"
      premise="Tap to pin, tap empty desk to release. Hubs are paper index cards. Edges are paper perforations. Paycheque core is the PAY SLIP stamp."
    >
      {/* MONEY */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          01 · MONEY · NETWORK
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.005em' }}>
          Where every dollar lands.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          paycheque → commitment → destination
        </div>
      </div>
      <HGraph nodes={moneyPlaced} edges={moneyHEdges} pinned={pinnedM} setPinned={setPinnedM} height={moneyHeight} showAmount />
      <HAuditTape obs={obsFor(pinnedM, moneyHNodes, moneyHEdges)} />

      {/* HABITS */}
      <div style={{ margin: '40px 0 12px' }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          02 · HABITS · NETWORK
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)' }}>
          The patterns underneath.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          merchants linked to when, where, how
        </div>
      </div>
      <HGraph nodes={habitsPlaced} edges={habitsHEdges} pinned={pinnedH} setPinned={setPinnedH} height={habitsHeight} showAmount />
      <HAuditTape obs={obsFor(pinnedH, habitsHNodes, habitsHEdges)} />
    </VariantWrap>
  );
}

// ---------- Variant G — Obsidian-style network graph ----------

interface GraphNode {
  id: string;
  label: string;
  cents?: number;
  cat?: Cat;
  /** hub | merchant. Hubs are pattern/destination nodes (smaller, ringed). */
  kind: 'merchant' | 'hub';
  obs?: string;
}

interface GraphEdge {
  a: string;
  b: string;
  /** thicker primary connector vs faint co-occurrence */
  weight?: 'primary' | 'faint';
}

// Habits graph: merchants connected to pattern hubs
const habitsNodes: GraphNode[] = [
  { id: 'h1', label: 'Tim Hortons', cents: 32400, cat: 'indulgence', kind: 'merchant', obs: '24 charges · twice a day, weekdays · last yesterday 2pm' },
  { id: 'h2', label: 'McDonald’s', cents: 18700, cat: 'indulgence', kind: 'merchant', obs: '11 charges · all friday/saturday · late night' },
  { id: 'h3', label: 'Uber Eats', cents: 24100, cat: 'indulgence', kind: 'merchant', obs: '14 charges · sunday evenings · avg $17' },
  { id: 'h4', label: 'Banh Mi Boys', cents: 12200, cat: 'lifestyle', kind: 'merchant', obs: '6 charges · lunch wednesdays' },
  { id: 'h5', label: 'Tokyo Smoke', cents: 28000, cat: 'indulgence', kind: 'merchant', obs: '9 charges · every 10 days · avg $31' },
  { id: 'h6', label: 'Amazon', cents: 15800, cat: 'lifestyle', kind: 'merchant', obs: '7 charges · two big orders · rest under $20' },
  { id: 'h7', label: 'Netflix', cents: 6700, cat: 'lifestyle', kind: 'merchant', obs: 'monthly · 14 months running · autopilot' },
  { id: 'h8', label: 'Spotify', cents: 3900, cat: 'lifestyle', kind: 'merchant', obs: 'monthly · 22 months running · autopilot' },
  { id: 'p_morning', label: 'MORNING', kind: 'hub' },
  { id: 'p_weekdays', label: 'WEEKDAYS', kind: 'hub' },
  { id: 'p_weekend', label: 'WEEKEND', kind: 'hub' },
  { id: 'p_autopilot', label: 'AUTOPILOT', kind: 'hub' },
  { id: 'p_evening', label: 'EVENING', kind: 'hub' },
];

const habitsEdges: GraphEdge[] = [
  { a: 'h1', b: 'p_morning', weight: 'primary' },
  { a: 'h1', b: 'p_weekdays', weight: 'primary' },
  { a: 'h2', b: 'p_evening' },
  { a: 'h2', b: 'p_weekend', weight: 'primary' },
  { a: 'h3', b: 'p_evening', weight: 'primary' },
  { a: 'h3', b: 'p_weekend' },
  { a: 'h4', b: 'p_weekdays' },
  { a: 'h5', b: 'p_evening' },
  { a: 'h7', b: 'p_autopilot', weight: 'primary' },
  { a: 'h8', b: 'p_autopilot', weight: 'primary' },
];

// Money graph: paycheque → commitments → destinations
const moneyNodes: GraphNode[] = [
  { id: 'core', label: '$2,700', kind: 'hub' },
  // commitments
  { id: 'm1', label: 'TD Visa min', cents: 8940, cat: 'debt', kind: 'merchant', obs: 'min · 26 paycheques in a row · never missed' },
  { id: 'm2', label: 'Cap One min', cents: 5000, cat: 'debt', kind: 'merchant', obs: 'min · 24 paycheques in a row' },
  { id: 'm3', label: 'Luther min', cents: 10000, cat: 'debt', kind: 'merchant', obs: 'informal · last paid feb 14' },
  { id: 'm4', label: '→ Cap One', cents: 136500, cat: 'debt', kind: 'merchant', obs: 'biggest push · clears in 8 weeks' },
  { id: 'm5', label: '→ TD Visa', cents: 87900, cat: 'debt', kind: 'merchant', obs: 'second push · clears by oct' },
  { id: 'm6', label: 'Vacation', cents: 4167, cat: 'savings', kind: 'merchant', obs: 'on pace for july · $1,750/$4,000' },
  { id: 'm7', label: 'Buffer', cents: 19546, cat: 'savings', kind: 'merchant', obs: 'autopilot · 3 months running' },
  { id: 'm8', label: 'Camping', cents: 7353, cat: 'savings', kind: 'merchant', obs: 'tight by june · $580/$1,200' },
  // destination hubs
  { id: 'd_capone', label: 'CAPITAL ONE', kind: 'hub' },
  { id: 'd_tdvisa', label: 'TD VISA', kind: 'hub' },
  { id: 'd_luther', label: 'LUTHER', kind: 'hub' },
  { id: 'd_goals', label: 'GOALS', kind: 'hub' },
];

const moneyEdges: GraphEdge[] = [
  // paycheque → every commitment
  { a: 'core', b: 'm1', weight: 'primary' },
  { a: 'core', b: 'm2', weight: 'primary' },
  { a: 'core', b: 'm3' },
  { a: 'core', b: 'm4', weight: 'primary' },
  { a: 'core', b: 'm5', weight: 'primary' },
  { a: 'core', b: 'm6' },
  { a: 'core', b: 'm7', weight: 'primary' },
  { a: 'core', b: 'm8' },
  // commitments → destinations
  { a: 'm1', b: 'd_tdvisa' },
  { a: 'm5', b: 'd_tdvisa', weight: 'primary' },
  { a: 'm2', b: 'd_capone' },
  { a: 'm4', b: 'd_capone', weight: 'primary' },
  { a: 'm3', b: 'd_luther' },
  { a: 'm6', b: 'd_goals' },
  { a: 'm8', b: 'd_goals' },
];

interface PlacedNode extends GraphNode {
  x: number;
  y: number;
  r: number;
  /** drift cycle phase, used to seed CSS animation delay */
  driftDelay: number;
}

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function placeHabitsGraph(nodes: GraphNode[], height: number): PlacedNode[] {
  // merchants in a relaxed cluster, hubs around the perimeter
  const merchants = nodes.filter((n) => n.kind === 'merchant');
  const hubs = nodes.filter((n) => n.kind === 'hub');
  const cx = W / 2;
  const cy = height / 2;
  const max = Math.max(...merchants.map((n) => n.cents ?? 1), 1);
  const placed: PlacedNode[] = [];
  // hubs in a wide ring
  hubs.forEach((h, i) => {
    const angle = -Math.PI / 2 + (i / hubs.length) * Math.PI * 2;
    placed.push({
      ...h,
      x: cx + Math.cos(angle) * 152,
      y: cy + Math.sin(angle) * 132,
      r: 14,
      driftDelay: hash(h.id) % 4000,
    });
  });
  // merchants in inner cluster, sized by amount
  merchants.forEach((m, i) => {
    const angle = -Math.PI / 2 + (i / merchants.length) * Math.PI * 2 + 0.2;
    const dist = 60 + (i % 2) * 24;
    const t = Math.log(1 + (m.cents ?? 1)) / Math.log(1 + max);
    placed.push({
      ...m,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: 12 + t * 18,
      driftDelay: hash(m.id) % 4000,
    });
  });
  return placed;
}

function placeMoneyGraph(nodes: GraphNode[], height: number): PlacedNode[] {
  const cx = W / 2;
  const cy = height / 2;
  const merchants = nodes.filter((n) => n.kind === 'merchant');
  const max = Math.max(...merchants.map((n) => n.cents ?? 1), 1);
  const placed: PlacedNode[] = [];
  // core
  const core = nodes.find((n) => n.id === 'core')!;
  placed.push({ ...core, x: cx, y: cy, r: 24, driftDelay: 0 });
  // destination hubs anchored on a ring
  const dests = ['d_capone', 'd_tdvisa', 'd_luther', 'd_goals'];
  dests.forEach((id, i) => {
    const node = nodes.find((n) => n.id === id)!;
    const angle = -Math.PI / 2 + (i / dests.length) * Math.PI * 2 + Math.PI / 4;
    placed.push({
      ...node,
      x: cx + Math.cos(angle) * 150,
      y: cy + Math.sin(angle) * 130,
      r: 14,
      driftDelay: hash(id) % 4000,
    });
  });
  // commitments — placed roughly between core and their destination
  const commits = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'];
  // map each commitment to its primary destination for placement
  const destOf: Record<string, string> = {
    m1: 'd_tdvisa',
    m2: 'd_capone',
    m3: 'd_luther',
    m4: 'd_capone',
    m5: 'd_tdvisa',
    m6: 'd_goals',
    m7: 'd_goals',
    m8: 'd_goals',
  };
  commits.forEach((id, i) => {
    const node = merchants.find((n) => n.id === id)!;
    const dest = placed.find((p) => p.id === destOf[id]);
    if (!dest) return;
    // offset perpendicular so commits sharing a destination spread
    const dx = dest.x - cx;
    const dy = dest.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const sameDest = commits.filter((c) => destOf[c] === destOf[id]);
    const idx = sameDest.indexOf(id);
    const spread = sameDest.length > 1 ? (idx - (sameDest.length - 1) / 2) * 26 : 0;
    const t = Math.log(1 + (node.cents ?? 1)) / Math.log(1 + max);
    placed.push({
      ...node,
      x: cx + dx * 0.55 + px * spread,
      y: cy + dy * 0.55 + py * spread,
      r: 10 + t * 16,
      driftDelay: hash(id) % 4000,
    });
  });
  return placed;
}

interface GraphProps {
  nodes: PlacedNode[];
  edges: GraphEdge[];
  hovered: string | null;
  setHovered: (id: string | null) => void;
  height: number;
  /** Whether to show the per-merchant amount in the node label. */
  showAmount?: boolean;
}

function Graph({ nodes, edges, hovered, setHovered, height, showAmount }: GraphProps) {
  // build adjacency for highlight
  const neighbors = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!neighbors.has(e.a)) neighbors.set(e.a, new Set());
    if (!neighbors.has(e.b)) neighbors.set(e.b, new Set());
    neighbors.get(e.a)!.add(e.b);
    neighbors.get(e.b)!.add(e.a);
  }
  const isLit = (id: string) => {
    if (!hovered) return true;
    if (id === hovered) return true;
    return neighbors.get(hovered)?.has(id) ?? false;
  };
  const isLitEdge = (e: GraphEdge) => {
    if (!hovered) return false;
    return e.a === hovered || e.b === hovered;
  };
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <section
      style={{
        background:
          'radial-gradient(ellipse at 50% 50%, rgba(158,120,185,0.10) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0a070c 100%)',
        borderRadius: 4,
        position: 'relative',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(158,120,185,0.4)" />
            <stop offset="100%" stopColor="rgba(158,120,185,0)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* edges */}
        {edges.map((e, i) => {
          const a = nodeById.get(e.a);
          const b = nodeById.get(e.b);
          if (!a || !b) return null;
          const lit = isLitEdge(e);
          const dim = hovered !== null && !lit;
          const baseOpacity = e.weight === 'primary' ? 0.22 : 0.1;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={lit ? 'var(--cat-income)' : 'rgba(255,255,255,0.5)'}
              strokeWidth={lit ? 1.6 : e.weight === 'primary' ? 0.9 : 0.5}
              strokeOpacity={dim ? 0.04 : lit ? 0.85 : baseOpacity}
              style={{ transition: 'stroke 160ms, stroke-opacity 160ms, stroke-width 160ms' }}
            />
          );
        })}

        {/* nodes */}
        {nodes.map((n) => {
          const lit = isLit(n.id);
          const isHovered = hovered === n.id;
          const fill = n.kind === 'merchant' && n.cat ? `var(--cat-${n.cat})` : 'rgba(0,0,0,0)';
          const stroke =
            n.kind === 'hub'
              ? isHovered
                ? 'var(--cat-income)'
                : 'rgba(255,255,255,0.45)'
              : isHovered
                ? 'var(--cat-income)'
                : '#0e0a10';
          const opacity = lit ? 1 : 0.18;
          const strokeWidth = isHovered ? 2 : n.kind === 'hub' ? 1 : 1.4;
          // CSS drift via style to keep deterministic per-node motion
          const drift: React.CSSProperties = {
            animation: `bm-drift 7s ease-in-out infinite alternate`,
            animationDelay: `-${n.driftDelay}ms`,
            transformBox: 'fill-box',
            transformOrigin: 'center',
            transition: 'opacity 160ms',
          };
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(n.id)}
              onTouchEnd={() => setHovered(null)}
              style={{ cursor: 'pointer', ...drift, opacity }}
            >
              {isHovered && (
                <circle cx={n.x} cy={n.y} r={n.r + 18} fill="url(#halo)" filter="url(#glow)" />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={n.kind === 'hub' ? '2 3' : undefined}
                style={{ transition: 'stroke 160ms, stroke-width 160ms' }}
              />
              {n.kind === 'hub' && (
                <text
                  x={n.x}
                  y={n.y + 4}
                  textAnchor="middle"
                  fontFamily="ui-monospace, Menlo"
                  fontSize={n.id === 'core' ? 12 : 8}
                  letterSpacing={n.id === 'core' ? '0' : '1.4'}
                  fontWeight={n.id === 'core' ? 600 : 700}
                  fill={isHovered ? 'var(--cat-income)' : 'rgba(255,255,255,0.7)'}
                >
                  {n.label}
                </text>
              )}
              {n.kind === 'merchant' && (
                <>
                  <text
                    x={n.x}
                    y={n.y + n.r + 12}
                    textAnchor="middle"
                    fontFamily="ui-monospace, Menlo"
                    fontSize={9}
                    fill="rgba(255,255,255,0.85)"
                  >
                    {n.label.length > 14 ? `${n.label.slice(0, 13)}…` : n.label}
                  </text>
                  {showAmount && n.cents != null && (
                    <text
                      x={n.x}
                      y={n.y + n.r + 23}
                      textAnchor="middle"
                      fontFamily="ui-monospace, Menlo"
                      fontSize={9}
                      fill="rgba(255,255,255,0.5)"
                    >
                      {fmt(n.cents)}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function VariantG() {
  const [hoveredH, setHoveredH] = useState<string | null>(null);
  const [hoveredM, setHoveredM] = useState<string | null>(null);
  const habitsHeight = 380;
  const moneyHeight = 380;
  const habitsPlaced = placeHabitsGraph(habitsNodes, habitsHeight);
  const moneyPlaced = placeMoneyGraph(moneyNodes, moneyHeight);

  const habitsObs = (() => {
    if (!hoveredH) return null;
    const n = habitsNodes.find((x) => x.id === hoveredH);
    if (!n) return null;
    if (n.kind === 'hub') {
      const linked = habitsEdges
        .filter((e) => e.a === hoveredH || e.b === hoveredH)
        .map((e) => (e.a === hoveredH ? e.b : e.a))
        .map((id) => habitsNodes.find((m) => m.id === id)?.label)
        .filter(Boolean) as string[];
      return `${n.label} · ${linked.length} merchants · ${linked.join(', ')}`;
    }
    return `${n.label.toUpperCase()} · ${n.obs ?? ''}`;
  })();

  const moneyObs = (() => {
    if (!hoveredM) return null;
    const n = moneyNodes.find((x) => x.id === hoveredM);
    if (!n) return null;
    if (n.id === 'core') return 'PAYCHEQUE · $2,700 · CYCLE 18 · APR 24';
    if (n.kind === 'hub') {
      const linked = moneyEdges
        .filter((e) => e.a === hoveredM || e.b === hoveredM)
        .map((e) => (e.a === hoveredM ? e.b : e.a))
        .filter((id) => id !== 'core')
        .map((id) => moneyNodes.find((m) => m.id === id))
        .filter(Boolean) as GraphNode[];
      const total = linked.reduce((s, x) => s + (x.cents ?? 0), 0);
      return `${n.label} · ${linked.length} flows · ${fmt(total)}/paycheque`;
    }
    return `${n.label.toUpperCase()} · ${n.obs ?? ''}`;
  })();

  return (
    <VariantWrap
      letter="G"
      title="Network · obsidian-style"
      premise="Money and habits as a living graph. Hover any node to light its local subgraph; the rest fades. Hubs are patterns and destinations. The graph drifts on its own."
    >
      {/* inject keyframes once */}
      <style>{`
        @keyframes bm-drift {
          0%   { transform: translate(0, 0); }
          50%  { transform: translate(2px, -3px); }
          100% { transform: translate(-2px, 3px); }
        }
      `}</style>

      {/* MONEY */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          01 · MONEY · NETWORK
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.005em' }}>
          Where every dollar lands.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          paycheque → commitment → destination · hover to trace
        </div>
      </div>
      <Graph
        nodes={moneyPlaced}
        edges={moneyEdges}
        hovered={hoveredM}
        setHovered={setHoveredM}
        height={moneyHeight}
        showAmount
      />
      <AuditTape obs={moneyObs} />

      {/* HABITS */}
      <div style={{ margin: '40px 0 12px' }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          02 · HABITS · NETWORK
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)' }}>
          The patterns underneath.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
          merchants linked to when, where, how · hover a hub to see its members
        </div>
      </div>
      <Graph
        nodes={habitsPlaced}
        edges={habitsEdges}
        hovered={hoveredH}
        setHovered={setHoveredH}
        height={habitsHeight}
        showAmount
      />
      <AuditTape obs={habitsObs} />
    </VariantWrap>
  );
}

// ---------- Variant F — Paper artifacts on the desk ----------

const CAT_COLOR: Record<Cat, string> = {
  income: 'var(--cat-income)',
  essentials: 'var(--cat-essentials)',
  lifestyle: 'var(--cat-lifestyle)',
  indulgence: 'var(--cat-indulgence)',
  savings: 'var(--cat-savings)',
  debt: 'var(--cat-debt)',
};

function rotForId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % 50) - 25) / 10; // -2.5 .. +2.5
}

interface PaperProps {
  b: Bubble;
  x: number;
  y: number;
  w: number;
  h: number;
  pressed: boolean;
  dimmed: boolean;
  isBiggest: boolean;
  onPress: () => void;
  onRelease: () => void;
}

function PaperArtifact({ b, x, y, w, h, pressed, dimmed, isBiggest, onPress, onRelease }: PaperProps) {
  const rot = pressed ? 0 : rotForId(b.id);
  const lift = pressed ? -10 : 0;
  const opacity = dimmed ? 0.32 : 1;
  const stripeColor = CAT_COLOR[b.cat];
  const paperFill = '#f2ece0';
  const paperShade = '#e6dfd0';
  const ink = '#1a141d';
  const stripeH = 12;
  const showSerratedTop = b.cat === 'indulgence';
  const showPerfBottom = b.cat === 'essentials';
  const showFlap = b.cat === 'savings';
  const showInvBadge = b.cat === 'debt';

  // Build serrated top edge as a path of triangle teeth
  const teeth = (() => {
    if (!showSerratedTop) return null;
    const step = 6;
    const depth = 3;
    let d = `M 0 ${stripeH + depth}`;
    for (let i = 0; i <= w; i += step) {
      d += ` L ${i} ${stripeH}`;
      d += ` L ${i + step / 2} ${stripeH + depth}`;
    }
    d += ` L ${w} ${stripeH + depth} Z`;
    return d;
  })();

  return (
    <g
      transform={`translate(${x - w / 2} ${y - h / 2 + lift}) rotate(${rot} ${w / 2} ${h / 2})`}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      onTouchStart={onPress}
      onTouchEnd={onRelease}
      style={{ cursor: 'pointer', transition: 'transform 140ms cubic-bezier(.2,.8,.2,1)' }}
      opacity={opacity}
    >
      {/* drop shadow plate */}
      <rect
        x={2}
        y={pressed ? 6 : 2}
        width={w}
        height={h}
        fill="#000"
        opacity={pressed ? 0.45 : 0.28}
        rx={1}
      />
      {/* paper body */}
      <rect x={0} y={0} width={w} height={h} fill={paperFill} stroke={ink} strokeWidth={1.2} rx={1} />
      {/* subtle paper-shade band along bottom for depth */}
      <rect x={0} y={h - 6} width={w} height={6} fill={paperShade} opacity={0.6} />
      {/* category stripe top */}
      <rect x={0} y={0} width={w} height={stripeH} fill={stripeColor} />
      {/* serrated top (indulgence only) */}
      {teeth && <path d={teeth} fill={paperFill} stroke="none" />}
      {/* tag in stripe */}
      <text
        x={6}
        y={stripeH - 3}
        fontFamily="ui-monospace, Menlo"
        fontSize={7}
        letterSpacing={1.4}
        fill="#1a141d"
        opacity={0.75}
        fontWeight={700}
      >
        {b.tag ?? '·'}
      </text>
      {/* perforation along bottom (essentials only) */}
      {showPerfBottom && (
        <>
          <line
            x1={4}
            x2={w - 4}
            y1={h - 8}
            y2={h - 8}
            stroke={ink}
            strokeWidth={0.5}
            strokeDasharray="2 2"
            opacity={0.55}
          />
          {[0.25, 0.5, 0.75].map((p) => (
            <circle key={p} cx={w * p} cy={h - 4} r={1.2} fill={ink} opacity={0.7} />
          ))}
        </>
      )}
      {/* envelope flap (savings) */}
      {showFlap && (
        <polygon
          points={`${w * 0.3},0 ${w * 0.5},${stripeH - 1} ${w * 0.7},0`}
          fill={paperShade}
          stroke={ink}
          strokeWidth={0.6}
          opacity={0.85}
        />
      )}
      {/* invoice corner badge (debt) */}
      {showInvBadge && (
        <g>
          <rect
            x={w - 26}
            y={stripeH + 2}
            width={22}
            height={10}
            fill="none"
            stroke={ink}
            strokeWidth={0.6}
            opacity={0.6}
          />
          <text
            x={w - 15}
            y={stripeH + 9}
            textAnchor="middle"
            fontFamily="ui-monospace, Menlo"
            fontSize={6}
            letterSpacing={0.8}
            fill={ink}
            opacity={0.7}
          >
            INV
          </text>
        </g>
      )}
      {/* merchant / line label */}
      <text
        x={6}
        y={stripeH + 14}
        fontFamily="var(--font-display)"
        fontSize={11}
        fontWeight={600}
        fill={ink}
      >
        {b.label.length > 14 ? `${b.label.slice(0, 13)}…` : b.label}
      </text>
      {/* amount, big */}
      <text
        x={w - 6}
        y={h - 12}
        textAnchor="end"
        fontFamily="var(--font-display)"
        fontSize={Math.min(20, w / 4.5)}
        fontWeight={600}
        fill={ink}
      >
        {fmt(b.cents)}
      </text>
      {/* mascot eye stamp on biggest only */}
      {isBiggest && (
        <g transform={`translate(${w - 38} ${h - 30}) rotate(-8)`} opacity={0.85}>
          <rect width={34} height={14} fill="none" stroke="var(--cat-income)" strokeWidth={0.8} />
          <text
            x={17}
            y={10}
            textAnchor="middle"
            fontFamily="ui-monospace, Menlo"
            fontSize={6}
            letterSpacing={1.2}
            fontWeight={700}
            fill="var(--cat-income)"
          >
            KEEP YOUR EYE
          </text>
        </g>
      )}
    </g>
  );
}

interface ArtifactPlaced extends Bubble {
  x: number;
  y: number;
  w: number;
  h: number;
}

function placeMoneyArtifacts(bubbles: Bubble[], height: number): ArtifactPlaced[] {
  // Put paycheque core in the middle (separate render). Satellites in two rings.
  const sorted = [...bubbles].sort((a, b) => b.cents - a.cents).slice(0, 8);
  const cx = W / 2;
  const cy = height / 2;
  const max = Math.max(...sorted.map((b) => b.cents), 1);
  const size = (cents: number) => {
    const t = Math.log(1 + cents) / Math.log(1 + max);
    const w = 64 + t * 50;
    return { w, h: w * 0.6 };
  };
  const inner = sorted.slice(0, 4);
  const outer = sorted.slice(4);
  const out: ArtifactPlaced[] = [];
  inner.forEach((b, i) => {
    const angle = -Math.PI / 2 + (i / inner.length) * Math.PI * 2;
    const { w, h } = size(b.cents);
    out.push({ ...b, x: cx + Math.cos(angle) * 110, y: cy + Math.sin(angle) * 110, w, h });
  });
  outer.forEach((b, i) => {
    const offset = Math.PI / 4;
    const angle = -Math.PI / 2 + offset + (i / outer.length) * Math.PI * 2;
    const { w, h } = size(b.cents);
    out.push({ ...b, x: cx + Math.cos(angle) * 152, y: cy + Math.sin(angle) * 152, w, h });
  });
  return out;
}

function placeHabitsArtifacts(bubbles: Bubble[], height: number): ArtifactPlaced[] {
  const sorted = [...bubbles].sort((a, b) => b.cents - a.cents).slice(0, 8);
  const cx = W / 2;
  const cy = height / 2;
  const max = Math.max(...sorted.map((b) => b.cents), 1);
  const size = (cents: number) => {
    const t = Math.log(1 + cents) / Math.log(1 + max);
    const w = 60 + t * 56;
    return { w, h: w * 0.62 };
  };
  const head = sorted[0]!;
  const ring1 = sorted.slice(1, 7);
  const ring2 = sorted.slice(7);
  const out: ArtifactPlaced[] = [];
  const headSize = size(head.cents);
  out.push({ ...head, x: cx, y: cy - 6, w: headSize.w, h: headSize.h });
  ring1.forEach((b, i) => {
    const angle = -Math.PI / 2 + ((i + 0.5) / ring1.length) * Math.PI * 2;
    const dist = 96;
    const { w, h } = size(b.cents);
    out.push({ ...b, x: cx + Math.cos(angle) * dist, y: cy - 6 + Math.sin(angle) * dist, w, h });
  });
  ring2.forEach((b, i) => {
    const angle = i * Math.PI;
    const { w, h } = size(b.cents);
    out.push({ ...b, x: cx + Math.cos(angle) * 142, y: cy - 6 + Math.sin(angle) * 142, w, h });
  });
  return out;
}

function DeskShell({ children, height = 360 }: { children: React.ReactNode; height?: number }) {
  return (
    <section
      style={{
        background:
          // leather-ish desk: warm dark tan over deep ink, with subtle vignette
          'radial-gradient(ellipse at 30% 20%, rgba(176,140,108,0.10) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(80,50,80,0.10) 0%, transparent 60%), linear-gradient(180deg, #1c1620 0%, #100a12 100%)',
        borderRadius: 4,
        position: 'relative',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4), 0 16px 32px -16px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: 'block' }}>
        {/* faint ledger hairlines suggesting paper underneath */}
        {[0.18, 0.36, 0.54, 0.72, 0.9].map((p) => (
          <line
            key={p}
            x1={20}
            x2={W - 20}
            y1={height * p}
            y2={height * p}
            stroke="rgba(255,255,255,0.025)"
            strokeWidth={0.5}
          />
        ))}
        {children}
      </svg>
    </section>
  );
}

function AuditTape({ obs }: { obs: string | null }) {
  return (
    <div
      style={{
        marginTop: 10,
        height: 42,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 10px',
        background: '#f2ece0',
        color: '#1a141d',
        position: 'relative',
        boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
      }}
    >
      {/* perforated edges (top + bottom) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: -3,
          height: 4,
          background:
            'radial-gradient(circle at 4px 4px, #1a141d 1.2px, transparent 1.4px) 0 0/10px 8px',
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -3,
          height: 4,
          background:
            'radial-gradient(circle at 4px 0px, #1a141d 1.2px, transparent 1.4px) 0 0/10px 8px',
          opacity: 0.55,
        }}
      />
      <div style={{ ...mono, fontSize: 7, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'rgba(26,20,29,0.55)', marginBottom: 2 }}>
        AUDIT TAPE
      </div>
      <div style={{ ...mono, fontSize: 11, letterSpacing: '0.06em', color: '#1a141d', minHeight: 14 }}>
        {obs ?? <span style={{ opacity: 0.35 }}>· lift an artifact ·</span>}
      </div>
    </div>
  );
}

function Statement({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 14,
        ...mono,
        fontSize: 12,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.78)',
        lineHeight: 1.55,
        paddingLeft: 14,
        borderLeft: '2px solid var(--cat-income)',
      }}
    >
      {children}
    </div>
  );
}

function VariantF() {
  const [pressedM, setPressedM] = useState<string | null>(null);
  const [pressedH, setPressedH] = useState<string | null>(null);

  const moneyHeight = 360;
  const habitsHeight = 360;
  const moneyPlaced = placeMoneyArtifacts(moneyBubbles, moneyHeight);
  const habitsPlaced = placeHabitsArtifacts(habitsBubbles, habitsHeight);
  const biggestMoneyId = [...moneyBubbles].sort((a, b) => b.cents - a.cents)[0]!.id;
  const biggestHabitsId = [...habitsBubbles].sort((a, b) => b.cents - a.cents)[0]!.id;

  const moneyObs = moneyPlaced.find((p) => p.id === pressedM)?.obs ?? null;
  const habitsObs = habitsPlaced.find((p) => p.id === pressedH)?.obs ?? null;

  const cx = W / 2;
  const cy = moneyHeight / 2;

  return (
    <VariantWrap
      letter="F"
      title="Paper artifacts on the desk"
      premise="Bubbles become paper — receipts, stubs, envelopes, invoices. Press lifts one off the desk and the audit tape says what only the bookkeeper sees."
    >
      {/* MONEY MAP */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          01 · MONEY MAP
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.005em' }}>
          Your $2,700 paycheque, pinned.
        </div>
      </div>
      <DeskShell height={moneyHeight}>
        {/* faint connectors from core */}
        {moneyPlaced.map((b) => (
          <line
            key={`l-${b.id}`}
            x1={cx}
            y1={cy}
            x2={b.x}
            y2={b.y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={0.6}
            strokeDasharray="2 4"
          />
        ))}
        {/* core: pay slip stamp */}
        <g transform={`translate(${cx - 60} ${cy - 28})`}>
          <rect x={2} y={4} width={120} height={56} fill="#000" opacity={0.35} rx={1} />
          <rect x={0} y={0} width={120} height={56} fill="#f2ece0" stroke="#1a141d" strokeWidth={1.4} rx={1} />
          <rect x={0} y={0} width={120} height={12} fill="var(--cat-income)" />
          <text x={6} y={9} fontFamily="ui-monospace, Menlo" fontSize={7} letterSpacing={1.4} fontWeight={700} fill="#1a141d" opacity={0.8}>
            PAY SLIP
          </text>
          <text x={60} y={32} textAnchor="middle" fontFamily="var(--font-display)" fontSize={20} fontWeight={600} fill="#1a141d">
            $2,700
          </text>
          <text x={60} y={48} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize={7} letterSpacing={1.6} fill="#1a141d" opacity={0.55}>
            CYCLE 18 · APR 24
          </text>
          {/* deposited stamp */}
          <g transform="translate(82 36) rotate(-12)" opacity={0.65}>
            <rect x={0} y={0} width={32} height={12} fill="none" stroke="var(--cat-income)" strokeWidth={0.8} />
            <text x={16} y={8.5} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize={6} letterSpacing={1.2} fontWeight={700} fill="var(--cat-income)">
              DEPOSITED
            </text>
          </g>
        </g>
        {/* satellites */}
        {moneyPlaced.map((b) => (
          <PaperArtifact
            key={b.id}
            b={b}
            x={b.x}
            y={b.y}
            w={b.w}
            h={b.h}
            pressed={pressedM === b.id}
            dimmed={pressedM !== null && pressedM !== b.id}
            isBiggest={b.id === biggestMoneyId}
            onPress={() => setPressedM(b.id)}
            onRelease={() => setPressedM(null)}
          />
        ))}
      </DeskShell>
      <AuditTape obs={moneyObs} />
      <Statement>
        This paycheque the biggest push goes to Capital One. Eight weeks at this rate and the card clears.
      </Statement>

      {/* HABITS MAP */}
      <div style={{ margin: '40px 0 12px' }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
          02 · HABITS · LAST 90 DAYS
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.94)' }}>
          The receipts you kept.
        </div>
      </div>
      <DeskShell height={habitsHeight}>
        {habitsPlaced.map((b) => (
          <PaperArtifact
            key={b.id}
            b={b}
            x={b.x}
            y={b.y}
            w={b.w}
            h={b.h}
            pressed={pressedH === b.id}
            dimmed={pressedH !== null && pressedH !== b.id}
            isBiggest={b.id === biggestHabitsId}
            onPress={() => setPressedH(b.id)}
            onRelease={() => setPressedH(null)}
          />
        ))}
      </DeskShell>
      <AuditTape obs={habitsObs} />
      <Statement>
        Tim Hortons takes 24% of your indulgence. The morning habit, twice a day on weekdays.
      </Statement>
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
        <VariantH />
        <VariantG />
        <VariantF />
        <VariantE />
        <VariantA />
        <VariantB />
        <VariantC />
        <VariantD />
      </div>
    </div>
  );
}
