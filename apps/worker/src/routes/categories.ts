import { Hono } from 'hono';
import type { Env } from '../env.js';

export const categoriesRoutes = new Hono<{ Bindings: Env }>();

categoriesRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, "group" as "group", parent_id FROM categories ORDER BY "group" ASC, name ASC`,
  ).all();
  return c.json({ categories: results });
});
