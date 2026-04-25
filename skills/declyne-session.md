---
name: declyne-session
description: Master build rules and locked decisions for Declyne. Single source of truth. Load this first every session.
---

# Declyne Session Skill

Declyne is a single-user personal financial reset system for Josh. It runs as an iOS app (Capacitor sideload, no App Store), backed by a Cloudflare Workers API and D1 database. It is not a product. It is one person's tool.

## Purpose

Five-phase reset: **Stabilize → Clear Debt → Build Credit → Build Buffer → Grow**. The app computes which phase Josh is in from his actual balances and behaviour. Never by self-report. No skipping. No demotion for a bad week.

## Tech Stack (locked)

- React 19 + Vite 7 + Tailwind v4
- Hono 4 on Cloudflare Workers
- Cloudflare D1 (SQLite) + Drizzle ORM
- Capacitor 8 for iOS wrapper
- PapaParse for CSV (TD Chequing, TD Savings, TD Visa, Capital One)
- OpenAI GPT-4o (investment) and GPT-4o-mini (spending summary). Never Claude in-app.
- Market data: Twelve Data primary, FMP + Yahoo fallback, Bank of Canada for rates
- Vitest for tests

## Build Rules

1. One slice per session. Plan before code. No parallel half-built features.
2. Rules engine first, AI second. GPT never does math. Math is deterministic Cloudflare Worker code.
3. Every financial mutation writes to `edit_log`. No silent changes.
4. Every slice ships with tests. Vitest on the Worker, Vitest on the client rules.
5. CSV parsing is client-side. The Worker receives parsed, normalized rows. It never sees raw files.
6. Merchant normalization is a 5-step pipeline, deterministic, versioned. AI does not name merchants.
7. Dedup key is `SHA256(date|description|amount|accountId)`. Collisions skip insert.
8. All money in cents, integer. Never floats.
9. Pay periods are **paycheque-anchored**, not calendar-anchored. A period starts on pay deposit, ends the day before the next.
10. Two-way splits only. Josh owes X, or X owes Josh. No legacy one-way receivables.

## Locked Feature Decisions

- Four tabs: **Today / Budget / Debts / Grow**. Plus a cog for settings. No More tab. No Feed tab.
- Single mascot PNG, static. Used in four places only (see brand skill). No expressions. No animations.
- No Face ID. No iCloud backup. No Capacitor Badge plugin. No App Store.
- Sunday reconciliation at **9am**, follow-up Tuesday **9am** if incomplete.
- Export is one sectioned CSV, not a ZIP.
- Onboarding is optional. Josh can skip any step and fill later.
- Vice dashboard lives inside Budget tab. Not a separate screen.

## Corrected Facts

- Bowgull debt: Mexico trip, **Josh owes Bowgull**. Not Cuba, not receivable.
- Schema includes `interest_rate`, `min_payment_type`, `min_payment_value`, `statement_date`, `payment_due_date`. These are required on any debt row.

## Voice

Direct. Dry. Slightly darker than Waymark. "Before you do something stupid with it" is in range. Never cheerleading, never shaming. No em dashes anywhere: copy, comments, code. Periods, colons, commas only.

## Anti-Scope

Do not build: social features, sharing, multi-user, web dashboard, Android, notifications beyond the two reconciliation reminders, gamification points/streaks as a user-facing metric, push marketing.

## Session Start Checklist

1. Read this file.
2. Read the skill for the slice you are building (brand, financial-engine, investment, ios).
3. Confirm the slice against the 40-slice build plan in the repo.
4. Write the plan as a comment or issue before editing code.
5. Ship with tests and an edit_log hook if it touches money.
