import { Link } from 'react-router-dom';

const PAYCHEQUE = 425000;
const PERIOD_LABEL = 'Apr 24 — May 7';
const DAY = 4;
const TOTAL_DAYS = 14;

type Category = 'essentials' | 'lifestyle' | 'indulgence' | 'debt' | 'savings';

interface Satellite {
  id: string;
  name: string;
  cents: number;
  category: Category;
  hint: string;
}

// Paycheque DRAFT view — only commitments. No merchants. No drawers.
// Each satellite is a locked allocation kicked out by the kernel.
const COMMITMENTS: Satellite[] = [
  { id: 'avalanche', name: 'Toward debt',  cents: 136500, category: 'debt',       hint: 'avalanche · capital one' },
  { id: 'cashbuf',   name: 'Cash buffer',  cents:  19546, category: 'savings',    hint: 'biweekly transfer' },
  { id: 'enbridge',  name: 'Enbridge',     cents:  10800, category: 'essentials', hint: 'bill · may 02' },
  { id: 'luther',    name: 'Luther',       cents:  10000, category: 'debt',       hint: 'monthly · mexico' },
  { id: 'rogers',    name: 'Rogers',       cents:   9500, category: 'essentials', hint: 'bill · apr 30' },
  { id: 'tdmin',     name: 'TD Visa min',  cents:   8940, category: 'debt',       hint: 'due may 05' },
  { id: 'vacation',  name: 'Vacation',     cents:   7353, category: 'savings',    hint: 'biweekly transfer' },
  { id: 'capone',    name: 'Capital One',  cents:   5000, category: 'debt',       hint: 'due may 03' },
];

const COMMITTED_TOTAL = COMMITMENTS.reduce((s, c) => s + c.cents, 0);
const FREE = PAYCHEQUE - COMMITTED_TOTAL;

function fmt(c: number) {
  const a = Math.abs(c);
  return `$${(a / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtCents(c: number) {
  const sign = c < 0 ? '-' : '';
  const a = Math.abs(c);
  return `${sign}$${(a / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaychequeTankMockup() {
  return (
    <div className="ledger-page flex flex-col gap-6 pb-8">
      {/* header */}
      <header style={{ paddingTop: 4 }}>
        <Link to="/paycheque" className="stamp stamp-square" style={{ marginBottom: 12, display: 'inline-block' }}>
          BACK
        </Link>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottom: '1px solid rgba(255,255,255,0.18)',
            paddingBottom: 14,
            gap: 12,
          }}
        >
          <div>
            <div
              className="ink-muted"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              This paycheque
            </div>
            <div className="display" style={{ fontSize: 24, lineHeight: 1.05, letterSpacing: '-0.01em' }}>
              {PERIOD_LABEL}
            </div>
          </div>
          <button className="stamp stamp-square" style={{ fontSize: 10, flexShrink: 0 }}>
            IMPORT CSV
          </button>
        </div>
        <p
          className="ink-muted"
          style={{
            margin: '12px 0 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.5,
          }}
        >
          Mockup of the draft view. The free bubble is the only number you choose. The rest is already spoken for.
        </p>
      </header>

      <DraftConstellation />

      {/* historical */}
      <section
        style={{
          margin: '-8px 0 0',
          padding: '14px 0',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.6,
          }}
        >
          Last paycheque ended free with $283.
          <br />
          <span style={{ color: 'var(--cat-indulgence)' }}>4 of last 8 ended underwater.</span>
        </p>
      </section>

      {/* draft anchor */}
      <div
        style={{
          margin: '-12px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          the plan below
        </span>
        <button className="stamp stamp-purple">DRAFT THIS PAYCHEQUE</button>
      </div>

      {/* 01 INCOME */}
      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>01</span> Income
        </span>
        <div className="ledger-row">
          <div className="flex items-center gap-3 ledger-row-main">
            <span className="cat-rule income" />
            <div>
              <div className="text-sm">Paycheque</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {PERIOD_LABEL}
              </div>
            </div>
          </div>
          <span className="num ledger-row-value" style={{ color: 'var(--cat-income)' }}>
            + {fmtCents(PAYCHEQUE)}
          </span>
        </div>
      </section>

      {/* 02 COMMITTED */}
      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>02</span> Committed
        </span>
        <span className="ledger-section-meta">{fmtCents(COMMITTED_TOTAL)}</span>
        {COMMITMENTS.map((c) => (
          <CommittedRow key={c.id} label={c.name} group={c.category} hint={c.hint} cents={c.cents} />
        ))}
      </section>

      {/* 03 BOOKS (linked) */}
      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>03</span> Books
        </span>
        <BooksRow label="P&amp;L statement"   hint="income · expenses · surplus" />
        <BooksRow label="Net worth"           hint="assets minus liabilities" />
        <BooksRow label="Next 30 days"        hint="cash forecast · running balance" />
        <BooksRow label="Subscriptions"       hint="recurring discretionary charges" />
      </section>

      {/* 04 OPEN TABS */}
      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>04</span> Open tabs
        </span>
        <span className="ledger-section-meta">4 chits</span>
        <TabRow name="Luther"        direction="i_owe"   cents={110000} hint="Mexico" />
        <TabRow name="Marcus Chen"   direction="they_owe" cents={4750}  hint="Lady Marmalade" />
        <TabRow name="Priya Shah"    direction="i_owe"   cents={8200}   hint="Bar Raval" />
        <TabRow name="Diego Alvarez" direction="they_owe" cents={3600}  hint="Golden Turtle" />
      </section>

      <p
        style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
          margin: '16px 0 4px',
        }}
      >
        — end of paycheque —
      </p>
    </div>
  );
}

/* -------- constellation: FREE + locked satellites -------- */

function DraftConstellation() {
  const sorted = [...COMMITMENTS].sort((a, b) => b.cents - a.cents);
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
      const angle = -Math.PI / 2 + Math.PI / inner.length + (i / outer.length) * Math.PI * 2;
      return {
        ...b,
        x: cx + Math.cos(angle) * orbitOuter,
        y: cy + Math.sin(angle) * orbitOuter,
        bubbleR: radiusFor(b.cents),
      };
    }),
  ];

  const freeColor = FREE >= 0 ? '#94a888' : '#c97a4a';

  return (
    <section
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(148,168,136,0.10) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
        borderRadius: 4,
        padding: '6px',
        position: 'relative',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="freeGlowDraft" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={freeColor} stopOpacity="0.35" />
            <stop offset="60%" stopColor={freeColor} stopOpacity="0.05" />
            <stop offset="100%" stopColor={freeColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r="115" fill="url(#freeGlowDraft)" />

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
          <LockedBubble key={b.id} b={b} />
        ))}

        {/* central FREE core */}
        <circle cx={cx} cy={cy} r="46" fill="#1a141d" />
        <circle cx={cx} cy={cy} r="46" fill="none" stroke={freeColor} strokeWidth="1.8" />
        <text x={cx} y={cy - 12} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" letterSpacing="3" fill={freeColor} opacity="0.85">
          FREE
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontFamily="Fraunces, ui-serif, Georgia" fontWeight="600" fontSize="22" fill={freeColor}>
          {fmt(FREE)}
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="8" letterSpacing="2" fill="rgba(255,255,255,0.45)">
          OF {fmt(PAYCHEQUE)}
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
        <span>DAY {DAY} OF {TOTAL_DAYS}</span>
        <span>{COMMITMENTS.length} COMMITMENTS</span>
      </div>
    </section>
  );
}

