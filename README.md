# Declyne

[![Deploy worker](https://github.com/Bowgull/Declyne/actions/workflows/deploy-worker.yml/badge.svg)](https://github.com/Bowgull/Declyne/actions/workflows/deploy-worker.yml)
[![Security](https://github.com/Bowgull/Declyne/actions/workflows/security.yml/badge.svg)](https://github.com/Bowgull/Declyne/actions/workflows/security.yml)
[![Checks](https://github.com/Bowgull/Declyne/actions/workflows/checks.yml/badge.svg)](https://github.com/Bowgull/Declyne/actions/workflows/checks.yml)

Personal financial reset system. Single user. Not a product. Receipts as the data model — every transaction is a sealed record, every paycheque is a tank, every chit between people is a tear-off.

Five phases: **Stabilize → Clear Debt → Build Credit → Build Buffer → Grow.**

## Stack

- **Client:** React 19 + Vite 7 + Tailwind v4 (Capacitor 8 for iOS sideload)
- **Worker:** Hono 4 on Cloudflare Workers, D1 (SQLite) via Drizzle, R2 for backups
- **LLM:** GPT-4o for investment recommendations only — never arithmetic, only validates pre-computed signals
- **CI:** GitHub Actions auto-deploys Worker on every push to `main`; security workflow runs gitleaks + Semgrep + Trivy + `pnpm audit` on every PR

## Security and privacy

This repo ships compliance artifacts you can read end-to-end:

- [SECURITY.md](SECURITY.md) — controls mapped to OWASP ASVS 5.0 Level 2, with `file:line` citations
- [PRIVACY.md](PRIVACY.md) — PIPEDA-aligned data handling notice
- [THREATS.md](THREATS.md) — STRIDE-style threat model with mitigations and acknowledged residual risks
- [docs/runbooks/](docs/runbooks/) — token rotation, D1→R2 backup procedures

## Build, deploy, develop

```bash
pnpm install
pnpm dev              # client on localhost:5174 with preview panel
pnpm dev:worker       # worker on localhost:8787
pnpm test             # 164+ tests, all passing
pnpm -r typecheck
pnpm cap:run          # build + sync + open Xcode (iOS sideload)
```

Worker deploys are automatic on push to `main` — no manual `wrangler deploy` step.

## Skills

The `skills/` directory is the source of truth for build context. Load [`declyne-session.md`](skills/declyne-session.md) first every session.

- [declyne-session.md](skills/declyne-session.md) — master rules and locked decisions
- [declyne-brand.md](skills/declyne-brand.md) — visual and voice system
- [declyne-financial-engine.md](skills/declyne-financial-engine.md) — schema, CSV, phase engine, reconciliation
- [declyne-investment.md](skills/declyne-investment.md) — signal math and GPT-4o prompt
- [declyne-ios.md](skills/declyne-ios.md) — Capacitor wrapper config

## Repo

Private. Sideload only. No App Store.
