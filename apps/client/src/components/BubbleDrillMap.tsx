/**
 * BubbleDrillMap — interactive drill-down bubble graph for Money + Habits.
 *
 * Tap a drillable bubble to descend a level (it becomes the new center).
 * Tap the center bubble or empty space to climb back up.
 * Optional FREE center for the money map (cream paper bubble at root).
 *
 * Data is a hierarchy: each node may have children. A node with children
 * is drillable; a leaf is not.
 */

import { useState, useMemo, useCallback } from 'react';
import type * as React from 'react';

// ── Types (exported) ────────────────────────────────────────────────────────

export interface Velocity {
  dir: 'up' | 'down' | 'flat';
  pct: number;
  /** Color the velocity green when good=true, red when good=false. Direction
   *  meaning is contextual: ↑ on debt extras = good; ↑ on bills = bad. */
  good: boolean;
}

export interface BubbleNode {
  id: string;
  label: string;
  color: string;
  amount_cents: number;
  velocity?: Velocity;
  badge?: 'min' | 'extra';
  children?: BubbleNode[];
}

export interface FreeCenterData {
  amount_cents: number;
  velocity?: Velocity;
  daysToPayday: number;
  /** Title text inside the cream bubble. Defaults to "FREE THIS PAY". */
  label?: string;
}

export interface BubbleDrillMapProps {
  /** Optional cream FREE bubble at the root center (money map only). */
  freeCenter?: FreeCenterData;
  /** Top-level orbit. Each child with `children` is drillable. */
  nodes: BubbleNode[];
  /** Hint shown at the bottom of the root level. */
  rootHint?: string;
  /** Empty-state message when nodes is empty. */
  empty?: string;
}

// ── Canvas ──────────────────────────────────────────────────────────────────

