import type * as React from 'react';

/**
 * Sticky visual key for the Books page.
 *
 * One legend, applied to every constellation across the page. Read once, applies forever.
 * Teaches the visual grammar so the user can decode any bubble at a glance.
 */
export default function BooksLegend() {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        margin: '0 -16px',
        padding: '10px 16px',
        background: 'linear-gradient(180deg, rgba(13,10,16,0.96) 70%, rgba(13,10,16,0))',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
          flexWrap: 'wrap',
          rowGap: 4,
        }}
      >
        <LegendItem>
          <SizeSwatch />
          <span>size = amount</span>
        </LegendItem>
        <LegendItem>
          <ColorSwatch />
          <span>color = category</span>
        </LegendItem>
        <LegendItem>
          <SolidDot />
          <span>solid = paid</span>
        </LegendItem>
        <LegendItem>
          <RingDot />
          <span>ring = autopilot</span>
        </LegendItem>
      </div>
    </div>
  );
}

function LegendItem({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </span>
  );
}

function SizeSwatch() {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
      <circle cx="4" cy="7" r="2.5" fill="rgba(255,255,255,0.55)" />
      <circle cx="11" cy="7" r="3.6" fill="rgba(255,255,255,0.55)" />
      <circle cx="19" cy="7" r="5" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}

function ColorSwatch() {
  return (
    <svg width="38" height="10" viewBox="0 0 38 10" aria-hidden="true">
      <circle cx="4" cy="5" r="3.5" fill="var(--cat-essentials)" />
      <circle cx="12" cy="5" r="3.5" fill="var(--cat-debt)" />
      <circle cx="20" cy="5" r="3.5" fill="var(--cat-savings)" />
      <circle cx="28" cy="5" r="3.5" fill="var(--cat-lifestyle)" />
      <circle cx="36" cy="5" r="3.5" fill="var(--cat-indulgence)" />
    </svg>
  );
}

function SolidDot() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="4" fill="var(--cat-savings)" />
    </svg>
  );
}

function RingDot() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <circle
        cx="5"
        cy="5"
        r="3.4"
        fill="rgba(255,255,255,0.02)"
        stroke="var(--cat-savings)"
        strokeWidth="1.2"
        strokeDasharray="2 2"
      />
    </svg>
  );
}
