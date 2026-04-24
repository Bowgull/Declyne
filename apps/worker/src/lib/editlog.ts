import type { Env } from '../env.js';
import type { EditLogActor } from '@declyne/shared';
import { newId, nowIso } from './ids.js';

export interface EditLogWrite {
  entity_type: string;
  entity_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor: EditLogActor;
  reason: string;
}

export async function writeEditLog(env: Env, entries: EditLogWrite[]): Promise<void> {
  if (entries.length === 0) return;
  const stmt = env.DB.prepare(
    `INSERT INTO edit_log (id, entity_type, entity_id, field, old_value, new_value, actor, reason, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  );
  const now = nowIso();
  const batch = entries.map((e) =>
    stmt.bind(newId('log'), e.entity_type, e.entity_id, e.field, e.old_value, e.new_value, e.actor, e.reason, now),
  );
  await env.DB.batch(batch);
}