function LockedBubble({ b }: { b: Satellite & { x: number; y: number; bubbleR: number } }) {
  const color = `var(--cat-${b.category})`;
  const labelY = b.y + b.bubbleR + 13;
  const amountY = labelY + 11;
  return (
    <g>
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r = b.bubbleR + 5;
        const dx = b.x + Math.cos(a) * r;
        const dy = b.y + Math.sin(a) * r;
        return <circle key={i} cx={dx} cy={dy} r="0.9" fill={color} opacity="0.7" />;
      })}
      <circle cx={b.x} cy={b.y} r={b.bubbleR} fill={color} stroke="#0e0a10" strokeWidth="1.5" />
      <circle cx={b.x} cy={b.y} r={Math.max(3, b.bubbleR - 5)} fill="none" stroke="#0e0a10" strokeWidth="0.8" />
      <text x={b.x} y={labelY} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" letterSpacing="0.5" fill="rgba(255,255,255,0.85)">
        {b.name}
      </text>
      <text x={b.x} y={amountY} textAnchor="middle" fontFamily="ui-monospace, Menlo" fontSize="9" fill="rgba(255,255,255,0.5)">
        {fmt(b.cents)}
      </text>
    </g>
  );
}

/* -------- shared row helpers -------- */

function CommittedRow({
  label,
  group,
  hint,
  cents,
}: {
  label: string;
  group: Category;
  hint: string;
  cents: number;
}) {
  const color = group === 'debt' ? 'var(--cat-debt)' : group === 'savings' ? 'var(--cat-savings)' : undefined;
  return (
    <div className="ledger-row">
      <div className="flex items-center gap-3 ledger-row-main">
        <span className={`cat-rule ${group}`} />
        <div>
          <div className="text-sm">{label}</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
            {hint}
          </div>
        </div>
      </div>
      <span className="num ledger-row-value" style={color ? { color } : undefined}>
        {fmtCents(cents)}
      </span>
    </div>
  );
}

function BooksRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="ledger-row tap">
      <div className="ledger-row-main">
        <div className="text-sm">{label}</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
          {hint}
        </div>
      </div>
      <span className="ledger-row-chevron">&rsaquo;</span>
    </div>
  );
}

function TabRow({ name, direction, cents, hint }: { name: string; direction: 'i_owe' | 'they_owe'; cents: number; hint: string }) {
  const isOwes = direction === 'they_owe';
  const color = isOwes ? 'var(--cat-savings)' : 'var(--cat-indulgence)';
  return (
    <div className="ledger-row">
      <div className="ledger-row-main">
        <div className="text-sm">{name}</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
          {isOwes ? 'owes you' : 'you owe'} · {hint}
        </div>
      </div>
      <span className="num ledger-row-value" style={{ color }}>
        {isOwes ? '+' : '−'} {fmtCents(cents)}
      </span>
    </div>
  );
}
