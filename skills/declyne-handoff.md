---
name: declyne-handoff
description: Session-end ritual for Declyne. Run this at the end of every session. Updates memory, CLAUDE.md, runs the debug pass, and commits. Produces a handoff note that the next session can pick up cold.
---

# Declyne Handoff Skill

Run this at the end of every Declyne session. It does four things in order:

1. Debug pass (must be green before anything else)
2. Memory update
3. CLAUDE.md update
4. Commit

Do not skip steps. Do not reorder. A session is not done until all four are complete.

---

## Step 1: Debug pass

Run all three. All must be green before proceeding.

```
pnpm test
pnpm -r typecheck
pnpm --filter @declyne/client build
```

If worker code changed (new routes, new lib files, schema changes), also deploy:

```
pnpm --filter @declyne/worker run deploy
```

Record the new worker version ID from the deploy output. You need it for the CLAUDE.md update.

If any step fails, fix it before continuing. A session that ends with red tests or a broken build is not done.

---

## Step 2: Memory update

Open `/Users/lindsaybell/.claude/projects/-Users-lindsaybell-Developer-Declyne/memory/project_declyne.md`.

Add a new entry at the top of the "Sessions so far" list. The entry must cover:

**What shipped** — concrete facts, not intentions:
- Migration file name and what it creates (table names, columns, constraints)
- New lib files and what pure helpers they export
- New routes (method + path + what they return)
- New client pages or components
- Test file names and count delta (e.g. "193 → 216, +23")
- Worker version ID
- Build sizes (JS kB / CSS kB)

**What was decided** — not just what was built, but why:
- Any naming decisions (e.g. "gl_accounts not accounts because existing accounts table is bank accounts")
- Any sign-rule or math decisions (e.g. "cashDebits=inflow regardless of cashType")
- Any scope decisions (e.g. "no UI changes this session — substrate only")
- Any constraints locked (e.g. "no custom domain ever, workers.dev is the surface")
- Any rejected approaches and why they failed

**What comes next** — the exact spec for the next session:
- Which accounting upgrade program session number (e.g. "Session 54 of the accounting upgrade program = overall session 59")
- What migration file it will create and what it adds
- What routes it will add or change
- What the test coverage goal is (~N new tests)
- Any gotchas or pre-conditions the next session needs to know

The entry should be dense. Future Claude sessions will use it to pick up cold without reading CLAUDE.md line-by-line.

---

## Step 3: CLAUDE.md update

Three changes every session:

**A. Move shipped items from "NOT built" to "What's built"**

Find the session's spec entry in `### The Accounting Upgrade Program` (or whatever program section applies). Replace the full spec block with a one-liner:

```
#### Session N — [Title] — SHIPPED in session [overall number]

See [title] entry in "What's built". [One sentence of key facts]. Worker `[version-id]`. [test delta].
```

Then add a full entry at the top of the "What's built" bullet list. Match the style of adjacent entries — dense bullet with nested facts, file links, test count, build sizes, worker version.

**B. Update the worker version**

```
- Latest worker version: `[new-version-id]` (session N — [short description])
```

**C. Update the test count in key commands**

```
pnpm test             # [N] tests, all passing ([delta])
```

**D. Update the repo state heading**

```
## Repo state (2026-04-27 handoff, end of session [N])
```

---

## Step 4: Commit

Stage and commit everything that changed this session. Include:
- All new source files
- All changed source files
- The migration SQL file
- Updated CLAUDE.md
- Updated memory files

Commit message format:
```
session [N]: [short description of what shipped]
```

Example: `session 58: GL foundation — journal entries, trial balance, backfill kernel`

Push to origin/main. CI auto-deploys the worker on push.

---

## What makes a good handoff note

The next Claude session has no memory of this conversation. It needs to reconstruct:

1. **Where we are in the program** — which session number, what phase of the accounting upgrade
2. **What the substrate looks like now** — what tables exist, what routes exist, what the live trial balance shows
3. **What decisions were made and why** — especially non-obvious ones that future code will depend on
4. **What comes next in exact detail** — not "session 54 adds AR/AP" but "migration 0013_counterparty_accounts.sql adds account_id FK to counterparties, backfills each as Assets:Receivable:<Name> or Liabilities:Payable:<Name>, splits/split_events rewritten to post JEs via postJournalEntry on create + settle"

A handoff note that says "GL foundation shipped, tests green" is useless. A handoff note that includes the trial balance output, the sign-rule decision, the naming collision workaround, and the exact spec for the next migration is what lets the next session start writing code immediately.

---

## Invariants (never skip)

- Privacy: dev identity is Bowgull. Never write the user's real name in any file, commit, or memory.
- All money is integer cents. Never floats.
- Every financial mutation writes edit_log.
- No em dashes anywhere — in copy, comments, code, commit messages.
- Three tabs only: Today / Budget / Yield. No new tabs without explicit approval.
- No custom domain. workers.dev is the surface forever.
- Worker auto-deploys via CI on push to main. Manual deploy only when you need to verify mid-session.
