import React from 'react';
import { Link } from 'react-router-dom';

const INK = '#1a141d';
const INK_SOFT = 'rgba(26,20,29,0.65)';
const INK_MUTED = 'rgba(26,20,29,0.45)';
const PURPLE = '#9e78b9';
const PURPLE_DEEP = '#5a3a78';
const PAPER = '#f2ece0';
const SAGE = '#94a888';
const SIENNA = '#c97a4a';
const GOLD = '#c8a96a';

function Mascot({ size = 44 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundImage: 'url(/brand/mascot-charcoal.png)',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        flexShrink: 0,
      }}
    />
  );
}

const monoCaps: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
};

const fraunces: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
};

const tabularMono: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontVariantNumeric: 'tabular-nums',
};

// A receipt shell with thermal-printer top and bottom edges
const ReceiptShell: React.FC<{ children: React.ReactNode; padded?: boolean }> = ({ children, padded = true }) => (
  <div style={{
    background: PAPER,
    boxShadow: '0 6px 22px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.25)',
    position: 'relative',
    padding: padded ? '24px 22px 28px' : 0,
    backgroundImage: `
      radial-gradient(ellipse at 80% 15%, rgba(26,20,29,0.04) 0%, transparent 50%),
      radial-gradient(ellipse at 20% 85%, rgba(158,120,185,0.05) 0%, transparent 60%)
    `,
  }}>
    {children}
  </div>
);

// A row that mimics a POS line item — label left, dotted leader, amount right
const ItemLine: React.FC<{ label: string; amount: string; muted?: boolean; bold?: boolean }> = ({ label, amount, muted, bold }) => (
  <div style={{
    display: 'flex', alignItems: 'baseline',
    fontSize: 13,
    color: muted ? INK_MUTED : INK,
    fontWeight: bold ? 600 : 400,
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    marginBottom: 4,
  }}>
    <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
    <span style={{
      flex: 1,
      borderBottom: `1px dotted ${muted ? 'rgba(26,20,29,0.20)' : 'rgba(26,20,29,0.32)'}`,
      margin: '0 8px',
      transform: 'translateY(-3px)',
    }} />
    <span style={{ whiteSpace: 'nowrap' }}>{amount}</span>
  </div>
);

// Code-128-ish barcode, pure CSS
const Barcode: React.FC = () => {
  const widths = [3, 1, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 1, 1, 3, 1, 2, 2, 3, 1, 2, 1, 1, 2, 3, 2, 1, 1, 1, 3, 1, 2, 2, 1, 1];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48, justifyContent: 'center' }}>
      {widths.map((w, i) => (
        <span key={i} style={{
          width: w,
          height: '100%',
          background: i % 2 === 0 ? INK : 'transparent',
        }} />
      ))}
    </div>
  );
};

// Perforation/tear edge
const Perf: React.FC<{ color?: string }> = ({ color = 'rgba(26,20,29,0.30)' }) => (
  <div style={{ borderTop: `1px dashed ${color}`, marginTop: 12, marginBottom: 12 }} />
);

// Saw-tooth tear edge for between two receipts in B
const TearEdge: React.FC = () => {
  const teeth = Array.from({ length: 18 });
  return (
    <div style={{ position: 'relative', height: 16 }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: PAPER,
        clipPath: `polygon(0 0, 100% 0, 100% 0%, ${teeth.map((_, i) => {
          const x = ((i + 1) / teeth.length) * 100;
          const xPrev = (i / teeth.length) * 100;
          return `${xPrev}% 0%, ${(xPrev + x) / 2}% 100%, ${x}% 0%`;
        }).join(', ')}, 0% 0%)`,
      }} />
    </div>
  );
};

