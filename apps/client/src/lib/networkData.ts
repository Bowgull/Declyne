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

const LIFESTYLE_SUBS = new Set([
  'food',
  'transit',
  'shopping',
  'home',
  'personal_care',
  'entertainment',
  'health',
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
      label: line.label,
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
  const habitMerchants = merchants
    .filter((m) => m.spend_90d_cents > 0)
    .filter((m) => m.category_group === 'lifestyle' || m.category_group === 'indulgence')
    .sort((a, b) => b.spend_90d_cents - a.spend_90d_cents)
    .slice(0, 9);

  if (habitMerchants.length === 0) return { nodes, edges };

  // Each merchant's destination hub is its sub_category, when present and
  // valid for the merchant's group. Unconfirmed merchants (or merchants
  // whose sub_category was set on the wrong group) cluster under a single
  // UNCONFIRMED hub — visually telling the user "open the queue."
  const usedSubs = new Set<string>();
  let unconfirmedCount = 0;

  for (const m of habitMerchants) {
    const sub = m.sub_category ?? null;
    if (!sub || !(sub in SUB_LABEL)) {
      unconfirmedCount++;
      continue;
    }
    // Group/sub mismatch: e.g. an indulgence brand mistakenly stamped lifestyle
    if (m.category_group === 'lifestyle' && !LIFESTYLE_SUBS.has(sub)) {
      unconfirmedCount++;
      continue;
    }
    if (m.category_group === 'indulgence' && LIFESTYLE_SUBS.has(sub)) {
      unconfirmedCount++;
      continue;
    }
    usedSubs.add(sub);
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
    const sub = m.sub_category ?? null;
    const validSub =
      sub && sub in SUB_LABEL
        ? (m.category_group === 'lifestyle' && LIFESTYLE_SUBS.has(sub)) ||
          (m.category_group === 'indulgence' && !LIFESTYLE_SUBS.has(sub))
        : false;
    const node: NetworkNode = {
      id,
      label: m.display_name,
      kind: 'merchant',
      cents: m.spend_90d_cents,
      cat: categoryFromGroup(m.category_group),
      obs: `${m.txn_count_90d ?? m.txn_count} charges in 90 days · $${(m.spend_90d_cents / 100).toFixed(0)} total`,
    };
    if (validSub && sub) node.subCategory = sub;
    nodes.push(node);
    const destHub = validSub && sub ? `hub_sub_${sub}` : 'hub_unconfirmed';
    edges.push({ a: id, b: destHub, weight: 'primary' });
  }

  return { nodes, edges };
}
