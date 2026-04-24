import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';

export const cronRoutes = new Hono<{ Bindings: Env }>();

cronRoutes.get('/runs', async (c) => {
  const limit = Number(c.req.query('limit') ?? '30');
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all();
  return c.json({ runs: results });
});

export async function logCronRun(
  env: Env,
  job: string,
  run: () => Promise<string | void>,
): Promise<void> {
  const id = newId('cron');
  const started = nowIso();
  await env.DB.prepare(
    `INSERT INTO cron_runs (id, job, started_at, status, detail) VALUES (?,?,?,?,?)`,
  )
    .bind(id, job, started, 'ok', null)
    .run();
  try {
    const detail = (await run()) ?? null;
    await env.DB.prepare(
      `UPDATE cron_runs SET finished_at = ?, status = 'ok', detail = ? WHERE id = ?`,
    )
      .bind(nowIso(), detail, id)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await env.DB.prepare(
      `UPDATE cron_runs SET finished_at = ?, status = 'error', detail = ? WHERE id = ?`,
    )
      .bind(nowIso(), msg, id)
      .run();
    throw err;
  }
}