const W = 380;
const H = 540;
const CX = W / 2;
const CY = H / 2;

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(c: number): string {
  if (c >= 100000) return `$${Math.round(c / 100).toLocaleString('en-CA')}`;
  return `$${(c / 100).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function radiusFor(cents: number, max: number, min: number, peak: number): number {
  if (max <= 0) return min;
  return min + Math.sqrt(Math.max(0, cents) / max) * (peak - min);
}

function velColor(v: Velocity): string {
  if (v.dir === 'flat' || v.pct === 0) return 'rgba(255,255,255,0.22)';
  return v.good ? '#7caf8c' : '#c45b5b';
}

function velText(v: Velocity): string {
  if (v.dir === 'flat' || v.pct === 0) return '→';
  const arrow = v.dir === 'up' ? '▲' : '▼';
  return `${arrow} ${v.pct}%`;
}

// ── Layout ──────────────────────────────────────────────────────────────────

interface LaidOutNode {
  src: BubbleNode;
  x: number;
  y: number;
  radius: number;
  drillable: boolean;
}

interface Line { x1: number; y1: number; x2: number; y2: number; color: string }

function relax(nodes: LaidOutNode[], padding = 8, iters = 80): void {
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.radius + b.radius + padding;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < minD) {
          const push = (minD - dist) / 2;
          a.x -= (dx / dist) * push; a.y -= (dy / dist) * push;
          b.x += (dx / dist) * push; b.y += (dy / dist) * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  for (const n of nodes) {
    n.x = Math.max(44 + n.radius, Math.min(W - 44 - n.radius, n.x));
    n.y = Math.max(28 + n.radius, Math.min(H - 50 - n.radius, n.y));
  }
}

interface Scene {
  centerNode: BubbleNode | null;
  centerRadius: number;
  laidOut: LaidOutNode[];
  lines: Line[];
}

function layoutChildren(
  parent: BubbleNode,
  centerRadius: number,
  isMoneyDrill: boolean,
): { laidOut: LaidOutNode[]; lines: Line[] } {
  const kids = [...(parent.children ?? [])].sort((a, b) => b.amount_cents - a.amount_cents);
  if (kids.length === 0) return { laidOut: [], lines: [] };
  const max = kids[0]!.amount_cents || 1;
  const orbitR = kids.length <= 3 ? 165 : kids.length <= 4 ? 180 : 195;
  const minR = isMoneyDrill ? 22 : 22;
  const peakR = isMoneyDrill ? 44 : 48;

  const laidOut: LaidOutNode[] = kids.map((k, i) => {
    const angle = -Math.PI / 2 + (i / kids.length) * Math.PI * 2;
    return {
      src: k,
      x: CX + Math.cos(angle) * orbitR,
      y: CY + Math.sin(angle) * orbitR,
      radius: radiusFor(k.amount_cents, max, minR, peakR),
      drillable: (k.children?.length ?? 0) > 0,
    };
  });
  relax(laidOut, 10, 60);
  void centerRadius;
  const lines = laidOut.map((n) => ({ x1: CX, y1: CY, x2: n.x, y2: n.y, color: n.src.color }));
  return { laidOut, lines };
}

function layoutRoot(nodes: BubbleNode[]): { laidOut: LaidOutNode[]; lines: Line[] } {
  const sorted = [...nodes].sort((a, b) => b.amount_cents - a.amount_cents);
  if (sorted.length === 0) return { laidOut: [], lines: [] };
  const max = sorted[0]!.amount_cents || 1;
  const n = sorted.length;
  const orbitR = n <= 3 ? 175 : n <= 4 ? 185 : 200;

  const laidOut: LaidOutNode[] = sorted.map((cat, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return {
      src: cat,
      x: CX + Math.cos(angle) * orbitR,
      y: CY + Math.sin(angle) * orbitR,
      radius: radiusFor(cat.amount_cents, max, 30, 72),
      drillable: (cat.children?.length ?? 0) > 0,
    };
  });
  relax(laidOut, 14, 80);
  const lines: Line[] = []; // root has no spokes (or center is FREE/no-op)
  return { laidOut, lines };
}

// ── Bubble ──────────────────────────────────────────────────────────────────

function Bubble({
  node, x, y, radius, drillable, onTap,
}: {
  node: BubbleNode;
  x: number; y: number; radius: number;
  drillable: boolean;
  onTap?: () => void;
}) {
  const anchor: 'start' | 'middle' | 'end' =
    x < 80 ? 'start' : x > W - 80 ? 'end' : 'middle';
  const labelX = anchor === 'start' ? x - radius + 4
    : anchor === 'end' ? x + radius - 4 : x;
  const below = y + radius + 46 < H - 20;
  const labelY = below ? y + radius + 14 : y - radius - 42;
  const amtY = labelY + 13;
  const velY = amtY + 12;

  const gradId = `bub-${node.id}`;
  const grainId = `grain-${node.id}`;
  const seed = (node.id.charCodeAt(0) + node.id.length * 7) % 100;

  return (
    <g
      onClick={onTap ? (e) => { (e as unknown as Event).stopPropagation(); onTap(); } : undefined}
      style={onTap ? { cursor: 'pointer' } : undefined}
      data-tap={onTap ? 'true' : undefined}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={node.color} stopOpacity={1} />
          <stop offset="55%" stopColor={node.color} stopOpacity={0.95} />
          <stop offset="100%" stopColor="#0a070c" stopOpacity={0.85} />
        </radialGradient>
        <filter id={grainId} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed={seed} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      {drillable && (
        <circle cx={x} cy={y} r={radius + 7} style={{ fill: node.color }} opacity={0.1} />
      )}
      <circle cx={x} cy={y} r={radius}
        fill={`url(#${gradId})`}
        stroke="#0e0a10" strokeWidth={1}
        filter="url(#bubble-shadow-sm)"
      />
      <circle cx={x} cy={y} r={radius} filter={`url(#${grainId})`} fill="#ffffff" pointerEvents="none" />
      <text x={labelX} y={labelY} textAnchor={anchor}
        fontFamily="ui-monospace, Menlo" fontSize="11" letterSpacing="0.04em"
        fill="rgba(255,255,255,0.92)"
        paintOrder="stroke" stroke="#0a070c" strokeWidth="2.5" strokeLinejoin="round">
        {node.label.length > 13 ? `${node.label.slice(0, 12)}…` : node.label}
      </text>
      <text x={labelX} y={amtY} textAnchor={anchor}
        fontFamily="ui-monospace, Menlo" fontSize="10"
        fill="rgba(255,255,255,0.45)"
        paintOrder="stroke" stroke="#0a070c" strokeWidth="2" strokeLinejoin="round">
        {fmt(node.amount_cents)}
      </text>
      {node.velocity && (
        <text x={labelX} y={velY} textAnchor={anchor}
          fontFamily="ui-monospace, Menlo" fontSize="9.5"
          fill={velColor(node.velocity)}
          paintOrder="stroke" stroke="#0a070c" strokeWidth="1.5" strokeLinejoin="round">
          {velText(node.velocity)}
        </text>
      )}
      {drillable && (
        <text x={x} y={y + 4} textAnchor="middle"
          fontFamily="ui-monospace, Menlo" fontSize="12"
          fill="rgba(255,255,255,0.5)">
          ›
        </text>
      )}
      {node.badge && (
        <text x={x} y={y + 4} textAnchor="middle"
          fontFamily="ui-monospace, Menlo" fontSize="8.5" letterSpacing="0.08em"
          fill={node.badge === 'extra' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)'}>
          {node.badge.toUpperCase()}
        </text>
      )}
    </g>
  );
}

