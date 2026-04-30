/**
 * Derive NetworkMap nodes/edges from API responses.
 *
 * Money network (PaychequeView):
 *   core PAY SLIP → commitment merchants → destination hubs (institutions, GOALS,
 *   personal, BILLS).
 *
 * Habits network (PatternsView):
 *   merchants in a cluster → category hubs + AUTOPILOT hub when recurring.
 */

import type {
  HubKind,
  NetworkCat,
  NetworkEdge,
  NetworkNode,
} from '../components/NetworkMap';

// ---------- shared shapes (kept loose; mirrors what Budget.tsx already pulls) ----------

export interface PaycheckSnapshotShape {
  period: { id: string; start_date: string; end_date: string };
  paycheque_cents: number;
  committed: {
    total_cents: number;
    lines: Array<{
      source: 'bill' | 'debt_min' | 'savings_goal' | 'savings_recurring';
      label: string;
      amount_cents: number;
      due_date?: string;
      ref_id?: string;
    }>;
  };
}

export interface PlanShape {
  next_paycheque_allocations: Array<{
    debt_id: string;
    debt_name: string;
    role: 'priority' | 'avalanche' | 'min';
    amount_cents: number;
  }>;
}

export interface MerchantShape {
  id: string;
  display_name: string;
  category_group: string | null;
  spend_90d_cents: number;
  spend_30d_cents?: number;
  txn_count: number;
  txn_count_90d?: number;
  sub_category?: string | null;
  sub_category_confirmed?: number;
}

export interface SubscriptionShape {
  merchant_id: string;
}

const SUB_LABEL: Record<string, string> = {
  food: 'FOOD',
  transit: 'TRANSIT',
  shopping: 'SHOPPING',
  home: 'HOME',
  personal_care: 'PERSONAL CARE',
  entertainment: 'ENTERTAINMENT',
  health: 'HEALTH',
  bars: 'BARS',
  takeout: 'TAKEOUT',
  fast_food: 'FAST FOOD',
  weed: 'WEED',
  streaming: 'STREAMING',
  gaming: 'GAMING',
  treats: 'TREATS',
};

// Sub-categories grouped by their parent group. Essentials subs (food /
// transit / health) are needs and don't show up on the Habits map — habits
// are about discretionary behavior. They live in the source of truth at
// `apps/worker/src/lib/subCategoryDetect.ts`.
const LIFESTYLE_SUBS = new Set([
  'shopping',
  'home',
  'personal_care',
  'entertainment',
]);
const INDULGENCE_SUBS = new Set([
  'bars',
  'takeout',
  'fast_food',
  'weed',
  'streaming',
  'gaming',
  'treats',
]);

// ---------- money-map color helpers ----------

// Semantic color per goal type — teaches the user what kind of savings each circle is.
const GOAL_TYPE_COLOR: Record<string, string> = {
  emergency: '#c97a4a', // sienna — safety net, urgency
  vacation:  '#5a9b8e', // teal — travel, refresh
  rrsp:      '#5a8a6a', // forest — long-term, roots
  tfsa:      '#c8a96a', // gold — liquid, valuable
  fhsa:      '#d99a5a', // amber — home, hearth
  car:       '#7a9aaa', // steel blue — practical
  other:     '#a890b0', // lavender — open
};

// Per-creditor palette: min = muted, extra = brighter. Cycle by hash of debt ref_id.
const CREDITOR_PAIRS: Array<{ min: string; extra: string }> = [
  { min: '#b89060', extra: '#e8c478' }, // warm gold
  { min: '#8a6aaa', extra: '#b090d8' }, // purple
  { min: '#6a8aaa', extra: '#90b4d0' }, // steel blue
  { min: '#aa8a6a', extra: '#c8a882' }, // bronze
];

