-- Session 60: Liabilities migration. Each debt links to a GL account.
--
-- Three paths during backfill (runDebtBackfill in debtGl.ts):
--   1. debt.account_id_linked set → look up that bank account's GL liability
--      account by path (Liabilities:CreditCards:<name> or Liabilities:Loans:<name>),
--      already created by glBackfill in session 58. Link.
--   2. A counterparty exists with name = debt.name → link to counterparties.account_id.
--      Avoids double-counting personal IOUs that exist in both tables.
--   3. Free-standing debt → create a new Liabilities:Loans:<name> account and
--      post an opening-balance JE (DR Equity:Opening Balance / CR Liabilities:Loans:<Name>)
--      seeding the principal_cents.
--
-- Schema only — opening-balance JEs are posted by runDebtBackfill so the migration
-- itself stays declarative.

ALTER TABLE debts ADD COLUMN account_id TEXT REFERENCES gl_accounts(id);
CREATE INDEX IF NOT EXISTS debts_account_idx ON debts(account_id);
