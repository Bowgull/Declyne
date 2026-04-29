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
}

export interface SubscriptionShape {
  merchant_id: string;
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

  // Commit nodes — one per snapshot line
  for (const line of snapshot.committed.lines) {
    const id = `c-${line.source}-${line.ref_id ?? line.label}`;
    let cat: NetworkCat = 'lifestyle';
    let destId: string;
    if (line.source === 'bill') {
      cat = 'essentials';
      destId = 'hub_bills';
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
    } else {
      cat = 'savings';
      destId = 'hub_goals';
    }
    nodes.push({ id, label: line.label, kind: 'merchant', cents: line.amount_cents, cat });
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
  subscriptions: SubscriptionShape[],
): HabitsNetwork {
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

  const subIds = new Set(subscriptions.map((s) => s.merchant_id));

  // Hubs: only emit category hubs that have ≥1 merchant. AUTOPILOT only if any
  // merchant is detected as recurring.
  const groups = new Set<string>();
  let anyAutopilot = false;
  for (const m of habitMerchants) {
    if (m.category_group === 'lifestyle') groups.add('lifestyle');
    if (m.category_group === 'indulgence') groups.add('indulgence');
    if (subIds.has(m.id)) anyAutopilot = true;
  }

  if (groups.has('lifestyle')) {
    nodes.push({ id: 'hub_lifestyle', label: 'LIFESTYLE', kind: 'hub', hubKind: 'lifestyle' });
  }
  if (groups.has('indulgence')) {
    nodes.push({ id: 'hub_indulgence', label: 'INDULGENCE', kind: 'hub', hubKind: 'indulgence' });
  }
  if (anyAutopilot) {
    nodes.push({ id: 'hub_autopilot', label: 'AUTOPILOT', kind: 'hub', hubKind: 'autopilot' });
  }

  for (const m of habitMerchants) {
    const id = `m-${m.id}`;
    nodes.push({
      id,
      label: m.display_name,
      kind: 'merchant',
      cents: m.spend_90d_cents,
      cat: categoryFromGroup(m.category_group),
      obs: `${m.txn_count_90d ?? m.txn_count} charges in 90 days · $${(m.spend_90d_cents / 100).toFixed(0)} total`,
    });
    if (m.category_group === 'lifestyle' && groups.has('lifestyle')) {
      edges.push({ a: id, b: 'hub_lifestyle' });
    }
    if (m.category_group === 'indulgence' && groups.has('indulgence')) {
      edges.push({ a: id, b: 'hub_indulgence' });
    }
    if (subIds.has(m.id) && anyAutopilot) {
      edges.push({ a: id, b: 'hub_autopilot', weight: 'primary' });
    }
  }

  return { nodes, edges };
}
