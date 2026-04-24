import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env.js';
import { accountsRoutes } from './routes/accounts.js';
import { importRoutes } from './routes/import.js';
import { phaseRoutes } from './routes/phase.js';
import { debtsRoutes } from './routes/debts.js';
import { splitsRoutes } from './routes/splits.js';
import { budgetRoutes } from './routes/budget.js';
import { investmentRoutes } from './routes/investment.js';
import { reviewRoutes } from './routes/review.js';
import { settingsRoutes } from './routes/settings.js';
import { exportRoutes } from './routes/export.js';
import { categoriesRoutes } from './routes/categories.js';
import { routingRoutes } from './routes/routing.js';
import { periodsRoutes } from './routes/periods.js';
import { signalsRoutes, computeAndStoreSignals } from './routes/signals.js';
import { cronRoutes, logCronRun } from './routes/cron.js';
import { coachRoutes } from './routes/coach.js';
import { marketRoutes } from './routes/market.js';
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
api.route('/accounts', accountsRoutes);
api.route('/import', importRoutes);
api.route('/phase', phaseRoutes);
api.route('/debts', debtsRoutes);
api.route('/splits', splitsRoutes);
api.route('/budget', budgetRoutes);
api.route('/investment', investmentRoutes);
api.route('/review', reviewRoutes);
api.route('/settings', settingsRoutes);
api.route('/export', exportRoutes);
api.route('/categories', categoriesRoutes);
api.route('/routing', routingRoutes);
api.route('/periods', periodsRoutes);
api.route('/signals', signalsRoutes);
api.route('/cron', cronRoutes);
api.route('/coach', coachRoutes);
api.route('/market', marketRoutes);

app.route('/api', api);

app.onError((err, c) => {
  console.error('worker error', err);
  return c.json({ error: err.message }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      logCronRun(env, 'signals.compute', async () => {
        const out = await computeAndStoreSignals(env);
        return `snapshot ${out.id}`;
      }).catch((err) => console.error('scheduled signals.compute failed', err)),
    );
  },
};