// ── Center bubbles ──────────────────────────────────────────────────────────

function FreeCenterBubble({ data }: { data: FreeCenterData }) {
  const radius = 78;
  const offset = radius * 0.3;
  const overlayR = radius * 0.6;
  return (
    <g style={{ cursor: 'default' }}>
      <circle cx={CX} cy={CY} r={radius + 26} fill="#f2ece0" opacity={0.04} />
      <circle cx={CX} cy={CY} r={radius + 12} fill="#f2ece0" opacity={0.07} />
      <circle cx={CX} cy={CY} r={radius} fill="#f2ece0" opacity={0.95}
        stroke="rgba(240,232,222,0.35)" strokeWidth={1}
        filter="url(#bubble-shadow-lg)" />
      <circle cx={CX + offset} cy={CY + offset} r={overlayR}
        fill="url(#bubble-depth)" opacity={0.18} pointerEvents="none" />
      <circle cx={CX - offset} cy={CY - offset} r={overlayR}
        fill="url(#bubble-shine)" opacity={0.45} pointerEvents="none" />
      <circle cx={CX} cy={CY} r={radius - 0.75}
        fill="none" stroke="rgba(0,0,0,0.10)" strokeWidth={1} pointerEvents="none" />
      <text x={CX} y={CY - 38} textAnchor="middle"
        fontFamily="ui-monospace, Menlo" fontSize="11" letterSpacing="0.18em"
        fill="rgba(26,20,29,0.42)">
        {data.label ?? 'FREE THIS PAY'}
      </text>
      <text x={CX} y={CY - 4} textAnchor="middle"
        fontFamily="var(--font-display, Georgia)" fontSize="38" fontWeight="600"
        fill="#1a141d">
        {fmt(data.amount_cents)}
      </text>
      {data.velocity && (
        <text x={CX} y={CY + 24} textAnchor="middle"
          fontFamily="ui-monospace, Menlo" fontSize="11" letterSpacing="0.08em"
          fill={velColor(data.velocity)}>
          {velText(data.velocity)} VS LAST PAY
        </text>
      )}
      <text x={CX} y={CY + 46} textAnchor="middle"
        fontFamily="ui-monospace, Menlo" fontSize="10" letterSpacing="0.12em"
        fill="rgba(26,20,29,0.32)">
        {`${data.daysToPayday}D TO PAYDAY`}
      </text>
    </g>
  );
}

