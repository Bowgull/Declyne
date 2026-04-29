import { useNavigate } from 'react-router-dom';

export type ConstellationCategory =
  | 'essentials'
  | 'lifestyle'
  | 'indulgence'
  | 'debt'
  | 'savings'
  | 'income';

export interface ConstellationBubble {
  id: string;
  label: string;
  amount_cents: number;
  category: ConstellationCategory;
  hint?: string;
  to?: string;
  onClick?: () => void;
}

interface Props {
  bubbles: ConstellationBubble[];
  mode: 'centered' | 'cluster';
  outlined?: boolean;
  center?: { primary: string; secondary?: string };
  empty?: string;
  footerLeft?: string;
  footerRight?: string;
  height?: number;
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
}

const W = 380;

function placeCentered(bubbles: ConstellationBubble[], height: number): Placed[] {
  const sorted = [...bubbles].sort((a, b) => b.amount_cents - a.amount_cents).slice(0, 8);
  const cx = W / 2;
  const cy = height / 2;
  const inner = sorted.slice(0, 4);
  const outer = sorted.slice(4);
  const orbitInner = 100;
  const orbitOuter = 148;
  const max = Math.max(...sorted.map((b) => b.amount_cents), 1);
  const minR = 13;
  const maxR = 22;
  const radiusFor = (cents: number) =>
    Math.max(minR, Math.min(maxR, minR + Math.sqrt(cents / max) * (maxR - minR)));
  return [
    ...inner.map((b, i) => {
      const angle = -Math.PI / 2 + (i / Math.max(1, inner.length)) * Math.PI * 2;
      return {
        ...b,
        x: cx + Math.cos(angle) * orbitInner,
        y: cy + Math.sin(angle) * orbitInner,
        r: radiusFor(b.amount_cents),
      };
    }),
    ...outer.map((b, i) => {
      const offset = Math.PI / Math.max(2, inner.length);
      const angle = -Math.PI / 2 + offset + (i / Math.max(1, outer.length)) * Math.PI * 2;
      return {
        ...b,
        x: cx + Math.cos(angle) * orbitOuter,
        y: cy + Math.sin(angle) * orbitOuter,
        r: radiusFor(b.amount_cents),
      };
    }),
  ];
}

function placeCluster(bubbles: ConstellationBubble[], height: number): Placed[] {
  const sorted = [...bubbles].sort((a, b) => b.amount_cents - a.amount_cents).slice(0, 10);
  const cx = W / 2;
  const cy = height / 2;
  const max = Math.max(...sorted.map((b) => b.amount_cents), 1);
  const minR = 12;
  const maxR = 22;
  const radiusFor = (cents: number) =>
    Math.max(minR, Math.min(maxR, minR + Math.sqrt(cents / max) * (maxR - minR)));
  // Place the largest at center; rest on rings around it with enough gap
  // to keep labels readable.
  const placed: Placed[] = [];
  const placeAt = (b: ConstellationBubble, x: number, y: number, r: number) => {
    placed.push({ ...b, x, y, r });
  };
  if (sorted.length === 0) return placed;
  placeAt(sorted[0]!, cx, cy - 18, radiusFor(sorted[0]!.amount_cents));
  // 6 around inner ring at radius 78, the rest at outer ring 132
  const ring1 = sorted.slice(1, 7);
  const ring2 = sorted.slice(7);
  ring1.forEach((b, i) => {
    const angle = -Math.PI / 2 + (i / Math.max(1, ring1.length)) * Math.PI * 2;
    placeAt(b, cx + Math.cos(angle) * 78, cy - 18 + Math.sin(angle) * 78, radiusFor(b.amount_cents));
  });
  ring2.forEach((b, i) => {
    const offset = Math.PI / Math.max(1, ring1.length);
    const angle = -Math.PI / 2 + offset + (i / Math.max(1, ring2.length)) * Math.PI * 2;
    placeAt(b, cx + Math.cos(angle) * 130, cy - 18 + Math.sin(angle) * 130, radiusFor(b.amount_cents));
  });
  return placed;
}

export default function Constellation(props: Props) {
  const navigate = useNavigate();
  const height = props.height ?? (props.mode === 'centered' ? 380 : 300);
  const cx = W / 2;
  const cy = height / 2;

  const placed =
    props.bubbles.length === 0
      ? []
      : props.mode === 'centered'
        ? placeCentered(props.bubbles, height)
        : placeCluster(props.bubbles, height);

  const handleTap = (b: ConstellationBubble) => {
    if (b.onClick) b.onClick();
    else if (b.to) navigate(b.to);
  };

  return (
    <section
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(158,120,185,0.10) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
        borderRadius: 4,
        padding: 6,
        position: 'relative',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
      }}
    >
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="constellation-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#9e78b9" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#9e78b9" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#9e78b9" stopOpacity="0" />
          </radialGradient>
        </defs>

        {props.mode === 'centered' && (
          <>
            <circle cx={cx} cy={cy} r="115" fill="url(#constellation-glow)" />
            {[100, 148].map((r) => (
              <circle
                key={r}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="2 5"
              />
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
          </>
        )}

        {placed.map((b) => {
          const labelY = b.y + b.r + 13;
          const amountY = labelY + 11;
          const tappable = b.to || b.onClick;
          return (
            <g
              key={b.id}
              onClick={tappable ? () => handleTap(b) : undefined}
              style={tappable ? { cursor: 'pointer' } : undefined}
            >
              {props.outlined ? (
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r}
                  fill="rgba(255,255,255,0.02)"
                  stroke={`var(--cat-${b.category})`}
                  strokeWidth="1.6"
                  strokeDasharray="2 3"
                />
              ) : (
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r}
                  fill={`var(--cat-${b.category})`}
                  stroke="#0e0a10"
                  strokeWidth="1.5"
                />
              )}
              <text
                x={b.x}
                y={labelY}
                textAnchor="middle"
                fontFamily="ui-monospace, Menlo"
                fontSize="9"
                letterSpacing="0.5"
                fill="rgba(255,255,255,0.85)"
              >
                {b.label.length > 14 ? `${b.label.slice(0, 13)}…` : b.label}
              </text>
              <text
                x={b.x}
                y={amountY}
                textAnchor="middle"
                fontFamily="ui-monospace, Menlo"
                fontSize="9"
                fill="rgba(255,255,255,0.5)"
              >
                {fmt(b.amount_cents)}
              </text>
            </g>
          );
        })}

        {props.mode === 'centered' && props.center && (
          <>
            <circle cx={cx} cy={cy} r="46" fill="#1a141d" />
            <circle
              cx={cx}
              cy={cy}
              r="46"
              fill="none"
              stroke="#9e78b9"
              strokeWidth="1.5"
            />
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fontFamily="Fraunces, ui-serif, Georgia"
              fontWeight="600"
              fontSize="20"
              fill="#f2ece0"
            >
              {props.center.primary}
            </text>
            {props.center.secondary && (
              <text
                x={cx}
                y={cy + 14}
                textAnchor="middle"
                fontFamily="ui-monospace, Menlo"
                fontSize="9"
                letterSpacing="1.6"
                fill="rgba(255,255,255,0.45)"
              >
                {props.center.secondary}
              </text>
            )}
          </>
        )}

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

      {(props.footerLeft || props.footerRight) && (
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
          <span>{props.footerLeft ?? ''}</span>
          <span>{props.footerRight ?? ''}</span>
        </div>
      )}
    </section>
  );
}
