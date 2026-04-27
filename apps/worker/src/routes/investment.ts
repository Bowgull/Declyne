import { Hono } from 'hono';
import type { Env } from '../env.js';
import { computeSignalsForSymbol } from '../lib/signals.js';
import { newId, nowIso } from '../lib/ids.js';
import { redactSensitive } from '../lib/logRedact.js';

export const investmentRoutes = new Hono<{ Bindings: Env }>();

investmentRoutes.get('/holdings', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT h.*,
            p.close_cents AS latest_price_cents,
            p.date        AS price_date,
            s.sma50, s.sma200, s.rsi14, s.momentum_30d
     FROM holdings h
     LEFT JOIN prices p
       ON p.symbol = h.symbol
      AND p.date = (SELECT MAX(date) FROM prices p2 WHERE p2.symbol = h.symbol)
     LEFT JOIN signals s
       ON s.symbol = h.symbol AND s.date = p.date`,
  ).all();
  return c.json({ holdings: results });
});

investmentRoutes.get('/signals/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM signals WHERE symbol = ? ORDER BY date DESC LIMIT 30`,
  ).bind(symbol).all();
  return c.json({ symbol, signals: results });
});

investmentRoutes.post('/signals/recompute/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const { results: priceRows } = await c.env.DB.prepare(
    `SELECT date, close_cents FROM prices WHERE symbol = ? ORDER BY date ASC`,
  ).bind(symbol).all<{ date: string; close_cents: number }>();

  if (priceRows.length === 0) return c.json({ updated: 0, reason: 'no_prices' });

  const signals = computeSignalsForSymbol(priceRows.map((p) => ({ date: p.date, close_cents: p.close_cents })));
  const now = nowIso();

  const stmt = c.env.DB.prepare(
    `INSERT OR REPLACE INTO signals (symbol, date, sma50, sma200, rsi14, momentum_30d, computed_at)
     VALUES (?,?,?,?,?,?,?)`,
  );
  const batch = signals.map((s) =>
    stmt.bind(symbol, s.date, s.sma50, s.sma200, s.rsi14, s.momentum_30d, now),
  );
  if (batch.length > 0) await c.env.DB.batch(batch);

  return c.json({ updated: signals.length });
});

// Rate limit: at most RECOMMEND_LIMIT_PER_HOUR successful generations per rolling hour.
// Counted from recommendations.generated_at. OpenAI calls cost money; this caps damage if the bearer token leaks.
const RECOMMEND_LIMIT_PER_HOUR = 10;

investmentRoutes.post('/recommend', async (c) => {
  // Builds payload per declyne-investment skill and calls GPT-4o.
  // GPT never does arithmetic. All numbers come from our signals table.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM recommendations WHERE generated_at >= ?`,
  ).bind(since).first<{ n: number }>();
  if ((recent?.n ?? 0) >= RECOMMEND_LIMIT_PER_HOUR) {
    return c.json({ error: 'rate_limited', limit: RECOMMEND_LIMIT_PER_HOUR, window: 'hour' }, 429);
  }

  const body = (await c.req.json()) as { phase: number };

  const { results: holdings } = await c.env.DB.prepare(`SELECT * FROM holdings`).all();
  const { results: signalRows } = await c.env.DB.prepare(
    `SELECT symbol, sma50, sma200, rsi14, momentum_30d FROM signals s1
     WHERE date = (SELECT MAX(date) FROM signals s2 WHERE s2.symbol = s1.symbol)`,
  ).all<{ symbol: string; sma50: number | null; sma200: number | null; rsi14: number | null; momentum_30d: number | null }>();

  const signals: Record<string, unknown> = {};
  for (const r of signalRows) signals[r.symbol] = r;

  const market = await c.env.DB.prepare(
    `SELECT * FROM market_snapshots ORDER BY as_of DESC LIMIT 1`,
  ).first<Record<string, unknown>>();

  const tfsa = await c.env.DB.prepare(
    `SELECT SUM(contribution_limit_cents - used_cents) as remaining FROM tfsa_room`,
  ).first<{ remaining: number | null }>();

  const payload = {
    as_of: new Date().toISOString().slice(0, 10),
    phase: body.phase,
    tfsa_room_cents: tfsa?.remaining ?? 0,
    holdings,
    signals,
    market: market ?? null,
    schema: {
      action: 'buy|sell|hold',
      symbol: 'string',
      wrapper: 'tfsa|fhsa|nonreg',
      units: 'number from payload, not computed',
      reason: 'string, under 200 chars',
      cited_signals: ['sma50', 'rsi14'],
    },
  };

  const systemPrompt = `You are Declyne's investment coach. You write for one user.

1. You never do arithmetic. All numbers you cite must come from the input payload.
2. You never recommend a trade that violates the user's current phase constraints.
3. Core allocation is 80% broad ETF. Do not propose reducing core below 70% unless explicitly asked.
4. Satellite positions max 5, max 5% each of total portfolio.
5. TFSA fills before non-registered unless TFSA room is zero.
6. If TFSA room is zero and a satellite idea would be tax-inefficient in non-registered, say so and defer.
7. Cite SMA-50, SMA-200, RSI-14, and 30d momentum from the payload when recommending a symbol.
8. If RSI-14 > 70, flag overbought and prefer wait. If RSI-14 < 30, flag oversold and note it is a signal, not a buy order.
9. Never recommend leveraged, inverse, or single-country frontier ETFs.
10. Never recommend options, crypto, or individual bonds.
11. Output JSON matching the schema in the payload. No prose outside the schema.
12. If data is stale (older than 2 trading days), return action: "hold" and reason: "stale_data".
13. Tone: dry, direct, short. No hype. No emojis. No em dashes.`;

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text();
    console.error('openai_error', redactSensitive(err));
    return c.json({ error: 'openai_error' }, 502);
  }

  const ai = (await openaiRes.json()) as { choices: Array<{ message: { content: string } }> };
  const content = ai.choices[0]?.message.content ?? '{}';
  const id = newId('rec');
  const now = nowIso();

  // Prompt hash so accepted/executed can be audited.
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const hash = Array.from(new Uint8Array(hashBytes)).map((b) => b.toString(16).padStart(2, '0')).join('');

  await c.env.DB.prepare(
    `INSERT INTO recommendations (id, generated_at, prompt_hash, response_json, accepted, executed_at)
     VALUES (?,?,?,?,0,NULL)`,
  ).bind(id, now, hash, content).run();

  return c.json({ id, response: JSON.parse(content) });
});
