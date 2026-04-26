# Security

Declyne is a single-user personal finance app. The threat surface is small — one user, one device, one Cloudflare Worker — but the data is sensitive (account numbers, balances, spending patterns) so the controls are explicit.

This document maps implemented controls to OWASP ASVS 5.0 Level 2 categories. Each row cites the file and line that implements the control.

## Architecture

- **Client:** React 19 + Vite 7 + Capacitor (iOS sideload). Source: [`apps/client`](apps/client).
- **Worker:** Hono on Cloudflare Workers, D1 SQLite. Source: [`apps/worker`](apps/worker).
- **Auth:** shared bearer token (`API_TOKEN`) baked into the client bundle. Single-user — no multi-tenant boundaries.
- **External:** OpenAI (investment recommendations), Twelve Data + FMP (market quotes).

## Controls

### V1. Architecture, Design, Threat Modeling

| Control | Implementation |
|---|---|
| Threat model documented | [`THREATS.md`](THREATS.md) |
| Defense in depth on mutation routes | Allowlist-based PATCH writers (e.g. [`apps/worker/src/routes/debts.ts`](apps/worker/src/routes/debts.ts) `ALLOWED_PATCH_FIELDS`, [`apps/worker/src/routes/allocations.ts`](apps/worker/src/routes/allocations.ts) `ALLOC_PATCH_FIELDS`) |

### V2. Authentication

| Control | Implementation |
|---|---|
| Bearer token required on `/api/*` | [`apps/worker/src/middleware/auth.ts`](apps/worker/src/middleware/auth.ts) wired in [`apps/worker/src/index.ts`](apps/worker/src/index.ts) |
| Token rotation runbook | [`docs/runbooks/rotate-api-token.md`](docs/runbooks/rotate-api-token.md) |
| Token storage on client | iOS Keychain via `@capacitor-community/secure-storage` (session 46) — not yet wired |

### V3. Session Management

Not applicable. The app uses a long-lived bearer token, not session cookies. Single-user app, single-device install.

### V4. Access Control

Not applicable beyond the token gate. Single user, no role hierarchy.

### V5. Validation, Sanitization, Encoding

| Control | Implementation |
|---|---|
| Input validators on every mutation route | `parseDebtPatch`, `parseAllocPatch`, `parseGoalPatch`, `parseHoldingPatch`, etc. — see `apps/worker/src/routes/*.ts` |
| SQL parameterization | Drizzle parameterized statements throughout; no string interpolation in queries |
| Money as integer cents | Locked in [`CLAUDE.md`](CLAUDE.md) "Rules" section. No floats anywhere |
| Dedup key for transaction imports | `SHA256(date|description|amount|accountId)` — defends against duplicate-row injection on re-import |

### V6. Stored Cryptography

| Control | Implementation |
|---|---|
| Secrets via Cloudflare Workers Secrets (`wrangler secret put`) | Listed in [`apps/worker/wrangler.toml`](apps/worker/wrangler.toml): `API_TOKEN`, `OPENAI_API_KEY`, `TWELVE_DATA_KEY`, `FMP_KEY` |
| No secrets in source | Verified via `gitleaks` in CI ([`.github/workflows/security.yml`](.github/workflows/security.yml)) |

### V7. Error Handling, Logging

| Control | Implementation |
|---|---|
| Sanitized error responses (no DB schema leakage) | [`apps/worker/src/index.ts`](apps/worker/src/index.ts) `app.onError` returns `{ error: 'internal' }` |
| Real errors logged to Cloudflare logs only | Same handler, `console.error` |
| Mutation audit trail | Every financial mutation writes to `edit_log` (locked rule, see [`CLAUDE.md`](CLAUDE.md)) |

### V8. Data Protection

| Control | Implementation |
|---|---|
| TLS in transit | Cloudflare Workers, HTTPS only |
| HSTS | [`apps/worker/src/middleware/security.ts`](apps/worker/src/middleware/security.ts) `Strict-Transport-Security: max-age=31536000` |
| Data residency | Cloudflare D1 (cross-region replicated within Cloudflare's global network) |
| User data purge | `DELETE /api/data/purge` — typed confirmation gate, 7-day grace, hard-purge cron |

### V9. Communications

| Control | Implementation |
|---|---|
| CORS origin allowlist | [`apps/worker/src/middleware/security.ts`](apps/worker/src/middleware/security.ts) `isAllowedOrigin()` |
| Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COEP) | Same file, `securityHeaders` middleware |

### V10. Malicious Code

| Control | Implementation |
|---|---|
| SAST on every PR | Semgrep in [`.github/workflows/security.yml`](.github/workflows/security.yml) (rulesets: `p/owasp-top-ten`, `p/typescript`, `p/javascript`) |
| Dependency CVE scanning | `pnpm audit` (high+ blocks) + Trivy filesystem scan in same workflow |
| Secret scanning | Gitleaks on every PR + push |
| Dependency updates | Dependabot weekly grouped PRs ([`.github/dependabot.yml`](.github/dependabot.yml)) |

### V11. Business Logic

| Control | Implementation |
|---|---|
| Idempotent stamp/unstamp on allocations | [`apps/worker/src/routes/allocations.ts`](apps/worker/src/routes/allocations.ts) `/stamp` and `/unstamp` |
| Auto-match runs at most once per import | [`apps/worker/src/routes/import.ts`](apps/worker/src/routes/import.ts) `autoMatchSplits` + `autoMatchAllocations` |

### V12. File and Resources

| Control | Implementation |
|---|---|
| CSV parsing client-side only | Locked rule. Worker receives parsed rows, never raw files |
| No file uploads | App is read/write JSON only |

### V13. API and Web Service

| Control | Implementation |
|---|---|
| Bearer auth on `/api/*` | See V2 |
| Public health check | [`apps/worker/src/index.ts`](apps/worker/src/index.ts) `/health` and `/healthz` (unauthenticated, no data) |
| No public mutation routes | All `POST`/`PATCH`/`DELETE` are under `/api/*` and gated |

### V14. Configuration

| Control | Implementation |
|---|---|
| Worker config in repo | [`apps/worker/wrangler.toml`](apps/worker/wrangler.toml) — no secrets in vars |
| CI auto-deploy | [`.github/workflows/deploy-worker.yml`](.github/workflows/deploy-worker.yml) — every push to main runs typecheck + tests + deploy |

## Reporting a vulnerability

This is a single-user app and not currently soliciting external reports. If you find one anyway, open an issue and tag it `security`.

## Out of scope (accepted residual risk)

- **Bearer token in iOS bundle.** Anyone who pulls the IPA off the device gets the token. Mitigated in session 46 by moving the token into the iOS Keychain on first launch.
- **No rate limiting** on `/api/invest/recommend` (which proxies to OpenAI on user's billing). Deferred to a follow-up using Cloudflare Workers `RATE_LIMITER` binding.
- **OpenAI data retention.** Investment-recommendation prompts go to OpenAI with default retention. Zero-data-retention application pending in session 48; until then, no real account numbers or names appear in prompts (only computed signals — see [`CLAUDE.md`](CLAUDE.md) rule "GPT never does arithmetic. All numbers in AI prompts come from our computed signals.")
