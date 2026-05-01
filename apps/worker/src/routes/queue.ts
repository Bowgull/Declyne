import { Hono } from 'hono';
import type { Env } from '../env.js';
import { loadMasterQueue } from '../lib/loadMasterQueue.js';

export const queueRoutes = new Hono<{ Bindings: Env }>();

queueRoutes.get('/', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const result = await loadMasterQueue(c.env, today);
  return c.json(result);
});
