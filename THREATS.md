# Threat model

STRIDE-style threat model for Declyne. Single-user app, single device. Threat surface is small but the data is sensitive (account numbers, balances, spending patterns).

## Surfaces

1. **iOS client** — Capacitor WebView app, sideloaded on user's iPhone. Bearer token in bundle.
2. **Cloudflare Worker** — public URL, bearer-gated `/api/*`, public `/health` and `/healthz`.
3. **D1 database** — managed by Cloudflare, accessed only from the Worker.
4. **External calls** — OpenAI (LLM), Twelve Data + FMP (market quotes).
5. **CI/CD** — GitHub Actions, deploys to Cloudflare via `CLOUDFLARE_API_TOKEN` secret.

## Threats

### Spoofing

| Threat | Mitigation |
|---|---|
| Attacker forges requests to the Worker | Bearer token gate ([`auth.ts`](apps/worker/src/middleware/auth.ts)). Attacker needs the token, which lives in the iOS bundle (Keychain after session 46). |
| Attacker forges browser origin to bypass CORS | CORS allowlist ([`security.ts`](apps/worker/src/middleware/security.ts) `isAllowedOrigin`) — non-allowlist origin gets empty `Access-Control-Allow-Origin`. CORS is a browser-side defense; doesn't stop curl/script attackers (which still need the bearer token). |
| Attacker spoofs CI/CD to deploy malicious code | GitHub branch protection on `main` (manual merge gate). `CLOUDFLARE_API_TOKEN` is a repo secret, not exposed to forks. |

### Tampering

| Threat | Mitigation |
|---|---|
| SQL injection via PATCH bodies | Allowlist-based field iteration ([`debts.ts`](apps/worker/src/routes/debts.ts) `ALLOWED_PATCH_FIELDS`, [`allocations.ts`](apps/worker/src/routes/allocations.ts) `ALLOC_PATCH_FIELDS`). Drizzle parameterized statements throughout. |
| Tampering with imported CSVs to inject duplicates | Dedup key `SHA256(date|description|amount|accountId)` (locked rule, see CLAUDE.md). |
| Modification of audit trail | `edit_log` is append-only by convention. Worker has no `UPDATE`/`DELETE` route on `edit_log`. |
| Supply-chain tampering on dependencies | Dependabot weekly + `pnpm audit` (high+ blocks) + Trivy CVE scan in CI. Drizzle CVE patched session 43. |

### Repudiation

| Threat | Mitigation |
|---|---|
| User claims they didn't make a mutation | `edit_log` tracks every financial mutation with `actor` and `reason`. Single-user app limits scope. |

### Information Disclosure

| Threat | Mitigation |
|---|---|
| Error response leaks DB schema or query fragments | Sanitized `app.onError` returns `{ error: 'internal' }` ([`index.ts`](apps/worker/src/index.ts)). Real error to Cloudflare logs only. |
| Bearer token leaked from iOS bundle | Session 46 moves token to iOS Keychain (hardware-backed). Until then: documented residual risk in SECURITY.md. |
| OpenAI sees PII in prompts | "GPT never does arithmetic" rule — only computed signals go to OpenAI, not raw transactions. Counterparty names go through but real names are scrubbed (user identity = "Bowgull"). ZDR application pending session 48. |
| Cloudflare logs contain request bodies | Worker doesn't log request bodies. `console.error` in `app.onError` logs the error message, which is now sanitized. |
| Browser referer leaks API URL | `Referrer-Policy: no-referrer` ([`security.ts`](apps/worker/src/middleware/security.ts)). |

### Denial of Service

| Threat | Mitigation |
|---|---|
| Attacker floods Worker with requests | Cloudflare's free-tier WAF + DDoS protection. Rate limiting via `RATE_LIMITER` binding deferred (next follow-up). |
| Attacker drains OpenAI billing via `/api/invest/recommend` | Bearer-gated. **Residual:** no per-route rate limit yet. Mitigated by token being single-user and not publicly known; flagged in SECURITY.md. |
| Attacker creates millions of allocations to fill D1 | Each mutation writes `edit_log` row. D1 free tier has limits. Single-user app limits realistic scope. |

### Elevation of Privilege

| Threat | Mitigation |
|---|---|
| Privilege escalation across user roles | N/A — single-user app, no role hierarchy. |
| Worker secrets leak via env exposure | Wrangler secrets are encrypted at rest in Cloudflare. Not exposed via Worker bindings unless explicitly read. |
| GitHub Actions secret leak | `CLOUDFLARE_API_TOKEN` scoped to "Edit Cloudflare Workers" template — can't pivot to other Cloudflare resources. |

## Out-of-scope (acknowledged)

- Physical device theft (iPhone unlocked with bearer token in bundle pre-session-46)
- Targeted malware on the user's MacBook with shell access (sees git, source, local DB)
- Cloudflare insider threat
- OpenAI insider threat
- A determined adversary with control of an unlocked iPhone — Keychain protection has limits (session 46 mitigation is for theft of a locked device + IPA extraction)

## Review cadence

This file is reviewed at the end of every session that touches `apps/worker/src/middleware`, `apps/worker/src/routes/auth*`, `wrangler.toml`, `.github/workflows/`, or any new external API integration. Diffs go through a normal PR.
