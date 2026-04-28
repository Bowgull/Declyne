#!/usr/bin/env bash
# Full remote D1 reseed. Handles the GL/period_close ordering automatically.
#
# Order matters:
#   1. Apply seed  (wipes GL tables + counterparty GL accounts, inserts all data)
#   2. Run GL backfill  (posts JEs for every transaction)
#   3. Run subsidiary backfills  (debts, holdings, AR/AP)
#   4. Restore period_close  (must come AFTER backfills — postJournalEntry
#      refuses writes into locked periods)
#
# Usage: pnpm db:reseed
set -euo pipefail

WORKER_URL="https://declyne-api.bocas-joshua.workers.dev"
SEED_FILE="apps/worker/drizzle/seed_test.sql"

# Load token from client env
TOKEN=$(grep VITE_API_TOKEN apps/client/.env.local 2>/dev/null | cut -d= -f2)
if [ -z "$TOKEN" ]; then
  echo "ERROR: VITE_API_TOKEN not found in apps/client/.env.local" >&2
  exit 1
fi

api() {
  local method="$1" path="$2"
  local result
  result=$(curl -sf -X "$method" "$WORKER_URL$path" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
  echo "$result"
}

echo "── 1/5  Applying seed..."
pnpm exec wrangler d1 execute declyne --remote --file="$SEED_FILE"

echo "── 2/5  Running GL backfill..."
result=$(api POST /api/admin/gl-backfill)
echo "        $result"

echo "── 3/5  Running subsidiary backfills (debts, holdings, AR/AP)..."
echo "        debt:     $(api POST /api/admin/debt-backfill)"
echo "        holdings: $(api POST /api/admin/holdings-backfill)"
echo "        arap:     $(api POST /api/admin/arap-backfill)"

echo "── 4/5  Restoring period_close (11 weekly closes Feb 8 → Apr 25)..."
pnpm exec wrangler d1 execute declyne --remote --command="
INSERT OR REPLACE INTO period_close
  (id, period_start, period_end, closed_at, closed_by,
   trial_balance_debits_cents, trial_balance_credits_cents)
VALUES
  ('pc_2026_02_14','2026-02-08','2026-02-14','2026-02-15T10:30:00Z','user',0,0),
  ('pc_2026_02_21','2026-02-15','2026-02-21','2026-02-22T10:15:00Z','user',0,0),
  ('pc_2026_02_28','2026-02-22','2026-02-28','2026-03-01T09:45:00Z','user',0,0),
  ('pc_2026_03_07','2026-03-01','2026-03-07','2026-03-08T10:20:00Z','user',0,0),
  ('pc_2026_03_14','2026-03-08','2026-03-14','2026-03-15T10:00:00Z','user',0,0),
  ('pc_2026_03_21','2026-03-15','2026-03-21','2026-03-22T11:10:00Z','user',0,0),
  ('pc_2026_03_28','2026-03-22','2026-03-28','2026-03-29T09:30:00Z','user',0,0),
  ('pc_2026_04_04','2026-03-29','2026-04-04','2026-04-05T10:25:00Z','user',0,0),
  ('pc_2026_04_11','2026-04-05','2026-04-11','2026-04-12T10:40:00Z','user',0,0),
  ('pc_2026_04_18','2026-04-12','2026-04-18','2026-04-19T09:55:00Z','user',0,0),
  ('pc_2026_04_25','2026-04-19','2026-04-25','2026-04-26T10:30:00Z','user',0,0);
"

echo "── 5/5  Verifying..."
tank=$(curl -sf "$WORKER_URL/api/budget/tank" -H "Authorization: Bearer $TOKEN")
remaining=$(echo "$tank" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'\${d[\"remaining_cents\"]/100:.2f}')" 2>/dev/null || echo "parse error")
tb=$(curl -sf "$WORKER_URL/api/gl/trial-balance" -H "Authorization: Bearer $TOKEN")
delta=$(echo "$tb" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['totals']['delta_cents'])" 2>/dev/null || echo "parse error")

echo ""
echo "Done."
echo "  Tank remaining : $remaining"
echo "  TB delta       : $delta  (0 = balanced)"
