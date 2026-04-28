import { Hono } from 'hono';
import type { Env } from '../env.js';
import { newId, nowIso } from '../lib/ids.js';
import { writeEditLog } from '../lib/editlog.js';

export const paymentLinksRoutes = new Hono<{ Bindings: Env }>();

const TOKEN_LEN = 12;
const TOKEN_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no 0/o/1/l ambiguity
const EXPIRY_DAYS = 90;

export function generateToken(len = TOKEN_LEN): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length];
  return out;
}

export function expiryFrom(nowMs: number, days = EXPIRY_DAYS): string {
  return new Date(nowMs + days * 86400_000).toISOString();
}

export type LinkStatus = 'active' | 'disabled' | 'expired' | 'settled';

export function linkStatus(
  link: { disabled_at: string | null; expires_at: string },
  splitClosedAt: string | null,
  now: Date,
): LinkStatus {
  if (splitClosedAt) return 'settled';
  if (link.disabled_at) return 'disabled';
  if (new Date(link.expires_at).getTime() <= now.getTime()) return 'expired';
  return 'active';
}

export type CreateLinkInput = {
  split_id: string;
  security_answer?: string | undefined;
};

export function parseCreateLinkInput(b: unknown): CreateLinkInput | { error: string } {
  if (!b || typeof b !== 'object') return { error: 'invalid body' };
  const o = b as Record<string, unknown>;
  const split_id = typeof o.split_id === 'string' ? o.split_id.trim() : '';
  if (!split_id) return { error: 'split_id required' };
  const sa = typeof o.security_answer === 'string' ? o.security_answer.trim() : '';
  if (sa && sa.length > 80) return { error: 'security_answer too long' };
  return { split_id, security_answer: sa || undefined };
}

export async function disableLinksForSplit(
  env: Env,
  splitId: string,
  reason: string,
): Promise<number> {
  const now = nowIso();
  const { results } = await env.DB.prepare(
    `SELECT id FROM payment_links WHERE split_id = ? AND disabled_at IS NULL`,
  )
    .bind(splitId)
    .all<{ id: string }>();
  const ids = (results ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;
  await env.DB.prepare(
    `UPDATE payment_links SET disabled_at = ? WHERE split_id = ? AND disabled_at IS NULL`,
  )
    .bind(now, splitId)
    .run();
  await writeEditLog(
    env,
    ids.map((id) => ({
      entity_type: 'payment_link',
      entity_id: id,
      field: 'disabled_at',
      old_value: null,
      new_value: now,
      actor: 'rules' as const,
      reason,
    })),
  );
  return ids.length;
}

// POST /api/payment-links — body { split_id, security_answer? }
paymentLinksRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = parseCreateLinkInput(body);
  if ('error' in parsed) return c.json(parsed, 400);

  const split = await c.env.DB.prepare(
    `SELECT id, direction, remaining_cents, closed_at FROM splits WHERE id = ?`,
  )
    .bind(parsed.split_id)
    .first<{ id: string; direction: string; remaining_cents: number; closed_at: string | null }>();
  if (!split) return c.json({ error: 'split not found' }, 404);
  if (split.closed_at) return c.json({ error: 'split already settled' }, 400);
  if (split.direction !== 'they_owe') {
    return c.json({ error: 'payment links only collect from they_owe chits' }, 400);
  }

  const emailRow = await c.env.DB.prepare(`SELECT value FROM settings WHERE key = ?`)
    .bind('interac_email')
    .first<{ value: string }>();
  const email = emailRow?.value?.trim();
  if (!email) {
    return c.json({ error: 'set interac_email in Settings before sending links' }, 400);
  }

  let securityAnswer = parsed.security_answer;
  if (!securityAnswer) {
    const defaultRow = await c.env.DB.prepare(`SELECT value FROM settings WHERE key = ?`)
      .bind('interac_security_answer_default')
      .first<{ value: string }>();
    securityAnswer = defaultRow?.value?.trim() || undefined;
  }

  const id = newId('plink');
  const token = generateToken();
  const now = new Date();
  const created_at = now.toISOString();
  const expires_at = expiryFrom(now.getTime());

  await c.env.DB.prepare(
    `INSERT INTO payment_links (id, split_id, token, email, security_answer, created_at, viewed_at, expires_at, disabled_at)
     VALUES (?,?,?,?,?,?,NULL,?,NULL)`,
  )
    .bind(id, parsed.split_id, token, email, securityAnswer ?? null, created_at, expires_at)
    .run();

  await writeEditLog(c.env, [
    {
      entity_type: 'payment_link',
      entity_id: id,
      field: 'create',
      old_value: null,
      new_value: JSON.stringify({ split_id: parsed.split_id, token }),
      actor: 'user',
      reason: 'payment_link_create',
    },
  ]);

  const url = new URL(c.req.url);
  const base = `${url.protocol}//${url.host}`;
  return c.json({ id, token, url: `${base}/pay/${token}`, expires_at });
});

