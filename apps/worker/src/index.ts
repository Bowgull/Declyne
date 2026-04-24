import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env.js';
import { importRoutes } from './routes/import.js';
import { phaseRoutes } from './routes/phase.js';
import { debtsRoutes } from './routes/debts.js';
import { splitsRoutes } from './routes/splits.js';
import { budgetRoutes } from './routes/budget.js';
import { investmentRoutes } from './routes/investment.js';
import { reviewRoutes } from './routes/review.js';
import { settingsRoutes } from './routes/settings.js';
import { exportRoutes } from './routes/export.js';
import { auth } from './middleware/auth.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: (o) => o ?? '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.json({ name: 'declyne-api', ok: true }));
app.get('/health', (c) => c.json({ ok: true, as_of: new Date().toISOString() }));

app.use('/api/*', auth);

const api = new Hono<{ Bindings: Env }>();
api.route('/import', importRoutes);
api.route('/phase', phaseRoutes);
api.route('/debts', debtsRoutes);
api.route('/splits', splitsRoutes);
api.route('/budget', budgetRoutes);
api.route('/investment', investmentRoutes);
api.route('/review', reviewRoutes);
api.route('/settings', settingsRoutes);
api.route('/export', exportRoutes);

app.route('/api', api);

app.onError((err, c) => {
  console.error('worker error', err);
  return c.json({ error: err.message }, 500);
});

export default app;