function hashRef(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function creditorColors(refId: string): { min: string; extra: string } {
  return CREDITOR_PAIRS[hashRef(refId) % CREDITOR_PAIRS.length]!;
}

// ---------- helpers ----------

const INSTITUTION_PATTERNS = [
  'visa',
  'mastercard',
  'amex',
  'discover',
  'capital one',
  'cap one',
  'capone',
  'td bank',
  'td canada',
  ' td ',
  'rbc',
  'cibc',
  'bmo',
  'scotia',
  'tangerine',
  'simplii',
  'walmart',
  'costco',
  'pc financial',
  'president',
  'rogers bank',
];

function isInstitution(name: string): boolean {
  const padded = ` ${name.toLowerCase()} `;
  return INSTITUTION_PATTERNS.some((p) => padded.includes(p));
}

/**
 * Extract a stable destination root from a committed-line label or plan-extra label.
 * Strips role suffixes and the "→" prefix used for push-allocations.
 */
function extractDestRoot(label: string): string {
  let s = label.trim();
  if (s.startsWith('→')) s = s.slice(1).trim();
  const suffixes = [' min', ' extra', ' priority', ' avalanche'];
  for (const suf of suffixes) {
    if (s.toLowerCase().endsWith(suf)) {
      s = s.slice(0, -suf.length).trim();
      break;
    }
  }
  return s;
}

/**
 * Shorten a label for use inside the graph. Strips parenthetical hints
 * (e.g. "Cash buffer (1 month essentials)" → "Cash buffer") and hard-caps
 * at 14 chars so labels don't spill past bubble edges on a phone screen.
 */
function graphLabel(label: string): string {
  const stripped = label.replace(/\s*\(.*?\)\s*/, '').trim();
  return stripped.length > 14 ? stripped.slice(0, 13) + '…' : stripped;
}

function daysUntil(iso: string): number {
  const end = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / 86400000));
}

function categoryFromGroup(group: string | null | undefined): NetworkCat {
  if (
    group === 'lifestyle' ||
    group === 'indulgence' ||
    group === 'essentials' ||
    group === 'debt' ||
    group === 'savings' ||
    group === 'income'
  ) {
    return group;
  }
  return 'lifestyle';
}

// ---------- money network ----------

export interface MoneyNetwork {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  destOf: Record<string, string>;
}

export function buildMoneyNetwork(
  snapshot: PaycheckSnapshotShape | null,
  plan: PlanShape | null,
  paychequeCents: number,
  goalTypeMap: Record<string, string> = {},
): MoneyNetwork {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const destOf: Record<string, string> = {};

  // CORE — PAY SLIP. Live signal: days to payday.
  const periodEnd = snapshot?.period?.end_date ?? null;
  const days = periodEnd ? daysUntil(periodEnd) : null;
  const coreLine1 = days != null ? `${days}d` : `$${Math.round(paychequeCents / 100)}`;
  const coreLine2 = days != null ? 'TO PAYDAY' : 'PAYCHEQUE';
  nodes.push({
    id: 'core',
    label: coreLine1,
    kind: 'core',
    coreLine1,
    coreLine2,
    obs:
      days != null
        ? `paycheque · ${days} days to payday · period ends ${periodEnd}`
        : `paycheque · $${(paychequeCents / 100).toFixed(0)}`,
  });

  if (!snapshot) {
    return { nodes, edges, destOf };
  }

  const hubMap = new Map<string, NetworkNode>();
  const ensureHub = (id: string, label: string, kind: HubKind, obs?: string) => {
    if (hubMap.has(id)) return hubMap.get(id)!;
    const hub: NetworkNode = { id, label, kind: 'hub', hubKind: kind };
    if (obs) hub.obs = obs;
    nodes.push(hub);
    hubMap.set(id, hub);
    return hub;
  };

  // Pre-create GOALS hub if any savings line exists
  const hasSavings = snapshot.committed.lines.some(
    (l) => l.source === 'savings_goal' || l.source === 'savings_recurring',
  );
  if (hasSavings) ensureHub('hub_goals', 'GOALS', 'goals');

  // Pre-create BILLS hub if any bill line exists
  const hasBills = snapshot.committed.lines.some((l) => l.source === 'bill');
  if (hasBills) ensureHub('hub_bills', 'BILLS', 'bills');

  // Commit nodes — one per snapshot line. payRole carries the 4-color
  // distinction (bill/debt_min/debt_extra/goal) so the user reads role at a
  // glance, not just category group.
  for (const line of snapshot.committed.lines) {
    const id = `c-${line.source}-${line.ref_id ?? line.label}`;
    let cat: NetworkCat = 'lifestyle';
    let destId: string;
    let payRole: 'bill' | 'debt_min' | 'goal' = 'bill';
    let color: string | undefined;
    if (line.source === 'bill') {
      cat = 'essentials';
      destId = 'hub_bills';
      payRole = 'bill';
    } else if (line.source === 'debt_min') {
      cat = 'debt';
      const root = extractDestRoot(line.label);
      const hubId = `hub_dest_${root.toLowerCase().replace(/\s+/g, '_')}`;
      ensureHub(
        hubId,
        root.toUpperCase(),
        isInstitution(root) ? 'institution' : 'personal',
      );
      destId = hubId;
      payRole = 'debt_min';
      color = creditorColors(line.ref_id ?? line.label).min;
    } else {
      cat = 'savings';
      destId = 'hub_goals';
      payRole = 'goal';
      const goalType = line.ref_id ? goalTypeMap[line.ref_id] : undefined;
      color = goalType ? GOAL_TYPE_COLOR[goalType] : undefined;
    }
    const node: NetworkNode = {
      id,
      label: graphLabel(line.label),
      kind: 'merchant',
      cents: line.amount_cents,
      cat,
      payRole,
    };
    if (color) node.color = color;
    nodes.push(node);
    edges.push({ a: 'core', b: id, weight: 'primary' });
    edges.push({ a: id, b: destId });
    destOf[id] = destId;
  }

  // Plan extras — push allocations beyond minimums
  if (plan) {
    const extras = plan.next_paycheque_allocations.filter((a) => a.role !== 'min');
    const byDebt = new Map<string, { name: string; cents: number }>();
    for (const a of extras) {
      const cur = byDebt.get(a.debt_id) ?? { name: a.debt_name, cents: 0 };
      cur.cents += a.amount_cents;
      byDebt.set(a.debt_id, cur);
    }
    for (const [debtId, v] of byDebt) {
      if (v.cents <= 0) continue;
      const id = `c-extra-${debtId}`;
      const hubId = `hub_dest_${v.name.toLowerCase().replace(/\s+/g, '_')}`;
      ensureHub(
        hubId,
        v.name.toUpperCase(),
        isInstitution(v.name) ? 'institution' : 'personal',
      );
      nodes.push({
        id,
        label: `→ ${v.name}`,
        kind: 'merchant',
        cents: v.cents,
        cat: 'debt',
        payRole: 'debt_extra',
        color: creditorColors(debtId).extra,
      });
      edges.push({ a: 'core', b: id, weight: 'primary' });
      edges.push({ a: id, b: hubId });
      destOf[id] = hubId;
    }
  }

  return { nodes, edges, destOf };
}

