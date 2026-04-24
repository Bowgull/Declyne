import { Hono } from 'hono';
import type { Env } from '../env.js';

export const budgetRoutes = new Hono<{ Bindings: Env }>();

budgetRoutes.get('/variance', async (c) => {
  // Current pay period variance by category.
  const period = await c.env.DB.prepare(
    `SELECT id, start_date, end_date FROM pay_periods ORDER BY start_date DESC LIMIT 1`,
  ).first<{ id: string; start_date: string; end_date: string }>();
  if (!period) return c.json({ period: null, rows: [] });

  const { results } = await c.env.DB.prepare(
    `SELECT c.id as category_id, c.name, c."group" as "group",
            COALESCE(b.allocation_cents, 0) as allocation_cents,
            COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as spent_cents
     FROM categories c
     LEFT JOIN budgets b ON b.category_id = c.id AND b.period_id = ?
     LEFT JOIN transactions t ON t.category_id = c.id AND t.posted_at BETWEEN ? AND ?
     GROUP BY c.id`,
  ).bind(period.id, period.start_date, period.end_date).all();

  return c.json({ period, rows: results });
});

budgetRoutes.get('/vice/trend', async (c) => {
  // Weekly vice ratio for the last 8 weeks. Each week = 7-day bucket ending today.
  const weeks: { week_start: string; vice_cents: number; lifestyle_cents: number; ratio_bps: number }[] = [];
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
    const vice = row.results.find((r) => r.g === 'vice')?.s ?? 0;
    const lifestyle = row.results.find((r) => r.g === 'lifestyle')?.s ?? 0;
    const denom = vice + lifestyle;
    const ratio_bps = denom === 0 ? 0 : Math.round((vice / denom) * 10_000);
    const weekStartRow = await c.env.DB.prepare(`SELECT ${start} as d`).first<{ d: string }>();
    weeks.push({ week_start: weekStartRow?.d ?? '', vice_cents: vice, lifestyle_cents: lifestyle, ratio_bps });
  }

  const top = await c.env.DB.prepare(
    `SELECT c.id, c.name,
            COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as spend_cents
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE c."group" = 'vice' AND t.posted_at >= date('now', '-30 days')
     GROUP BY c.id ORDER BY spend_cents DESC LIMIT 5`,
  ).all<{ id: string; name: string; spend_cents: number }>();

  const peakRow = await c.env.DB.prepare(
    `SELECT CAST(strftime('%w', t.posted_at) AS INTEGER) as d,
            COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as s
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE c."group" = 'vice' AND t.posted_at >= date('now', '-90 days')
     GROUP BY d ORDER BY s DESC LIMIT 1`,
  ).first<{ d: number; s: number }>();

  return c.json({
    weeks,
    top_categories: top.results,
    peak_weekday: peakRow?.d ?? null,
    peak_weekday_cents: peakRow?.s ?? 0,
  });
});

budgetRoutes.get('/vice', async (c) => {
  // Vice ratio trailing 30 days: vice / (vice + lifestyle).
  const { results } = await c.env.DB.prepare(
    `SELECT c."group" as "group", COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) as spend_cents
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.posted_at >= date('now', '-30 days')
     GROUP BY c."group"`,
  ).all<{ group: string; spend_cents: number }>();

  const vice = results.find((r) => r.group === 'vice')?.spend_cents ?? 0;
  const lifestyle = results.find((r) => r.group === 'lifestyle')?.spend_cents ?? 0;
  const denom = vice + lifestyle;
  const ratio_bps = denom === 0 ? 0 : Math.round((vice / denom) * 10_000);
  return c.json({ vice_cents: vice, lifestyle_cents: lifestyle, ratio_bps });
});