// ─── A — The Storefront Receipt ───────────────────────────────────────────────
function StorefrontReceipt() {
  return (
    <ReceiptShell>
      {/* Establishment seal — mascot top-center, like a store logo */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
        <Mascot size={48} />
      </div>

      {/* Establishment name */}
      <div style={{ ...monoCaps, fontSize: 11, letterSpacing: '0.34em', fontWeight: 700, color: INK, textAlign: 'center', marginBottom: 2 }}>
        DECLYNE BOOKKEEPING
      </div>

      {/* Address-style line */}
      <div style={{ ...monoCaps, fontSize: 9, letterSpacing: '0.22em', color: INK_MUTED, textAlign: 'center', marginBottom: 1 }}>
        BOWGULL · TORONTO · WK 18
      </div>

      {/* Receipt timestamp */}
      <div style={{ ...monoCaps, fontSize: 9, letterSpacing: '0.20em', color: INK_MUTED, textAlign: 'center', marginBottom: 12 }}>
        29 APR 2026 · 06:42:18
      </div>

      <Perf />

      {/* TODAY section */}
      <div style={{ ...monoCaps, fontSize: 9, color: INK, fontWeight: 600, letterSpacing: '0.30em', textAlign: 'center', marginBottom: 10 }}>
        — TODAY —
      </div>

      <div style={{ ...monoCaps, fontSize: 9, color: INK_MUTED, letterSpacing: '0.22em', marginBottom: 6 }}>
        TANK SUMMARY
      </div>
      <ItemLine label="Paycheque (4/24)" amount="$4,250.00" muted />
      <ItemLine label="Committed" amount="−$2,533.52" muted />
      <ItemLine label="Spent so far" amount="−$1,448.95" muted />
      <div style={{ borderTop: `1px solid ${INK}`, marginTop: 6, marginBottom: 6 }} />
      <ItemLine label="LEFT IN TANK" amount="$267.53" bold />
      <div style={{ ...monoCaps, fontSize: 8, color: INK_MUTED, letterSpacing: '0.22em', marginTop: 4 }}>
        10 DAYS TO PAYDAY · 1.6× DAILY PACE
      </div>

      <Perf />

      {/* UP NEXT section */}
      <div style={{ ...monoCaps, fontSize: 9, color: INK, fontWeight: 600, letterSpacing: '0.30em', textAlign: 'center', marginBottom: 10 }}>
        — UP NEXT —
      </div>
      <ItemLine label="? 2 to categorize" amount="NOW" />
      <ItemLine label="↻ Rogers · 22d" amount="$80.00" />
      <ItemLine label="↻ Metro · 28d" amount="$69.80" />
      <div style={{ ...monoCaps, fontSize: 8, color: INK_MUTED, letterSpacing: '0.22em', marginTop: 4 }}>
        2 MORE QUEUED · TAP TO EXPAND
      </div>

      <Perf />

      {/* OPEN TABS section */}
      <div style={{ ...monoCaps, fontSize: 9, color: INK, fontWeight: 600, letterSpacing: '0.30em', textAlign: 'center', marginBottom: 10 }}>
        — OPEN TABS —
      </div>
      <ItemLine label="Priya Shah · 2 chits" amount="−$137.00" />
      <ItemLine label="Bowgull · 1 chit" amount="−$100.00" />
      <ItemLine label="Diego Alvarez · 2 chits" amount="+$64.00" />
      <ItemLine label="Marcus Chen · 1 chit" amount="+$35.00" />
      <div style={{ borderTop: `1px solid ${INK}`, marginTop: 6, marginBottom: 6 }} />
      <ItemLine label="NET POSITION" amount="−$138.00" bold />

      <Perf />

      {/* Approval / reference line */}
      <div style={{ ...monoCaps, fontSize: 9, color: INK, letterSpacing: '0.22em', textAlign: 'center', marginBottom: 4 }}>
        ** APPROVED — REF #0084 **
      </div>
      <div style={{ ...monoCaps, fontSize: 8, color: INK_MUTED, letterSpacing: '0.22em', textAlign: 'center', marginBottom: 14 }}>
        CASHIER #1 · BAT &nbsp;·&nbsp; LANE 04
      </div>

      {/* Barcode */}
      <Barcode />
      <div style={{ ...monoCaps, fontSize: 8, color: INK_MUTED, letterSpacing: '0.30em', textAlign: 'center', marginTop: 4, marginBottom: 12 }}>
        DLC-2026-0084-BWG
      </div>

      {/* Footer thank-you */}
      <div style={{ ...monoCaps, fontSize: 9, color: INK, letterSpacing: '0.30em', textAlign: 'center' }}>
        ** THANK YOU — KEEP THE RECEIPT **
      </div>
    </ReceiptShell>
  );
}

// ─── B — The Twin Receipt ─────────────────────────────────────────────────────
function TwinReceipt() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top — ceremonial */}
      <ReceiptShell padded={false}>
        <div style={{ padding: '20px 22px 22px' }}>
          {/* Mascot small top-center */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <Mascot size={40} />
          </div>

          {/* Date line */}
          <div style={{ ...monoCaps, fontSize: 10, letterSpacing: '0.30em', textAlign: 'center', color: INK, fontWeight: 600, marginBottom: 14 }}>
            WED · 29 APR · WK 18
          </div>

          {/* Hero number */}
          <div style={{ ...monoCaps, fontSize: 9, color: INK_MUTED, letterSpacing: '0.22em', textAlign: 'center', marginBottom: 4 }}>
            LEFT IN TANK
          </div>
          <div style={{ ...fraunces, fontSize: 64, fontWeight: 600, color: SIENNA, lineHeight: 1, letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 14 }}>
            $267.53
          </div>

          {/* Bat note */}
          <div style={{ borderTop: `1px dashed rgba(26,20,29,0.30)`, paddingTop: 10 }}>
            <div style={{ ...monoCaps, fontSize: 8, color: INK_MUTED, letterSpacing: '0.22em', textAlign: 'center', marginBottom: 4 }}>
              FROM THE BAT
            </div>
            <div style={{ ...fraunces, fontStyle: 'italic', fontSize: 14, textAlign: 'center', color: INK_SOFT, lineHeight: 1.4 }}>
              "Tank holds. Stay light."
            </div>
          </div>
        </div>

        {/* Saw-tooth bottom edge — tearable */}
        <div style={{
          height: 16, background: '#0a070c',
          maskImage: 'radial-gradient(circle 5px at 8px 0, transparent 99%, black 100%)',
          WebkitMaskImage: 'radial-gradient(circle 5px at 8px 0, transparent 99%, black 100%)',
          maskSize: '16px 16px',
          WebkitMaskSize: '16px 16px',
        }} />
      </ReceiptShell>

      {/* Bottom — operational */}
      <ReceiptShell>
        {/* Section header */}
        <div style={{ ...monoCaps, fontSize: 10, color: INK, fontWeight: 600, letterSpacing: '0.30em', textAlign: 'center', marginBottom: 4 }}>
          DECLYNE BOOKKEEPING
        </div>
        <div style={{ ...monoCaps, fontSize: 9, color: INK_MUTED, letterSpacing: '0.22em', textAlign: 'center', marginBottom: 14 }}>
          BOWGULL · WK 18 · RCPT 0084
        </div>

        <Perf />

        {/* UP NEXT */}
        <div style={{ ...monoCaps, fontSize: 9, color: INK, fontWeight: 600, letterSpacing: '0.28em', marginBottom: 10 }}>
          UP NEXT
        </div>
        <ItemLine label="? 2 to categorize" amount="NOW" />
        <ItemLine label="↻ Rogers · 22d" amount="$80.00" />
        <ItemLine label="↻ Metro · 28d" amount="$69.80" />
        <ItemLine label="+ 2 more" amount="↓" muted />

        <Perf />

        {/* OPEN TABS */}
        <div style={{ ...monoCaps, fontSize: 9, color: INK, fontWeight: 600, letterSpacing: '0.28em', marginBottom: 10 }}>
          OPEN TABS · 4 ACTIVE
        </div>
        <ItemLine label="Priya Shah" amount="−$137.00" />
        <ItemLine label="Bowgull" amount="−$100.00" />
        <ItemLine label="Diego Alvarez" amount="+$64.00" />
        <ItemLine label="Marcus Chen" amount="+$35.00" />

        <Perf />

        <div style={{ ...monoCaps, fontSize: 9, color: INK_MUTED, letterSpacing: '0.30em', textAlign: 'center' }}>
          ** STILL PRINTING **
        </div>
      </ReceiptShell>
    </div>
  );
}

