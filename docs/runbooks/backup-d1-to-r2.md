# Runbook: backup D1 to R2

When to do this: weekly (manual until automated), before any schema migration, before a token rotation drill, before any wrangler operation that could go wrong.

Time: ~2 minutes.

## One-time setup

Create the R2 bucket (free tier: 10 GB/mo, $0.015/GB-month over):

```bash
npx wrangler r2 bucket create declyne-backups
```

Optional — add lifecycle rule to expire after 90 days from the Cloudflare dashboard.

## Manual backup (current procedure)

```bash
cd apps/worker
DATE=$(date -u +%Y-%m-%dT%H-%M-%SZ)
npx wrangler d1 export declyne --remote --output "/tmp/declyne-${DATE}.sql"
npx wrangler r2 object put "declyne-backups/declyne-${DATE}.sql" --file "/tmp/declyne-${DATE}.sql"
rm "/tmp/declyne-${DATE}.sql"
```

The export is a plain SQL dump (`CREATE TABLE` + `INSERT` statements). At ~140 rows of seed + however many real transactions you have, this is well under 10 MB.

## Verify

```bash
npx wrangler r2 object list declyne-backups
```

Most recent object should match what you just uploaded.

## Restore

```bash
npx wrangler r2 object get "declyne-backups/declyne-2026-04-26T03-00-00Z.sql" --file "/tmp/restore.sql"
npx wrangler d1 execute declyne --remote --file "/tmp/restore.sql"
```

**Warning:** restoring overwrites current state. Run `DELETE /api/data/purge` first if you want a clean restore.

## Automate

Deferred. Cloudflare Workers can write to R2 on cron, but D1 → R2 export needs the wrangler CLI (no Worker-side D1 dump primitive yet). Two options when ready:

1. **GitHub Actions weekly cron:** runs the manual procedure above. Needs `CLOUDFLARE_API_TOKEN` (already configured) + a service-account-style approach for R2 write. Simplest path.
2. **Cloudflare D1 → R2 internal pipeline:** Wait for Cloudflare to ship a native primitive. Currently in private beta as of this commit.

## Why we don't ship #1 yet

The wrangler `d1 export` command in CI requires an extra Cloudflare API token scope (D1 read). The current `CLOUDFLARE_API_TOKEN` is the "Edit Cloudflare Workers" template — it can deploy Workers but not export D1 data. To enable automated backup:

1. Mint a second token "Edit D1 + R2 Read/Write"
2. Add as `CLOUDFLARE_BACKUP_TOKEN` repo secret
3. Add `.github/workflows/backup-d1.yml` (weekly cron)

Flagged as a follow-up. Until then, this runbook is the procedure.
