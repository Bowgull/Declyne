import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { computeSignalsForSymbol } from '../lib/signals.js';

export const marketRoutes = new Hono<{ Bindings: Env }>();

marketRoutes.get('/snapshot', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT * FROM market_snapshots ORDER BY as_of DESC LIMIT 1`,
  ).first();
  return c.json({ snapshot: row ?? null });
});

marketRoutes.post('/fetch', async (c) => {
  const { results: holdingRows } = await c.env.DB.prepare(
    `SELECT DISTINCT symbol FROM holdings`,
  ).all<{ symbol: string }>();

  const symbols = holdingRows.map((h) => h.symbol);
  const fetched: string[] = [];
  const errors: string[] = [];

  for (const symbol of symbols) {
    try {
      const tdUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=200&apikey=${c.env.TWELVE_DATA_KEY}`;
      let prices: Array<{ date: string; close_cents: number }> = [];

      const tdRes = await fetch(tdUrl);
      if (tdRes.ok) {
        const tdData = (await tdRes.json()) as {
          status?: string;
          code?: number;
          values?: Array<{ datetime: string; close: string }>;
        };
        if (!tdData.code && tdData.values?.length) {
          prices = tdData.values.map((v) => ({
            date: v.datetime,
            close_cents: Math.round(parseFloat(v.close) * 100),
          }));
        }
      }

      if (prices.length === 0) {
        const fmpUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?serietype=line&timeseries=200&apikey=${c.env.FMP_KEY}`;
        const fmpRes = await fetch(fmpUrl);
        if (fmpRes.ok) {
          const fmpData = (await fmpRes.json()) as {
            historical?: Array<{ date: string; close: number }>;
          };
          if (fmpData.historical?.length) {
            prices = fmpData.historical.map((v) => ({
              date: v.date,
              close_cents: Math.round(v.close * 100),
            }));
          }
        }
      }

      if (prices.length === 0) {
        errors.push(`${symbol}: no data from Twelve Data or FMP`);
        continue;
      }

      const stmt = c.env.DB.prepare(
        `INSERT OR REPLACE INTO prices (symbol, date, close_cents, source) VALUES (?,?,?,?)`,
      );
      await c.env.DB.batch(prices.map((p) => stmt.bind(symbol, p.date, p.close_cents, 'twelve_data')));

      const { results: allPrices } = await c.env.DB.prepare(
        `SELECT date, close_cents FROM prices WHERE symbol = ? ORDER BY date ASC`,
      ).bind(symbol).all<{ date: string; close_cents: number }>();

      const signals = computeSignalsForSymbol(allPrices);
      if (signals.length > 0) {
        const now = nowIso();
        const sigStmt = c.env.DB.prepare(
          `INSERT OR REPLACE INTO signals (symbol, date, sma50, sma200, rsi14, momentum_30d, computed_at) VALUES (?,?,?,?,?,?,?)`,
        );
        await c.env.DB.batch(
          signals.map((s) => sigStmt.bind(symbol, s.date, s.sma50, s.sma200, s.rsi14, s.momentum_30d, now)),
        );
      }

      fetched.push(symbol);
    } catch (err) {
      errors.push(`${symbol}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let bocBps: number | null = null;
  let cadUsd: number | null = null;
  let tsxClose: number | null = null;
  let sp500Close: number | null = null;

  try {
    const bocRes = await fetch(
      'https://www.bankofcanada.ca/valet/observations/V122514/json?recent=1',
    );
    if (bocRes.ok) {
      const bocData = (await bocRes.json()) as {
        observations?: Array<Record<string, { v: string }>>;
      };
      const v = bocData.observations?.[0]?.V122514?.v;
      if (v) bocBps = Math.round(parseFloat(v) * 100);
    }
  } catch {}

  try {
    const fxRes = await fetch(
      `https://api.twelvedata.com/price?symbol=USD/CAD&apikey=${c.env.TWELVE_DATA_KEY}`,
    );
    if (fxRes.ok) {
      const fxData = (await fxRes.json()) as { price?: string };
      if (fxData.price) cadUsd = Math.round(parseFloat(fxData.price) * 10_000);
    }
  } catch {}

  try {
    const tsxRes = await fetch(
      `https://api.twelvedata.com/price?symbol=XIU.TO&apikey=${c.env.TWELVE_DATA_KEY}`,
    );
    if (tsxRes.ok) {
      const tsxData = (await tsxRes.json()) as { price?: string };
      if (tsxData.price) tsxClose = Math.round(parseFloat(tsxData.price) * 100);
    }
  } catch {}

  try {
    const spRes = await fetch(
      `https://api.twelvedata.com/price?symbol=SPY&apikey=${c.env.TWELVE_DATA_KEY}`,
    );
    if (spRes.ok) {
      const spData = (await spRes.json()) as { price?: string };
      if (spData.price) sp500Close = Math.round(parseFloat(spData.price) * 100);
    }
  } catch {}

  const snapId = newId('msnap');
  const today = nowIso().slice(0, 10);
  await c.env.DB.prepare(
    `INSERT INTO market_snapshots (id, as_of, boc_overnight_bps, cad_usd, tsx_close, sp500_close) VALUES (?,?,?,?,?,?)`,
  ).bind(snapId, today, bocBps, cadUsd, tsxClose, sp500Close).run();

  return c.json({
    symbols_fetched: fetched,
    errors,
    snapshot: { boc_overnight_bps: bocBps, cad_usd: cadUsd, tsx_close: tsxClose, sp500_close: sp500Close },
  });
});
