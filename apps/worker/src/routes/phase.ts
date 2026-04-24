import { Hono } from 'hono';
import type { Env } from '../env.js';
import { evaluatePhase, PHASE_NAMES, type Phase, type PhaseInputs } from '@declyne/shared';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';
import { evaluateAndRecordPhase, gatherPhaseInputs } from '../lib/phase.js';
import { computeAndStoreStreaks } from '../lib/streaks.js';

export const phaseRoutes = new Hono<{ Bindings: Env }>();

phaseRoutes.get('/', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT phase, entered_at, trigger_rule FROM phase_log ORDER BY entered_at DESC LIMIT 1`,
  ).first<{ phase: number; entered_at: string; trigger_rule: string }>();
  const phase = (row?.phase ?? 1) as Phase;
  return c.json({
    phase,
    name: PHASE_NAMES[phase],
    entered_at: row?.entered_at ?? null,
    trigger_rule: row?.trigger_rule ?? 'bootstrap',
  });
});

phaseRoutes.post('/evaluate', async (c) => {
  const inputs = (await c.req.json()) as PhaseInputs;
  const result = evaluatePhase(inputs);

  if (result.next_phase !== inputs.current_phase && result.rule_triggered) {
    const id = newId('ph');
    await c.env.DB.prepare(
      `INSERT INTO phase_log (id, phase, entered_at, trigger_rule, metrics_json) VALUES (?,?,?,?,?)`,
    )
      .bind(id, result.next_phase, nowIso(), result.rule_triggered, JSON.stringify(result.metrics))
      .run();
    await c.env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('current_phase', ?)`)
      .bind(String(result.next_phase))
      .run();
    await writeEditLog(c.env, [
      {
        entity_type: 'phase',
        entity_id: id,
        field: 'phase',
        old_value: String(inputs.current_phase),
        new_value: String(result.next_phase),
        actor: 'rules',
        reason: 'phase_transition',
      },
    ]);
  }

  return c.json(result);
});

phaseRoutes.post('/recompute', async (c) => {
  const out = await evaluateAndRecordPhase(c.env);
  return c.json(out);
});

phaseRoutes.post('/streaks/recompute', async (c) => {
  const out = await computeAndStoreStreaks(c.env);
  return c.json(out);
});

phaseRoutes.get('/inputs', async (c) => {
  const inputs = await gatherPhaseInputs(c.env);
  return c.json({ inputs });
});

phaseRoutes.get('/log', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM phase_log ORDER BY entered_at DESC LIMIT 50`).all();
  return c.json({ entries: results });
});
