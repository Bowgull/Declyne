import { Hono } from 'hono';
import type { Env } from '../env.js';

export const taxYearRoutes = new Hono<{ Bindings: Env }>();

// GET /api/settings/tax-year?year=YYYY
// Returns GL-derived income YTD and investment contributions per wrapper for
// the given calendar year. Numbers come from journal entries, not CRA data —
// labeled clearly as estimates, not authoritative for tax filing.
taxYearRoutes.get('/', async (c) => {
  const yearParam = c.req.query('year');
  const year =
    yearParam && /^\d{4}$/.test(yearParam)
      ? yearParam
      : new Date().getFullYear().toString();

  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const today = new Date().toISOString().slice(0, 10);
  // Never query past today even if the year extends into the future.
  const effectiveTo = to < today ? to : today;

  // Income YTD — credit minus debit on Income:Salary GL account.
  const incomeRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(l.credit_cents) - SUM(l.debit_cents), 0) AS income_cents
     FROM journal_lines l
     JOIN gl_accounts a ON a.id = l.account_id
     JOIN journal_entries e ON e.id = l.journal_entry_id
     WHERE a.path = 'Income:Salary'
       AND date(e.posted_at) >= ?
       AND date(e.posted_at) <= ?`,
  )
    .bind(from, effectiveTo)
    .first<{ income_cents: number }>();

  // Investment contributions — sum of debit JEs posted to holding asset accounts
  // (Assets:Investments:<Wrapper>:<Symbol>) within the year. The wrapper is
  // extracted from the path. Note: the backfill posted all opening JEs on the
  // backfill date, so these numbers reflect GL activity in the year, not the
  // original purchase date.
  const contribRows = await c.env.DB.prepare(
    `SELECT
       CASE
         WHEN a.path LIKE 'Assets:Investments:TFSA:%'   THEN 'tfsa'
         WHEN a.path LIKE 'Assets:Investments:FHSA:%'   THEN 'fhsa'
         WHEN a.path LIKE 'Assets:Investments:RRSP:%'   THEN 'rrsp'
         WHEN a.path LIKE 'Assets:Investments:NonReg:%' THEN 'nonreg'
       END AS wrapper,
       COALESCE(SUM(l.debit_cents), 0) AS invested_cents
     FROM journal_lines l
     JOIN gl_accounts a ON a.id = l.account_id
     JOIN journal_entries e ON e.id = l.journal_entry_id
     WHERE a.path LIKE 'Assets:Investments:%'
       AND date(e.posted_at) >= ?
       AND date(e.posted_at) <= ?
     GROUP BY wrapper`,
  )
    .bind(from, effectiveTo)
    .all<{ wrapper: string | null; invested_cents: number }>();

  const contributions: Record<string, number> = { tfsa: 0, fhsa: 0, rrsp: 0, nonreg: 0 };
  for (const r of contribRows.results) {
    if (r.wrapper && r.wrapper in contributions) contributions[r.wrapper] = r.invested_cents;
  }

  // Annual limits hard-coded for 2026. RRSP room depends on prior-year income
  // (18% of earned income, ~$32k cap for 2026) — we surface it as null since we
  // don't have the prior-year T4.
  const ANNUAL_LIMITS: Record<string, number | null> = {
    tfsa: 700_000,   // $7,000
    fhsa: 800_000,   // $8,000
    rrsp: null,       // requires prior-year T4 to compute
    nonreg: null,     // no limit
  };

  return c.json({
    year,
    income_ytd_cents: incomeRow?.income_cents ?? 0,
    contributions,
    annual_limits: ANNUAL_LIMITS,
    note: 'GL-derived · not authoritative for CRA purposes',
  });
});
