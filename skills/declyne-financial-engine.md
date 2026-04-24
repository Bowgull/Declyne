---
name: declyne-financial-engine
description: Schema, CSV pipeline, merchant normalization, phase engine, behaviour signals, reconciliation flow.
---

# Declyne Financial Engine Skill

All money is integer cents. All dates are ISO local (America/Toronto). All mutations write to `edit_log`.

## Schema (24 tables)

### Core (13)

- `accounts` id, name, institution, type (chequing|savings|credit|loan), currency, last_import_at, archived
- `transactions` id, account_id, posted_at, amount_cents, description_raw, merchant_id, category_id, dedup_hash, source (csv|manual), created_at
- `merchants` id, display_name, normalized_key, category_default_id, verified
- `categories` id, name, group (essentials|lifestyle|vice|income|transfer|debt), parent_id
- `budgets` id, period_id, category_id, allocation_cents
- `pay_periods` id, start_date (deposit date), end_date, paycheque_cents, source_account_id
- `routing_plan` id, pay_period_id, target (account|category|debt), amount_cents, executed_at
- `debts` id, name, principal_cents, interest_rate_bps, min_payment_type (fixed|percent), min_payment_value, statement_date, payment_due_date, account_id_linked, archived
- `debt_payments` id, debt_id, transaction_id, amount_cents, posted_at
- `splits` id, counterparty, direction (josh_owes|owes_josh), original_cents, remaining_cents, reason, created_at, closed_at
- `split_events` id, split_id, delta_cents, transaction_id, note, created_at
- `edit_log` id, entity_type, entity_id, field, old_value, new_value, actor (system|user|rules|ai), reason, created_at
- `settings` key, value

### Investment (6)

- `holdings` id, symbol, account_wrapper (tfsa|fhsa|rrsp|nonreg), units, avg_cost_cents, updated_at
- `prices` symbol, date, close_cents, source
- `signals` symbol, date, sma50, sma200, rsi14, momentum_30d, computed_at
- `tfsa_room` year, contribution_limit_cents, used_cents
- `recommendations` id, generated_at, prompt_hash, response_json, accepted, executed_at
- `market_snapshots` id, as_of, boc_overnight_bps, cad_usd, tsx_close, sp500_close

### Credit & Reset (2)

- `credit_snapshots` id, as_of, score, utilization_bps, on_time_streak_days, source (manual|equifax)
- `phase_log` id, phase (1..5), entered_at, trigger_rule, metrics_json

### Session (3)

- `behaviour_snapshots` id, as_of, vice_ratio_bps, days_to_zero, cc_payoff_streak, subscription_creep_pct_bps, savings_increased_bool, vice_peak_day, review_queue_lag_days, reconciliation_streak
- `goals` id, name, target_cents, target_date, linked_account_id, progress_cents, archived
- `review_queue` id, transaction_id, reason (uncategorized|new_merchant|unusual_amount|split_candidate), resolved_at

## CSV Pipeline

Client-side only. PapaParse in a Web Worker.

1. Detect format by header row: TD Chequing, TD Savings, TD Visa, Capital One. Reject unknown.
2. Parse rows, convert to cents, normalize sign by account type (credit posts as debt when charge, credit when payment).
3. For each row, compute `dedup_hash = SHA256(date|description|amount|accountId)`.
4. Run merchant normalization pipeline.
5. Send normalized batch to Worker. Worker dedups by hash, inserts new rows, returns summary.
6. Flag any new merchant or uncategorized row into `review_queue`.

## Merchant Normalization (5 steps, deterministic, versioned)

1. Uppercase, strip punctuation, collapse whitespace.
2. Strip known prefixes: `POS `, `VISA DEBIT `, `INTERAC `, `SQ *`, `TST* `, `PAYPAL *`.
3. Strip trailing location suffixes: 4+ digit numbers, 2-letter province codes, known city names.
4. Match against `merchants.normalized_key`. If match, attach `merchant_id`.
5. If no match, create unverified merchant row, queue for review.

Version the pipeline in settings (`merchant_norm_version`). Reprocessing bumps version and re-runs on flagged rows only.

## Pay Periods (paycheque-anchored)

A pay period begins on the day a paycheque is deposited and ends the day before the next deposit. Not the 1st and 15th. Not Monday to Sunday.

Detection: income transaction over a threshold into the designated source account, description matches known employer pattern. Creates `pay_periods` row and triggers routing plan generation.

## Routing Plan

Generated per pay period from the current phase's rules:

- Phase 1 Stabilize: essentials first, then min payments, remainder to buffer.
- Phase 2 Clear Debt: essentials, min payments, then avalanche to highest APR.
- Phase 3 Build Credit: essentials, full statement pay on primary CC, min on others.
- Phase 4 Build Buffer: essentials, min debts, TFSA contribution up to plan.
- Phase 5 Grow: essentials, min debts, investment plan per investment skill.

Routing is a suggestion with one-tap execute. Each execution writes `edit_log` and updates `routing_plan.executed_at`.

## Phase Engine

Computed daily and on any material change. No demotion. No skipping.

- Phase 1 → 2: essentials covered for 2 consecutive pay periods AND cc_payoff_streak >= 1 period
- Phase 2 → 3: non-mortgage debt principal down 20% from Phase 2 entry AND no missed min payment 60 days
- Phase 3 → 4: utilization under 30% for 3 consecutive statements AND on_time_streak_days >= 90
- Phase 4 → 5: buffer >= 3 months essentials AND vice_ratio under 15% trailing 30 days

Every transition writes `phase_log` with the triggering rule and metrics snapshot.

## Behaviour Signals (8)

Computed nightly into `behaviour_snapshots`:

- `vice_ratio` = vice_spend / (vice_spend + lifestyle_spend), trailing 30d
- `days_to_zero` = chequing_balance / avg_daily_burn
- `cc_payoff_streak` = consecutive pay periods with CC paid to zero
- `subscription_creep_pct` = (subs_this_month - subs_3mo_avg) / subs_3mo_avg
- `savings_increased` = bool, savings balance trailing 7d > prior 7d
- `vice_peak_day` = weekday with highest vice spend trailing 90d
- `review_queue_lag_days` = now - oldest unresolved review_queue.created_at
- `reconciliation_streak` = consecutive Sundays reconciled on time

## Sunday Reconciliation (6 steps)

Triggered Sunday 9am. Follow-up Tuesday 9am if not complete.

1. Import CSVs prompt (skippable if auto-imported).
2. Review Queue: categorize new merchants, resolve unusual amounts.
3. Split check: any splits to update or close.
4. Budget variance: show categories over and under, no judgment copy.
5. Phase check: current phase, distance to next trigger.
6. Receipt summary: sectioned recap, single sheet, one-tap archive.

## Edit Log

Every write to a money-touching table writes `edit_log`:
- `actor`: system, user, rules, ai
- `reason`: short machine code like `csv_import`, `manual_recat`, `routing_execute`, `phase_transition`

Never mutate silently. Never update in place without logging.

## Export

One sectioned CSV. Sections: accounts, transactions, debts, splits, phase_log, edit_log. One file, header rows between sections. Not a ZIP.
