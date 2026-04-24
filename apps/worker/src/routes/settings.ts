import { Hono } from 'hono';
import type { Env } from '../env.js';

export const settingsRoutes = new Hono<{ Bindings: Env }>();

settingsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT key, value FROM settings`).all<{ key: string; value: string }>();
  const map: Record<string, string> = {};
  for (const r of results) map[r.key] = r.value;
  return c.json({ settings: map });
});

settingsRoutes.post('/:key', async (c) => {
  const key = c.req.param('key');
  const b = (await c.req.json()) as { value: string };
  await c.env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).bind(key, b.value).run();
  return c.json({ ok: true });
});