// POST /api/payment-links/:id/disable — manual disable
paymentLinksRoutes.post('/:id/disable', async (c) => {
  const id = c.req.param('id');
  const link = await c.env.DB.prepare(
    `SELECT id, disabled_at FROM payment_links WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: string; disabled_at: string | null }>();
  if (!link) return c.json({ error: 'not found' }, 404);
  if (link.disabled_at) return c.json({ ok: true, already_disabled: true });
  const now = nowIso();
  await c.env.DB.prepare(`UPDATE payment_links SET disabled_at = ? WHERE id = ?`)
    .bind(now, id)
    .run();
  await writeEditLog(c.env, [
    {
      entity_type: 'payment_link',
      entity_id: id,
      field: 'disabled_at',
      old_value: null,
      new_value: now,
      actor: 'user',
      reason: 'payment_link_manual_disable',
    },
  ]);
  return c.json({ ok: true });
});

// GET /api/payment-links?split_id=...  — list (auth'd, for the app)
paymentLinksRoutes.get('/', async (c) => {
  const splitId = c.req.query('split_id');
  if (!splitId) return c.json({ error: 'split_id required' }, 400);
  const { results } = await c.env.DB.prepare(
    `SELECT id, split_id, token, email, security_answer, created_at, viewed_at, expires_at, disabled_at
     FROM payment_links WHERE split_id = ? ORDER BY created_at DESC`,
  )
    .bind(splitId)
    .all();
  return c.json({ links: results ?? [] });
});

// ---------------------------------------------------------------------------
// Public landing page rendering. The unauthed route in index.ts calls this.
// ---------------------------------------------------------------------------

type LinkRow = {
  id: string;
  token: string;
  email: string;
  security_answer: string | null;
  expires_at: string;
  disabled_at: string | null;
  viewed_at: string | null;
  created_at: string;
  split_id: string;
  split_remaining_cents: number;
  split_original_cents: number;
  split_reason: string;
  split_closed_at: string | null;
  split_created_at: string;
  counterparty_name: string | null;
};

export async function loadPublicLink(env: Env, token: string): Promise<LinkRow | null> {
  const row = await env.DB.prepare(
    `SELECT pl.id, pl.token, pl.email, pl.security_answer, pl.expires_at, pl.disabled_at,
            pl.viewed_at, pl.created_at, pl.split_id,
            s.remaining_cents AS split_remaining_cents,
            s.original_cents AS split_original_cents,
            s.reason AS split_reason,
            s.closed_at AS split_closed_at,
            s.created_at AS split_created_at,
            cp.name AS counterparty_name
     FROM payment_links pl
     JOIN splits s ON s.id = pl.split_id
     LEFT JOIN counterparties cp ON cp.id = s.counterparty_id
     WHERE pl.token = ?`,
  )
    .bind(token)
    .first<LinkRow>();
  return row ?? null;
}

export async function markViewed(env: Env, id: string): Promise<void> {
  const now = nowIso();
  await env.DB.prepare(
    `UPDATE payment_links SET viewed_at = ? WHERE id = ? AND viewed_at IS NULL`,
  )
    .bind(now, id)
    .run();
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default:  return '&#39;';
    }
  });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function renderPublicLinkHtml(row: LinkRow, status: LinkStatus, userName?: string): string {
  // FROM = the person requesting payment (the user). Falls back to "Declyne" if no name set.
  const fromName = escapeHtml(userName || 'Declyne');
  const toName = escapeHtml(row.counterparty_name ?? '');
  const amountCents = row.split_closed_at ? 0 : row.split_remaining_cents;
  const amount = formatCents(amountCents);
  const reason = escapeHtml(row.split_reason);
  const email = escapeHtml(row.email);
  const sa = row.security_answer ? escapeHtml(row.security_answer) : '';
  const created = row.split_created_at.slice(0, 10);
  const settled = status !== 'active';
  const settledMsg =
    status === 'settled' ? '** this tab is settled **'
    : status === 'expired' ? '** this link has expired **'
    : '** this link is no longer active **';

  const inactiveBlock = `
    <div class="settled">${settledMsg}</div>
  `;

  const activeBlock = `
    <div class="kicker mb-12">send via interac e-transfer</div>
    <div class="row">
      <div>
        <div class="kicker-sm">email</div>
        <div class="mono">${email}</div>
      </div>
      <button class="stamp" data-copy="${email}">copy</button>
    </div>
    <div class="row">
      <div>
        <div class="kicker-sm">amount</div>
        <div class="mono">${amount}</div>
      </div>
      <button class="stamp" data-copy="${(amountCents / 100).toFixed(2)}">copy</button>
    </div>
    ${sa ? `
    <div class="row last">
      <div>
        <div class="kicker-sm">security answer</div>
        <div class="mono">${sa}</div>
      </div>
      <button class="stamp" data-copy="${sa}">copy</button>
    </div>` : '<div class="row last"></div>'}
    <p class="instr">Open your bank app, send via Interac e-Transfer, paste these in.</p>
  `;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="robots" content="noindex,nofollow" />
<title>Payment request &middot; ${toName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
:root {
  --paper:#f2ece0;
  --paper-shade:#e6dfd0;
  --ink:#1a141d;
  --ink-muted:#6b6470;
  --hairline-ink:rgba(26,20,29,0.18);
  --purple:#9e78b9;
  --bg:#1a141d;
  --mono:'Geist Mono',ui-monospace,monospace;
  --display:'Fraunces',Georgia,serif;
}
* { box-sizing:border-box; }
html,body { margin:0; padding:0; background:var(--bg); color:var(--ink); font-family:var(--mono); -webkit-font-smoothing:antialiased; }
body { min-height:100vh; padding:24px 16px 48px; display:flex; flex-direction:column; align-items:center; }
.brand { font-family:var(--mono); font-size:10px; letter-spacing:0.22em; text-transform:uppercase; color:rgba(255,255,255,0.55); margin-bottom:24px; }
.receipt {
  width:100%; max-width:380px; padding:28px 24px 24px;
  background:var(--paper); color:var(--ink);
  position:relative; box-shadow:0 14px 28px rgba(0,0,0,0.35), 0 4px 8px rgba(0,0,0,0.25);
}
.receipt::before, .receipt::after {
  content:''; position:absolute; left:-1px; right:-1px; height:10px; background:var(--bg);
  -webkit-mask:radial-gradient(circle at 4px 50%, transparent 3px, #000 3.5px) 0 0/8px 10px repeat-x;
          mask:radial-gradient(circle at 4px 50%, transparent 3px, #000 3.5px) 0 0/8px 10px repeat-x;
}
.receipt::before { top:-10px; }
.receipt::after  { bottom:-10px; transform:scaleY(-1); }
.head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
.kicker { font-family:var(--mono); font-size:10px; letter-spacing:0.22em; text-transform:uppercase; color:var(--ink-muted); }
.kicker-sm { font-family:var(--mono); font-size:9px; letter-spacing:0.22em; text-transform:uppercase; color:var(--ink-muted); margin-bottom:2px; }
.mb-4 { margin-bottom:4px; }
.mb-12 { margin-bottom:12px; }
.from { font-family:var(--display); font-size:28px; font-weight:600; line-height:1; color:var(--ink); margin:4px 0 2px; }
.dateline { font-family:var(--mono); font-size:11px; color:var(--ink-muted); }
.mascot { width:64px; height:64px; opacity:0.88; margin-top:2px; object-fit:contain; }
.perf { border-top:1px dashed var(--hairline-ink); margin:20px 0; }
.amount-label { margin-bottom:6px; }
.hero { font-family:var(--display); font-weight:600; font-size:44px; line-height:1; letter-spacing:-0.02em; color:var(--ink); margin-bottom:4px; font-variant-numeric:tabular-nums; }
.hero .cad { font-size:18px; margin-left:4px; opacity:0.5; }
.reason { font-family:var(--mono); font-size:11px; color:var(--ink-muted); margin-bottom:24px; }
.row { display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--hairline-ink); padding:10px 0; }
.row.last { border-bottom:1px dashed var(--hairline-ink); margin-bottom:24px; }
.mono { font-family:var(--mono); font-size:13px; color:var(--ink); }
.stamp {
  font-family:var(--mono); font-size:11px; letter-spacing:0.18em; text-transform:uppercase;
  background:var(--paper); color:var(--ink);
  border:none; border-radius:2px; padding:8px 12px; min-width:64px;
  box-shadow: inset 0 0 0 1px rgba(26,20,29,0.55), inset 0 0 0 3px var(--paper), inset 0 0 0 4px rgba(26,20,29,0.55);
  transform:rotate(-0.6deg); cursor:pointer;
}
.stamp.copied { background:#c8a96a; color:var(--paper); box-shadow: inset 0 0 0 1px rgba(26,20,29,0.55), inset 0 0 0 3px #c8a96a, inset 0 0 0 4px rgba(26,20,29,0.55); }
.instr { font-family:var(--mono); font-size:11px; line-height:1.6; color:var(--ink-muted); margin:0; }
.settled { text-align:center; font-family:var(--mono); font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:var(--ink-muted); padding:24px 0; }
.foot { margin-top:28px; text-align:center; font-family:var(--mono); font-size:10px; letter-spacing:0.18em; color:var(--ink-muted); opacity:0.6; }
.foot .d { color:var(--purple); font-weight:600; }
.disclaimer { margin-top:16px; font-family:var(--mono); font-size:10px; color:rgba(255,255,255,0.4); text-align:center; max-width:320px; line-height:1.6; }
</style>
</head>
<body>
  <div class="brand">declyne &middot; payment request</div>
  <div class="receipt">
    <div class="head">
      <div>
        <div class="kicker mb-4">from</div>
        <div class="from">${fromName}</div>
        <div class="dateline">${created}</div>
      </div>
      <img class="mascot" src="https://declyne-api.bocas-joshua.workers.dev/brand/mascot-head.png" alt="" aria-hidden="true" onerror="this.style.display='none'" />
    </div>
    <div class="perf"></div>
    <div class="kicker amount-label">amount owing</div>
    <div class="hero">${amount}<span class="cad">CAD</span></div>
    <div class="reason">${reason}</div>
    <div class="perf"></div>
    ${settled ? inactiveBlock : activeBlock}
    <div class="foot">** sent via <span class="d">D</span>eclyne **</div>
  </div>
  <div class="disclaimer">${settled ? 'This link is closed. No further action needed.' : 'This link expires in 90 days. Once the transfer is received, it marks automatically.'}</div>
<script>
document.querySelectorAll('button.stamp[data-copy]').forEach(function(btn){
  btn.addEventListener('click', function(){
    var v = btn.getAttribute('data-copy') || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(function(){
        var orig = btn.textContent;
        btn.textContent = 'copied';
        btn.classList.add('copied');
        setTimeout(function(){ btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
      });
    }
  });
});
</script>
</body>
</html>`;
}
