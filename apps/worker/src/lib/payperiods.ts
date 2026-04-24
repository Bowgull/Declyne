// Paycheque-anchored pay period detection.
// A period starts on the day a paycheque deposit posts and ends the day before
// the next deposit. Detection is deterministic: income into a configured source
// account, amount >= threshold, description matches a case-insensitive substring.

export interface PaycheckCandidate {
  posted_at: string;
  amount_cents: number;
  description_raw: string;
}

export interface DetectedPeriod {
  start_date: string;
  end_date: string;
  paycheque_cents: number;
}

export interface DetectConfig {
  pattern: string;
  min_cents: number;
  fallback_days: number;
}

function toDate(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function detectPeriods(
  candidates: PaycheckCandidate[],
  config: DetectConfig,
): DetectedPeriod[] {
  const pat = config.pattern.trim().toLowerCase();
  const matches = candidates
    .filter(
      (c) =>
        c.amount_cents >= config.min_cents &&
        (pat.length === 0 || c.description_raw.toLowerCase().includes(pat)),
    )
    .map((c) => ({ ...c, date: toDate(c.posted_at) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const out: DetectedPeriod[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const next = matches[i + 1];
    const end = next ? addDays(next.date, -1) : addDays(m.date, config.fallback_days - 1);
    if (end < m.date) continue;
    out.push({
      start_date: m.date,
      end_date: end,
      paycheque_cents: m.amount_cents,
    });
  }
  return out;
}
