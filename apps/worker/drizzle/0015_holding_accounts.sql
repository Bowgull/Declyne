-- Session 61: Assets migration. Each holding lot links to a GL asset account.
--
-- Backfill (runHoldingsBackfill in glHoldings.ts) walks every holdings row,
-- creates Assets:Investments:<Wrapper>:<Symbol> if missing (parent gla_assets_invest),
-- writes ACB + units + currency into metadata_json, and posts an opening-balance
-- JE seeding cost basis (DR Assets:Investments:<...> / CR Equity:Opening Balance).
--
-- Schema only — opening JEs are posted by the backfill so the migration stays
-- declarative. Multi-currency: USD lots stay in USD on their account, currency
-- carried in metadata_json.

ALTER TABLE holdings ADD COLUMN account_id TEXT REFERENCES gl_accounts(id);
CREATE INDEX IF NOT EXISTS holdings_account_idx ON holdings(account_id);
