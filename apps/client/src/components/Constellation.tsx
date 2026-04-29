import { useNavigate } from 'react-router-dom';

export type ConstellationCategory =
  | 'essentials'
  | 'lifestyle'
  | 'indulgence'
  | 'debt'
  | 'savings'
  | 'income';

export type Velocity = 'up' | 'down' | 'flat';

export interface ConstellationBubble {
  id: string;
  label: string;
  amount_cents: number;
  category: ConstellationCategory;
  hint?: string;
  to?: string;
  onClick?: () => void;
  /** days until this hits (Money clock mode). 0 = today, horizon = far edge. */
  days_until?: number;
  /** visit/transaction count (Habits frequency mode). drives radius. */
  txn_count?: number;
  /** spend trend vs prior period. renders an inline arrow. */
  velocity?: Velocity;
}

export type ConstellationMode = 'clock' | 'frequency' | 'cluster' | 'centered';

interface Props {
  bubbles: ConstellationBubble[];
  mode: ConstellationMode;
  /** dashed-ring autopilot variant (subscriptions). */
  outlined?: boolean;
  empty?: string;
  height?: number;
  /** clock mode: maximum days_until shown. defaults to 14. */
  horizon?: number;
}

function fmt(c: number) {
  const a = Math.abs(c);
  if (a >= 100000) return `$${Math.round(a / 100).toLocaleString('en-CA')}`;
  return `$${(a / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Placed extends ConstellationBubble {
  x: number;
  y: number;
  r: number;
  alpha: number;
  /** label position: 'below' (under bubble) or 'above' (over bubble). */
  labelPos: 'below' | 'above';
}

const W = 380;
const PADDING_X = 36;
const PADDING_Y = 26;

function radiusByAmount(cents: number, max: number, min = 12, peak = 30): number {
  if (max <= 0) return min;
  return min + Math.sqrt(Math.max(0, cents) / max) * (peak - min);
}

function radiusByCount(count: number, max: number, min = 14, peak = 36): number {
  if (max <= 0) return min;
  return min + Math.sqrt(Math.max(0, count) / max) * (peak - min);
}

/** Push overlapping bubbles apart with a few iterations of relaxation. */
function relax(placed: Placed[], padding = 6, iterations = 40): void {
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r + padding;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

/** Clamp bubble centers so labels stay on the canvas. */
function clamp(placed: Placed[], svgHeight: number): void {
  for (const p of placed) {
    p.x = Math.max(PADDING_X, Math.min(W - PADDING_X, p.x));
    p.y = Math.max(PADDING_Y + p.r, Math.min(svgHeight - PADDING_Y - p.r - 18, p.y));
  }
}

/** Decide label position per bubble: below by default, above when no room below or label would overlap another bubble. */
function decideLabelPositions(placed: Placed[], svgHeight: number): void {
  for (const p of placed) {
    const labelClearanceBelow = svgHeight - (p.y + p.r + 24);
    const labelClearanceAbove = p.y - p.r - 24;
    let preferred: 'below' | 'above' = labelClearanceBelow >= 0 ? 'below' : 'above';

    // If preferred would overlap another bubble, try the other side.
    const labelHits = (pos: 'below' | 'above') => {
      const labelY = pos === 'below' ? p.y + p.r + 13 : p.y - p.r - 6;
      for (const q of placed) {
        if (q === p) continue;
        const dy = labelY - q.y;
        const dx = p.x - q.x;
        if (Math.abs(dx) < q.r + 30 && Math.abs(dy) < q.r + 6) return true;
      }
      return false;
    };

    if (labelHits(preferred)) {
      const alt = preferred === 'below' ? 'above' : 'below';
      const altClearance = alt === 'below' ? labelClearanceBelow : labelClearanceAbove;
      if (altClearance >= 0 && !labelHits(alt)) preferred = alt;
    }
    p.labelPos = preferred;
  }
}

function placeClock(
  bubbles: ConstellationBubble[],
  height: number,
  horizon: number,
): Placed[] {
  if (bubbles.length === 0) return [];
  const cx = W / 2;
  const cy = height / 2;
  const outerR = Math.min(cx, cy) - 40;
  const innerR = 56;
  // Sweep < 2π so the start (today) and end (payday) don't collide at 12 o'clock.
  const SWEEP = Math.PI * 1.65;
  const max = Math.max(...bubbles.map((b) => b.amount_cents), 1);
  const sorted = [...bubbles].sort(
    (a, b) => (a.days_until ?? horizon) - (b.days_until ?? horizon),
  );
  // Group bubbles by integer day so duplicates fan around the same hour.
  const buckets = new Map<number, ConstellationBubble[]>();
  for (const b of sorted) {
    const days = Math.max(0, Math.min(horizon, b.days_until ?? horizon));
    const key = Math.round(days);
    const list = buckets.get(key) ?? [];
    list.push(b);
    buckets.set(key, list);
  }
  const placed: Placed[] = [];
  for (const [days, list] of buckets) {
    const t = horizon === 0 ? 0 : days / horizon;
    const baseAngle = -Math.PI / 2 + t * SWEEP;
    const baseDist = innerR + 14 + t * (outerR - innerR - 14);
    const alpha = 0.6 + (1 - t) * 0.35;
    // Wider angular fan + radial stagger when many bubbles share a day.
    const spread =
      list.length > 1
        ? Math.min(Math.PI / 4, (Math.PI / 18) * list.length)
        : 0;
    list.forEach((b, i) => {
      const offset =
        list.length === 1
          ? 0
          : -spread + (i / Math.max(1, list.length - 1)) * spread * 2;
      const angle = baseAngle + offset;
      // Alternate radial distance so adjacent bubbles in the wedge don't overlap.
      const ringStep = 18;
      const ringIdx = (i % 3) - 1; // -1, 0, 1, -1, ...
      const distOffset = list.length > 1 ? ringIdx * ringStep : 0;
      const dist = baseDist + distOffset;
      placed.push({
        ...b,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        r: radiusByAmount(b.amount_cents, max, 12, 26),
        alpha,
        labelPos: 'below',
      });
    });
  }
  relax(placed, 10, 60);
  clamp(placed, height);
  decideLabelPositions(placed, height);
  return placed;
}

function placeFrequency(bubbles: ConstellationBubble[], height: number): Placed[] {
  const sorted = [...bubbles]
    .sort((a, b) => (b.txn_count ?? 0) - (a.txn_count ?? 0))
    .slice(0, 9);
  if (sorted.length === 0) return [];
  const cx = W / 2;
  const cy = height / 2;
  const maxCount = Math.max(...sorted.map((b) => b.txn_count ?? 1), 1);
  const maxAmount = Math.max(...sorted.map((b) => b.amount_cents), 1);
  const placed: Placed[] = [];
  // Head — biggest, anchored slightly above center.
  const head = sorted[0]!;
  placed.push({
    ...head,
    x: cx,
    y: cy - 10,
    r: radiusByCount(head.txn_count ?? 1, maxCount, 24, 44),
    alpha: 0.95,
    labelPos: 'below',
  });
  const ring1 = sorted.slice(1, 6);
  const ring2 = sorted.slice(6);
  ring1.forEach((b, i) => {
    const angle = -Math.PI / 2 + ((i + 0.5) / Math.max(1, ring1.length)) * Math.PI * 2;
    const r = radiusByCount(b.txn_count ?? 1, maxCount, 14, 28);
    const dist = 96;
    const alpha = 0.6 + ((b.amount_cents ?? 0) / maxAmount) * 0.35;
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * dist,
      y: cy - 10 + Math.sin(angle) * dist,
      r,
      alpha,
      labelPos: 'below',
    });
  });
  ring2.forEach((b, i) => {
    const offset = Math.PI / Math.max(1, ring1.length);
    const angle = -Math.PI / 2 + offset + (i / Math.max(1, ring2.length)) * Math.PI * 2;
    const r = radiusByCount(b.txn_count ?? 1, maxCount, 12, 22);
    const dist = 144;
    const alpha = 0.55 + ((b.amount_cents ?? 0) / maxAmount) * 0.35;
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * dist,
      y: cy - 10 + Math.sin(angle) * dist,
      r,
      alpha,
      labelPos: 'below',
    });
  });
  relax(placed);
  clamp(placed, height);
  decideLabelPositions(placed, height);
  return placed;
}

function placeCentered(bubbles: ConstellationBubble[], height: number): Placed[] {
  const sorted = [...bubbles].sort((a, b) => b.amount_cents - a.amount_cents).slice(0, 8);
  if (sorted.length === 0) return [];
  const cx = W / 2;
  const cy = height / 2;
  const inner = sorted.slice(0, 4);
  const outer = sorted.slice(4);
  const max = Math.max(...sorted.map((b) => b.amount_cents), 1);
  const placed: Placed[] = [];
  inner.forEach((b, i) => {
    const angle = -Math.PI / 2 + (i / Math.max(1, inner.length)) * Math.PI * 2;
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * 100,
      y: cy + Math.sin(angle) * 100,
      r: radiusByAmount(b.amount_cents, max, 13, 28),
      alpha: 0.9,
      labelPos: 'below',
    });
  });
  outer.forEach((b, i) => {
    const offset = Math.PI / Math.max(2, inner.length);
    const angle = -Math.PI / 2 + offset + (i / Math.max(1, outer.length)) * Math.PI * 2;
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * 148,
      y: cy + Math.sin(angle) * 148,
      r: radiusByAmount(b.amount_cents, max, 13, 28),
      alpha: 0.9,
      labelPos: 'below',
    });
  });
  relax(placed);
  clamp(placed, height);
  decideLabelPositions(placed, height);
  return placed;
}

function placeCluster(bubbles: ConstellationBubble[], height: number): Placed[] {
  const sorted = [...bubbles].sort((a, b) => b.amount_cents - a.amount_cents).slice(0, 10);
  if (sorted.length === 0) return [];
  const cx = W / 2;
  const cy = height / 2;
  const max = Math.max(...sorted.map((b) => b.amount_cents), 1);
  const placed: Placed[] = [];
  placed.push({
    ...sorted[0]!,
    x: cx,
    y: cy - 14,
    r: radiusByAmount(sorted[0]!.amount_cents, max, 16, 32),
    alpha: 0.9,
    labelPos: 'below',
  });
  const ring1 = sorted.slice(1, 7);
  const ring2 = sorted.slice(7);
  ring1.forEach((b, i) => {
    const angle = -Math.PI / 2 + ((i + 0.5) / Math.max(1, ring1.length)) * Math.PI * 2;
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * 82,
      y: cy - 14 + Math.sin(angle) * 82,
      r: radiusByAmount(b.amount_cents, max, 12, 24),
      alpha: 0.85,
      labelPos: 'below',
    });
  });
  ring2.forEach((b, i) => {
    const offset = Math.PI / Math.max(1, ring1.length);
    const angle = -Math.PI / 2 + offset + (i / Math.max(1, ring2.length)) * Math.PI * 2;
    placed.push({
      ...b,
      x: cx + Math.cos(angle) * 132,
      y: cy - 14 + Math.sin(angle) * 132,
      r: radiusByAmount(b.amount_cents, max, 10, 18),
      alpha: 0.8,
      labelPos: 'below',
    });
  });
  relax(placed);
  clamp(placed, height);
  decideLabelPositions(placed, height);
  return placed;
}

function VelocityGlyph({ v, x, y }: { v: Velocity; x: number; y: number }) {
  const glyph = v === 'up' ? '↑' : v === 'down' ? '↓' : '→';
  const color =
    v === 'up'
      ? 'var(--cat-indulgence)'
      : v === 'down'
        ? 'var(--cat-savings)'
        : 'rgba(255,255,255,0.5)';
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily="ui-monospace, Menlo"
      fontSize="11"
      fontWeight="600"
      fill={color}
    >
      {glyph}
    </text>
  );
}

export default function Constellation(props: Props) {
  const navigate = useNavigate();
  const svgHeight = props.height ?? (props.mode === 'cluster' ? 300 : 340);

  const placed =
    props.bubbles.length === 0
      ? []
      : props.mode === 'clock'
        ? placeClock(props.bubbles, svgHeight, props.horizon ?? 14)
        : props.mode === 'frequency'
          ? placeFrequency(props.bubbles, svgHeight)
          : props.mode === 'centered'
            ? placeCentered(props.bubbles, svgHeight)
            : placeCluster(props.bubbles, svgHeight);

  const cx = W / 2;
  const cy = svgHeight / 2;

  const handleTap = (b: ConstellationBubble) => {
    if (b.onClick) b.onClick();
    else if (b.to) navigate(b.to);
  };

  return (
    <section
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(158,120,185,0.08) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
        borderRadius: 4,
        padding: 0,
        position: 'relative',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${svgHeight}`}
        width="100%"
        style={{ display: 'block' }}
      >
        {/* Money map: thin radial connectors from center to each bubble. */}
        {props.mode === 'clock' &&
          placed.map((b) => (
            <line
              key={`l-${b.id}`}
              x1={cx}
              y1={cy}
              x2={b.x}
              y2={b.y}
              stroke={`var(--cat-${b.category})`}
              strokeOpacity={0.1 + b.alpha * 0.18}
              strokeWidth="0.8"
            />
          ))}

        {placed.map((b) => {
          const labelY = b.labelPos === 'below' ? b.y + b.r + 13 : b.y - b.r - 6;
          const amountY = b.labelPos === 'below' ? labelY + 11 : labelY - 11;
          const tappable = b.to || b.onClick;
          const fillBubble = props.outlined
            ? 'rgba(255,255,255,0.02)'
            : `var(--cat-${b.category})`;
          // Anchor labels away from the edges so long names don't spill outside the SVG.
          const anchor: 'start' | 'middle' | 'end' =
            b.x < 80 ? 'start' : b.x > W - 80 ? 'end' : 'middle';
          const labelX = anchor === 'start' ? b.x - b.r : anchor === 'end' ? b.x + b.r : b.x;
          return (
            <g
              key={b.id}
              onClick={tappable ? () => handleTap(b) : undefined}
              style={tappable ? { cursor: 'pointer' } : undefined}
              opacity={b.alpha}
            >
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill={fillBubble}
                stroke={
                  props.outlined ? `var(--cat-${b.category})` : '#0e0a10'
                }
                strokeWidth={props.outlined ? 1.6 : 1.5}
                strokeDasharray={props.outlined ? '2 3' : undefined}
              />
              {b.velocity && (
                <VelocityGlyph
                  v={b.velocity}
                  x={b.x + b.r + 7}
                  y={b.y - b.r + 2}
                />
              )}
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fontFamily="ui-monospace, Menlo"
                fontSize="9"
                letterSpacing="0.5"
                fill="rgba(255,255,255,0.85)"
              >
                {b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label}
              </text>
              <text
                x={labelX}
                y={amountY}
                textAnchor={anchor}
                fontFamily="ui-monospace, Menlo"
                fontSize="9"
                fill="rgba(255,255,255,0.5)"
              >
                {fmt(b.amount_cents)}
                {typeof b.txn_count === 'number' && b.txn_count > 0
                  ? ` · ${b.txn_count}×`
                  : ''}
              </text>
            </g>
          );
        })}

        {placed.length === 0 && props.empty && (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            fontFamily="ui-monospace, Menlo"
            fontSize="10"
            letterSpacing="1.4"
            fill="rgba(255,255,255,0.45)"
          >
            {props.empty}
          </text>
        )}
      </svg>
    </section>
  );
}
