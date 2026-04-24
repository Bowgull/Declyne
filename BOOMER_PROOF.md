# Declyne: Setup for People Who Hate Setup

This file exists so you can run the app without Googling anything.

You only do this once. After that it is `pnpm dev` on desktop, and once a week
you plug your phone in and hit play in Xcode.

---

## The six steps. In order. Do not skip.

### 1. Make a Cloudflare account

Go to <https://dash.cloudflare.com/sign-up>. Email + password. That's it. Free
tier is enough. You never need to add a credit card for this app.

### 2. Get three API keys

Make an account on each and copy the key somewhere (Notes app is fine):

- **OpenAI**: <https://platform.openai.com/api-keys> (costs money per request,
  pennies for this app)
- **Twelve Data**: <https://twelvedata.com/pricing> — free tier
- **Financial Modeling Prep**: <https://site.financialmodelingprep.com/developer/docs> — free tier

### 3. Run the setup script

Open Terminal. Copy-paste this:

```
cd ~/Developer/Declyne
pnpm setup
```

It will:
- install all packages
- open a browser window so you can log into Cloudflare (click Allow)
- create the D1 database
- ask you to paste each API key one at a time
- deploy the first version of the Worker
- write the URL and auth token into `.env.local` for the client

If something crashes partway through, **just run `pnpm setup` again**. It is
designed to be re-run. Nothing gets corrupted.

### 4. Make sure it works on desktop first

```
pnpm dev
```

Open <http://localhost:5173>. You should see "Today" with Phase 1 / Stabilize
and some empty cards. If you see that, the Worker is alive and talking.

### 5. Put it on your phone

Plug your iPhone into the Mac with a USB-C cable. Unlock the phone. When it
asks "Trust This Computer?" tap Trust.

Then in Terminal:

```
pnpm cap:run
```

Xcode will open. You may need to do these one-time things:

1. Click the **Declyne** project in the left sidebar
2. Click the **App** target
3. Click **Signing & Capabilities**
4. Check **Automatically manage signing**
5. Under **Team**, pick your Apple ID (sign into it with your regular Apple
   ID if it's not listed — no developer account needed)
6. Xcode will complain about the bundle ID once. Change `com.josh.declyne` to
   something unique like `com.josh.declyne.yourname` — only the first time.
7. At the top of Xcode, pick your iPhone from the device dropdown (it's left
   of the play button)
8. Hit the **▶ Play** button

First time, your phone will say "Untrusted Developer". On your phone go to:
**Settings → General → VPN & Device Management → [your Apple ID] → Trust**

Open the app. Grant notification permission when it asks. Done.

### 6. Every 7 days, redo step 5

The app will send you a notification on day 6 saying **"Redeploy Declyne"**.
When you get it:

1. Plug in phone
2. `pnpm cap:run`
3. Xcode opens, hit **▶ Play**
4. Done. Another 7 days.

That is the tradeoff for not paying Apple $99/year. Hit play once a week.

---

## What each command does

| Command | What it does |
|---|---|
| `pnpm setup` | First-time setup. Re-runnable. |
| `pnpm dev` | Run the client on the desktop for dev. |
| `pnpm dev:worker` | Run the Worker locally if you're editing backend code. |
| `pnpm cap:run` | Build, sync to iOS, open Xcode so you can sideload. |
| `pnpm worker:deploy` | Push Worker changes to Cloudflare. |
| `pnpm db:push` | Push a schema change to the live D1 database. |
| `pnpm test` | Run all tests (math, phase rules, merchant normalization). |

---

## Where your data lives

- **Cloudflare D1**: your SQLite database, hosted by Cloudflare. Free.
  Encrypted at rest. Only you can read it (the Worker checks a token before
  answering).
- **The iPhone app**: a thin wrapper. All truth lives in D1. The app just
  draws it.
- **OpenAI**: sees only the investment payload (signals + holdings, no raw
  transactions). Only when you tap "Get recommendation" in Grow.

No other service sees anything. No analytics. No crash reporter.

---

## If something is broken

- **"wrangler: command not found"** → run `pnpm install` first.
- **"unauthorized" in the app** → client `.env.local` has the wrong token.
  Look at it, and look at what `wrangler secret list` shows. They must match.
- **Xcode "No signing certificate"** → you didn't log into your Apple ID in
  Xcode. Xcode → Settings → Accounts → + → sign in.
- **App opens then crashes** → in Xcode the console at the bottom shows the
  error. Copy-paste it to Claude in a new chat.

---

## What I (Claude) can do for you

Anything in code. Ask me to:
- add a new page or feature
- change the phase rules
- adjust the merchant normalizer for a weird TD description format
- redeploy the Worker
- write a new test

What I cannot do:
- click buttons in Xcode
- type your password into Cloudflare
- paste API keys for you
- plug in your phone

Everything else is mine.