// ---------- money drill tree (for BubbleDrillMap) ----------

import type { BubbleNode, FreeCenterData, Velocity } from '../components/BubbleDrillMap';

export interface MoneyDrillTree {
  freeCenter: FreeCenterData;
  hubs: BubbleNode[];
}

const PAY_BILLS_COLOR = '#7a8595';      // slate
const PAY_DEBT_COLOR  = '#c8a96a';      // muted gold
const PAY_GOAL_COLOR  = '#94a888';      // sage

export function buildMoneyDrillTree(
  snapshot: PaycheckSnapshotShape | null,
  plan: PlanShape | null,
  paychequeCents: number,
  goalTypeMap: Record<string, string> = {},
): MoneyDrillTree {
  const periodEnd = snapshot?.period?.end_date ?? null;
  const days = periodEnd ? daysUntil(periodEnd) : 0;

  const billLines = snapshot?.committed.lines.filter((l) => l.source === 'bill') ?? [];
  const billsTotal = billLines.reduce((s, l) => s + l.amount_cents, 0);
  const billNodes: BubbleNode[] = billLines.map((l) => ({
    id: `bill-${l.ref_id ?? l.label}`,
    label: graphLabel(l.label),
    color: PAY_BILLS_COLOR,
    amount_cents: l.amount_cents,
  }));

  // Debt = mins from snapshot + extras from plan, grouped per debt.
  const debtMap = new Map<string, { name: string; min: number; extra: number; refId: string }>();
  const minLines = snapshot?.committed.lines.filter((l) => l.source === 'debt_min') ?? [];
  for (const l of minLines) {
    const root = extractDestRoot(l.label);
    const refId = l.ref_id ?? root;
    const cur = debtMap.get(refId) ?? { name: root, min: 0, extra: 0, refId };
    cur.min += l.amount_cents;
    debtMap.set(refId, cur);
  }
  if (plan) {
    for (const a of plan.next_paycheque_allocations) {
      const refId = a.debt_id;
      const cur = debtMap.get(refId) ?? { name: a.debt_name, min: 0, extra: 0, refId };
      if (a.role === 'min') cur.min += a.amount_cents;
      else cur.extra += a.amount_cents;
      debtMap.set(refId, cur);
    }
  }
  const debtNodes: BubbleNode[] = [];
  let debtTotal = 0;
  for (const v of debtMap.values()) {
    const total = v.min + v.extra;
    if (total <= 0) continue;
    debtTotal += total;
    const colors = creditorColors(v.refId);
    debtNodes.push({
      id: `debt-${v.refId}`,
      label: graphLabel(v.name),
      color: v.extra > 0 ? colors.extra : colors.min,
      amount_cents: total,
      badge: v.extra > 0 ? 'extra' : 'min',
    });
  }

  const goalLines = snapshot?.committed.lines.filter(
    (l) => l.source === 'savings_goal' || l.source === 'savings_recurring',
  ) ?? [];
  const goalsTotal = goalLines.reduce((s, l) => s + l.amount_cents, 0);
  const goalNodes: BubbleNode[] = goalLines.map((l) => {
    const refId = l.ref_id ?? l.label;
    const goalType = l.ref_id ? goalTypeMap[l.ref_id] : undefined;
    const color = goalType ? (GOAL_TYPE_COLOR[goalType] ?? PAY_GOAL_COLOR) : PAY_GOAL_COLOR;
    return {
      id: `goal-${refId}`,
      label: graphLabel(l.label),
      color,
      amount_cents: l.amount_cents,
    };
  });

  const totalPlanned = billsTotal + debtTotal + goalsTotal;
  const freeCents = Math.max(0, paychequeCents - totalPlanned);

  const hubs: BubbleNode[] = [];
  if (billNodes.length > 0) {
    hubs.push({
      id: 'hub-bills', label: 'Bills', color: PAY_BILLS_COLOR,
      amount_cents: billsTotal, children: billNodes,
    });
  }
  if (debtNodes.length > 0) {
    hubs.push({
      id: 'hub-debt', label: 'Debt', color: PAY_DEBT_COLOR,
      amount_cents: debtTotal, children: debtNodes,
    });
  }
  if (goalNodes.length > 0) {
    hubs.push({
      id: 'hub-goals', label: 'Goals', color: PAY_GOAL_COLOR,
      amount_cents: goalsTotal, children: goalNodes,
    });
  }

  const freeCenter: FreeCenterData = {
    amount_cents: freeCents,
    daysToPayday: days,
  };

  return { freeCenter, hubs };
}

