import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env.js';
import { isAllowedOrigin, securityHeaders } from './middleware/security.js';
import { accountsRoutes } from './routes/accounts.js';
import { importRoutes } from './routes/import.js';
import { phaseRoutes } from './routes/phase.js';
import { debtsRoutes } from './routes/debts.js';
import { splitsRoutes } from './routes/splits.js';
import { counterpartiesRoutes } from './routes/counterparties.js';
import { budgetRoutes } from './routes/budget.js';
import { investmentRoutes } from './routes/investment.js';
import { reviewRoutes } from './routes/review.js';
import { settingsRoutes } from './routes/settings.js';
import { exportRoutes } from './routes/export.js';
import { categoriesRoutes } from './routes/categories.js';
import { allocationsRoutes } from './routes/allocations.js';
import { periodsRoutes } from './routes/periods.js';
import { signalsRoutes, computeAndStoreSignals } from './routes/signals.js';
import { evaluateAndRecordPhase } from './lib/phase.js';
import { computeAndStoreStreaks } from './lib/streaks.js';
import { cronRoutes, logCronRun } from './routes/cron.js';
import { marketRoutes } from './routes/market.js';
import { editLogRoutes } from './routes/editLog.js';
import { merchantsRoutes } from './routes/merchants.js';
import { creditRoutes } from './routes/credit.js';
import { goalsRoutes } from './routes/goals.js';
import { holdingsRoutes } from './routes/holdings.js';
import { ccStatementsRoutes } from './routes/ccStatements.js';
import { reconciliationRoutes } from './routes/reconciliation.js';
import { todayRoutes } from './routes/today.js';
import { dataPurgeRoutes } from './routes/dataPurge.js';
import { auth } from './middleware/auth.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', securityHeaders);
app.use('*', cors({
  origin: (o) => (isAllowedOrigin(o) ? (o ?? '*') : ''),
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/', (c) => c.json({ name: 'declyne-api', ok: true }));
app.get('/health', (c) => c.json({ ok: true, as_of: new Date().toISOString() }));
app.get('/healthz', (c) => c.json({ ok: true }));

app.use('/api/*', auth);

const api = new Hono<{ Bindings: Env }>();
api.route('/accounts', accountsRoutes);
api.route('/import', importRoutes);
api.route('/phase', phaseRoutes);
api.route('/debts', debtsRoutes);
api.route('/splits', splitsRoutes);
api.route('/counterparties', counterpartiesRoutes);
api.route('/budget', budgetRoutes);
api.route('/investment', investmentRoutes);
api.route('/review', reviewRoutes);
api.route('/settings', settingsRoutes);
api.route('/export', exportRoutes);
api.route('/categories', categoriesRoutes);
api.route('/allocations', allocationsRoutes);
api.route('/periods', periodsRoutes);
api.route('/signals', signalsRoutes);
api.route('/cron', cronRoutes);
api.route('/market', marketRoutes);
api.route('/edit-log', editLogRoutes);
api.route('/merchants', merchantsRoutes);
api.route('/credit', creditRoutes);
api.route('/goals', goalsRoutes);
api.route('/holdings', holdingsRoutes);
api.route('/cc-statements', ccStatementsRoutes);
api.route('/reconciliation', reconciliationRoutes);
api.route('/today', todayRoutes);
api.route('/data/purge', dataPurgeRoutes);

app.route('/api', api);

app.onError((err, c) => {
  console.error('worker error', err);
  return c.json({ error: 'internal' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await logCronRun(env, 'signals.compute', async () => {
          const out = await computeAndStoreSignals(env);
          return `snapshot ${out.id}`;
        }).catch((err) => console.error('scheduled signals.compute failed', err));
        await logCronRun(env, 'streaks.recompute', async () => {
          const out = await computeAndStoreStreaks(env);
          return `essentials=${out.essentials_covered_streak_periods} util=${out.utilization_under_30_streak_statements} ontime=${out.on_time_streak_days}`;
        }).catch((err) => console.error('scheduled streaks.recompute failed', err));
        await logCronRun(env, 'phase.recompute', async () => {
          const out = await evaluateAndRecordPhase(env);
          return out.transitioned
            ? `transition ${out.inputs.current_phase}->${out.evaluated.next_phase} (${out.evaluated.rule_triggered})`
            : `no change, phase ${out.inputs.current_phase}`;
        }).catch((err) => console.error('scheduled phase.recompute failed', err));
      })(),
    );
  },
};