function HubCenterBubble({
  node, onTap, isMoneyContext,
}: { node: BubbleNode; onTap: () => void; isMoneyContext: boolean }) {
  const radius = isMoneyContext ? 64 : 66;
  const velSuffix = isMoneyContext ? ' VS LAST PAY' : ' 30D';
  const gradId = `hub-bub-${node.id}`;
  const grainId = `hub-grain-${node.id}`;
  const seed = (node.id.charCodeAt(0) + node.id.length * 11) % 100;
  return (
    <g onClick={(e) => { (e as unknown as Event).stopPropagation(); onTap(); }}
      style={{ cursor: 'pointer' }} data-tap="true">
      <defs>
        <radialGradient id={gradId} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={node.color} stopOpacity={1} />
          <stop offset="55%" stopColor={node.color} stopOpacity={0.95} />
          <stop offset="100%" stopColor="#0a070c" stopOpacity={0.85} />
        </radialGradient>
        <filter id={grainId} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed={seed} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <circle cx={CX} cy={CY} r={radius + 14} style={{ fill: node.color }} opacity={0.15} />
      <circle cx={CX} cy={CY} r={radius}
        fill={`url(#${gradId})`} stroke="#0e0a10" strokeWidth={1}
        filter="url(#bubble-shadow-lg)" />
      <circle cx={CX} cy={CY} r={radius} filter={`url(#${grainId})`} fill="#ffffff" pointerEvents="none" />
      <text x={CX} y={CY - 26} textAnchor="middle"
        fontFamily="ui-monospace, Menlo" fontSize="14" letterSpacing="0.06em" fontWeight="600"
        fill="rgba(255,255,255,0.95)"
        paintOrder="stroke" stroke="#0e0a10" strokeWidth="2.5">
        {node.label.toUpperCase()}
      </text>
      <text x={CX} y={CY - 4} textAnchor="middle"
        fontFamily="ui-monospace, Menlo" fontSize="13"
        fill="rgba(255,255,255,0.7)"
        paintOrder="stroke" stroke="#0e0a10" strokeWidth="2">
        {fmt(node.amount_cents)}
      </text>
      {node.velocity && (
        <text x={CX} y={CY + 16} textAnchor="middle"
          fontFamily="ui-monospace, Menlo" fontSize="11" letterSpacing="0.06em"
          fill={velColor(node.velocity)}
          paintOrder="stroke" stroke="#0e0a10" strokeWidth="2.2" strokeLinejoin="round">
          {velText(node.velocity)}{velSuffix}
        </text>
      )}
      <text x={CX} y={CY + 36} textAnchor="middle"
        fontFamily="ui-monospace, Menlo" fontSize="9.5" letterSpacing="0.12em"
        fill="rgba(255,255,255,0.55)"
        paintOrder="stroke" stroke="#0e0a10" strokeWidth="2" strokeLinejoin="round">
        TAP TO GO BACK
      </text>
    </g>
  );
}

