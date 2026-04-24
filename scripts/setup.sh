#!/usr/bin/env bash
# Declyne first-time setup. Interactive. Safe to re-run.
set -e

cd "$(dirname "$0")/.."

echo ""
echo "▌ Declyne setup"
echo "▌ This will:"
echo "▌   1. install dependencies"
echo "▌   2. log you into Cloudflare (browser window)"
echo "▌   3. create the D1 database and write its ID into wrangler.toml"
echo "▌   4. push the schema to D1"
echo "▌   5. prompt you for API keys to save as Worker secrets"
echo ""
read -r -p "Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo "▌ Installing packages (this is the slow one, grab coffee)..."
pnpm install

echo "▌ Logging into Cloudflare..."
pnpm --filter @declyne/worker exec wrangler login

echo "▌ Creating D1 database 'declyne' (idempotent if it exists)..."
DB_OUTPUT=$(pnpm --filter @declyne/worker exec wrangler d1 create declyne || true)
echo "$DB_OUTPUT"

DB_ID=$(echo "$DB_OUTPUT" | grep -Eo 'database_id = "[a-f0-9-]+"' | head -1 | cut -d'"' -f2)
if [ -z "$DB_ID" ]; then
  echo "▌ Could not auto-detect database_id."
  echo "▌ Open apps/worker/wrangler.toml and paste it manually,"
  echo "▌ then re-run with: pnpm setup"
  exit 1
fi

sed -i '' "s/REPLACE_AFTER_wrangler_d1_create/${DB_ID}/" apps/worker/wrangler.toml
echo "▌ Saved database_id ${DB_ID} into wrangler.toml"

echo "▌ Pushing schema + seed to remote D1..."
pnpm --filter @declyne/worker exec wrangler d1 execute declyne --remote --file=./drizzle/0000_init.sql
pnpm --filter @declyne/worker exec wrangler d1 execute declyne --remote --file=./drizzle/seed.sql

echo ""
echo "▌ Now set secrets. Paste each key when prompted."
echo "▌ (Worker never logs these; they are encrypted at rest.)"
echo ""
API_TOKEN=$(openssl rand -hex 24)
echo "▌ Generated API_TOKEN (shared between worker and client): $API_TOKEN"
echo "▌ Save this. It will also be written to apps/client/.env.local in a moment."
echo ""
printf "%s" "$API_TOKEN" | pnpm --filter @declyne/worker exec wrangler secret put API_TOKEN

echo "▌ Paste your OpenAI API key:"
pnpm --filter @declyne/worker exec wrangler secret put OPENAI_API_KEY

echo "▌ Paste your Twelve Data key (get a free one at twelvedata.com):"
pnpm --filter @declyne/worker exec wrangler secret put TWELVE_DATA_KEY

echo "▌ Paste your Financial Modeling Prep key (free tier at site.financialmodelingprep.com):"
pnpm --filter @declyne/worker exec wrangler secret put FMP_KEY

echo "▌ Deploying worker for the first time..."
pnpm --filter @declyne/worker exec wrangler deploy

WORKER_URL=$(pnpm --filter @declyne/worker exec wrangler deployments list --name declyne-api 2>/dev/null | grep -Eo 'https://declyne-api[.a-z0-9-]*workers\.dev' | head -1 || echo "")
if [ -z "$WORKER_URL" ]; then
  WORKER_URL="https://declyne-api.YOUR-SUBDOMAIN.workers.dev"
  echo "▌ Could not auto-detect worker URL. Edit apps/client/.env.local after this script."
fi

cat > apps/client/.env.local <<EOF
VITE_API_URL=${WORKER_URL}
VITE_API_TOKEN=${API_TOKEN}
EOF
echo "▌ Wrote apps/client/.env.local"

echo ""
echo "▌ Done. What's next:"
echo "▌   pnpm dev              # run the client on localhost:5173"
echo "▌   pnpm cap:run          # build, sync to iOS, open Xcode"
echo ""
