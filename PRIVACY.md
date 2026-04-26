# Privacy

Declyne is a single-user app for one person. This document describes what data the app handles, where it goes, and how to delete it. Aligned with PIPEDA (Canada).

## What's collected

All collection is initiated by the user pasting or importing data into the app:

- **Transactions** — date, description, amount, account, optional merchant tag. Imported by user from CSV or entered manually.
- **Accounts** — name, type (chequing/savings/credit/investment), institution.
- **Debts** — name, principal, interest rate, minimum payment, due dates.
- **Splits / counterparties** — counterparty name, amount, direction, reason.
- **Goals** — name, target amount, deadline.
- **Holdings** — symbol, units, average cost, account wrapper.
- **Computed signals** — phase, indulgence ratio, streaks, behaviour snapshots. Derived from the above; not collected directly.

The app does **not** collect: credentials, real names (user dev identity is "Bowgull"), location, contacts, photos, biometric data.

## Where the data goes

| Destination | What | Retention |
|---|---|---|
| Cloudflare D1 (worker DB) | All app data | Until user deletes via `DELETE /api/data/purge` |
| Cloudflare Workers logs | Worker error logs (sanitized — no DB schema fragments) | 7 days (Cloudflare default) |
| OpenAI (`/api/invest/recommend` only) | Computed signals + holdings (symbols + units + wrapper, no real names or account numbers) | Per OpenAI default retention; ZDR application pending |
| Twelve Data + FMP | Symbol-only quote requests | Not retained beyond request log |

## What is NOT sent to OpenAI

- Account numbers
- Real names (counterparty names included — those are in the prompt only as opaque labels, but a careful reader could infer relationships from "Marcus owes me $47.50")
- Transaction descriptions

The "GPT never does arithmetic" rule (see [`CLAUDE.md`](CLAUDE.md)) means computed signals come from server-side logic, not from the LLM. Numbers passed to the prompt are pre-computed by the worker.

## User rights (PIPEDA)

| Right | How |
|---|---|
| Access your data | Worker route `GET /api/export/all` returns the full DB as JSON |
| Correct your data | Every mutation route accepts `PATCH`, scoped to the user's own rows |
| Withdraw consent / delete | `DELETE /api/data/purge` with body `{ "confirm": "DELETE EVERYTHING" }` — soft-deletes immediately, hard-purges after 7 days |
| Audit trail | `edit_log` table tracks every financial mutation (immutable, append-only) |
| Data portability | `GET /api/export/all` returns standard JSON |

## Cross-border data flow

Cloudflare D1 is replicated within Cloudflare's global network; data may transit US, EU, and other regions. OpenAI and the market-data APIs are US-based. By installing and importing data, the user consents to this transfer (PIPEDA Schedule 1, Principle 3).

## Cookies / tracking

None. No analytics. No telemetry. No cookies (the worker is API-only, no rendered pages).

## Children's data

The app is not intended for users under 18. No collection of children's data.

## Changes to this policy

Material changes are committed to this file and announced in the release notes. The user can `git log PRIVACY.md` to see the full history.

## Contact

Single-user app. The user is the data subject and the data controller. No contact channel needed.
