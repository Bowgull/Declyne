# Runbook: rotate `API_TOKEN`

When to do this: token leaked, suspected compromise, or quarterly hygiene.

Time required: ~3 minutes.

## Steps

1. **Generate a new token** (from any machine):
   ```bash
   openssl rand -hex 32
   ```
   Copy the hex string — this is the new token.

2. **Set the new token on the Worker**:
   ```bash
   cd apps/worker
   npx wrangler secret put API_TOKEN
   ```
   Paste the new token at the prompt. The Worker hot-reloads in ~2 seconds; old token is invalidated server-side.

3. **Update the iOS app**:
   - **After session 46 ships:** open the iOS app, navigate to Settings → "Update API token", paste the new value. The app stores it in Keychain.
   - **Before session 46 ships (current state):** the token is baked into the bundle as `VITE_API_TOKEN`. Update `apps/client/.env.production`, run `pnpm cap:run`, sideload the new build. The old build will start returning 401s on every API call until updated.

4. **Verify**:
   ```bash
   curl -H "Authorization: Bearer <new-token>" https://declyne-api.bocas-joshua.workers.dev/api/health
   ```
   Should return `{"ok":true,"as_of":"..."}`.

5. **Confirm the old token is dead**:
   ```bash
   curl -H "Authorization: Bearer <old-token>" https://declyne-api.bocas-joshua.workers.dev/api/health
   ```
   Should return `401`.

## If something goes wrong

- **Worker is rejecting both tokens:** the `wrangler secret put` may not have persisted. Re-run step 2.
- **iOS app still gets 401s after update:** force-quit and relaunch — Capacitor caches env reads. After session 46 the Keychain read happens at every request, so force-quit isn't needed.
- **You can't access wrangler:** log in with `npx wrangler login` (browser flow). Account is `bocas.joshua@gmail.com`.

## Why we don't auto-rotate

Single-user app, single device. The cost of a sync glitch (app stuck on 401 until you sideload the new build) is higher than the cost of manual rotation. Once session 46 ships and the token lives in Keychain, automated rotation becomes worth doing — see the `## Out of scope` block in [`SECURITY.md`](../../SECURITY.md).
