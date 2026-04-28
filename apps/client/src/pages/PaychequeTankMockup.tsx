import { Link } from 'react-router-dom';

const SPENDING_BUDGET = 217361;
const DAY = 4;
const TOTAL_DAYS = 14;
const EXPECTED = Math.round(SPENDING_BUDGET * (DAY / TOTAL_DAYS));
const ACTUAL = 75320;
const VARIANCE = EXPECTED - ACTUAL;
const PCT_USED = ACTUAL / SPENDING_BUDGET;
const PCT_EXPECTED = DAY / TOTAL_DAYS;

function fmt(c: number) {
  const s = c < 0 ? '-' : '';
  const a = Math.abs(c);
  return `${s}$${(a / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaychequeTankMockup() {
  return (
    <main className="ledger-page">
      <header style={{ marginBottom: 20 }}>
        <Link to="/paycheque" className="stamp stamp-square" style={{ marginBottom: 12 }}>
          BACK
        </Link>
        <h1 className="display" style={{ fontSize: 30, lineHeight: 1.1, margin: 0 }}>
          Paycheque hero · mockups
        </h1>
        <p
          className="ink-muted"
          style={{
            marginTop: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          Day {DAY} of {TOTAL_DAYS} · expected {fmt(EXPECTED)} · actual {fmt(ACTUAL)} · {fmt(-VARIANCE)} behind
        </p>
      </header>

      <Variant kicker="01" title="Brass balance scale" sub="Bookkeeping is balance. The beam tilts live as you spend.">
        <BrassScale />
      </Variant>

      <Variant kicker="02" title="Adding-machine tape" sub="Continuous mechanical tape. Each transaction prints. Lever shows pace.">
        <AddingTape />
      </Variant>

      <Variant kicker="03" title="Brass pressure dial" sub="Two needles · expected vs actual · red zone past plan.">
        <BrassDial />
      </Variant>
    </main>
  );
}

function Variant({
  kicker,
  title,
  sub,
  children,
}: {
  kicker: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 64 }}>
      <div className="ledger-section" style={{ marginBottom: 14 }}>
        <span className="ledger-section-kicker">
          <span className="num">§{kicker}</span> {title}
        </span>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.06em',
          marginTop: 0,
          marginBottom: 16,
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        {sub}
      </p>
      {children}
    </section>
  );
}

/* ---------------- 01 · Brass balance scale ---------------- */

function BrassScale() {
  // negative tilt = spent pan dips down (behind plan)
  // positive tilt = plan pan dips down (ahead of plan)
  // negative variance = spent more than plan = spent pan drops (positive rotation)
  const tiltDeg = Math.max(-12, Math.min(12, ((ACTUAL - EXPECTED) / SPENDING_BUDGET) * 80));
  const behind = VARIANCE < 0;

  const beamLength = 280;
  const fulcrumX = 160;
  const fulcrumY = 90;
  const beamLeft = { x: fulcrumX - beamLength / 2, y: fulcrumY };
  const beamRight = { x: fulcrumX + beamLength / 2, y: fulcrumY };
  const tiltRad = (tiltDeg * Math.PI) / 180;
  const lY = fulcrumY + Math.sin(tiltRad) * (beamLength / 2);
  const rY = fulcrumY - Math.sin(tiltRad) * (beamLength / 2);
  const lX = fulcrumX - Math.cos(tiltRad) * (beamLength / 2);
  const rX = fulcrumX + Math.cos(tiltRad) * (beamLength / 2);

  return (
    <div
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(212,169,88,0.08) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
        borderRadius: 4,
        padding: '24px 0 18px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg viewBox="0 0 320 260" width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="brass" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e8c878" />
            <stop offset="50%" stopColor="#c89a4f" />
            <stop offset="100%" stopColor="#7a5826" />
          </linearGradient>
          <linearGradient id="brass-bar" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f0d088" />
            <stop offset="50%" stopColor="#c89a4f" />
            <stop offset="100%" stopColor="#6a4c20" />
          </linearGradient>
          <radialGradient id="pan-spent" cx="50%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#e8c878" />
            <stop offset="60%" stopColor="#a8803a" />
            <stop offset="100%" stopColor="#3a2810" />
          </radialGradient>
          <radialGradient id="pan-plan" cx="50%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#e8c878" />
            <stop offset="60%" stopColor="#a8803a" />
            <stop offset="100%" stopColor="#3a2810" />
          </radialGradient>
          <linearGradient id="indulgence-glow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c97a4a" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#c97a4a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* base / pedestal */}
        <ellipse cx={fulcrumX} cy={234} rx="80" ry="6" fill="#000" opacity="0.6" />
        <rect x={fulcrumX - 36} y={210} width="72" height="20" rx="2" fill="url(#brass)" />
        <rect x={fulcrumX - 28} y={208} width="56" height="3" fill="#3a2810" />
        <rect x={fulcrumX - 6} y={fulcrumY + 8} width="12" height="204" fill="url(#brass)" />
        <rect x={fulcrumX - 6} y={fulcrumY + 8} width="3" height="204" fill="#f0d088" opacity="0.55" />

        {/* fulcrum knob */}
        <circle cx={fulcrumX} cy={fulcrumY + 8} r="9" fill="url(#brass)" />
        <circle cx={fulcrumX} cy={fulcrumY + 8} r="3" fill="#3a2810" />

        {/* center indicator post */}
        <line x1={fulcrumX} y1={fulcrumY + 10} x2={fulcrumX} y2={fulcrumY - 30} stroke="#3a2810" strokeWidth="1" />
        <polygon
          points={`${fulcrumX - 4},${fulcrumY - 30} ${fulcrumX + 4},${fulcrumY - 30} ${fulcrumX},${fulcrumY - 38}`}
          fill="#9e78b9"
        />

        {/* beam */}
        <g style={{ transformOrigin: `${fulcrumX}px ${fulcrumY}px`, transform: `rotate(${tiltDeg}deg)`, transition: 'transform 800ms cubic-bezier(0.34, 1.2, 0.64, 1)' }}>
          <rect x={beamLeft.x} y={fulcrumY - 4} width={beamLength} height="8" rx="1" fill="url(#brass-bar)" />
          <rect x={beamLeft.x} y={fulcrumY - 4} width={beamLength} height="2" fill="#f0d088" opacity="0.7" />
          <circle cx={beamLeft.x + 4} cy={fulcrumY} r="3" fill="#3a2810" />
          <circle cx={beamRight.x - 4} cy={fulcrumY} r="3" fill="#3a2810" />
        </g>

        {/* left chains + spent pan */}
        <line x1={lX} y1={lY} x2={lX - 4} y2={lY + 50} stroke="#8a6c3a" strokeWidth="0.8" />
        <line x1={lX} y1={lY} x2={lX + 4} y2={lY + 50} stroke="#8a6c3a" strokeWidth="0.8" />
        <ellipse cx={lX} cy={lY + 56} rx="48" ry="6" fill="#3a2810" />
        <ellipse cx={lX} cy={lY + 54} rx="48" ry="6" fill="url(#pan-spent)" />
        <path d={`M ${lX - 48},${lY + 54} Q ${lX},${lY + 80} ${lX + 48},${lY + 54}`} fill="url(#pan-spent)" stroke="#3a2810" strokeWidth="0.6" />

        {/* coin pile on spent pan — colored by category */}
        <g transform={`translate(${lX} ${lY + 54})`}>
          <ellipse cx="-22" cy="-2" rx="6" ry="2" fill="#7a8595" stroke="#3a2810" strokeWidth="0.4" />
          <ellipse cx="-10" cy="-4" rx="6" ry="2" fill="#7a8595" stroke="#3a2810" strokeWidth="0.4" />
          <ellipse cx="2" cy="-6" rx="6" ry="2" fill="#c8a96a" stroke="#3a2810" strokeWidth="0.4" />
          <ellipse cx="14" cy="-4" rx="6" ry="2" fill="#b88e7a" stroke="#3a2810" strokeWidth="0.4" />
          <ellipse cx="-16" cy="-9" rx="6" ry="2" fill="#c97a4a" stroke="#3a2810" strokeWidth="0.4" />
          <ellipse cx="-4" cy="-11" rx="6" ry="2" fill="#c97a4a" stroke="#3a2810" strokeWidth="0.4" />
          <ellipse cx="8" cy="-13" rx="6" ry="2" fill="#c97a4a" stroke="#3a2810" strokeWidth="0.4" />
          <ellipse cx="-8" cy="-17" rx="6" ry="2" fill="#94a888" stroke="#3a2810" strokeWidth="0.4" />
        </g>

        {/* indulgence glow on the heavy side */}
        {behind && (
          <ellipse cx={lX} cy={lY + 54} rx="56" ry="14" fill="url(#indulgence-glow)" opacity="0.7" />
        )}

        {/* right chains + plan pan */}
        <line x1={rX} y1={rY} x2={rX - 4} y2={rY + 50} stroke="#8a6c3a" strokeWidth="0.8" />
        <line x1={rX} y1={rY} x2={rX + 4} y2={rY + 50} stroke="#8a6c3a" strokeWidth="0.8" />
        <ellipse cx={rX} cy={rY + 56} rx="48" ry="6" fill="#3a2810" />
        <ellipse cx={rX} cy={rY + 54} rx="48" ry="6" fill="url(#pan-plan)" />
        <path d={`M ${rX - 48},${rY + 54} Q ${rX},${rY + 80} ${rX + 48},${rY + 54}`} fill="url(#pan-plan)" stroke="#3a2810" strokeWidth="0.6" />

        {/* stamped weight cylinder on plan pan */}
        <g transform={`translate(${rX} ${rY + 54})`}>
          <ellipse cx="0" cy="-22" rx="20" ry="4" fill="#3a2810" />
          <rect x="-20" y="-22" width="40" height="22" fill="url(#brass)" />
          <ellipse cx="0" cy="0" rx="20" ry="4" fill="#7a5826" />
          <ellipse cx="0" cy="-22" rx="20" ry="4" fill="#e8c878" />
          <text x="0" y="-9" textAnchor="middle" fill="#3a2810" fontSize="8" fontFamily="ui-monospace, Menlo" letterSpacing="1">
            PLAN
          </text>
          <text x="0" y="-1" textAnchor="middle" fill="#3a2810" fontSize="6" fontFamily="ui-monospace, Menlo">
            {fmt(EXPECTED).replace('$', '$ ')}
          </text>
        </g>

        {/* tick scale at top */}
        <g>
          <line x1={fulcrumX - 60} y1={fulcrumY - 50} x2={fulcrumX + 60} y2={fulcrumY - 50} stroke="#5a4830" strokeWidth="0.6" />
          {[-60, -40, -20, 0, 20, 40, 60].map((t) => (
            <line key={t} x1={fulcrumX + t} y1={fulcrumY - 50} x2={fulcrumX + t} y2={fulcrumY - (t === 0 ? 56 : 53)} stroke={t === 0 ? '#9e78b9' : '#5a4830'} strokeWidth={t === 0 ? 1 : 0.5} />
          ))}
        </g>
      </svg>

      {/* readout */}
      <div
        style={{
          padding: '10px 24px 6px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          Day {DAY} · {TOTAL_DAYS - DAY}d left
        </div>
        <div
          className="hero-num"
          style={{
            color: behind ? 'var(--cat-indulgence)' : 'var(--cat-savings)',
            marginTop: 4,
          }}
        >
          {behind ? fmt(-VARIANCE) : fmt(VARIANCE)}
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)',
            marginTop: 2,
          }}
        >
          {behind ? 'behind plan' : 'ahead of plan'}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 02 · Adding-machine tape ---------------- */

function AddingTape() {
  const events = [
    { t: '08:14', m: 'Tim Hortons',     a: -842,   g: 'lifestyle' },
    { t: '08:42', m: 'TTC presto',      a: -340,   g: 'essentials' },
    { t: '12:03', m: 'Loblaws',         a: -4715,  g: 'essentials' },
    { t: '14:22', m: 'Indigo',          a: -2899,  g: 'lifestyle' },
    { t: '17:50', m: 'Pizzeria Libretto', a: -3420, g: 'indulgence' },
    { t: '19:08', m: 'LCBO',            a: -2384,  g: 'indulgence' },
    { t: '21:11', m: 'Uber',            a: -1830,  g: 'lifestyle' },
  ];
  const behind = VARIANCE < 0;
  const leverPct = Math.min(1, Math.max(0, PCT_USED));

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #0e0a10 0%, #1a141d 60%, #0e0a10 100%)',
        borderRadius: 4,
        padding: '24px 18px 28px',
        position: 'relative',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 16px 32px -16px rgba(0,0,0,0.7)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 16 }}>
        {/* lever column */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(180deg, #2a2228 0%, #16101a 100%)',
            borderRadius: 4,
            padding: '12px 8px',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
            }}
          >
            PACE
          </div>
          {/* track */}
          <div
            style={{
              position: 'relative',
              width: 4,
              margin: '12px auto',
              height: 280,
              background: 'linear-gradient(180deg, #94a888 0%, #c8a96a 50%, #c97a4a 100%)',
              borderRadius: 2,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4)',
            }}
          >
            {/* expected tick */}
            <div
              style={{
                position: 'absolute',
                left: -10,
                right: -10,
                top: `${PCT_EXPECTED * 100}%`,
                height: 1,
                background: 'rgba(255,255,255,0.5)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: -16,
                top: `calc(${PCT_EXPECTED * 100}% - 5px)`,
                fontFamily: 'var(--font-mono)',
                fontSize: 7,
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              ◀
            </div>
            {/* actual lever knob */}
            <div
              style={{
                position: 'absolute',
                left: -12,
                top: `calc(${leverPct * 100}% - 8px)`,
                width: 28,
                height: 16,
                background: 'linear-gradient(180deg, #e8c878 0%, #c89a4f 60%, #6a4c20 100%)',
                border: '1px solid #3a2810',
                borderRadius: 3,
                boxShadow: '0 2px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4)',
              }}
            />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              letterSpacing: '0.18em',
              color: behind ? 'var(--cat-indulgence)' : 'var(--cat-savings)',
              textAlign: 'center',
            }}
          >
            {behind ? 'HOT' : 'COOL'}
          </div>
        </div>

        {/* tape */}
        <div style={{ position: 'relative' }}>
          {/* top spool curl */}
          <div
            style={{
              height: 14,
              background:
                'radial-gradient(ellipse at 50% 100%, #d8cfb8 0%, #b6ad95 60%, #8a8170 100%)',
              borderRadius: '6px 6px 0 0',
              boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.3)',
            }}
          />
          <div
            style={{
              background: '#f0e8d4',
              backgroundImage:
                'repeating-linear-gradient(180deg, transparent 0, transparent 23px, rgba(0,0,0,0.04) 23px, rgba(0,0,0,0.04) 24px)',
              padding: '12px 14px 18px',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 11,
              color: '#1a141d',
              letterSpacing: '-0.02em',
              boxShadow: 'inset 0 8px 8px -8px rgba(0,0,0,0.4)',
              minHeight: 280,
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #1a141d', paddingBottom: 6, marginBottom: 8 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase' }}>
                DAY {DAY} · WK 18
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(ACTUAL)}</div>
              <div style={{ fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.6 }}>
                of {fmt(SPENDING_BUDGET)}
              </div>
            </div>
            {events.map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '38px 10px 1fr auto',
                  columnGap: 6,
                  alignItems: 'baseline',
                  padding: '2px 0',
                }}
              >
                <span style={{ opacity: 0.6 }}>{e.t}</span>
                <span className={`cat-dot ${e.g}`} style={{ marginTop: 5 }} />
                <span>{e.m}</span>
                <span>{fmt(e.a)}</span>
              </div>
            ))}
            <div
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: '2px solid #1a141d',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                vs plan
              </span>
              <span style={{ color: behind ? '#c97a4a' : '#5a7a4a', fontWeight: 600 }}>
                {fmt(-VARIANCE)} {behind ? 'over' : 'under'}
              </span>
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 9,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                opacity: 0.5,
                textAlign: 'center',
              }}
            >
              ▼ still printing ▼
            </div>
          </div>
          {/* bottom torn edge */}
          <div
            style={{
              height: 8,
              background:
                'radial-gradient(circle at 5px 0, #0e0a10 4px, transparent 4.5px)',
              backgroundSize: '10px 8px',
              transform: 'scaleY(-1)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- 03 · Brass pressure dial ---------------- */

function BrassDial() {
  // sweep -135° (left) to +135° (right). 0 = bottom rotated to top.
  const angleFor = (pct: number) => -135 + Math.min(1.1, Math.max(0, pct)) * 270;
  const expectedAngle = angleFor(PCT_EXPECTED);
  const actualAngle = angleFor(PCT_USED);
  const behind = PCT_USED > PCT_EXPECTED;

  const cx = 160;
  const cy = 160;
  const r = 120;

  return (
    <div
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(212,169,88,0.06) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
        borderRadius: 4,
        padding: '24px 18px 18px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
      }}
    >
      <svg viewBox="0 0 320 320" width="100%" style={{ display: 'block' }}>
        <defs>
          <radialGradient id="bezel" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#f0d088" />
            <stop offset="60%" stopColor="#b08850" />
            <stop offset="100%" stopColor="#3a2810" />
          </radialGradient>
          <radialGradient id="face" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#f5ecd4" />
            <stop offset="100%" stopColor="#d8c89c" />
          </radialGradient>
          <linearGradient id="glass" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="35%" stopColor="#fff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* outer brass bezel */}
        <circle cx={cx} cy={cy} r={r + 18} fill="url(#bezel)" />
        <circle cx={cx} cy={cy} r={r + 14} fill="none" stroke="#3a2810" strokeWidth="1.5" />
        {/* knurled edge ticks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const x1 = cx + Math.cos(a) * (r + 11);
          const y1 = cy + Math.sin(a) * (r + 11);
          const x2 = cx + Math.cos(a) * (r + 17);
          const y2 = cy + Math.sin(a) * (r + 17);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3a2810" strokeWidth="0.8" />;
        })}

        {/* dial face */}
        <circle cx={cx} cy={cy} r={r} fill="url(#face)" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3a2810" strokeWidth="1" />

        {/* arc bands: green / gold / red */}
        {(() => {
          const arc = (pStart: number, pEnd: number, color: string, w: number) => {
            const aS = (angleFor(pStart) * Math.PI) / 180;
            const aE = (angleFor(pEnd) * Math.PI) / 180;
            const r1 = r - 14;
            const x1 = cx + Math.cos(aS - Math.PI / 2) * r1;
            const y1 = cy + Math.sin(aS - Math.PI / 2) * r1;
            const x2 = cx + Math.cos(aE - Math.PI / 2) * r1;
            const y2 = cy + Math.sin(aE - Math.PI / 2) * r1;
            const large = pEnd - pStart > 0.5 ? 1 : 0;
            return (
              <path
                d={`M ${x1} ${y1} A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={w}
                strokeLinecap="butt"
              />
            );
          };
          return (
            <>
              {arc(0, 0.65, '#94a888', 7)}
              {arc(0.65, 1.0, '#c8a96a', 7)}
              {arc(1.0, 1.18, '#c97a4a', 7)}
            </>
          );
        })()}

        {/* major ticks + numerals */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((p) => {
          const a = ((angleFor(p) - 90) * Math.PI) / 180;
          const x1 = cx + Math.cos(a) * (r - 28);
          const y1 = cy + Math.sin(a) * (r - 28);
          const x2 = cx + Math.cos(a) * (r - 4);
          const y2 = cy + Math.sin(a) * (r - 4);
          const tx = cx + Math.cos(a) * (r - 42);
          const ty = cy + Math.sin(a) * (r - 42);
          return (
            <g key={p}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3a2810" strokeWidth="2" />
              <text
                x={tx}
                y={ty + 4}
                textAnchor="middle"
                fontSize="13"
                fontFamily="Fraunces, ui-serif, Georgia"
                fontWeight="600"
                fill="#3a2810"
              >
                {Math.round(p * 100)}
              </text>
            </g>
          );
        })}
        {/* minor ticks */}
        {Array.from({ length: 21 }).map((_, i) => {
          const p = i / 20;
          if ([0, 0.25, 0.5, 0.75, 1.0].includes(p)) return null;
          const a = ((angleFor(p) - 90) * Math.PI) / 180;
          const x1 = cx + Math.cos(a) * (r - 18);
          const y1 = cy + Math.sin(a) * (r - 18);
          const x2 = cx + Math.cos(a) * (r - 6);
          const y2 = cy + Math.sin(a) * (r - 6);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3a2810" strokeWidth="0.8" />;
        })}

        {/* engraved label */}
        <text
          x={cx}
          y={cy - 40}
          textAnchor="middle"
          fontSize="9"
          letterSpacing="3"
          fontFamily="ui-monospace, Menlo"
          fill="#3a2810"
          opacity="0.65"
        >
          PACE · % OF PLAN
        </text>
        <text
          x={cx}
          y={cy + 56}
          textAnchor="middle"
          fontSize="22"
          fontFamily="Fraunces, ui-serif, Georgia"
          fontWeight="600"
          fill={behind ? '#c97a4a' : '#5a7a4a'}
        >
          {Math.round(PCT_USED * 100)}%
        </text>
        <text
          x={cx}
          y={cy + 72}
          textAnchor="middle"
          fontSize="8"
          letterSpacing="2"
          fontFamily="ui-monospace, Menlo"
          fill="#3a2810"
          opacity="0.55"
        >
          DAY {DAY}/{TOTAL_DAYS}
        </text>

        {/* expected (ghost) needle */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${expectedAngle}deg)`,
          }}
        >
          <line x1={cx} y1={cy} x2={cx} y2={cy - (r - 14)} stroke="#3a2810" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
        </g>

        {/* actual needle */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${actualAngle}deg)`,
            transition: 'transform 800ms cubic-bezier(0.34, 1.2, 0.64, 1)',
          }}
        >
          <polygon
            points={`${cx - 4},${cy + 8} ${cx + 4},${cy + 8} ${cx + 1},${cy - (r - 12)} ${cx - 1},${cy - (r - 12)}`}
            fill="#9e78b9"
            stroke="#3a2810"
            strokeWidth="0.8"
          />
        </g>

        {/* center hub */}
        <circle cx={cx} cy={cy} r="14" fill="url(#bezel)" />
        <circle cx={cx} cy={cy} r="14" fill="none" stroke="#3a2810" strokeWidth="0.8" />
        <circle cx={cx} cy={cy} r="5" fill="#3a2810" />

        {/* glass highlight */}
        <ellipse cx={cx - 30} cy={cy - 50} rx="60" ry="40" fill="url(#glass)" opacity="0.6" />
      </svg>

      <div
        style={{
          marginTop: 4,
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: behind ? 'var(--cat-indulgence)' : 'var(--cat-savings)',
          }}
        >
          {behind ? `${fmt(-VARIANCE)} over plan` : `${fmt(VARIANCE)} under plan`}
        </span>
      </div>
    </div>
  );
}
