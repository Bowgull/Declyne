import { Link } from 'react-router-dom';

// Sample categories pulled from the brand palette so the comparison is honest.
const SAMPLES = [
  { label: 'TIM HORTONS', amount: '$48.20', color: '#c97a4a', velocity: '▲ 24%' },
  { label: 'LCBO',        amount: '$112.00', color: '#9c5050', velocity: '→' },
  { label: 'TOKYO SMOKE', amount: '$67.50', color: '#7a8a5e', velocity: '▼ 12%' },
  { label: 'PRESTO',      amount: '$32.00', color: '#7a8595', velocity: '→' },
];

type VariantProps = { color: string; cx: number; cy: number; r: number; id: string };

// F0 — Original F. Center-bright ombré + faint white grain. Reference.
function VariantF0({ color, cx, cy, r, id }: VariantProps) {
  return (
    <g>
      <defs>
        <radialGradient id={`f0-${id}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor={color} stopOpacity={1} />
          <stop offset="55%"  stopColor={color} stopOpacity={0.95} />
          <stop offset="100%" stopColor="#0a070c" stopOpacity={0.85} />
        </radialGradient>
        <filter id={`f0-grain-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed={id.charCodeAt(0) + 9} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#f0-${id})`} stroke="#0e0a10" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={r} filter={`url(#f0-grain-${id})`} fill="#ffffff" />
    </g>
  );
}

// F1 — Color halo. Bubble bleeds its own color outward — "lit from within" reads physically.
// Soft Gaussian blur of the fill color sits behind, no harsh black ring.
function VariantF1({ color, cx, cy, r, id }: VariantProps) {
  return (
    <g>
      <defs>
        <radialGradient id={`f1-${id}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor={color} stopOpacity={1} />
          <stop offset="55%"  stopColor={color} stopOpacity={0.95} />
          <stop offset="100%" stopColor="#0a070c" stopOpacity={0.78} />
        </radialGradient>
        <filter id={`f1-halo-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={r * 0.32} />
        </filter>
        <filter id={`f1-grain-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed={id.charCodeAt(0) + 11} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      {/* Outer color halo */}
      <circle cx={cx} cy={cy} r={r * 1.05} fill={color} opacity={0.32} filter={`url(#f1-halo-${id})`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#f1-${id})`} />
      <circle cx={cx} cy={cy} r={r} filter={`url(#f1-grain-${id})`} fill="#ffffff" />
    </g>
  );
}

// F2 — Cream specular. Paper-cream micro-highlight at top-left instead of white. Brand-tied.
// Halo + warm specular + paper grain.
function VariantF2({ color, cx, cy, r, id }: VariantProps) {
  return (
    <g>
      <defs>
        <radialGradient id={`f2-core-${id}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor={color} stopOpacity={1} />
          <stop offset="55%"  stopColor={color} stopOpacity={0.94} />
          <stop offset="100%" stopColor="#0a070c" stopOpacity={0.82} />
        </radialGradient>
        <radialGradient id={`f2-spec-${id}`} cx="38%" cy="36%" r="40%">
          <stop offset="0%"   stopColor="#f2ece0" stopOpacity={0.55} />
          <stop offset="60%"  stopColor="#f2ece0" stopOpacity={0.08} />
          <stop offset="100%" stopColor="#f2ece0" stopOpacity={0} />
        </radialGradient>
        <filter id={`f2-halo-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={r * 0.28} />
        </filter>
        <filter id={`f2-grain-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed={id.charCodeAt(0) + 13} />
          <feColorMatrix values="0 0 0 0 0.95  0 0 0 0 0.92  0 0 0 0 0.88  0 0 0 0.07 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r * 1.05} fill={color} opacity={0.28} filter={`url(#f2-halo-${id})`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#f2-core-${id})`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#f2-spec-${id})`} />
      <circle cx={cx} cy={cy} r={r} filter={`url(#f2-grain-${id})`} fill="#f2ece0" />
    </g>
  );
}

// F3 — Wax-seal hybrid. F2 + a thin inner rim that picks up the color, like a pressed token.
// The rim is what sells "this is a coin/seal, not a sticker."
function VariantF3({ color, cx, cy, r, id }: VariantProps) {
  return (
    <g>
      <defs>
        <radialGradient id={`f3-core-${id}`} cx="50%" cy="50%" r="62%">
          <stop offset="0%"   stopColor={color} stopOpacity={1} />
          <stop offset="50%"  stopColor={color} stopOpacity={0.96} />
          <stop offset="88%"  stopColor={color} stopOpacity={0.7} />
          <stop offset="100%" stopColor="#0a070c" stopOpacity={0.85} />
        </radialGradient>
        <radialGradient id={`f3-spec-${id}`} cx="38%" cy="34%" r="38%">
          <stop offset="0%"   stopColor="#f2ece0" stopOpacity={0.5} />
          <stop offset="55%"  stopColor="#f2ece0" stopOpacity={0.08} />
          <stop offset="100%" stopColor="#f2ece0" stopOpacity={0} />
        </radialGradient>
        <filter id={`f3-halo-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={r * 0.30} />
        </filter>
        <filter id={`f3-grain-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed={id.charCodeAt(0) + 17} />
          <feColorMatrix values="0 0 0 0 0.95  0 0 0 0 0.92  0 0 0 0 0.88  0 0 0 0.06 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <circle cx={cx} cy={cy} r={r * 1.06} fill={color} opacity={0.30} filter={`url(#f3-halo-${id})`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#f3-core-${id})`} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#f3-spec-${id})`} />
      <circle cx={cx} cy={cy} r={r} filter={`url(#f3-grain-${id})`} fill="#f2ece0" />
      {/* Pressed-token inner rim, very thin, color-tinted */}
      <circle cx={cx} cy={cy} r={r - 1.25} fill="none" stroke={color} strokeWidth={0.8} opacity={0.5} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0e0a10" strokeWidth={0.8} opacity={0.55} />
    </g>
  );
}

// F4 — Full stack. F3 + drop shadow on the desk + tiny bottom-edge highlight (catchlight).
// This is the "we have more power than this" version. All polish layered honestly.
function VariantF4({ color, cx, cy, r, id }: VariantProps) {
  return (
    <g>
      <defs>
        <radialGradient id={`f4-core-${id}`} cx="50%" cy="50%" r="62%">
          <stop offset="0%"   stopColor={color} stopOpacity={1} />
          <stop offset="50%"  stopColor={color} stopOpacity={0.96} />
          <stop offset="88%"  stopColor={color} stopOpacity={0.72} />
          <stop offset="100%" stopColor="#0a070c" stopOpacity={0.88} />
        </radialGradient>
        <radialGradient id={`f4-spec-${id}`} cx="36%" cy="32%" r="42%">
          <stop offset="0%"   stopColor="#f2ece0" stopOpacity={0.55} />
          <stop offset="55%"  stopColor="#f2ece0" stopOpacity={0.10} />
          <stop offset="100%" stopColor="#f2ece0" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`f4-glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <filter id={`f4-shadow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={r * 0.18} />
        </filter>
        <filter id={`f4-halo-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={r * 0.34} />
        </filter>
        <filter id={`f4-grain-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.05" numOctaves="2" seed={id.charCodeAt(0) + 23} />
          <feColorMatrix values="0 0 0 0 0.95  0 0 0 0 0.92  0 0 0 0 0.88  0 0 0 0.07 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      {/* Cast shadow — sits on the desk, slightly below */}
      <ellipse cx={cx} cy={cy + r * 0.92} rx={r * 0.85} ry={r * 0.18}
               fill="#000" opacity={0.45} filter={`url(#f4-shadow-${id})`} />
      {/* Color halo */}
      <circle cx={cx} cy={cy} r={r * 1.08} fill={`url(#f4-glow-${id})`} filter={`url(#f4-halo-${id})`} />
      {/* Core ombré */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#f4-core-${id})`} />
      {/* Cream specular */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#f4-spec-${id})`} />
      {/* Paper grain — clipped to circle */}
      <circle cx={cx} cy={cy} r={r} filter={`url(#f4-grain-${id})`} fill="#f2ece0" />
      {/* Pressed-token inner color rim */}
      <circle cx={cx} cy={cy} r={r - 1.25} fill="none" stroke={color} strokeWidth={0.8} opacity={0.55} />
      {/* Outer ink hairline */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0e0a10" strokeWidth={0.8} opacity={0.6} />
      {/* Bottom catchlight — narrow arc that hints at light bouncing back from the desk */}
      <path d={`M ${cx - r * 0.55} ${cy + r * 0.65} Q ${cx} ${cy + r * 0.95} ${cx + r * 0.55} ${cy + r * 0.65}`}
            fill="none" stroke={color} strokeWidth={1} opacity={0.35} strokeLinecap="round" />
    </g>
  );
}

const VARIANTS = [
  { key: 'F0', name: 'F0 · Original',         desc: 'Where you said yes.',                              Comp: VariantF0 },
  { key: 'F1', name: 'F1 · Color halo',        desc: 'Bubble bleeds its own color outward.',             Comp: VariantF1 },
  { key: 'F2', name: 'F2 · Cream specular',    desc: 'Paper-cream highlight, not white. Brand-tied.',    Comp: VariantF2 },
  { key: 'F3', name: 'F3 · Pressed token',     desc: 'F2 + thin color rim. Reads as struck coin.',       Comp: VariantF3 },
  { key: 'F4', name: 'F4 · Full stack',        desc: 'Halo + ombré + cream spec + grain + rim + cast shadow + bottom catchlight.', Comp: VariantF4 },
];

export default function BubbleStylesMockup() {
  const W = 360;
  const ROW_H = 220;
  return (
    <div className="ledger-page" style={{ paddingBottom: 80 }}>
      <header style={{ marginBottom: 16, padding: '0 18px' }}>
        <div className="kicker" style={{ marginBottom: 4 }}>§ MOCKUP</div>
        <h1 className="display" style={{ fontSize: 28, margin: 0 }}>F refined</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 4 }}>
          Push the center-bright ombré with brand-aligned polish. Five layered builds.
        </p>
        <Link to="/books" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>← books</Link>
      </header>

      {VARIANTS.map(({ key, name, desc, Comp }) => (
        <section key={key} className="ledger-section" style={{ marginBottom: 28 }}>
          <div className="ledger-section-kicker">{name}</div>
          <div className="ledger-section-meta" style={{ color: 'var(--color-text-muted)', fontSize: 10, maxWidth: 220, textAlign: 'right' }}>
            {desc}
          </div>
          <svg width={W} height={ROW_H} viewBox={`0 0 ${W} ${ROW_H}`} style={{ display: 'block', margin: '12px auto 0' }}>
            {SAMPLES.map((s, i) => {
              const cx = 48 + i * 88;
              const cy = ROW_H / 2 - 16;
              const r = [36, 30, 26, 22][i] ?? 24;
              return (
                <g key={`${key}-${i}`}>
                  <Comp color={s.color} cx={cx} cy={cy} r={r} id={`${key}${i}`} />
                  <text x={cx} y={cy + r + 22} textAnchor="middle"
                        fontFamily="ui-monospace, Menlo" fontSize="9" letterSpacing="0.04em"
                        fill="rgba(255,255,255,0.85)">
                    {s.label}
                  </text>
                  <text x={cx} y={cy + r + 34} textAnchor="middle"
                        fontFamily="ui-monospace, Menlo" fontSize="9"
                        fill="rgba(255,255,255,0.45)">
                    {s.amount}
                  </text>
                  <text x={cx} y={cy + r + 46} textAnchor="middle"
                        fontFamily="ui-monospace, Menlo" fontSize="9"
                        fill="rgba(255,255,255,0.55)">
                    {s.velocity}
                  </text>
                </g>
              );
            })}
          </svg>
        </section>
      ))}

      <section className="ledger-section" style={{ marginTop: 32 }}>
        <div className="ledger-section-kicker">Layer guide</div>
        <ul style={{ color: 'var(--color-text-muted)', fontSize: 11, lineHeight: 1.7, paddingLeft: 18 }}>
          <li><b>Halo</b> — bubble's own color, blurred. Lifts off the desk without a black ring.</li>
          <li><b>Ombré core</b> — center-bright, edge-dark. Multi-stop so the falloff isn't linear.</li>
          <li><b>Cream specular</b> — paper-color (#f2ece0) highlight at upper-left, not white. Ties to receipt paper.</li>
          <li><b>Paper grain</b> — feTurbulence with cream tint at 6–7% alpha, clipped inside the circle.</li>
          <li><b>Inner rim</b> — 0.8px stroke in the bubble's own color. Reads as a pressed token edge.</li>
          <li><b>Cast shadow</b> — soft ellipse below the bubble. Sits on the ledger desk.</li>
          <li><b>Bottom catchlight</b> — narrow arc in fill color. Hints at light bouncing back up.</li>
        </ul>
      </section>
    </div>
  );
}
