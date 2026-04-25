import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const reconciliationRoutes = new Hono<{ Bindings: Env }>();

// Returns the most recent Sunday (>= today's day-of-week walks back).
// `today` must be YYYY-MM-DD. Output YYYY-MM-DD. Sunday counts as itself.
export function mostRecentSunday(today: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('today must be YYYY-MM-DD');
  const d = new Date(`${today}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function isCompletedThisWeek(lastAt: string | null, today: string): boolean {
  if (!lastAt) return false;
  const sunday = mostRecentSunday(today);
  // lastAt is ISO timestamp; compare against start of Sunday UTC.
  return lastAt >= `${sunday}T00:00:00.000Z`;
}

async function readSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = ?`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function writeSetting(env: Env, key: string, value: string): Promise<string | null> {
  const prev = await readSetting(env, key);
  await env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
    .bind(key, value)
    .run();
  return prev;
}

reconciliationRoutes.get('/status', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const last_at = await readSetting(c.env, 'last_reconciliation_at');
  const streakRaw = await readSetting(c.env, 'reconciliation_streak');
  const streak = Number(streakRaw ?? '0') || 0;
  return c.json({
    last_reconciliation_at: last_at,
    reconciliation_streak: streak,
    completed_this_week: isCompletedThisWeek(last_at, today),
    week_starts_on: mostRecentSunday(today),
  });
});

reconciliationRoutes.post('/complete', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const last_at = await readSetting(c.env, 'last_reconciliation_at');
  if (isCompletedThisWeek(last_at, today)) {
    const streakRaw = await readSetting(c.env, 'reconciliation_streak');
    return c.json({
      ok: true,
      already: true,
      reconciliation_streak: Number(streakRaw ?? '0') || 0,
      last_reconciliation_at: last_at,
    });
  }

  const now = nowIso();
  const prevStreakRaw = await readSetting(c.env, 'reconciliation_streak');
  const prevStreak = Number(prevStreakRaw ?? '0') || 0;
  const nextStreak = prevStreak + 1;

  const prevLast = await writeSetting(c.env, 'last_reconciliation_at', now);
  await writeSetting(c.env, 'reconciliation_streak', String(nextStreak));

  const eventId = newId('rec');
  await writeEditLog(c.env, [
    {
      entity_type: 'reconciliation',
      entity_id: eventId,
      field: 'last_reconciliation_at',
      old_value: prevLast,
      new_value: now,
      actor: 'user',
      reason: 'reconciliation_complete',
    },
    {
      entity_type: 'reconciliation',
      entity_id: eventId,
      field: 'reconciliation_streak',
      old_value: String(prevStreak),
      new_value: String(nextStreak),
      actor: 'user',
      reason: 'reconciliation_complete',
    },
  ]);

  return c.json({
    ok: true,
    already: false,
    reconciliation_streak: nextStreak,
    last_reconciliation_at: now,
  });
});
