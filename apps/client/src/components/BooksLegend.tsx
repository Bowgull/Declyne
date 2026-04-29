import type * as React from 'react';

type Subview = 'paycheque' | 'patterns';

export default function BooksLegend({ view }: { view: Subview }) {
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
          <span>size = {view === 'paycheque' ? 'amount' : '90d spend'}</span>
        </LegendItem>
        {view === 'paycheque' ? (
          <LegendItem>
            <PayRoleSwatch />
            <span>color = role</span>
          </LegendItem>
        ) : (
          <LegendItem>
            <SubCatSwatch />
            <span>color = sub-category</span>
          </LegendItem>
        )}
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

// 4-dot swatch showing the pay-role hierarchy: bills (slate) · mins (muted gold) · extras (amber) · goals (sage)
function PayRoleSwatch() {
  return (
    <svg width="44" height="10" viewBox="0 0 44 10" aria-hidden="true">
      <circle cx="4"  cy="5" r="3.5" fill="var(--pay-bills)" />
      <circle cx="16" cy="5" r="3.5" fill="var(--pay-debt-min)" />
      <circle cx="28" cy="5" r="3.5" fill="var(--pay-debt-extra)" />
      <circle cx="40" cy="5" r="3.5" fill="var(--pay-goal)" />
    </svg>
  );
}

// 5-dot swatch showing a sample of the 14 sub-category hues
function SubCatSwatch() {
  return (
    <svg width="52" height="10" viewBox="0 0 52 10" aria-hidden="true">
      <circle cx="4"  cy="5" r="3.5" fill="var(--sub-food)" />
      <circle cx="16" cy="5" r="3.5" fill="var(--sub-shopping)" />
      <circle cx="28" cy="5" r="3.5" fill="var(--sub-bars)" />
      <circle cx="40" cy="5" r="3.5" fill="var(--sub-streaming)" />
      <circle cx="52" cy="5" r="3.5" fill="var(--sub-weed)" />
    </svg>
  );
}
