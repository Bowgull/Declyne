import { describe, it, expect } from 'vitest';
import {
  generateToken,
  expiryFrom,
  linkStatus,
  parseCreateLinkInput,
  escapeHtml,
  renderPublicLinkHtml,
} from '../routes/paymentLinks.js';

describe('generateToken', () => {
  it('produces a 12-char token by default', () => {
    const t = generateToken();
    expect(t).toHaveLength(12);
  });

  it('honors a custom length', () => {
    expect(generateToken(20)).toHaveLength(20);
  });

  it('uses only the unambiguous alphabet (no 0/o/1/l)', () => {
    for (let i = 0; i < 50; i++) {
      const t = generateToken();
      expect(t).toMatch(/^[abcdefghijkmnpqrstuvwxyz23456789]+$/);
    }
  });

  it('generates distinct tokens across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateToken());
    // 32^12 space, 500 samples — collisions effectively impossible
    expect(seen.size).toBe(500);
  });
});

describe('expiryFrom', () => {
  it('returns 90 days from now by default', () => {
    const now = Date.UTC(2026, 3, 27, 12, 0, 0);
    const out = expiryFrom(now);
    const diff = new Date(out).getTime() - now;
    expect(diff).toBe(90 * 86400_000);
  });

  it('honors custom day count', () => {
    const now = Date.UTC(2026, 3, 27);
    const out = expiryFrom(now, 7);
    expect(new Date(out).getTime() - now).toBe(7 * 86400_000);
  });
});

describe('linkStatus', () => {
  const future = new Date(Date.now() + 86400_000).toISOString();
  const past = new Date(Date.now() - 86400_000).toISOString();
  const now = new Date();

  it('returns settled when split closed_at is set', () => {
    expect(linkStatus({ disabled_at: null, expires_at: future }, '2026-04-27', now)).toBe('settled');
  });

  it('settled wins over disabled', () => {
    expect(linkStatus({ disabled_at: '2026-04-26', expires_at: future }, '2026-04-27', now)).toBe('settled');
  });

  it('returns disabled when disabled_at is set and split is open', () => {
    expect(linkStatus({ disabled_at: '2026-04-27', expires_at: future }, null, now)).toBe('disabled');
  });

  it('returns expired when past expires_at', () => {
    expect(linkStatus({ disabled_at: null, expires_at: past }, null, now)).toBe('expired');
  });

  it('returns active otherwise', () => {
    expect(linkStatus({ disabled_at: null, expires_at: future }, null, now)).toBe('active');
  });
});

describe('parseCreateLinkInput', () => {
  it('accepts a minimal valid body', () => {
    expect(parseCreateLinkInput({ split_id: 'split_123' })).toEqual({
      split_id: 'split_123',
      security_answer: undefined,
    });
  });

  it('trims security_answer and drops empty strings', () => {
    expect(parseCreateLinkInput({ split_id: 'x', security_answer: '  brunch  ' })).toEqual({
      split_id: 'x',
      security_answer: 'brunch',
    });
    expect(parseCreateLinkInput({ split_id: 'x', security_answer: '   ' })).toEqual({
      split_id: 'x',
      security_answer: undefined,
    });
  });

  it('rejects missing split_id', () => {
    expect(parseCreateLinkInput({})).toEqual({ error: 'split_id required' });
    expect(parseCreateLinkInput({ split_id: '' })).toEqual({ error: 'split_id required' });
  });

  it('rejects non-object body', () => {
    expect(parseCreateLinkInput(null)).toEqual({ error: 'invalid body' });
    expect(parseCreateLinkInput('split_1')).toEqual({ error: 'invalid body' });
  });

  it('rejects security_answer over 80 chars', () => {
    expect(parseCreateLinkInput({ split_id: 'x', security_answer: 'a'.repeat(81) })).toEqual({
      error: 'security_answer too long',
    });
  });
});

describe('escapeHtml', () => {
  it('escapes the dangerous characters', () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    );
  });
});

describe('renderPublicLinkHtml', () => {
  const baseRow = {
    id: 'plink_1',
    token: 'abc123def456',
    email: 'me@example.com',
    security_answer: 'brunch',
    expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
    disabled_at: null,
    viewed_at: null,
    created_at: '2026-04-27T12:00:00.000Z',
    split_id: 'split_1',
    split_remaining_cents: 4750,
    split_original_cents: 4750,
    split_reason: 'Lady Marmalade brunch',
    split_closed_at: null,
    split_created_at: '2026-04-20T12:00:00.000Z',
    counterparty_name: 'Marcus Chen',
  };

  it('renders amount, email, security answer, and copy stamps when active', () => {
    const html = renderPublicLinkHtml(baseRow, 'active');
    expect(html).toContain('$47.50');
    expect(html).toContain('me@example.com');
    expect(html).toContain('brunch');
    expect(html).toContain('data-copy="me@example.com"');
    expect(html).toContain('data-copy="47.50"');
    expect(html).toContain('data-copy="brunch"');
    expect(html).not.toContain('this tab is settled');
  });

  it('renders the settled banner when status is settled', () => {
    const html = renderPublicLinkHtml({ ...baseRow, split_closed_at: '2026-04-27' }, 'settled');
    expect(html).toContain('this tab is settled');
    expect(html).not.toContain('data-copy="me@example.com"');
  });

  it('renders the expired banner when status is expired', () => {
    const html = renderPublicLinkHtml(baseRow, 'expired');
    expect(html).toContain('this link has expired');
  });

  it('escapes user-controlled fields', () => {
    const html = renderPublicLinkHtml(
      { ...baseRow, split_reason: '<img src=x onerror=alert(1)>', counterparty_name: '"&<' },
      'active',
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;&amp;&lt;');
  });
});
