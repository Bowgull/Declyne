import type { Context, Next } from 'hono';
import type { Env } from '../env.js';

// Single-user app. A shared bearer token between client and worker is enough.
// On the client the token lives in the iOS Keychain (capacitor-secure-storage-plugin)
// after first run; there is no build-time token (it would ship in the bundle). Worker reads
// API_TOKEN from Cloudflare Workers Secrets (set via `wrangler secret put`).
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