// ---------- habits drill tree ----------

export interface HabitsDrillTree {
  categories: BubbleNode[];
  totalSpend90: number;
}

const SUB_COLOR_MAP: Record<string, string> = {
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

const CAT_COLOR_MAP: Record<string, string> = {
  essentials: 'var(--cat-essentials)',
  lifestyle:  'var(--cat-lifestyle)',
  indulgence: 'var(--cat-indulgence)',
};

const CAT_LABEL: Record<string, string> = {
  essentials: 'Essentials',
  lifestyle:  'Lifestyle',
  indulgence: 'Indulgence',
};

/** Velocity from 30d vs 90d/3 (steady monthly). down=good for outflow categories. */
function deriveSpendVelocity(spend30: number, spend90: number): Velocity | undefined {
  if (spend90 <= 0) return undefined;
  const steadyMonthly = spend90 / 3;
  if (steadyMonthly <= 0) return undefined;
  const ratio = spend30 / steadyMonthly;
  // Ratio 1.0 = matching trend; >1 = accelerating, <1 = cooling.
  const pct = Math.round(Math.abs(ratio - 1) * 100);
  if (pct < 5) return { dir: 'flat', pct: 0, good: true };
  return {
    dir: ratio > 1 ? 'up' : 'down',
    pct,
    good: ratio < 1, // cooling spending is good
  };
}

export function buildHabitsDrillTree(merchants: MerchantShape[]): HabitsDrillTree {
  const habitMerchants = merchants.filter((m) => m.spend_90d_cents > 0);

  // Group: category → sub_category → merchants[]
  const catMap = new Map<string, Map<string, MerchantShape[]>>();
  for (const m of habitMerchants) {
    const catKey = m.category_group;
    if (!catKey || !(catKey in CAT_COLOR_MAP)) continue;
    const sub = m.sub_category_confirmed === 1 ? (m.sub_category ?? null) : null;
    const subKey = sub && sub in SUB_LABEL ? sub : '__unconfirmed';
    let subs = catMap.get(catKey);
    if (!subs) { subs = new Map(); catMap.set(catKey, subs); }
    const list = subs.get(subKey) ?? [];
    list.push(m);
    subs.set(subKey, list);
  }

  let totalSpend90 = 0;
  const categories: BubbleNode[] = [];
  for (const [catKey, subs] of catMap) {
    const subNodes: BubbleNode[] = [];
    let catTotal90 = 0;
    let catTotal30 = 0;

    for (const [subKey, list] of subs) {
      const subTotal90 = list.reduce((s, m) => s + m.spend_90d_cents, 0);
      const subTotal30 = list.reduce((s, m) => s + (m.spend_30d_cents ?? 0), 0);
      catTotal90 += subTotal90;
      catTotal30 += subTotal30;

      const merchantNodes: BubbleNode[] = [...list]
        .sort((a, b) => b.spend_90d_cents - a.spend_90d_cents)
        .map((m) => {
          const color = subKey === '__unconfirmed'
            ? CAT_COLOR_MAP[catKey] ?? 'var(--color-text-muted)'
            : SUB_COLOR_MAP[subKey] ?? CAT_COLOR_MAP[catKey] ?? 'var(--color-text-muted)';
          const v = deriveSpendVelocity(m.spend_30d_cents ?? 0, m.spend_90d_cents);
          const node: BubbleNode = {
            id: `merchant-${m.id}`,
            label: m.display_name,
            color,
            amount_cents: m.spend_90d_cents,
          };
          if (v) node.velocity = v;
          return node;
        });

      const subColor = subKey === '__unconfirmed'
        ? CAT_COLOR_MAP[catKey] ?? 'var(--color-text-muted)'
        : SUB_COLOR_MAP[subKey] ?? CAT_COLOR_MAP[catKey] ?? 'var(--color-text-muted)';
      const subLabel = subKey === '__unconfirmed' ? 'Unconfirmed' : (SUB_LABEL[subKey] ?? subKey);
      const v = deriveSpendVelocity(subTotal30, subTotal90);
      const subNode: BubbleNode = {
        id: `sub-${catKey}-${subKey}`,
        label: subLabel,
        color: subColor,
        amount_cents: subTotal90,
        children: merchantNodes,
      };
      if (v) subNode.velocity = v;
      subNodes.push(subNode);
    }

    if (catTotal90 <= 0) continue;
    totalSpend90 += catTotal90;
    const v = deriveSpendVelocity(catTotal30, catTotal90);
    const catNode: BubbleNode = {
      id: `cat-${catKey}`,
      label: CAT_LABEL[catKey] ?? catKey,
      color: CAT_COLOR_MAP[catKey] ?? 'var(--color-text-muted)',
      amount_cents: catTotal90,
      children: subNodes.sort((a, b) => b.amount_cents - a.amount_cents),
    };
    if (v) catNode.velocity = v;
    categories.push(catNode);
  }

  categories.sort((a, b) => b.amount_cents - a.amount_cents);
  return { categories, totalSpend90 };
}

// ---------- habits network ----------

export interface HabitsNetwork {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export function buildHabitsNetwork(
  merchants: MerchantShape[],
  _subscriptions: SubscriptionShape[],
): HabitsNetwork {
  // Subscriptions live on Books → Standing orders; the Habits map no longer
  // duplicates that signal. The argument is kept for callsite stability.
  void _subscriptions;
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];

  // Take top merchants by 90d spend across lifestyle + indulgence (the discretionary
  // surface where habit observation is most useful).
  // Cap at 7 merchants so the canvas stays readable. Hubs multiply with
  // distinct sub-categories, so fewer merchants = fewer hubs = less chaos.
  const habitMerchants = merchants
    .filter((m) => m.spend_90d_cents > 0)
    .filter((m) => m.category_group === 'lifestyle' || m.category_group === 'indulgence')
    .sort((a, b) => b.spend_90d_cents - a.spend_90d_cents)
    .slice(0, 7);

  if (habitMerchants.length === 0) return { nodes, edges };

  // Determine each merchant's effective sub-category. Confirmed subs route by
  // the sub's own group; unconfirmed must match the merchant's category group.
  // Cap visible hubs at 4 (ranked by merchant count). Extras fold into
  // UNCONFIRMED so the canvas stays readable.
  const MAX_HUBS = 4;
  const subCount = new Map<string, number>(); // sub → # of merchants that resolve there
  let unconfirmedCount = 0;

  const effectiveSub = (m: MerchantShape): string | null => {
    const sub = m.sub_category ?? null;
    if (!sub || !(sub in SUB_LABEL)) return null;
    if (
      m.sub_category_confirmed === 1 &&
      (LIFESTYLE_SUBS.has(sub) || INDULGENCE_SUBS.has(sub))
    ) return sub;
    if (m.category_group === 'lifestyle' && LIFESTYLE_SUBS.has(sub)) return sub;
    if (m.category_group === 'indulgence' && INDULGENCE_SUBS.has(sub)) return sub;
    return null;
  };

  for (const m of habitMerchants) {
    const sub = effectiveSub(m);
    if (!sub) { unconfirmedCount++; continue; }
    subCount.set(sub, (subCount.get(sub) ?? 0) + 1);
  }

  // Pick top MAX_HUBS subs by merchant count; the rest overflow to UNCONFIRMED.
  const usedSubs = new Set(
    [...subCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_HUBS)
      .map(([sub]) => sub),
  );

  // Merchants whose sub didn't make the hub cap count as unconfirmed visually.
  for (const [sub, count] of subCount) {
    if (!usedSubs.has(sub)) unconfirmedCount += count;
  }

  for (const sub of usedSubs) {
    const isLifestyle = LIFESTYLE_SUBS.has(sub);
    nodes.push({
      id: `hub_sub_${sub}`,
      label: SUB_LABEL[sub] ?? sub.toUpperCase(),
      kind: 'hub',
      hubKind: isLifestyle ? 'lifestyle' : 'indulgence',
      subCategory: sub,
    });
  }
  if (unconfirmedCount > 0) {
    nodes.push({
      id: 'hub_unconfirmed',
      label: 'UNCONFIRMED',
      kind: 'hub',
      hubKind: 'bills',
      obs: `${unconfirmedCount} merchant${unconfirmedCount === 1 ? '' : 's'} need a sub-category`,
    });
  }

  for (const m of habitMerchants) {
    const id = `m-${m.id}`;
    const resolvedSub = effectiveSub(m);
    const validSub = resolvedSub !== null && usedSubs.has(resolvedSub);
    const sub = resolvedSub;
    // Velocity-driven size. Pure recent monthly burn (30d × 3) when we have it,
    // so a hot merchant reads as visibly bigger and a cold one shrinks even if
    // its 90d total is large. The displayed label still shows the 90d total
    // (the human-anchored number); size answers the different question of
    // "what are you doing right now."
    const recent = m.spend_30d_cents ?? 0;
    const steady = m.spend_90d_cents;
    const sizeCents =
      m.spend_30d_cents != null
        ? Math.max(Math.round(recent * 3), 100)
        : steady;
    const velocityRatio = steady > 0 && m.spend_30d_cents != null
      ? (recent * 3) / steady
      : null;
    const velocityNote =
      velocityRatio == null
        ? ''
        : velocityRatio >= 1.4
          ? ' · accelerating'
          : velocityRatio <= 0.6
            ? ' · cooling'
            : '';
    const node: NetworkNode = {
      id,
      label: m.display_name,
      kind: 'merchant',
      cents: steady,
      sizeCents,
      cat: categoryFromGroup(m.category_group),
      obs: `${m.txn_count_90d ?? m.txn_count} charges in 90 days · $${(steady / 100).toFixed(0)} total${velocityNote}`,
    };
    if (validSub && sub) node.subCategory = sub;
    nodes.push(node);
    const destHub = validSub && sub ? `hub_sub_${sub}` : 'hub_unconfirmed';
    edges.push({ a: id, b: destHub, weight: 'primary' });
  }

  return { nodes, edges };
}
