import type { AccountType, AccountWrapper, EditLogActor, ReviewReason, SplitDirection, TransactionSource } from './constants.js';
import type { CategoryGroup } from './categories.js';
import type { Cents } from './money.js';

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  currency: string;
  last_import_at: string | null;
  archived: number;
}

export interface Transaction {
  id: string;
  account_id: string;
  posted_at: string;
  amount_cents: Cents;
  description_raw: string;
  merchant_id: string | null;
  category_id: string | null;
  dedup_hash: string;
  source: TransactionSource;
  created_at: string;
}

export interface ParsedRow {
  posted_at: string;
  amount_cents: Cents;
  description_raw: string;
  account_id: string;
  dedup_hash: string;
  merchant_normalized_key: string;
}

export interface ImportResult {
  inserted: number;
  skipped_dedup: number;
  flagged_for_review: number;
  new_merchants: number;
}

export interface Merchant {
  id: string;
  display_name: string;
  normalized_key: string;
  category_default_id: string | null;
  verified: number;
}

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
  parent_id: string | null;
}

export interface Debt {
  id: string;
  name: string;
  principal_cents: Cents;
  interest_rate_bps: number;
  min_payment_type: 'fixed' | 'percent';
  min_payment_value: number;
  statement_date: number;
  payment_due_date: number;
  account_id_linked: string | null;
  archived: number;
}

export interface Split {
  id: string;
  counterparty: string;
  direction: SplitDirection;
  original_cents: Cents;
  remaining_cents: Cents;
  reason: string;
  created_at: string;
  closed_at: string | null;
}

export interface PayPeriod {
  id: string;
  start_date: string;
  end_date: string;
  paycheque_cents: Cents;
  source_account_id: string;
}

export interface BehaviourSnapshot {
  id: string;
  as_of: string;
  vice_ratio_bps: number;
  days_to_zero: number;
  cc_payoff_streak: number;
  subscription_creep_pct_bps: number;
  savings_increased_bool: number;
  vice_peak_day: number;
  review_queue_lag_days: number;
  reconciliation_streak: number;
}

export interface PhaseLog {
  id: string;
  phase: 1 | 2 | 3 | 4 | 5;
  entered_at: string;
  trigger_rule: string;
  metrics_json: string;
}

export interface ReviewItem {
  id: string;
  transaction_id: string;
  reason: ReviewReason;
  resolved_at: string | null;
}

export interface EditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor: EditLogActor;
  reason: string;
  created_at: string;
}

export interface Holding {
  id: string;
  symbol: string;
  account_wrapper: AccountWrapper;
  units: number;
  avg_cost_cents: Cents;
  updated_at: string;
}

export interface Signal {
  symbol: string;
  date: string;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  momentum_30d: number | null;
  computed_at: string;
}
