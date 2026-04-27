// Canonical postage-stamp artwork. Lifted from the session 56-57 mockup
// (`pages/ButtonsMockup.tsx`). All four stamps in production must use these
// exact SVGs so the mockup never drifts from shipped UI.
//
// Stroke is `currentColor` so the parent `.postage-art` span (which sets
// `color: var(--color-accent-purple)`) controls the hue. Do not set fill or
// stroke colors on the SVGs themselves.

const svgProps = {
  viewBox: '0 0 36 36',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function MailArt() {
  return (
    <svg {...svgProps}>
      <rect x="4" y="9" width="28" height="20" rx="1.5" />
      <path d="M5 11l13 10 13-10" />
      <path d="M5 28l9-9" />
      <path d="M31 28l-9-9" />
    </svg>
  );
}

export function SeedArt() {
  return (
    <svg {...svgProps}>
      <path d="M18 30V14" />
      <path d="M18 18c-3-1-5-1-6.5-3.5C12.5 13 15 13 18 15" />
      <path d="M18 18c3-1 5-1 6.5-3.5C23.5 13 21 13 18 15" />
      <path d="M18 24c-3-1-5-1-6.5-3.5C12.5 19 15 19 18 21" />
      <path d="M18 24c3-1 5-1 6.5-3.5C23.5 19 21 19 18 21" />
      <circle cx="18" cy="11" r="2.5" />
    </svg>
  );
}

export function BagArt() {
  return (
    <svg {...svgProps}>
      <path d="M9 13l2-5h14l2 5" />
      <path d="M7 13h22l-2 16H9z" />
      <path d="M14 13v-3a4 4 0 018 0v3" />
    </svg>
  );
}

export function SealArt() {
  return (
    <svg {...svgProps}>
      <circle cx="18" cy="18" r="11" />
      <circle cx="18" cy="18" r="7.5" />
      <path d="M14 18l3 3 5-5" />
    </svg>
  );
}
