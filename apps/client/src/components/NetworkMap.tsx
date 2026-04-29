import { useMemo, useState } from 'react';

/**
 * NetworkMap — obsidian-style graph for Money and Habits, on-brand:
 *  - Hubs are paper index cards with a kind-specific top stripe color
 *  - Edges are paper perforations (dashed)
 *  - Merchant nodes are stamped coins in their category color
 *  - Tap to pin a node; tap empty desk to release
 *  - Audit-tape strip below shows what only the bookkeeper sees
 *  - Center artifact (optional) is the PAY SLIP stamp with live cycle context
 *  - No drift, iPhone-native tap targets
 */

export type NetworkCat =
  | 'essentials'
  | 'lifestyle'
  | 'indulgence'
  | 'savings'
  | 'debt'
  | 'income';

export type HubKind =
  | 'institution'
  | 'goals'
  | 'personal'
  | 'autopilot'
  | 'time'
  | 'bills'
  | 'lifestyle'
  | 'indulgence';

export type PayRole = 'bill' | 'debt_min' | 'debt_extra' | 'goal';

export interface NetworkNode {
  id: string;
  label: string;
  kind: 'merchant' | 'hub' | 'core';
  /** Merchant only — drives circle size + amount label. */
  cents?: number;
  /** Merchant only — fill color. */
  cat?: NetworkCat;
  /** Hub only — stripe color. */
  hubKind?: HubKind;
  /** Habits map: sub-category id (food, takeout, weed, etc.). When present
   *  it overrides the merchant fill and the hub stripe so each sub gets its
   *  own readable color. */
  subCategory?: string;
  /** Money map: distinguishes a paycheque commit's role. Overrides cat for
   *  fill so users see bill / debt-min / debt-extra / goal as 4 distinct
   *  hues, not all collapsed under "essentials" or "debt". */
  payRole?: PayRole;
  /** Audit-tape observation revealed when this node is pinned. */
  obs?: string;
  /** Core only — overrides the default "$amount" display in the PAY SLIP. */
  coreLine1?: string;
  coreLine2?: string;
}

export interface NetworkEdge {
  a: string;
  b: string;
  weight?: 'primary' | 'faint';
}

export interface NetworkMapProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  /** Optional layout hint. money places hubs on outer ring + commits between core
   *  and their primary destination. habits places hubs in a ring and merchants
   *  in an inner cluster. */
  mode: 'money' | 'habits';
  /** For money mode: map commit-id → primary destination hub id. */
  destOf?: Record<string, string>;
  height?: number;
  showAmount?: boolean;
  /** Empty-state text rendered when nodes is empty. */
  empty?: string;
}

const W = 380;
const HUB_W = 80;
const HUB_H = 22;
const CORE_W = 104;
const CORE_H = 52;

const HUB_STRIPE: Record<HubKind, string> = {
  institution: 'var(--cat-debt)',
  goals: 'var(--cat-savings)',
  personal: 'var(--hub-personal)',
  autopilot: 'var(--hub-autopilot)',
  time: 'var(--hub-time)',
  bills: 'var(--cat-essentials)',
  lifestyle: 'var(--cat-lifestyle)',
  indulgence: 'var(--cat-indulgence)',
};

// 14 sub-category hues. Keep the IDs aligned with the worker vocab in
// subCategoryDetect.ts. Underscores in source → hyphens in CSS-var names.
const SUB_COLOR: Record<string, string> = {
  food: 'var(--sub-food)',
  transit: 'var(--sub-transit)',
  shopping: 'var(--sub-shopping)',
  home: 'var(--sub-home)',
  personal_care: 'var(--sub-personal-care)',
  entertainment: 'var(--sub-entertainment)',
  health: 'var(--sub-health)',
  bars: 'var(--sub-bars)',
  takeout: 'var(--sub-takeout)',
  fast_food: 'var(--sub-fast-food)',
  weed: 'var(--sub-weed)',
  streaming: 'var(--sub-streaming)',
  gaming: 'var(--sub-gaming)',
  treats: 'var(--sub-treats)',
};

const PAY_ROLE_COLOR: Record<PayRole, string> = {
  bill: 'var(--pay-bills)',
  debt_min: 'var(--pay-debt-min)',
  debt_extra: 'var(--pay-debt-extra)',
  goal: 'var(--pay-goal)',
};

