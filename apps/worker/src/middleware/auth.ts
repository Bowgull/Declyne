import type { Context, Next } from 'hono';
import type { Env } from '../env.js';

// Single-user app. A shared bearer token between client and worker is enough.
// Token is baked into the client build as VITE_API_TOKEN; worker reads API_TOKEN.
export async function auth(c: Context<{ Bindings: Env }>, next: Next) {
  const expected = c.env.API_TOKEN;
  if (!expected) {
    return c.json({ error: 'server missing API_TOKEN' }, 500);
  }
  const h = c.req.header('Authorization');
  if (h !== `Bearer ${expected}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
}
