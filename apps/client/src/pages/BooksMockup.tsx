import { useMemo } from 'react';

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

function fmt(c: number) {
  return `$${(c / 100).toFixed(2)}`;
}
function fmtRound(c: number) {
  return `$${Math.round(c / 100)}`;
}

// ---------- shared sample data ----------

type CatGroup = 'essentials' | 'lifestyle' | 'indulgence' | 'savings' | 'debt' | 'income';

const CAT_VAR: Record<CatGroup, string> = {
  income: 'var(--cat-income)',
  essentials: 'var(--cat-essentials)',
  lifestyle: 'var(--cat-lifestyle)',
  indulgence: 'var(--cat-indulgence)',
  savings: 'var(--cat-savings)',
  debt: 'var(--cat-debt)',
};

// Habits: top merchants ALL groups (the fix)
const habitsAll: { name: string; group: CatGroup; spend_90d: number }[] = [
  { name: 'Rogers', group: 'essentials', spend_90d: 28500 },
  { name: 'Enbridge Gas', group: 'essentials', spend_90d: 32400 },
  { name: 'Loblaws', group: 'essentials', spend_90d: 84200 },
  { name: 'Hydro One', group: 'essentials', spend_90d: 21800 },
  { name: 'Tim Hortons', group: 'lifestyle', spend_90d: 18600 },
  { name: 'Banh Mi Boys', group: 'lifestyle', spend_90d: 14200 },
  { name: 'Amazon.ca', group: 'lifestyle', spend_90d: 22300 },
  { name: 'Uber Eats', group: 'indulgence', spend_90d: 31200 },
  { name: "McDonald's", group: 'indulgence', spend_90d: 12400 },
  { name: 'Tokyo Smoke', group: 'indulgence', spend_90d: 18900 },
  { name: 'LCBO', group: 'indulgence', spend_90d: 14600 },
  { name: 'Capital One Pmt', group: 'debt', spend_90d: 45000 },
  { name: 'TD Visa Pmt', group: 'debt', spend_90d: 38500 },
  { name: 'TFSA Sweep', group: 'savings', spend_90d: 60000 },
  { name: 'Vacation Fund', group: 'savings', spend_90d: 25000 },
  { name: 'Emergency Fund', group: 'savings', spend_90d: 15000 },
];

// Subscriptions
type Sub = {
  name: string;
  group: CatGroup;
  monthly: number;
  months_running: number;
  next_charge_days: number;
};
const subs: Sub[] = [
  { name: 'Uber Eats Pass', group: 'indulgence', monthly: 3200, months_running: 14, next_charge_days: 4 },
  { name: 'Amazon Prime', group: 'lifestyle', monthly: 3000, months_running: 38, next_charge_days: 11 },
  { name: 'Netflix', group: 'lifestyle', monthly: 2000, months_running: 27, next_charge_days: 8 },
  { name: 'Banh Mi Club', group: 'lifestyle', monthly: 1700, months_running: 6, next_charge_days: 22 },
  { name: 'Spotify', group: 'lifestyle', monthly: 1300, months_running: 41, next_charge_days: 17 },
  { name: 'Starbucks Reload', group: 'indulgence', monthly: 700, months_running: 9, next_charge_days: 2 },
  { name: 'Apple iCloud', group: 'lifestyle', monthly: 400, months_running: 52, next_charge_days: 13 },
];

const subsByMonthly = [...subs].sort((a, b) => b.monthly - a.monthly);
const totalMonthly = subs.reduce((a, s) => a + s.monthly, 0);
const totalAnnual = totalMonthly * 12;

// ---------- shared bubble layout (cluster mode) ----------

function clusterPositions(n: number, W: number, H: number) {
  // largest at top center, 6 around inner ring r=78, rest on outer ring r=130
  const cx = W / 2;
  const cy = H / 2;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      out.push({ x: cx, y: cy - 30 });
      continue;
    }
    if (i <= 6) {
      const a = ((i - 1) / 6) * Math.PI * 2 - Math.PI / 2;
      out.push({ x: cx + Math.cos(a) * 78, y: cy + Math.sin(a) * 78 });
      continue;
    }
    const k = i - 7;
    const remaining = Math.max(1, n - 7);
    const a = (k / remaining) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8;
    out.push({ x: cx + Math.cos(a) * 130, y: cy + Math.sin(a) * 130 });
  }
  return out;
}

