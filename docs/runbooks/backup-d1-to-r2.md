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

## Automated backup

Runs weekly via `.github/workflows/backup-d1.yml` (Sunday 3am UTC). Uses two secrets:
- `CLOUDFLARE_D1_TOKEN` — "Declyne D1 Backup" token, D1:Read scope only (minted session 50)
- `CLOUDFLARE_API_TOKEN` — "Edit Cloudflare Workers" token, includes R2 write

The workflow exports D1 to a temp file then uploads to R2, switching tokens between steps. Trigger manually via Actions → Backup D1 to R2 → Run workflow.
