import type * as React from 'react';

// Same data, same asymmetric positions as before
const W = 360;
const H = 300;

const NODES = [
  { id: 'free',    label: 'FREE THIS PAY', amount: '$506',   color: '#f2ece0', text: '#1a141d', muted: '#6b6470', x: 176, y: 148, r: 46 },
  { id: 'bills',   label: 'BILLS',         amount: '$1,200', color: '#7a8595', text: '#e8e4ec', muted: null,      x: 65,  y: 82,  r: 30 },
  { id: 'visa',    label: 'TD VISA',       amount: '$800',   color: '#c8a96a', text: '#1a141d', muted: null,      x: 294, y: 70,  r: 24 },
  { id: 'rogers',  label: 'ROGERS',        amount: '$180',   color: '#7a8595', text: '#e8e4ec', muted: null,      x: 80,  y: 220, r: 15 },
  { id: 'savings', label: 'SAVINGS',       amount: '$400',   color: '#94a888', text: '#1a141d', muted: null,      x: 278, y: 210, r: 20 },
];

const EDGES: [string, string][] = [
  ['free', 'bills'],
  ['free', 'visa'],
  ['free', 'savings'],
  ['bills', 'rogers'],
];

function nodeAt(id: string) {
  return NODES.find(n => n.id === id)!;
}

function shadowFor(id: string) {
  if (id === 'free') {
    return [
      '0 1px 3px rgba(0,0,0,0.25)',
      '0 6px 20px rgba(0,0,0,0.45)',
      '0 20px 56px rgba(0,0,0,0.3)',
      'inset 0 1px 0 rgba(255,255,255,0.75)',
      'inset 0 -1px 0 rgba(0,0,0,0.08)',
    ].join(', ');
  }
  return [
    '0 1px 2px rgba(0,0,0,0.35)',
    '0 4px 14px rgba(0,0,0,0.45)',
    '0 12px 32px rgba(0,0,0,0.25)',
    'inset 0 1px 0 rgba(255,255,255,0.18)',
    'inset 0 -1px 0 rgba(0,0,0,0.2)',
  ].join(', ');
}

export function ConstellationMockup() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0d0a10',
      padding: '28px 16px 64px',
      fontFamily: "'Geist Mono', monospace",
    }}>

      {/* header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(232,228,236,0.28)', marginBottom: 5 }}>
          BOOKS · MONEY MAP
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: '#e8e4ec', fontWeight: 600 }}>
          Material bubbles
        </div>
        <div style={{ fontSize: 9, color: 'rgba(232,228,236,0.25)', marginTop: 5, letterSpacing: '0.07em', lineHeight: 1.7 }}>
          CSS div bubbles · box-shadow elevation stack<br />
          same vocabulary as ledger cards and receipts
        </div>
      </div>

      {/* visualization container */}
      <div style={{
        position: 'relative',
        width: W,
        height: H,
        background: '#15111b',
        borderRadius: 6,
        border: '1px solid rgba(232,228,236,0.05)',
      }}>

        {/* thread / perforation layer — SVG behind everything */}
        <svg
          width={W} height={H}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
        >
          {EDGES.map(([a, b]) => {
            const na = nodeAt(a); const nb = nodeAt(b);
            // shorten line to bubble edges
            const dx = nb.x - na.x; const dy = nb.y - na.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / dist; const uy = dy / dist;
            return (
              <line key={`${a}-${b}`}
                x1={na.x + ux * na.r} y1={na.y + uy * na.r}
                x2={nb.x - ux * nb.r} y2={nb.y - uy * nb.r}
                stroke="rgba(232,228,236,0.09)"
                strokeWidth={0.75}
                strokeDasharray="3 6"
              />
            );
          })}
        </svg>

        {/* bubble layer */}
        {NODES.map(n => (
          <div
            key={n.id}
            style={{
              position: 'absolute',
              left: n.x - n.r,
              top: n.y - n.r,
              width: n.r * 2,
              height: n.r * 2,
              borderRadius: '50%',
              background: n.color,
              boxShadow: shadowFor(n.id),
              zIndex: n.id === 'free' ? 3 : 2,
              // subtle directional shading — not 3D sphere, just material
              backgroundImage: `radial-gradient(
                ellipse at 38% 32%,
                rgba(255,255,255,0.07) 0%,
                transparent 65%
              )`,
              backgroundBlendMode: 'overlay',
            }}
          >
            {/* inner content — only FREE has text inside */}
            {n.id === 'free' && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}>
                <span style={{
                  fontSize: 7.5,
                  fontFamily: "'Geist Mono', monospace",
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: n.muted ?? '#6b6470',
                }}>
                  {n.label}
                </span>
                <span style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 22,
                  fontWeight: 600,
                  color: n.text,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}>
                  {n.amount}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* label layer — satellite labels float below each bubble */}
        {NODES.filter(n => n.id !== 'free').map(n => (
          <div
            key={`lbl-${n.id}`}
            style={{
              position: 'absolute',
              left: n.x - 52,
              top: n.y + n.r + 7,
              width: 104,
              textAlign: 'center',
              zIndex: 4,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              fontSize: 8,
              letterSpacing: '0.1em',
              color: 'rgba(232,228,236,0.58)',
              textTransform: 'uppercase',
            }}>
              {n.label}
            </div>
            <div style={{
              fontSize: 8,
              color: 'rgba(232,228,236,0.3)',
              marginTop: 2,
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
            }}>
              {n.amount}
            </div>
          </div>
        ))}
      </div>

      {/* annotation */}
      <div style={{
        marginTop: 20,
        fontSize: 8.5,
        color: 'rgba(232,228,236,0.25)',
        letterSpacing: '0.07em',
        lineHeight: 1.8,
      }}>
        · free bubble = round receipt · cream paper · floating above surface<br />
        · satellites = round ledger cards · category color · same shadow stack<br />
        · threads = dashed perforation lines · shortened to bubble edges<br />
        · shading = radial 38%/32% ambient light · not sphere gloss
      </div>

      <div style={{
        marginTop: 32,
        borderTop: '1px solid rgba(232,228,236,0.06)',
        paddingTop: 16,
        fontSize: 9,
        color: 'rgba(232,228,236,0.2)',
        letterSpacing: '0.1em',
        textAlign: 'center',
      }}>
        ** mockup only · no live data **
      </div>
    </div>
  );
}