function bubbleR(amount: number, max: number) {
  const minR = 13;
  const maxR = 24;
  return minR + (maxR - minR) * Math.sqrt(amount / max);
}

// ---------- 01 — Habits BEFORE / AFTER ----------

function HabitsViz({ items, label }: { items: typeof habitsAll; label: string }) {
  const W = 360;
  const H = 320;
  const sorted = [...items].sort((a, b) => b.spend_90d - a.spend_90d);
  const max = sorted[0]?.spend_90d || 1;
  const pos = clusterPositions(sorted.length, W, H);
  return (
    <div style={{ background: 'var(--color-bg-card)', borderRadius: 6, padding: '14px 12px' }}>
      <div style={{ ...kickerDark, marginBottom: 6 }}>{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {sorted.map((b, i) => {
          const r = bubbleR(b.spend_90d, max);
          const p = pos[i]!;
          const fill = CAT_VAR[b.group];
          const labelY = p.y - r - 7;
          const labelX = p.x;
          const anchor: 'start' | 'middle' | 'end' =
            labelX < 70 ? 'start' : labelX > W - 70 ? 'end' : 'middle';
          return (
            <g key={b.name}>
              <circle cx={p.x} cy={p.y} r={r} fill={fill} fillOpacity={0.78} />
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fontFamily="var(--font-mono)"
                fontSize={9}
                fill="var(--color-text-muted)"
                style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}
              >
                {b.name.length > 14 ? b.name.slice(0, 13) + '…' : b.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- 02 — Subs Variant A: Standing-orders tape with punch cards ----------

function PunchRow({ count, total = 36 }: { count: number; total?: number }) {
  // Show up to `total` dots; punched (filled ink) for first `count`.
  const cap = Math.min(total, Math.max(count, 12));
  const dots = Array.from({ length: cap });
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
      {dots.map((_, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background:
              i < count ? 'var(--color-ink)' : 'transparent',
            border:
              i < count ? '0' : '1px solid color-mix(in oklab, var(--color-ink) 30%, transparent)',
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  );
}

function StandingOrdersTape() {
  return (
    <div
      style={{
        background: 'var(--color-paper)',
        color: 'var(--color-ink)',
        borderRadius: 6,
        padding: '20px 18px 24px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        position: 'relative',
      }}
    >
      <div style={{ ...kickerDark, color: 'var(--color-ink-muted)', marginBottom: 4 }}>
        § STANDING ORDERS
      </div>
      <div className="display" style={{ fontSize: 28, color: 'var(--color-ink)', lineHeight: 1.1 }}>
        7 hands in your wallet
      </div>
      <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 4 }}>
        {fmt(totalMonthly)}/mo · {fmt(totalAnnual)}/yr
      </div>

      <div style={{ marginTop: 18 }}>
        {subsByMonthly.map((s, i) => (
          <div
            key={s.name}
            style={{
              borderTop: i === 0 ? 'none' : '1px dashed color-mix(in oklab, var(--color-ink) 28%, transparent)',
              padding: '14px 0 12px',
              display: 'grid',
              gridTemplateColumns: '14px 1fr auto',
              columnGap: 10,
              alignItems: 'baseline',
            }}
          >
            <div
              style={{
                color: CAT_VAR[s.group],
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                lineHeight: 1,
              }}
              title="autopilot"
            >
              ↻
            </div>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--color-ink)' }}>
                {s.name}
              </div>
              <div style={{ ...mono, fontSize: 10, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                punched {s.months_running}× · ${(s.monthly * 12 / 100).toFixed(0)}/yr to date{' '}
                ${((s.monthly * s.months_running) / 100).toFixed(0)}
              </div>
              <PunchRow count={s.months_running} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...mono, fontSize: 18, color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(s.monthly)}
              </div>
              <div style={{ ...mono, fontSize: 9, color: 'var(--color-ink-muted)', marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                hits in {s.next_charge_days}d
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          ...mono,
          fontSize: 10,
          color: 'var(--color-ink-muted)',
          textAlign: 'center',
          marginTop: 22,
          letterSpacing: '0.18em',
        }}
      >
        ** end of standing orders **
      </div>
    </div>
  );
}

// ---------- 03 — Subs Variant B: Calendar timeline ----------

function CalendarTimeline() {
  const sorted = [...subs].sort((a, b) => a.next_charge_days - b.next_charge_days);
  const max = 30;
  return (
    <div style={{ background: 'var(--color-bg-card)', borderRadius: 6, padding: '16px 14px' }}>
      <div style={{ ...kickerDark, marginBottom: 4 }}>§ NEXT 30 DAYS</div>
      <div className="display" style={{ fontSize: 24, color: 'var(--color-text-primary)' }}>
        When each one hits
      </div>
      <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
        {fmt(totalMonthly)} clears your account this month
      </div>
      <div style={{ marginTop: 16, position: 'relative', paddingLeft: 24 }}>
        {/* spine */}
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: 0,
            bottom: 0,
            width: 1,
            background: 'var(--rule-ink)',
          }}
        />
        {/* day markers */}
        {[0, 7, 14, 21, 28].map((d) => (
          <div
            key={d}
            style={{
              position: 'absolute',
              left: 0,
              top: `${(d / max) * 100}%`,
              ...mono,
              fontSize: 9,
              color: 'var(--color-text-muted)',
              transform: 'translateY(-50%)',
            }}
          >
            {d}d
          </div>
        ))}
        <div style={{ minHeight: 320, position: 'relative' }}>
          {sorted.map((s) => {
            const top = (s.next_charge_days / max) * 100;
            const w = 40 + (s.monthly / 3200) * 140;
            return (
              <div
                key={s.name}
                style={{
                  position: 'absolute',
                  top: `${top}%`,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transform: 'translateY(-50%)',
                }}
              >
                <div
                  style={{
                    height: 14,
                    width: w,
                    background: CAT_VAR[s.group],
                    opacity: 0.78,
                    borderRadius: 1,
                  }}
                />
                <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-primary)' }}>
                  {s.name}
                </div>
                <div
                  style={{
                    ...mono,
                    fontSize: 10,
                    color: 'var(--color-text-muted)',
                    marginLeft: 'auto',
                  }}
                >
                  {fmtRound(s.monthly)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- 04 — Subs Variant C: Annual stack ----------

function AnnualStack() {
  const sorted = [...subs].sort((a, b) => b.monthly - a.monthly);
  const totalH = 360;
  return (
    <div style={{ background: 'var(--color-bg-card)', borderRadius: 6, padding: '16px 14px' }}>
      <div style={{ ...kickerDark, marginBottom: 4 }}>§ ANNUAL WEIGHT</div>
      <div className="display" style={{ fontSize: 24, color: 'var(--color-text-primary)' }}>
        {fmtRound(totalAnnual)}/yr
      </div>
      <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
        stacked. biggest at the bottom.
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 16, alignItems: 'flex-end' }}>
        {/* Stack column */}
        <div
          style={{
            width: 84,
            height: totalH,
            display: 'flex',
            flexDirection: 'column-reverse',
            border: '1px solid var(--rule-ink)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {sorted.map((s) => {
            const h = (s.monthly / totalMonthly) * totalH;
            return (
              <div
                key={s.name}
                style={{
                  height: h,
                  background: CAT_VAR[s.group],
                  opacity: 0.85,
                  borderTop: '1px dashed rgba(255,255,255,0.2)',
                }}
                title={`${s.name} ${fmt(s.monthly)}/mo`}
              />
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ flex: 1 }}>
          {sorted.map((s) => (
            <div
              key={s.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '10px 1fr auto',
                gap: 10,
                alignItems: 'baseline',
                padding: '6px 0',
                borderBottom: '1px solid var(--rule-ink)',
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: CAT_VAR[s.group],
                  display: 'inline-block',
                }}
              />
              <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-primary)' }}>
                {s.name}
              </div>
              <div
                style={{
                  ...mono,
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtRound(s.monthly * 12)}/y
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Subs Variant E: Verdict ledger (lives inside Books, dark surface) ----------

function VerdictLedger() {
  const presets: Record<string, Verdict> = {
    'Apple iCloud': 'kill',
    'Spotify': 'keep',
    'Uber Eats Pass': 'keep',
  };
  const sorted = [...subs].sort((a, b) => b.monthly - a.monthly);
  const totalPaid = subs.reduce((a, s) => a + s.monthly * s.months_running, 0);
  const longest = sorted.reduce((a, s) => (s.months_running > a.months_running ? s : a), sorted[0]!);
  const newest = sorted.reduce((a, s) => (s.months_running < a.months_running ? s : a), sorted[0]!);
  const biggest = sorted[0]!;
  const FLAVOR: Record<string, string> = {
    'Apple iCloud': 'photos you don\'t restore',
    'Netflix': 'queue you stopped finishing',
    'Spotify': 'one playlist on repeat',
    'Amazon Prime': 'free shipping you forget you have',
    'Uber Eats Pass': 'unlocks discounts on takeout',
    'Banh Mi Club': 'one sandwich a week',
    'Starbucks Reload': 'auto top-up on your card',
  };
  function badgeFor(s: Sub): { label: string; color: string } | null {
    if (s.name === biggest.name) return { label: 'biggest', color: 'var(--cat-indulgence)' };
    if (s.name === longest.name) return { label: `oldest · ${s.months_running} mo`, color: 'var(--color-accent-gold)' };
    if (s.name === newest.name) return { label: 'fresh', color: 'var(--cat-savings)' };
    return null;
  }

  const showMenuFor = 'Netflix'; // illustration

  // Stamp factory — leans on the existing .stamp triple-inset shadow vocabulary.
  function rubberStamp(label: string, active: boolean, color: string, tilt: number): React.CSSProperties {
    return {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      padding: '6px 12px',
      border: 'none',
      background: active ? color : 'transparent',
      color: active ? 'var(--color-bg-primary)' : color,
      cursor: 'pointer',
      borderRadius: 2,
      transform: active ? `rotate(${tilt}deg)` : 'rotate(0)',
      boxShadow: active
        ? `inset 0 0 0 1px ${color}, inset 0 0 0 3px var(--color-bg-primary), inset 0 0 0 4px ${color}`
        : `inset 0 0 0 1px ${color}, inset 0 0 0 3px var(--color-bg-card), inset 0 0 0 4px ${color}`,
      transition: 'transform 120ms ease',
    };
  }

  function row(s: Sub, isHero: boolean) {
    const v = presets[s.name] || 'none';
    const killed = v === 'kill';
    const kept = v === 'keep';
    const annual = s.monthly * 12;
    const paidToDate = s.monthly * s.months_running;
    const cancelHelp = CANCEL_INSTRUCTIONS[s.name] || 'check your account page';
    const sharePct = (s.monthly / totalMonthly) * 100;
    const catColor = CAT_VAR[s.group];
    const badge = badgeFor(s);
    const flavor = FLAVOR[s.name];

    const heroBg = isHero
      ? `linear-gradient(180deg, color-mix(in oklab, ${catColor} 14%, transparent) 0%, transparent 100%)`
      : 'transparent';

    return (
      <div
        key={s.name}
        style={{
          position: 'relative',
          padding: isHero ? '20px 14px 18px 18px' : '16px 4px 14px 14px',
          marginTop: isHero ? 4 : 0,
          marginBottom: isHero ? 14 : 0,
          background: heroBg,
          borderTop: isHero
            ? `1px dashed color-mix(in oklab, ${catColor} 50%, transparent)`
            : 'none',
          borderBottom: isHero
            ? `1px dashed color-mix(in oklab, ${catColor} 50%, transparent)`
            : '1px solid var(--rule-ink)',
          opacity: killed ? 0.55 : 1,
          transition: 'opacity 200ms ease',
        }}
      >
        {/* category rule on the left edge */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: isHero ? 14 : 12,
            bottom: isHero ? 14 : 12,
            width: 3,
            background: catColor,
            opacity: killed ? 0.4 : 0.85,
          }}
        />

        {/* header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 18px',
            columnGap: 10,
            alignItems: 'baseline',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  color: catColor,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  lineHeight: 1,
                }}
                title="autopilot"
              >
                ↻
              </span>
              <span
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: isHero ? 24 : 17,
                  color: 'var(--color-text-primary)',
                  textDecoration: killed ? 'line-through' : 'none',
                  textDecorationThickness: '1px',
                  lineHeight: 1.1,
                }}
              >
                {s.name}
              </span>
              {badge && (
                <span
                  style={{
                    ...mono,
                    fontSize: 8,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: badge.color,
                    border: `1px solid ${badge.color}`,
                    padding: '2px 6px',
                    borderRadius: 1,
                  }}
                >
                  {badge.label}
                </span>
              )}
            </div>
            {flavor && (
              <div
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontStyle: 'italic',
                  fontSize: isHero ? 13 : 11,
                  color: 'var(--color-text-muted)',
                  marginTop: 4,
                  marginLeft: 21,
                }}
              >
                {flavor}
              </div>
            )}
            <div
              style={{
                ...mono,
                fontSize: 10,
                color: 'var(--color-text-muted)',
                marginTop: 6,
                marginLeft: 21,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {fmtRound(annual)}/yr · {fmtRound(paidToDate)} paid to date · {s.months_running} mo in
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'Fraunces, serif',
                fontWeight: 600,
                fontSize: isHero ? 36 : 22,
                color: 'var(--color-text-primary)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {fmt(s.monthly)}
            </div>
            <div
              style={{
                ...mono,
                fontSize: 9,
                color: 'var(--color-text-muted)',
                marginTop: 4,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              /mo · {sharePct.toFixed(0)}% of bleed
            </div>
          </div>
          <button
            type="button"
            aria-label="more"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 4,
              margin: -4,
              alignSelf: 'start',
            }}
          >
            ⋯
          </button>
        </div>

        {/* share-of-bleed micro bar */}
        <div
          style={{
            marginTop: 12,
            marginLeft: 21,
            height: 4,
            background: 'var(--rule-ink)',
            position: 'relative',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${sharePct}%`,
              background: catColor,
              opacity: killed ? 0.4 : 0.9,
            }}
          />
        </div>

        {/* stamps */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 12,
            marginLeft: 21,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button type="button" style={rubberStamp('Keep', kept, 'var(--cat-savings)', -1.2)}>
            Keep
          </button>
          <button type="button" style={rubberStamp('Kill', killed, 'var(--cat-indulgence)', 1.4)}>
            Kill
          </button>
          {kept && (
            <span
              style={{
                ...mono,
                fontSize: 9,
                color: 'var(--cat-savings)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginLeft: 'auto',
              }}
            >
              kept · revisit next quarter
            </span>
          )}
          {killed && (
            <span
              style={{
                ...mono,
                fontSize: 9,
                color: 'var(--cat-indulgence)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginLeft: 'auto',
              }}
            >
              waiting for next charge
            </span>
          )}
        </div>

        {/* cancel: torn-tape sticker */}
        {killed && (
          <div
            style={{
              marginTop: 14,
              marginLeft: 21,
              padding: '10px 14px 11px',
              background: 'var(--color-paper-shade)',
              color: 'var(--color-ink)',
              transform: 'rotate(-0.6deg)',
              boxShadow:
                '0 8px 18px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(0,0,0,0.06)',
              clipPath:
                'polygon(0 6%, 4% 0, 12% 5%, 22% 1%, 35% 4%, 50% 0, 65% 4%, 78% 0, 90% 4%, 100% 0, 100% 94%, 96% 100%, 86% 96%, 74% 100%, 60% 96%, 46% 100%, 32% 96%, 18% 100%, 8% 96%, 0 100%)',
            }}
          >
            <div
              style={{
                ...mono,
                fontSize: 9,
                color: 'var(--color-ink-muted)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              cancel here →
            </div>
            <div style={{ ...mono, fontSize: 12, color: 'var(--color-ink)' }}>
              {cancelHelp}
            </div>
          </div>
        )}

        {/* overflow menu — illustration only */}
        {s.name === showMenuFor && (
          <div
            style={{
              marginTop: 12,
              marginLeft: 21,
              padding: '12px 14px',
              border: '1px solid var(--rule-ink-strong)',
              borderLeft: '3px solid var(--color-text-muted)',
              background: 'color-mix(in oklab, var(--color-bg-primary) 60%, transparent)',
            }}
          >
            <div
              style={{
                ...mono,
                fontSize: 9,
                color: 'var(--color-text-muted)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              more · long-press anywhere
            </div>
            <button
              type="button"
              style={{
                ...mono,
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                padding: '5px 10px',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px dashed var(--rule-ink-strong)',
                cursor: 'pointer',
              }}
            >
              not a sub
            </button>
            <div
              style={{
                ...mono,
                fontSize: 10,
                color: 'var(--color-text-muted)',
                marginTop: 8,
                letterSpacing: '0.04em',
                lineHeight: 1.5,
              }}
            >
              drops this off the tape forever. the merchant keeps its category
              everywhere else.
            </div>
          </div>
        )}
      </div>
    );
  }

  // Hero stack visualization — horizontal bar split by sub
  const stackItems = sorted;

  return (
    <div style={{ background: 'var(--color-bg-card)', borderRadius: 6, padding: '20px 16px' }}>
      {/* hero confrontation */}
      <div
        style={{
          borderTop: '1px solid var(--rule-ink-strong)',
          paddingTop: 18,
          position: 'relative',
        }}
      >
        <div
          style={{
            ...kickerDark,
            background: 'var(--color-bg-card)',
            paddingRight: 8,
            position: 'absolute',
            top: -7,
            left: 0,
          }}
        >
          <span style={{ color: 'var(--color-accent-gold)', marginRight: 8 }}>02</span>
          STANDING ORDERS · 7 HANDS IN YOUR WALLET
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'baseline',
            gap: 16,
            marginTop: 8,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'Fraunces, serif',
                fontWeight: 600,
                fontSize: 56,
                color: 'var(--color-text-primary)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {fmtRound(totalAnnual)}
              <span style={{ fontSize: 24, color: 'var(--color-text-muted)' }}>/yr</span>
            </div>
            <div
              style={{
                ...mono,
                fontSize: 11,
                color: 'var(--color-text-muted)',
                marginTop: 8,
                letterSpacing: '0.06em',
              }}
            >
              if you keep all of these. {fmtRound(totalPaid)} already gone.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                ...mono,
                fontSize: 10,
                color: 'var(--color-text-muted)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              monthly
            </div>
            <div
              style={{
                fontFamily: 'Fraunces, serif',
                fontWeight: 500,
                fontSize: 22,
                color: 'var(--color-text-primary)',
                marginTop: 2,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmt(totalMonthly)}
            </div>
          </div>
        </div>

        {/* horizontal stack */}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            height: 10,
            borderRadius: 1,
            overflow: 'hidden',
            border: '1px solid var(--rule-ink)',
          }}
        >
          {stackItems.map((s) => (
            <div
              key={s.name}
              title={`${s.name} ${fmt(s.monthly)}/mo`}
              style={{
                flex: s.monthly,
                background: CAT_VAR[s.group],
                opacity: 0.85,
                borderRight: '1px dashed rgba(0,0,0,0.25)',
              }}
            />
          ))}
        </div>
        <div
          style={{
            ...mono,
            fontSize: 9,
            color: 'var(--color-text-muted)',
            marginTop: 6,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>← biggest</span>
          <span>{stackItems.length} orders · color = category</span>
        </div>
      </div>

      {/* rows */}
      <div style={{ marginTop: 22 }}>
        {sorted.map((s, i) => row(s, i === 0))}
      </div>
    </div>
  );
}

// ---------- 05 — Subs Variant D: Verdict tape (KEEP / KILL) ----------

type Verdict = 'none' | 'keep' | 'kill';

const CANCEL_INSTRUCTIONS: Record<string, string> = {
  'Netflix': 'netflix.com/youraccount → Cancel Membership',
  'Spotify': 'spotify.com/account/subscription → Cancel Premium',
  'Apple iCloud': 'iPhone Settings → Apple ID → Subscriptions → iCloud+',
  'Amazon Prime': 'amazon.ca → Account → Prime → End Membership',
  'Uber Eats Pass': 'Uber app → Account → Uber One → Manage',
  'Banh Mi Club': 'banhmiboys.ca → Account → Membership',
  'Starbucks Reload': 'Starbucks app → Cards → Auto-Reload → Off',
};

function VerdictTape() {
  // mockup state — one of each so all three states are visible
  const [verdicts, setVerdicts] = (function useLocalState() {
    // tiny inline mock — real impl would be useState
    const map: Record<string, Verdict> = {
      'Apple iCloud': 'kill',
      'Spotify': 'keep',
      'Uber Eats Pass': 'keep',
    };
    return [map, () => {}] as const;
  })();

  const sorted = [...subs].sort((a, b) => b.monthly - a.monthly);
  const totalPaid = subs.reduce((a, s) => a + s.monthly * s.months_running, 0);

  return (
    <div
      style={{
        background: 'var(--color-paper)',
        color: 'var(--color-ink)',
        borderRadius: 6,
        padding: '20px 18px 24px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ ...kickerDark, color: 'var(--color-ink-muted)', marginBottom: 4 }}>
        § STANDING ORDERS
      </div>
      <div className="display" style={{ fontSize: 28, color: 'var(--color-ink)', lineHeight: 1.1 }}>
        7 hands in your wallet
      </div>
      <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink-muted)', marginTop: 4 }}>
        {fmt(totalMonthly)}/mo · {fmt(totalAnnual)}/yr going forward · {fmt(totalPaid)} paid to date
      </div>

      <div style={{ marginTop: 18 }}>
        {sorted.map((s, i) => {
          const v = verdicts[s.name] || 'none';
          const paidToDate = s.monthly * s.months_running;
          const annual = s.monthly * 12;
          const killed = v === 'kill';
          const kept = v === 'keep';
          const cancelHelp = CANCEL_INSTRUCTIONS[s.name] || 'check your account page on the merchant site';
          return (
            <div
              key={s.name}
              style={{
                borderTop:
                  i === 0
                    ? 'none'
                    : '1px dashed color-mix(in oklab, var(--color-ink) 28%, transparent)',
                padding: '14px 0 14px',
                opacity: killed ? 0.62 : 1,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '14px 1fr auto',
                  columnGap: 10,
                  alignItems: 'baseline',
                }}
              >
                <div
                  style={{
                    color: killed ? 'var(--cat-indulgence)' : kept ? 'var(--cat-savings)' : 'var(--color-accent-purple-soft)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ↻
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'Fraunces, serif',
                      fontSize: 18,
                      color: 'var(--color-ink)',
                      textDecoration: killed ? 'line-through' : 'none',
                      textDecorationThickness: '1px',
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      ...mono,
                      fontSize: 10,
                      color: 'var(--color-ink-muted)',
                      marginTop: 4,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {fmtRound(annual)}/yr · {fmtRound(paidToDate)} paid to date · {s.months_running} mo in
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      ...mono,
                      fontSize: 18,
                      color: 'var(--color-ink)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt(s.monthly)}
                  </div>
                  <div
                    style={{
                      ...mono,
                      fontSize: 9,
                      color: 'var(--color-ink-muted)',
                      marginTop: 4,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    /MO
                  </div>
                </div>
              </div>

              {/* stamps row */}
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                <button
                  type="button"
                  className="stamp stamp-square"
                  style={{
                    fontSize: 10,
                    padding: '6px 12px',
                    transform: kept ? 'rotate(-1deg)' : 'rotate(0)',
                    background: kept ? 'var(--cat-savings)' : 'transparent',
                    color: kept ? 'var(--color-paper)' : 'var(--color-ink)',
                    boxShadow: kept
                      ? '0 0 0 1px var(--cat-savings) inset, 0 0 0 3px var(--color-paper) inset, 0 0 0 4px var(--cat-savings) inset'
                      : '0 0 0 1px var(--color-ink) inset, 0 0 0 3px var(--color-paper) inset, 0 0 0 4px var(--color-ink) inset',
                  }}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="stamp stamp-square"
                  style={{
                    fontSize: 10,
                    padding: '6px 12px',
                    transform: killed ? 'rotate(1.4deg)' : 'rotate(0)',
                    background: killed ? 'var(--cat-indulgence)' : 'transparent',
                    color: killed ? 'var(--color-paper)' : 'var(--color-ink)',
                    boxShadow: killed
                      ? '0 0 0 1px var(--cat-indulgence) inset, 0 0 0 3px var(--color-paper) inset, 0 0 0 4px var(--cat-indulgence) inset'
                      : '0 0 0 1px var(--color-ink) inset, 0 0 0 3px var(--color-paper) inset, 0 0 0 4px var(--color-ink) inset',
                  }}
                >
                  Kill
                </button>
                {v !== 'none' && (
                  <span
                    style={{
                      ...mono,
                      fontSize: 9,
                      color: 'var(--color-ink-muted)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginLeft: 'auto',
                    }}
                  >
                    {kept && 'kept · review next quarter'}
                    {killed && 'killed · waiting for next charge to confirm'}
                  </span>
                )}
              </div>

              {/* cancel instructions on KILL */}
              {killed && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 10px',
                    border: '1px dashed color-mix(in oklab, var(--color-ink) 35%, transparent)',
                    background: 'color-mix(in oklab, var(--cat-indulgence) 8%, var(--color-paper))',
                  }}
                >
                  <div
                    style={{
                      ...mono,
                      fontSize: 9,
                      color: 'var(--color-ink-muted)',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      marginBottom: 4,
                    }}
                  >
                    cancel here
                  </div>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--color-ink)' }}>
                    {cancelHelp}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          ...mono,
          fontSize: 10,
          color: 'var(--color-ink-muted)',
          textAlign: 'center',
          marginTop: 22,
          letterSpacing: '0.18em',
        }}
      >
        ** end of standing orders **
      </div>
    </div>
  );
}

// ---------- page ----------

export default function BooksMockup() {
  const habitsBefore = useMemo(
    () => habitsAll.filter((m) => m.group === 'lifestyle' || m.group === 'indulgence').slice(0, 8),
    []
  );
  const habitsAfter = useMemo(() => habitsAll.slice(0, 16), []);

  return (
    <div style={{ paddingBottom: 80, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ ...kickerDark, marginBottom: 4 }}>§ MOCKUP · BOOKS REWORK</div>
        <div className="display" style={{ fontSize: 30, color: 'var(--color-text-primary)' }}>
          Habits, fixed. Subscriptions, three takes.
        </div>
        <div style={{ ...mono, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Pick a direction. We build the winner against live data.
        </div>
      </div>

      <SectionLabel
        n="01"
        title="Habits — before / after"
        note="Before filtered to lifestyle + indulgence so the cluster was monochrome. After: top 16 merchants, all groups. The legend finally has something to do — slate, clay, sienna, gold, sage, all in one picture."
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <HabitsViz items={habitsBefore} label="BEFORE — discretionary only" />
        <HabitsViz items={habitsAfter} label="AFTER — all groups" />
      </div>

      <SectionLabel
        n="02"
        title="Subs · Variant A — Standing-orders tape with punch cards"
        note="Cream receipt. Biggest at top. Each row carries an autopilot ↻ glyph, the service in Fraunces, monthly in tabular mono, and a row of punch dots — one for every month you've paid. You see Apple iCloud at 52 punches and feel it. Tenure is the story."
      />
      <StandingOrdersTape />

      <SectionLabel
        n="03"
        title="Subs · Variant B — Calendar timeline"
        note="When each one actually hits in the next 30 days. Bar length = monthly cost. You see Starbucks Reload landing in 2 days and Banh Mi Club at the end of the month. Answers 'what's about to clear my account?' instead of 'what do I pay total?'"
      />
      <CalendarTimeline />

      <SectionLabel
        n="04"
        title="Subs · Variant C — Annual stack"
        note="One column, stacked floor-to-ceiling. The visual mass IS the annual weight. Biggest at the bottom (foundation), trial subs as thin slices at the top. Reads like a fuel tank, except every gauge mark is a yearly outflow you forgot you authorized."
      />
      <AnnualStack />

      <SectionLabel
        n="05"
        title="Subs · Variant E — Page-aware. Ledger context (lives inside Books)"
        note="Dark ledger section. Hairline rules, kicker like Money map and Habits. KEEP / KILL on each row. NOT A SUB hides behind the ⋯ glyph at the row's right edge — long-press or tap opens it. Edge case = edge ergonomic."
      />
      <VerdictLedger />

      <SectionLabel
        n="06"
        title="Subs · Variant D — Receipt context (drill-in /paycheque/subscriptions)"
        note="Same data, different surface. When you tap a sub from the Books ledger row to see paid-to-date and history, you land on a cream receipt. The verdict tape lives here in full. The Books section is the summary; this is the drill-in."
      />
      <VerdictTape />

      <SectionLabel
        n="07"
        title="The call"
        note="D is the right one. The system shows cost without lying about value. The user supplies the verdict. KILL surfaces the cancel link so the decision becomes the action. A's punch cards were brand-pretty but pretended to mean something they didn't. B and C answer different questions that aren't 'should I keep this.'"
      />
    </div>
  );
}
