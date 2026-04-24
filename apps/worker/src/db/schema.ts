import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// ============================================================================
// CORE (13)
// ============================================================================

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  institution: text('institution').notNull(),
  type: text('type', { enum: ['chequing', 'savings', 'credit', 'loan'] }).notNull(),
  currency: text('currency').notNull().default('CAD'),
  last_import_at: text('last_import_at'),
  archived: integer('archived').notNull().default(0),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  account_id: text('account_id').notNull().references(() => accounts.id),
  posted_at: text('posted_at').notNull(),
  amount_cents: integer('amount_cents').notNull(),
  description_raw: text('description_raw').notNull(),
  merchant_id: text('merchant_id').references(() => merchants.id),
  category_id: text('category_id').references(() => categories.id),
  dedup_hash: text('dedup_hash').notNull().unique(),
  source: text('source', { enum: ['csv', 'manual'] }).notNull(),
  created_at: text('created_at').notNull(),
});

export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey(),
  display_name: text('display_name').notNull(),
  normalized_key: text('normalized_key').notNull().unique(),
  category_default_id: text('category_default_id').references(() => categories.id),
  verified: integer('verified').notNull().default(0),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  group: text('group', { enum: ['essentials', 'lifestyle', 'vice', 'income', 'transfer', 'debt'] }).notNull(),
  parent_id: text('parent_id'),
});

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  period_id: text('period_id').notNull().references(() => pay_periods.id),
  category_id: text('category_id').notNull().references(() => categories.id),
  allocation_cents: integer('allocation_cents').notNull(),
});

export const pay_periods = sqliteTable('pay_periods', {
  id: text('id').primaryKey(),
  start_date: text('start_date').notNull(),
  end_date: text('end_date').notNull(),
  paycheque_cents: integer('paycheque_cents').notNull(),
  source_account_id: text('source_account_id').notNull().references(() => accounts.id),
});

export const routing_plan = sqliteTable('routing_plan', {
  id: text('id').primaryKey(),
  pay_period_id: text('pay_period_id').notNull().references(() => pay_periods.id),
  target_type: text('target_type', { enum: ['account', 'category', 'debt'] }).notNull(),
  target_id: text('target_id').notNull(),
  amount_cents: integer('amount_cents').notNull(),
  executed_at: text('executed_at'),
});

export const debts = sqliteTable('debts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  principal_cents: integer('principal_cents').notNull(),
  interest_rate_bps: integer('interest_rate_bps').notNull(),
  min_payment_type: text('min_payment_type', { enum: ['fixed', 'percent'] }).notNull(),
  min_payment_value: integer('min_payment_value').notNull(),
  statement_date: integer('statement_date').notNull(),
  payment_due_date: integer('payment_due_date').notNull(),
  account_id_linked: text('account_id_linked').references(() => accounts.id),
  archived: integer('archived').notNull().default(0),
});

export const debt_payments = sqliteTable('debt_payments', {
  id: text('id').primaryKey(),
  debt_id: text('debt_id').notNull().references(() => debts.id),
  transaction_id: text('transaction_id').references(() => transactions.id),
  amount_cents: integer('amount_cents').notNull(),
  posted_at: text('posted_at').notNull(),
});

export const splits = sqliteTable('splits', {
  id: text('id').primaryKey(),
  counterparty: text('counterparty').notNull(),
  direction: text('direction', { enum: ['josh_owes', 'owes_josh'] }).notNull(),
  original_cents: integer('original_cents').notNull(),
  remaining_cents: integer('remaining_cents').notNull(),
  reason: text('reason').notNull(),
  created_at: text('created_at').notNull(),
  closed_at: text('closed_at'),
});

export const split_events = sqliteTable('split_events', {
  id: text('id').primaryKey(),
  split_id: text('split_id').notNull().references(() => splits.id),
  delta_cents: integer('delta_cents').notNull(),
  transaction_id: text('transaction_id').references(() => transactions.id),
  note: text('note'),
  created_at: text('created_at').notNull(),
});

