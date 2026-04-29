import { useNavigate } from 'react-router-dom';

export interface RibbonSubscription {
  id: string;
  name: string;
  amount_cents: number;
  cadence_days: number;
  months_running: number;
  category: 'lifestyle' | 'indulgence' | 'essentials' | 'debt' | 'savings' | 'income';
}

interface Props {
  subs: RibbonSubscription[];
  to?: string;
  emptyHint?: string;
}

const ROW_H = 30;
const LANE_LEFT = 132;
const LANE_RIGHT = 12;
const W = 380;

function fmtMoney(c: number, opts: { whole?: boolean } = {}) {
  const a = Math.abs(c);
  if (opts.whole) return `$${Math.round(a / 100).toLocaleString('en-CA')}`;
  return `$${(a / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function annualCents(s: RibbonSubscription): number {
  if (s.cadence_days <= 0) return 0;
  return Math.round((s.amount_cents * 365) / s.cadence_days);
}

function monthlyCents(s: RibbonSubscription): number {
  if (s.cadence_days <= 0) return 0;
  return Math.round((s.amount_cents * 30) / s.cadence_days);
}

/** Number of charges in the next 12 months for a given cadence. */
function chargesIn12mo(cadence_days: number): number {
  if (cadence_days <= 0) return 0;
  return Math.max(1, Math.round(365 / cadence_days));
}

export default function SubscriptionRibbon({ subs, to, emptyHint }: Props) {
  const navigate = useNavigate();
  if (subs.length === 0) {
    return (
      <section
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(158,120,185,0.10) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
          borderRadius: 4,
          padding: '32px 22px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '1.4px',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
        }}
      >
        {emptyHint ?? 'Nothing detected · need 6 months of activity'}
      </section>
    );
  }

  const sorted = [...subs].sort((a, b) => b.months_running - a.months_running);
  const visible = sorted.slice(0, 7);
  const overflow = sorted.length - visible.length;

  const laneW = W - LANE_LEFT - LANE_RIGHT;
  const ribbonHeight = visible.length * ROW_H + 28;

  return (
    <section
      style={{
        background:
          'radial-gradient(ellipse at top, rgba(158,120,185,0.10) 0%, transparent 55%), linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
        borderRadius: 4,
        padding: '8px 6px 0',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${ribbonHeight}`}
        width="100%"
        style={{ display: 'block' }}
      >
        {/* month tick marks */}
        {Array.from({ length: 13 }).map((_, m) => {
          const x = LANE_LEFT + (m / 12) * laneW;
          const major = m === 0 || m === 6 || m === 12;
          return (
            <g key={m}>
              <line
                x1={x}
                y1={18}
                x2={x}
                y2={ribbonHeight - 4}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={major ? 1 : 0.6}
                strokeDasharray={major ? undefined : '1 3'}
              />
              {major && (
                <text
                  x={x}
                  y={12}
                  textAnchor={m === 0 ? 'start' : m === 12 ? 'end' : 'middle'}
                  fontFamily="ui-monospace, Menlo"
                  fontSize="8"
                  letterSpacing="1.4"
                  fill="rgba(255,255,255,0.32)"
                >
                  {m === 0 ? 'NOW' : m === 12 ? '+12MO' : '+6MO'}
                </text>
              )}
            </g>
          );
        })}

        {visible.map((s, i) => {
          const y = 28 + i * ROW_H;
          const charges = chargesIn12mo(s.cadence_days);
          const dotCount = Math.min(charges, 18);
          const annual = annualCents(s);
          const isYearly = s.cadence_days > 200;
          return (
            <g
              key={s.id}
              onClick={() => to && navigate(to)}
              style={to ? { cursor: 'pointer' } : undefined}
            >
              {/* row underline */}
              <line
                x1={6}
                y1={y + ROW_H - 4}
                x2={W - 6}
                y2={y + ROW_H - 4}
                stroke="rgba(255,255,255,0.06)"
              />
              {/* category rule */}
              <rect
                x={6}
                y={y}
                width={2}
                height={ROW_H - 8}
                fill={`var(--cat-${s.category})`}
                opacity={0.85}
              />
              {/* name */}
              <text
                x={14}
                y={y + 11}
                fontFamily="Fraunces, ui-serif, Georgia"
                fontSize="14"
                fontWeight="500"
                fill="rgba(255,236,224,0.95)"
              >
                {s.name.length > 14 ? `${s.name.slice(0, 13)}…` : s.name}
              </text>
              {/* months running + annual */}
              <text
                x={14}
                y={y + 22}
                fontFamily="ui-monospace, Menlo"
                fontSize="9"
                letterSpacing="0.6"
                fill="rgba(255,255,255,0.55)"
              >
                {s.months_running}mo ·{' '}
                <tspan fill="var(--color-accent-gold)">
                  {fmtMoney(annual, { whole: true })}/yr
                </tspan>
              </text>
              {/* charge dots across the year */}
              {Array.from({ length: dotCount }).map((_, d) => {
                const t = (d + 0.5) / dotCount;
                const x = LANE_LEFT + t * laneW;
                return (
                  <circle
                    key={d}
                    cx={x}
                    cy={y + ROW_H / 2 - 2}
                    r={isYearly ? 3.4 : 2.4}
                    fill={`var(--cat-${s.category})`}
                    opacity={0.7 + (d === 0 ? 0.25 : 0)}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      <div
        style={{
          padding: '6px 14px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        <span>{sorted.length} running · oldest first</span>
        {overflow > 0 ? (
          <span
            style={{ cursor: to ? 'pointer' : undefined }}
            onClick={() => to && navigate(to)}
          >
            + {overflow} more &rsaquo;
          </span>
        ) : (
          <span />
        )}
      </div>
    </section>
  );
}

/** Helpers exported for callers that want to render totals as a section kicker. */
export function subscriptionTotals(subs: RibbonSubscription[]): {
  monthly_cents: number;
  annual_cents: number;
} {
  return {
    monthly_cents: subs.reduce((s, x) => s + monthlyCents(x), 0),
    annual_cents: subs.reduce((s, x) => s + annualCents(x), 0),
  };
}