// ── Keyframes ───────────────────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes bubble-scene-in {
    from { opacity: 0; transform: scale(0.82); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes bubble-scene-out {
    from { opacity: 0; transform: scale(1.1); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes bubble-center-arrive {
    from { transform: translate(var(--origin-dx, 0px), var(--origin-dy, 0px)); opacity: 0.3; }
    to   { transform: translate(0, 0); opacity: 1; }
  }
  @keyframes bubble-node-appear {
    from { transform: scale(0.05); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }
  @keyframes bubble-spoke-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  g[data-tap]:active { opacity: 0.6; }
`;

// ── Main ────────────────────────────────────────────────────────────────────

type TransDir = 'in' | 'out';

export default function BubbleDrillMap({
  freeCenter, nodes, rootHint, empty,
}: BubbleDrillMapProps) {
  const [path, setPath] = useState<string[]>([]);
  const [sceneKey, setSceneKey] = useState(0);
  const [transDir, setTransDir] = useState<TransDir>('in');
  const [tapOrigin, setTapOrigin] = useState<{ x: number; y: number } | null>(null);

  const isMoneyContext = freeCenter != null;

  // Resolve current focused node from the path against the tree.
  const focused: BubbleNode | null = useMemo(() => {
    if (path.length === 0) return null;
    let cur: BubbleNode | undefined = nodes.find((n) => n.id === path[0]);
    for (let i = 1; cur && i < path.length; i++) {
      cur = cur.children?.find((c) => c.id === path[i]);
    }
    return cur ?? null;
  }, [path, nodes]);

  const scene: Scene = useMemo(() => {
    if (focused) {
      const { laidOut, lines } = layoutChildren(focused, 64, isMoneyContext);
      return { centerNode: focused, centerRadius: isMoneyContext ? 64 : 66, laidOut, lines };
    }
    const { laidOut, lines } = layoutRoot(nodes);
    return { centerNode: null, centerRadius: 0, laidOut, lines };
  }, [focused, nodes, isMoneyContext]);

  const transition = useCallback((dir: TransDir, fn: () => void) => {
    setTransDir(dir);
    fn();
    setSceneKey((k) => k + 1);
  }, []);

  const drill = useCallback((id: string, x: number, y: number) => {
    setTapOrigin({ x, y });
    transition('in', () => setPath((p) => [...p, id]));
  }, [transition]);

  const back = useCallback(() => {
    setTapOrigin(null);
    transition('out', () => setPath((p) => p.slice(0, -1)));
  }, [transition]);

  const sceneAnim = transDir === 'in' ? 'bubble-scene-in' : 'bubble-scene-out';
  const isRoot = path.length === 0;

  if (nodes.length === 0 && !freeCenter) {
    return (
      <div style={{
        background: 'linear-gradient(180deg, #1a141d 0%, #0f0c12 100%)',
        borderRadius: 6, padding: '40px 16px',
        textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)',
      }}>
        {empty ?? 'Nothing to show'}
      </div>
    );
  }

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        key={sceneKey}
        style={{
          overflow: 'hidden',
          animation: `${sceneAnim} 460ms cubic-bezier(0.25, 0.1, 0.25, 1) forwards`,
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          <defs>
            <radialGradient id="bubble-shine" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="bubble-depth" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.55" />
              <stop offset="60%" stopColor="#000000" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            <filter id="bubble-shadow-sm" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" />
              <feOffset dx="0" dy="1.4" result="off" />
              <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="bubble-shadow-lg" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" />
              <feOffset dx="0" dy="2.4" result="off" />
              <feComponentTransfer><feFuncA type="linear" slope="0.6" /></feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Background tap-to-back when drilled in */}
          {!isRoot && (
            <rect x={0} y={0} width={W} height={H} fill="transparent"
              onClick={back} style={{ cursor: 'pointer' }} />
          )}

          {/* Spokes (only in drill view) */}
          {scene.lines.map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              style={{
                stroke: l.color,
                animation: `bubble-spoke-fade 300ms ease ${240 + i * 40}ms both`,
              }}
              strokeOpacity={0.18} strokeWidth={1} strokeDasharray="3 4" />
          ))}

          {/* FREE center at root (money map only) */}
          {isRoot && freeCenter && <FreeCenterBubble data={freeCenter} />}

          {/* Drilled-in center */}
          {scene.centerNode && (
            <g style={{
              '--origin-dx': tapOrigin ? `${tapOrigin.x - CX}px` : '0px',
              '--origin-dy': tapOrigin ? `${tapOrigin.y - CY}px` : '0px',
              animation: tapOrigin
                ? 'bubble-center-arrive 560ms cubic-bezier(0.34, 1.56, 0.64, 1) both'
                : undefined,
            } as React.CSSProperties}>
              <HubCenterBubble
                node={scene.centerNode}
                onTap={back}
                isMoneyContext={isMoneyContext}
              />
            </g>
          )}

          {/* Orbit nodes */}
          {scene.laidOut.map((laid, idx) => (
            <g key={laid.src.id} style={{
              transformOrigin: `${laid.x}px ${laid.y}px`,
              animation: transDir === 'in'
                ? `bubble-node-appear 350ms cubic-bezier(0.34, 1.56, 0.64, 1) ${110 + idx * 90}ms both`
                : undefined,
            }}>
              {laid.drillable ? (
                <Bubble
                  node={laid.src}
                  x={laid.x} y={laid.y} radius={laid.radius}
                  drillable
                  onTap={() => drill(laid.src.id, laid.x, laid.y)}
                />
              ) : (
                <Bubble
                  node={laid.src}
                  x={laid.x} y={laid.y} radius={laid.radius}
                  drillable={false}
                />
              )}
            </g>
          ))}

          {/* Root hint */}
          {isRoot && rootHint && (
            <text x={CX} y={H - 32} textAnchor="middle"
              fontFamily="ui-monospace, Menlo" fontSize="10" letterSpacing="0.14em"
              fill="rgba(255,255,255,0.32)">
              {rootHint}
            </text>
          )}
        </svg>

        {!isRoot && (
          <div style={{
            textAlign: 'center', padding: '4px 0 8px',
            fontFamily: 'ui-monospace, Menlo', fontSize: 10, letterSpacing: '0.14em',
            color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase',
          }}>
            tap outside to go back
          </div>
        )}
      </div>
    </>
  );
}