function merchantFill(n: NetworkNode): string {
  if (n.subCategory && SUB_COLOR[n.subCategory]) return SUB_COLOR[n.subCategory]!;
  if (n.payRole) return PAY_ROLE_COLOR[n.payRole];
  return n.cat ? `var(--cat-${n.cat})` : 'rgba(255,255,255,0.12)';
}

function hubStripe(n: NetworkNode): string {
  if (n.subCategory && SUB_COLOR[n.subCategory]) return SUB_COLOR[n.subCategory]!;
  return n.hubKind ? HUB_STRIPE[n.hubKind] : 'var(--cat-debt)';
}

export { SUB_COLOR, PAY_ROLE_COLOR };

interface Placed extends NetworkNode {
  x: number;
  y: number;
  r: number;
  cardW?: number;
  cardH?: number;
}

function fmt(c: number): string {
  const a = Math.abs(c);
  if (a >= 100000) return `$${Math.round(a / 100).toLocaleString('en-CA')}`;
  return `$${(a / 100).toLocaleString('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function effectiveR(n: Placed): number {
  if (n.cardW != null && n.cardH != null) {
    return Math.max(n.cardW, n.cardH) / 2 + 4;
  }
  return n.r + 14;
}

function relax(placed: Placed[], padding = 6, iters = 100): void {
  const movable = (n: Placed) => n.kind === 'merchant';
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        const aMov = movable(a);
        const bMov = movable(b);
        if (!aMov && !bMov) continue;
        const ra = effectiveR(a);
        const rb = effectiveR(b);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = ra + rb + padding;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < minDist) {
          const overlap = (minDist - dist) / (aMov && bMov ? 2 : 1);
          const nx = dx / dist;
          const ny = dy / dist;
          if (aMov) {
            a.x -= nx * overlap;
            a.y -= ny * overlap;
          }
          if (bMov) {
            b.x += nx * overlap;
            b.y += ny * overlap;
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

function placeMoney(
  nodes: NetworkNode[],
  destOf: Record<string, string>,
  height: number,
): Placed[] {
  const cx = W / 2;
  const cy = height / 2;
  const merchants = nodes.filter((n) => n.kind === 'merchant');
  const max = Math.max(...merchants.map((n) => n.cents ?? 1), 1);
  const placed: Placed[] = [];

  // core
  const core = nodes.find((n) => n.kind === 'core');
  if (core) {
    placed.push({ ...core, x: cx, y: cy, r: 0, cardW: CORE_W, cardH: CORE_H });
  }

  // hubs evenly around perimeter (radius tuned so 80px-wide cards stay on canvas)
  const hubs = nodes.filter((n) => n.kind === 'hub');
  const hubAngleOffset = hubs.length === 4 ? Math.PI / 4 : 0;
  hubs.forEach((h, i) => {
    const angle = -Math.PI / 2 + (i / hubs.length) * Math.PI * 2 + hubAngleOffset;
    placed.push({
      ...h,
      x: cx + Math.cos(angle) * 152,
      y: cy + Math.sin(angle) * 142,
      r: 0,
      cardW: HUB_W,
      cardH: HUB_H,
    });
  });

  // commits placed between core and their primary destination
  merchants.forEach((m) => {
    const destId = destOf[m.id];
    const dest = destId ? placed.find((p) => p.id === destId) : null;
    const sameDest = merchants.filter((c) => destOf[c.id] === destId);
    const idx = sameDest.indexOf(m);
    const t = Math.log(1 + (m.cents ?? 1)) / Math.log(1 + max);
    const r = 11 + t * 13;
    if (!dest) {
      // orphan commit — place near center
      placed.push({ ...m, x: cx, y: cy + (idx + 1) * 28, r });
      return;
    }
    const dx = dest.x - cx;
    const dy = dest.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const spread =
      sameDest.length === 1
        ? 0
        : sameDest.length === 2
          ? idx === 0
            ? -28
            : 28
          : (idx - (sameDest.length - 1) / 2) * 40;
    placed.push({
      ...m,
      x: cx + dx * 0.6 + px * spread,
      y: cy + dy * 0.6 + py * spread,
      r,
    });
  });

  relax(placed, 6, 120);
  return placed;
}

function placeHabits(nodes: NetworkNode[], height: number): Placed[] {
  const cx = W / 2;
  const cy = height / 2;
  const merchants = nodes.filter((n) => n.kind === 'merchant');
  const hubs = nodes.filter((n) => n.kind === 'hub');
  const max = Math.max(...merchants.map((n) => n.cents ?? 1), 1);
  const placed: Placed[] = [];
  hubs.forEach((h, i) => {
    const angle = -Math.PI / 2 + (i / hubs.length) * Math.PI * 2;
    placed.push({
      ...h,
      x: cx + Math.cos(angle) * 152,
      y: cy + Math.sin(angle) * 142,
      r: 0,
      cardW: HUB_W,
      cardH: HUB_H,
    });
  });
  merchants.forEach((m, i) => {
    const angle = -Math.PI / 2 + (i / merchants.length) * Math.PI * 2 + 0.3;
    const dist = 60 + (i % 2) * 22;
    const t = Math.log(1 + (m.cents ?? 1)) / Math.log(1 + max);
    placed.push({
      ...m,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      r: 12 + t * 16,
    });
  });
  relax(placed, 6, 120);
  return placed;
}

function obsFor(
  pinned: string | null,
  nodes: NetworkNode[],
  edges: NetworkEdge[],
): string | null {
  if (!pinned) return null;
  const n = nodes.find((x) => x.id === pinned);
  if (!n) return null;
  if (n.kind === 'core') return n.obs?.toUpperCase() ?? null;
  if (n.kind === 'hub') {
    const linked = edges
      .filter((e) => e.a === pinned || e.b === pinned)
      .map((e) => (e.a === pinned ? e.b : e.a))
      .map((id) => nodes.find((m) => m.id === id))
      .filter((x): x is NetworkNode => Boolean(x))
      .filter((x) => x.kind === 'merchant');
    if (linked.length === 0) return n.obs?.toUpperCase() ?? n.label;
    if (linked.some((x) => x.cents != null)) {
      const total = linked.reduce((s, x) => s + (x.cents ?? 0), 0);
      return `${n.label} · ${linked.length} flows · ${fmt(total)}`;
    }
    const names = linked.map((x) => x.label).join(', ');
    return `${n.label} · ${linked.length} · ${names}`;
  }
  return `${n.label.toUpperCase()} · ${n.obs ?? ''}`;
}

export default function NetworkMap(props: NetworkMapProps) {
  const { nodes, edges, mode, destOf = {}, height = 410, showAmount, empty } = props;
  const [pinned, setPinned] = useState<string | null>(null);

  const placed = useMemo(() => {
    if (nodes.length === 0) return [];
    return mode === 'money' ? placeMoney(nodes, destOf, height) : placeHabits(nodes, height);
    // destOf reference equality is enough for our use; deps lint warn if any
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, mode, height]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!m.has(e.a)) m.set(e.a, new Set());
      if (!m.has(e.b)) m.set(e.b, new Set());
      m.get(e.a)!.add(e.b);
      m.get(e.b)!.add(e.a);
    }
    return m;
  }, [edges]);

  const isLit = (id: string): boolean => {
    if (!pinned) return true;
    if (id === pinned) return true;
    return neighbors.get(pinned)?.has(id) ?? false;
  };
  const isLitEdge = (e: NetworkEdge): boolean =>
    pinned !== null && (e.a === pinned || e.b === pinned);

  const nodeById = new Map(placed.map((n) => [n.id, n]));
  const tap = (id: string) => (ev: React.MouseEvent | React.TouchEvent) => {
    ev.stopPropagation();
    setPinned(pinned === id ? null : id);
  };

  const cx = W / 2;
  const cy = height / 2;

  const observation = obsFor(pinned, nodes, edges);

  return (
    <div className="flex flex-col gap-0">
      <section
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(158,120,185,0.10) 0%, transparent 60%), linear-gradient(180deg, #1a141d 0%, #0a070c 100%)',
          borderRadius: 4,
          position: 'relative',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 32px -16px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          touchAction: 'manipulation',
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${height}`}
          width="100%"
          style={{ display: 'block' }}
          onClick={() => setPinned(null)}
        >
          {/* edges — paper perforations */}
          {edges.map((e, i) => {
            const a = nodeById.get(e.a);
            const b = nodeById.get(e.b);
            if (!a || !b) return null;
            const lit = isLitEdge(e);
            const dim = pinned !== null && !lit;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={lit ? 'var(--cat-income)' : 'rgba(255,255,255,0.45)'}
                strokeWidth={lit ? 1.4 : e.weight === 'primary' ? 0.8 : 0.5}
                strokeOpacity={
                  dim ? 0.04 : lit ? 0.85 : e.weight === 'primary' ? 0.13 : 0.06
                }
                strokeDasharray="3 4"
                style={{
                  transition: 'stroke 160ms, stroke-opacity 160ms, stroke-width 160ms',
                }}
              />
            );
          })}

          {/* shapes (no merchant labels yet — second pass) */}
          {placed.map((n) => {
            const lit = isLit(n.id);
            const isPinned = pinned === n.id;
            const opacity = lit ? 1 : 0.18;

            if (n.kind === 'core') {
              const w = n.cardW!;
              const h = n.cardH!;
              return (
                <g
                  key={n.id}
                  onClick={tap(n.id)}
                  style={{ cursor: 'pointer', transition: 'opacity 160ms' }}
                  opacity={opacity}
                >
                  <rect
                    x={n.x - w / 2 - 6}
                    y={n.y - h / 2 - 6}
                    width={w + 12}
                    height={h + 12}
                    fill="transparent"
                  />
                  <rect
                    x={n.x - w / 2 + 2}
                    y={n.y - h / 2 + 3}
                    width={w}
                    height={h}
                    fill="#000"
                    opacity={0.32}
                    rx={1}
                  />
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={h}
                    fill="#f2ece0"
                    stroke={isPinned ? 'var(--cat-income)' : '#1a141d'}
                    strokeWidth={isPinned ? 1.6 : 1.2}
                    rx={1}
                  />
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={11}
                    fill="var(--cat-income)"
                  />
                  <text
                    x={n.x - w / 2 + 5}
                    y={n.y - h / 2 + 8}
                    fontFamily="ui-monospace, Menlo"
                    fontSize={6.5}
                    letterSpacing={1.4}
                    fontWeight={700}
                    fill="#1a141d"
                    opacity={0.8}
                  >
                    PAY SLIP
                  </text>
                  <text
                    x={n.x}
                    y={n.y + 8}
                    textAnchor="middle"
                    fontFamily="var(--font-display)"
                    fontSize={n.coreLine1 && n.coreLine1.length > 8 ? 14 : 18}
                    fontWeight={600}
                    fill="#1a141d"
                  >
                    {n.coreLine1 ?? n.label}
                  </text>
                  {n.coreLine2 && (
                    <text
                      x={n.x}
                      y={n.y + 21}
                      textAnchor="middle"
                      fontFamily="ui-monospace, Menlo"
                      fontSize={7}
                      letterSpacing={1.2}
                      fill="#1a141d"
                      opacity={0.55}
                    >
                      {n.coreLine2}
                    </text>
                  )}
                </g>
              );
            }

            if (n.kind === 'hub') {
              const w = n.cardW!;
              const h = n.cardH!;
              const stripe = hubStripe(n);
              return (
                <g
                  key={n.id}
                  onClick={tap(n.id)}
                  style={{ cursor: 'pointer', transition: 'opacity 160ms' }}
                  opacity={opacity}
                >
                  <rect
                    x={n.x - w / 2 - 10}
                    y={n.y - h / 2 - 10}
                    width={w + 20}
                    height={h + 20}
                    fill="transparent"
                  />
                  <rect
                    x={n.x - w / 2 + 1}
                    y={n.y - h / 2 + 2}
                    width={w}
                    height={h}
                    fill="#000"
                    opacity={0.28}
                    rx={1}
                  />
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={h}
                    fill="#f2ece0"
                    stroke={isPinned ? 'var(--cat-income)' : '#1a141d'}
                    strokeWidth={isPinned ? 1.5 : 1}
                    rx={1}
                  />
                  {/* kind-specific top stripe */}
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={5}
                    fill={stripe}
                  />
                  <text
                    x={n.x}
                    y={n.y + 6}
                    textAnchor="middle"
                    fontFamily="ui-monospace, Menlo"
                    fontSize={9}
                    letterSpacing={1.4}
                    fontWeight={700}
                    fill={isPinned ? 'var(--cat-income)' : '#1a141d'}
                    opacity={isPinned ? 1 : 0.78}
                  >
                    {n.label}
                  </text>
                </g>
              );
            }

            // merchant — coin (label rendered in second pass)
            const fill = merchantFill(n);
            return (
              <g
                key={n.id}
                onClick={tap(n.id)}
                style={{ cursor: 'pointer', transition: 'opacity 160ms' }}
                opacity={opacity}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={Math.max(n.r + 12, 22)}
                  fill="transparent"
                />
                {isPinned && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r + 12}
                    fill="rgba(158,120,185,0.18)"
                  />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={fill}
                  stroke={isPinned ? 'var(--cat-income)' : 'rgba(255,255,255,0.14)'}
                  strokeWidth={isPinned ? 1.8 : 0.8}
                  style={{ transition: 'stroke 160ms, stroke-width 160ms' }}
                />
              </g>
            );
          })}

          {/* labels — second pass on top of all shapes; ink-stroked glyphs for
              legibility against any background, no rectangle backing */}
          {placed
            .filter((n) => n.kind === 'merchant')
            .map((n) => {
              const lit = isLit(n.id);
              const opacity = lit ? 1 : 0.18;
              const labelText =
                n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label;
              return (
                <g
                  key={`lbl-${n.id}`}
                  style={{ pointerEvents: 'none', transition: 'opacity 160ms' }}
                  opacity={opacity}
                >
                  <text
                    x={n.x}
                    y={n.y + n.r + 12}
                    textAnchor="middle"
                    fontFamily="ui-monospace, Menlo"
                    fontSize={9}
                    fill="rgba(255,255,255,0.92)"
                    style={{
                      paintOrder: 'stroke',
                      stroke: '#0a070c',
                      strokeWidth: 3,
                      strokeLinejoin: 'round',
                    }}
                  >
                    {labelText}
                  </text>
                  {showAmount && n.cents != null && (
                    <text
                      x={n.x}
                      y={n.y + n.r + 23}
                      textAnchor="middle"
                      fontFamily="ui-monospace, Menlo"
                      fontSize={9}
                      fill="rgba(255,255,255,0.55)"
                      style={{
                        paintOrder: 'stroke',
                        stroke: '#0a070c',
                        strokeWidth: 3,
                        strokeLinejoin: 'round',
                      }}
                    >
                      {fmt(n.cents)}
                    </text>
                  )}
                </g>
              );
            })}

          {/* PINNED corner stamp */}
          {pinned !== null && (
            <g transform={`translate(${W - 60} 18) rotate(-8)`}>
              <rect
                x={0}
                y={0}
                width={48}
                height={14}
                fill="none"
                stroke="var(--cat-income)"
                strokeWidth={0.9}
              />
              <text
                x={24}
                y={10}
                textAnchor="middle"
                fontFamily="ui-monospace, Menlo"
                fontSize={7}
                letterSpacing={1.6}
                fontWeight={700}
                fill="var(--cat-income)"
              >
                PINNED
              </text>
            </g>
          )}

          {placed.length === 0 && empty && (
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              fontFamily="ui-monospace, Menlo"
              fontSize={10}
              letterSpacing={1.4}
              fill="rgba(255,255,255,0.45)"
            >
              {empty}
            </text>
          )}
        </svg>
      </section>

      {/* Audit tape */}
      <div
        style={{
          marginTop: 10,
          height: 42,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 10px',
          background: '#f2ece0',
          color: '#1a141d',
          position: 'relative',
          boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -3,
            height: 4,
            background:
              'radial-gradient(circle at 4px 4px, #1a141d 1.2px, transparent 1.4px) 0 0/10px 8px',
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -3,
            height: 4,
            background:
              'radial-gradient(circle at 4px 0px, #1a141d 1.2px, transparent 1.4px) 0 0/10px 8px',
            opacity: 0.55,
          }}
        />
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 7,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'rgba(26,20,29,0.55)',
            marginBottom: 2,
          }}
        >
          AUDIT TAPE
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
            color: '#1a141d',
            minHeight: 14,
          }}
        >
          {observation ?? <span style={{ opacity: 0.4 }}>· tap to pin ·</span>}
        </div>
      </div>
    </div>
  );
}
