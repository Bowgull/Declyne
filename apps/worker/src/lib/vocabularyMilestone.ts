import type { Env } from '../env.js';

export function shouldUnlock(currentLevel: number, milestone: number): boolean {
  return currentLevel < milestone;
}

const MESSAGES: Record<number, string> = {
  1: "You just imported transactions. In bookkeeping, they're called journal entries — every money movement recorded.",
  2: 'You reconciled for the first time. Bookkeepers call it closing the books — checking your records against reality.',
  3: 'That payment reduced a liability. A liability is money you owe. Every stamp moves the number.',
  4: 'You accepted a payment plan. Bookkeepers call this a debt schedule — fixed installments, fixed end date.',
};

export function vocabMessage(level: number): string {
  return MESSAGES[level] ?? '';
}

export async function maybeUnlockVocabulary(
  env: Env,
  milestone: 1 | 2 | 3 | 4,
): Promise<{ level: number; message: string } | null> {
  const row = await env.DB.prepare(
    `SELECT value FROM settings WHERE key = 'vocabulary_level'`,
  ).first<{ value: string }>();
  const current = parseInt(row?.value ?? '0', 10);
  if (!shouldUnlock(current, milestone)) return null;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('vocabulary_level', ?)`,
  )
    .bind(String(milestone))
    .run();
  return { level: milestone, message: vocabMessage(milestone) };
}
