import { Hono } from 'hono';
import type { Env } from '../env.js';
import { loadPaycheckSnapshot } from '../lib/periodIntelligence.js';

export const paychequeRoutes = new Hono<{ Bindings: Env }>();

// Returns the unified paycheque snapshot — income, committed (bills + debt
// mins + savings), recommended debt extra, spending money. The Paycheque
// page (session 73) renders this top-to-bottom. The plan kernel uses the
// same intelligence under the hood via loadPaycheckInputs.
paychequeRoutes.get('/', async (c) => {
  const snap = await loadPaycheckSnapshot(c.env);
  if (!snap) return c.json({ snapshot: null });
  return c.json({ snapshot: snap });
});
