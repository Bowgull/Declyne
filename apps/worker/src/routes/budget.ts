import { Hono } from 'hono';
import type { Env } from '../env.js';

export const budgetRoutes = new Hono<{ Bindings: Env }>();

budgetRoutes.get('/variance', async (c) => {
  // Per-category-group variance for the current pay period. Pulls planned from
  // period_allocations (the only source of truth since session 41) and spent
  // from transactions joined to category group. Delta is signed: positive =
  // under, negative = over.
  const period = await c.env.DB.prepare(
    `SELECT id, start_date, end_date FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string; start_date: string; end_date: string }>();
  if (!period) return c.json({ period: null, rows: [] });

  const planned = await c.env.DB.prepare(
    `SELECT category_group AS g, COALESCE(SUM(planned_cents), 0) AS cents
     FROM period_allocations WHERE pay_period_id = ? GROUP BY category_group`,
  ).bind(period.id).all<{ g: string; cents: number }>();

  const spent = await c.env.DB.prepare(
    `SELECT COALESCE(c."group", 'uncategorized') AS g,
            COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) AS cents
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at BETWEEN ? AND ?
     GROUP BY g`,
  ).bind(period.start_date, period.end_date).all<{ g: string; cents: number }>();

  const groups = ['essentials', 'lifestyle', 'debt', 'savings', 'indulgence'] as const;
  const planMap = new Map(planned.results.map((r) => [r.g, r.cents]));
  const spendMap = new Map(spent.results.map((r) => [r.g, r.cents]));
  const rows = groups.map((g) => {
    const planned_cents = planMap.get(g) ?? 0;
    const spent_cents = spendMap.get(g) ?? 0;
    return { group: g, planned_cents, spent_cents, delta_cents: planned_cents - spent_cents };
  });

  return c.json({ period, rows });
});

budgetRoutes.get('/indulgence/trend', async (c) => {
  // Weekly indulgence ratio for the last 8 weeks. Each week = 7-day bucket ending today.
  const weeks: { week_start: string; indulgence_cents: number; lifestyle_cents: number; ratio_bps: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const end = `date('now', '-${i * 7} days')`;
    const start = `date('now', '-${(i + 1) * 7} days')`;
    const row = await c.env.DB.prepare(
      `SELECT c."group" as g,
              COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.posted_at > ${start} AND t.posted_at <= ${end}
       GROUP BY c."group"`,
    ).all<{ g: string; s: number }>();
    const indulgence = row.results.find((r) => r.g === 'indulgence')?.s ?? 0;
    const lifestyle = row.results.find((r) => r.g === 'lifestyle')?.s ?? 0;
    const denom = indulgence + lifestyle;
    const ratio_bps = denom === 0 ? 0 : Math.round((indulgence / denom) * 10_000);
    const weekStartRow = await c.env.DB.prepare(`SELECT ${start} as d`).first<{ d: string }>();
    weeks.push({ week_start: weekStartRow?.d ?? '', indulgence_cents: indulgence, lifestyle_cents: lifestyle, ratio_bps });
  }

  const top = await c.env.DB.prepare(
    `SELECT c.id, c.name,
            COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as spend_cents
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE c."group" = 'indulgence' AND t.posted_at >= date('now', '-30 days')
     GROUP BY c.id ORDER BY spend_cents DESC LIMIT 5`,
  ).all<{ id: string; name: string; spend_cents: number }>();

  const peakRow = await c.env.DB.prepare(
    `SELECT CAST(strftime('%w', t.posted_at) AS INTEGER) as d,
            COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE c."group" = 'indulgence' AND t.posted_at >= date('now', '-90 days')
     GROUP BY d ORDER BY s DESC LIMIT 1`,
  ).first<{ d: number; s: number }>();

  return c.json({
    weeks,
    top_categories: top.results,
    peak_weekday: peakRow?.d ?? null,
    peak_weekday_cents: peakRow?.s ?? 0,
  });
});

budgetRoutes.get('/tank', async (c) => {
  // Current pay period tank state: paycheque in, spend by category group, days remaining.
  const period = await c.env.DB.prepare(
    `SELECT id, start_date, end_date, paycheque_cents
     FROM pay_periods WHERE start_date <= date('now') ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string; start_date: string; end_date: string; paycheque_cents: number }>();
  if (!period) return c.json({ period: null });

  const { results } = await c.env.DB.prepare(
    `SELECT COALESCE(c."group", 'uncategorized') as g,
            COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at BETWEEN ? AND ?
     GROUP BY g`,
  ).bind(period.start_date, period.end_date).all<{ g: string; s: number }>();

  const by_group: Record<string, number> = {
    essentials: 0,
    lifestyle: 0,
    indulgence: 0,
    debt: 0,
    transfer: 0,
    uncategorized: 0,
  };
  for (const r of results) {
    if (r.g in by_group) by_group[r.g] = r.s;
    else by_group.uncategorized = (by_group.uncategorized ?? 0) + r.s;
  }
  const total_spent_cents =
    (by_group.essentials ?? 0) +
    (by_group.lifestyle ?? 0) +
    (by_group.indulgence ?? 0) +
    (by_group.debt ?? 0) +
    (by_group.uncategorized ?? 0);

  const today = new Date().toISOString().slice(0, 10);
  const end = period.end_date;
  const msPerDay = 86_400_000;
  const days_remaining = Math.max(
    0,
    Math.ceil((Date.parse(end) - Date.parse(today)) / msPerDay),
  );

  const remaining_cents = Math.max(0, period.paycheque_cents - total_spent_cents);

  // Pending plan installments reduce how much is truly unallocated.
  const committedRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(planned_cents), 0) AS cents
     FROM period_allocations
     WHERE pay_period_id = ?
       AND category_group = 'debt'
       AND committed_at IS NOT NULL
       AND stamped_at IS NULL`,
  ).bind(period.id).first<{ cents: number }>();
  const committed_cents = committedRow?.cents ?? 0;
  const truly_free_cents = Math.max(0, remaining_cents - committed_cents);

  return c.json({
    period,
    paycheque_cents: period.paycheque_cents,
    by_group,
    total_spent_cents,
    remaining_cents,
    committed_cents,
    truly_free_cents,
    days_remaining,
  });
});

budgetRoutes.get('/tank/history', async (c) => {
  // Last N closed pay periods with totals for sparkline-of-tanks visual.
  const limit = Math.min(8, Math.max(1, Number(c.req.query('limit') ?? '4')));
  const { results: periods } = await c.env.DB.prepare(
    `SELECT id, start_date, end_date, paycheque_cents
     FROM pay_periods ORDER BY start_date DESC LIMIT ?`,
  ).bind(limit + 1).all<{ id: string; start_date: string; end_date: string; paycheque_cents: number }>();
  // Drop the most recent (current) period; we only want history.
  const closed = periods.slice(1);
  if (closed.length === 0) return c.json({ rows: [] });

  const rows: {
    id: string;
    start_date: string;
    end_date: string;
    paycheque_cents: number;
    indulgence_cents: number;
    other_cents: number;
  }[] = [];
  for (const p of closed) {
    const r = await c.env.DB.prepare(
      `SELECT COALESCE(c."group", 'uncategorized') as g,
              COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.posted_at BETWEEN ? AND ?
       GROUP BY g`,
    ).bind(p.start_date, p.end_date).all<{ g: string; s: number }>();
    let indulgence = 0;
    let other = 0;
    for (const x of r.results) {
      if (x.g === 'indulgence') indulgence += x.s;
      else if (x.g === 'transfer') continue;
      else other += x.s;
    }
    rows.push({ ...p, indulgence_cents: indulgence, other_cents: other });
  }
  return c.json({ rows });
});

budgetRoutes.get('/indulgence', async (c) => {
  // Indulgence ratio trailing 30 days: indulgence / (indulgence + lifestyle).
  const { results } = await c.env.DB.prepare(
    `SELECT c."group" as "group", COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as spend_cents
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at >= date('now', '-30 days')
     GROUP BY c."group"`,
  ).all<{ group: string; spend_cents: number }>();

  const indulgence = results.find((r) => r.group === 'indulgence')?.spend_cents ?? 0;
  const lifestyle = results.find((r) => r.group === 'lifestyle')?.spend_cents ?? 0;
  const denom = indulgence + lifestyle;
  const ratio_bps = denom === 0 ? 0 : Math.round((indulgence / denom) * 10_000);
  return c.json({ indulgence_cents: indulgence, lifestyle_cents: lifestyle, ratio_bps });
});