export const edit_log = sqliteTable('edit_log', {
  id: text('id').primaryKey(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  field: text('field').notNull(),
  old_value: text('old_value'),
  new_value: text('new_value'),
  actor: text('actor', { enum: ['system', 'user', 'rules', 'ai'] }).notNull(),
  reason: text('reason').notNull(),
  created_at: text('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ============================================================================
// INVESTMENT (6)
// ============================================================================

export const holdings = sqliteTable('holdings', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  account_wrapper: text('account_wrapper', { enum: ['tfsa', 'fhsa', 'rrsp', 'nonreg'] }).notNull(),
  units: integer('units').notNull(), // stored * 10_000 for 4 decimal precision
  avg_cost_cents: integer('avg_cost_cents').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const prices = sqliteTable('prices', {
  symbol: text('symbol').notNull(),
  date: text('date').notNull(),
  close_cents: integer('close_cents').notNull(),
  source: text('source').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.symbol, t.date] }),
}));

export const signals = sqliteTable('signals', {
  symbol: text('symbol').notNull(),
  date: text('date').notNull(),
  sma50: integer('sma50'),
  sma200: integer('sma200'),
  rsi14: integer('rsi14'), // * 100
  momentum_30d: integer('momentum_30d'), // bps
  computed_at: text('computed_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.symbol, t.date] }),
}));

export const tfsa_room = sqliteTable('tfsa_room', {
  year: integer('year').primaryKey(),
  contribution_limit_cents: integer('contribution_limit_cents').notNull(),
  used_cents: integer('used_cents').notNull().default(0),
});

export const recommendations = sqliteTable('recommendations', {
  id: text('id').primaryKey(),
  generated_at: text('generated_at').notNull(),
  prompt_hash: text('prompt_hash').notNull(),
  response_json: text('response_json').notNull(),
  accepted: integer('accepted').notNull().default(0),
  executed_at: text('executed_at'),
});

export const market_snapshots = sqliteTable('market_snapshots', {
  id: text('id').primaryKey(),
  as_of: text('as_of').notNull(),
  boc_overnight_bps: integer('boc_overnight_bps'),
  cad_usd: integer('cad_usd'), // * 10_000
  tsx_close: integer('tsx_close'),
  sp500_close: integer('sp500_close'),
});

// ============================================================================
// CREDIT & RESET (2)
// ============================================================================

export const credit_snapshots = sqliteTable('credit_snapshots', {
  id: text('id').primaryKey(),
  as_of: text('as_of').notNull(),
  score: integer('score').notNull(),
  utilization_bps: integer('utilization_bps').notNull(),
  on_time_streak_days: integer('on_time_streak_days').notNull(),
  source: text('source', { enum: ['manual', 'equifax'] }).notNull(),
});

export const phase_log = sqliteTable('phase_log', {
  id: text('id').primaryKey(),
  phase: integer('phase').notNull(),
  entered_at: text('entered_at').notNull(),
  trigger_rule: text('trigger_rule').notNull(),
  metrics_json: text('metrics_json').notNull(),
});

// ============================================================================
// SESSION (3)
// ============================================================================

export const behaviour_snapshots = sqliteTable('behaviour_snapshots', {
  id: text('id').primaryKey(),
  as_of: text('as_of').notNull(),
  vice_ratio_bps: integer('vice_ratio_bps').notNull(),
  days_to_zero: integer('days_to_zero').notNull(),
  cc_payoff_streak: integer('cc_payoff_streak').notNull(),
  subscription_creep_pct_bps: integer('subscription_creep_pct_bps').notNull(),
  savings_increased_bool: integer('savings_increased_bool').notNull(),
  vice_peak_day: integer('vice_peak_day').notNull(),
  review_queue_lag_days: integer('review_queue_lag_days').notNull(),
  reconciliation_streak: integer('reconciliation_streak').notNull(),
});

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  target_cents: integer('target_cents').notNull(),
  target_date: text('target_date').notNull(),
  linked_account_id: text('linked_account_id').references(() => accounts.id),
  progress_cents: integer('progress_cents').notNull().default(0),
  archived: integer('archived').notNull().default(0),
});

export const review_queue = sqliteTable('review_queue', {
  id: text('id').primaryKey(),
  transaction_id: text('transaction_id').notNull().references(() => transactions.id),
  reason: text('reason', {
    enum: ['uncategorized', 'new_merchant', 'unusual_amount', 'split_candidate'],
  }).notNull(),
  resolved_at: text('resolved_at'),
});
