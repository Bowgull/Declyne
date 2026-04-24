export const MERCHANT_NORM_VERSION = 1;

export const TIMEZONE = 'America/Toronto';

export const PAYCHEQUE_DETECT_THRESHOLD_CENTS = 100_000;

export const CSV_FORMATS = ['td_chequing', 'td_savings', 'td_visa', 'capital_one'] as const;
export type CsvFormat = (typeof CSV_FORMATS)[number];

export const ACCOUNT_TYPES = ['chequing', 'savings', 'credit', 'loan'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TRANSACTION_SOURCES = ['csv', 'manual'] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const EDIT_LOG_ACTORS = ['system', 'user', 'rules', 'ai'] as const;
export type EditLogActor = (typeof EDIT_LOG_ACTORS)[number];

export const SPLIT_DIRECTIONS = ['josh_owes', 'owes_josh'] as const;
export type SplitDirection = (typeof SPLIT_DIRECTIONS)[number];

export const REVIEW_REASONS = ['uncategorized', 'new_merchant', 'unusual_amount', 'split_candidate'] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

export const ACCOUNT_WRAPPERS = ['tfsa', 'fhsa', 'rrsp', 'nonreg'] as const;
export type AccountWrapper = (typeof ACCOUNT_WRAPPERS)[number];