// ─── C — The Annotated Receipt ────────────────────────────────────────────────
// Custom variant of ItemLine that supports a margin annotation
const AnnotatedItemLine: React.FC<{
  label: string;
  amount: string;
  bold?: boolean;
  stamp?: boolean;
  note?: string;
}> = ({ label, amount, bold, stamp, note }) => (
  <div style={{ position: 'relative', marginBottom: 4 }}>
    <div style={{
      display: 'flex', alignItems: 'baseline',
      fontSize: 13, color: INK,
      fontWeight: bold ? 600 : 400,
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {stamp && (
        <span style={{
          display: 'inline-block', width: 12, height: 12, marginRight: 6,
          background: PURPLE, borderRadius: 1.5,
          transform: 'rotate(-4deg)',
          alignSelf: 'center',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.4), 0 0 0 1px rgba(94,58,120,0.3)',
        }} />
      )}
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{
        flex: 1,
        borderBottom: `1px dotted rgba(26,20,29,0.32)`,
        margin: '0 8px',
        transform: 'translateY(-3px)',
      }} />
      <span style={{ whiteSpace: 'nowrap' }}>{amount}</span>
    </div>
    {note && (
      <div style={{
        ...fraunces,
        fontStyle: 'italic',
        fontSize: 11,
        color: PURPLE_DEEP,
        marginTop: 1,
        marginLeft: stamp ? 18 : 0,
        opacity: 0.85,
        letterSpacing: '0.01em',
      }}>
        ↳ {note}
      </div>
    )}
  </div>
);

