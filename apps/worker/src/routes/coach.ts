import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { buildCoachPayload, COACH_SYSTEM_PROMPT, type CoachSnapshot } from '../lib/coach.js';
import type { Phase } from '@declyne/shared';

export const coachRoutes = new Hono<{ Bindings: Env }>();

coachRoutes.get('/latest', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT * FROM coach_messages ORDER BY generated_at DESC LIMIT 1`,
  ).first();
  return c.json({ message: row ?? null });
});

coachRoutes.get('/history', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM coach_messages ORDER BY generated_at DESC LIMIT 30`,
  ).all();
  return c.json({ rows: results });
});

coachRoutes.post('/summary', async (c) => {
  const snap = await c.env.DB.prepare(
    `SELECT * FROM behaviour_snapshots ORDER BY as_of DESC LIMIT 1`,
  ).first<CoachSnapshot & { id: string }>();
  if (!snap) return c.json({ error: 'no_snapshot' }, 404);

  const phaseRow = await c.env.DB.prepare(
    `SELECT phase FROM phase_log ORDER BY entered_at DESC LIMIT 1`,
  ).first<{ phase: number }>();
  const phase = ((phaseRow?.phase ?? 1) as Phase);

  const payload = buildCoachPayload(phase, {
    as_of: snap.as_of,
    vice_ratio_bps: snap.vice_ratio_bps,
    days_to_zero: snap.days_to_zero,
    cc_payoff_streak: snap.cc_payoff_streak,
    subscription_creep_pct_bps: snap.subscription_creep_pct_bps,
    savings_increased_bool: snap.savings_increased_bool,
    vice_peak_day: snap.vice_peak_day,
    review_queue_lag_days: snap.review_queue_lag_days,
    reconciliation_streak: snap.reconciliation_streak,
  });

  const model = 'gpt-4o-mini';
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: COACH_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text();
    return c.json({ error: 'openai_error', detail: err }, 502);
  }

  const ai = (await openaiRes.json()) as { choices: Array<{ message: { content: string } }> };
  const text = (ai.choices[0]?.message.content ?? '').replace(/[\u2013\u2014]/g, ',').trim();

  const hashBytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const hash = Array.from(new Uint8Array(hashBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const id = newId('coach');
  await c.env.DB.prepare(
    `INSERT INTO coach_messages (id, generated_at, snapshot_id, phase, prompt_hash, response_text, model)
     VALUES (?,?,?,?,?,?,?)`,
  )
    .bind(id, nowIso(), snap.id, phase, hash, text, model)
    .run();

  return c.json({ id, phase, text, snapshot_id: snap.id, model });
});