function AnnotatedReceipt() {
  return (
    <ReceiptShell>
      {/* Header — same establishment treatment as A but tighter */}
      <div style={{ position: 'absolute', top: 18, right: 18 }}>
        <Mascot size={36} />
      </div>

      <div style={{ ...monoCaps, fontSize: 10, fontWeight: 600, letterSpacing: '0.30em', color: INK, marginBottom: 2 }}>
        DECLYNE · WED 29 APR
      </div>
      <div style={{ ...monoCaps, fontSize: 8, color: INK_MUTED, letterSpacing: '0.22em' }}>
        BOWGULL · WK 18 · REVIEWED BY THE BAT
      </div>

      <Perf />

      {/* Hero — with annotation */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{ ...monoCaps, fontSize: 9, color: INK_MUTED, letterSpacing: '0.22em', marginBottom: 4 }}>
          LEFT IN TANK
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ ...fraunces, fontSize: 52, fontWeight: 600, color: SIENNA, lineHeight: 0.9, letterSpacing: '-0.01em' }}>
            $267.53
          </div>
          {/* Bat's purple ink stamp */}
          <div style={{
            background: PURPLE, color: PAPER,
            ...monoCaps, fontSize: 8, fontWeight: 700, letterSpacing: '0.18em',
            padding: '4px 8px',
            transform: 'rotate(-3deg)',
            boxShadow: '0 0 0 1.5px rgba(255,255,255,0.4) inset, 0 0 0 1px rgba(94,58,120,0.3)',
            marginBottom: 4,
            whiteSpace: 'nowrap',
          }}>
            HOLDING ✓
          </div>
        </div>
        {/* Margin note */}
        <div style={{
          ...fraunces, fontStyle: 'italic', fontSize: 12,
          color: PURPLE_DEEP, marginTop: 6, opacity: 0.9,
          letterSpacing: '0.01em',
        }}>
          ↑ light pace — tank holds with room
        </div>
      </div>

      <Perf />

      {/* UP NEXT — annotated lines */}
      <div style={{ ...monoCaps, fontSize: 9, color: INK, fontWeight: 600, letterSpacing: '0.28em', marginBottom: 10 }}>
        UP NEXT
      </div>
      <AnnotatedItemLine label="? 2 to categorize" amount="NOW" stamp note="needs your verdict — first" />
      <AnnotatedItemLine label="↻ Rogers · 22d" amount="$80.00" />
      <AnnotatedItemLine label="↻ Metro · 28d" amount="$69.80" />

      <Perf />

      {/* OPEN TABS — annotated */}
      <div style={{ ...monoCaps, fontSize: 9, color: INK, fontWeight: 600, letterSpacing: '0.28em', marginBottom: 10 }}>
        OPEN TABS
      </div>
      <AnnotatedItemLine label="Priya Shah · 2 chits" amount="−$137.00" stamp note="two weeks open — nudge soon" />
      <AnnotatedItemLine label="Bowgull · 1 chit" amount="−$100.00" />
      <AnnotatedItemLine label="Diego Alvarez · 2 chits" amount="+$64.00" />
      <AnnotatedItemLine label="Marcus Chen · 1 chit" amount="+$35.00" />

      <Perf />

      {/* Streak — annotated */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ ...monoCaps, fontSize: 11, color: INK, fontWeight: 600, letterSpacing: '0.22em' }}>
          SUNDAY SEAL · 3 WEEKS
        </div>
        <div style={{
          background: GOLD, color: INK,
          ...monoCaps, fontSize: 8, fontWeight: 700, letterSpacing: '0.18em',
          padding: '3px 7px',
          transform: 'rotate(2deg)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.2) inset',
        }}>
          EARNED
        </div>
      </div>
      <div style={{ ...fraunces, fontStyle: 'italic', fontSize: 12, color: PURPLE_DEEP, opacity: 0.85, letterSpacing: '0.01em' }}>
        ↳ third sunday running — keep it
      </div>

      <Perf />

      {/* Footer */}
      <div style={{ ...monoCaps, fontSize: 9, color: INK, letterSpacing: '0.30em', textAlign: 'center' }}>
        ** REVIEWED — STILL HOLDING **
      </div>
    </ReceiptShell>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TodayHeaderMockup() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a070c', padding: '24px 14px 60px', fontFamily: 'var(--font-mono)' }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/today" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none' }}>
          ← Today
        </Link>
      </div>

      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 36, textAlign: 'center' }}>
        Three receipt directions · stay in the frame
      </div>

      <div style={{ marginBottom: 56 }}>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>
          A — The Storefront Receipt
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.14em', marginBottom: 14, lineHeight: 1.6 }}>
          Real thermal-printer typography. Mascot top-center as the establishment seal. Item lines with dotted leaders. Subtotals, totals, approval code, barcode, thank-you footer.
        </div>
        <StorefrontReceipt />
      </div>

      <div style={{ marginBottom: 56 }}>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>
          B — The Twin Receipt
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.14em', marginBottom: 14, lineHeight: 1.6 }}>
          Two stacked receipts. Top is ceremonial — date, hero number at 64px, one bat note. Bottom is operational — Up Next, Open Tabs, item lines.
        </div>
        <TwinReceipt />
      </div>

      <div style={{ marginBottom: 40 }}>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>
          C — The Annotated Receipt
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.14em', marginBottom: 14, lineHeight: 1.6 }}>
          Single receipt that the bat has reviewed. Purple ink stamps mark flagged items. Italic Fraunces margin notes ("↑ tank holding") read like pencilled annotations.
        </div>
        <AnnotatedReceipt />
      </div>
    </div>
  );
}
