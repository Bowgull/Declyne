import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { setToken, clearToken } from '../lib/tokenStore';
import { scheduleAllNotifications } from '../native/notifications';
import LedgerHeader from '../components/LedgerHeader';
import SearchSheet from '../components/SearchSheet';

type Account = {
  id: string;
  name: string;
  institution: string;
  type: string;
  archived: number;
};

type CronRun = {
  id: string;
  job: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  detail: string | null;
};

const NAV_ITEMS: Array<{ to: string; label: string; hint: string }> = [
  { to: '/settings/accounts', label: 'Accounts', hint: 'institutions, types, archive' },
  { to: '/settings/merchants', label: 'Merchants', hint: 'verify + recategorize' },
  { to: '/settings/credit', label: 'Credit snapshots', hint: 'score, utilization, on-time' },
  { to: '/settings/cc-statements', label: 'CC statements', hint: 'per-cycle balances + due' },
  { to: '/goals', label: 'Goals', hint: 'targets + progress' },
  { to: '/holdings', label: 'Holdings', hint: 'lots, wrappers, costs' },
  { to: '/onboarding', label: 'Re-run onboarding', hint: '5 steps, skippable' },
];

export default function Settings() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ settings: Record<string, string> }>('/api/settings'),
  });
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ accounts: Account[] }>('/api/accounts'),
  });
  const cronRuns = useQuery({
    queryKey: ['cron-runs'],
    queryFn: () => api.get<{ runs: CronRun[] }>('/api/cron/runs?limit=5'),
  });

  const s = settings.data?.settings ?? {};

  const [sourceId, setSourceId] = useState('');
  const [pattern, setPattern] = useState('');
  const [minCents, setMinCents] = useState('');
  const [fallbackDays, setFallbackDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameSavedAt, setDisplayNameSavedAt] = useState<string | null>(null);

  const [interacEmail, setInteracEmail] = useState('');
  const [interacAnswer, setInteracAnswer] = useState('');
  const [interacSaving, setInteracSaving] = useState(false);
  const [interacSavedAt, setInteracSavedAt] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [tokenSheetOpen, setTokenSheetOpen] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenMsg, setTokenMsg] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(s.user_display_name ?? '');
  }, [s.user_display_name]);

  useEffect(() => {
    setInteracEmail(s.interac_email ?? '');
    setInteracAnswer(s.interac_security_answer_default ?? '');
  }, [s.interac_email, s.interac_security_answer_default]);

  useEffect(() => {
    setSourceId(s.paycheque_source_account_id ?? '');
    setPattern(s.paycheque_pattern ?? '');
    setMinCents(s.paycheque_min_cents ?? '');
    setFallbackDays(s.paycheque_fallback_days ?? '');
  }, [
    s.paycheque_source_account_id,
    s.paycheque_pattern,
    s.paycheque_min_cents,
    s.paycheque_fallback_days,
  ]);

  async function savePaycheque() {
    setSaving(true);
    try {
      await Promise.all([
        api.post('/api/settings/paycheque_source_account_id', { value: sourceId }),
        api.post('/api/settings/paycheque_pattern', { value: pattern }),
        api.post('/api/settings/paycheque_min_cents', { value: minCents }),
        api.post('/api/settings/paycheque_fallback_days', { value: fallbackDays }),
      ]);
      await qc.invalidateQueries({ queryKey: ['settings'] });
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    setDisplayNameSaving(true);
    try {
      await api.post('/api/settings/user_display_name', { value: displayName.trim() });
      await qc.invalidateQueries({ queryKey: ['settings'] });
      setDisplayNameSavedAt(new Date().toLocaleTimeString());
    } finally {
      setDisplayNameSaving(false);
    }
  }

  async function saveInterac() {
    setInteracSaving(true);
    try {
      await Promise.all([
        api.post('/api/settings/interac_email', { value: interacEmail.trim() }),
        api.post('/api/settings/interac_security_answer_default', { value: interacAnswer.trim() }),
      ]);
      await qc.invalidateQueries({ queryKey: ['settings'] });
      setInteracSavedAt(new Date().toLocaleTimeString());
    } finally {
      setInteracSaving(false);
    }
  }

  async function detectNow() {
    await api.post('/api/periods/detect', {});
    await qc.invalidateQueries({ queryKey: ['periods'] });
    setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <div className="ledger-page">
      <LedgerHeader
        kicker="§ SETTINGS"
        title="Settings"
        action={<Link to="/today" className="stamp">Done</Link>}
      />

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">01</span>Profile</span>
        <div className="flex flex-col gap-3 pt-2 pb-4">
          <label className="field-label">Your name</label>
          <input
            className="field"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How you appear on payment requests"
            autoComplete="name"
          />
          <div className="flex gap-2 pt-1">
            <button className="stamp stamp-square flex-1" onClick={saveProfile} disabled={displayNameSaving}>
              {displayNameSaving ? 'Saving.' : 'Save'}
            </button>
          </div>
          {displayNameSavedAt && (
            <p className="text-xs text-[color:var(--color-text-muted)]">Saved at {displayNameSavedAt}</p>
          )}
        </div>
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">02</span>Data</span>
        <button onClick={() => setSearchOpen(true)} className="ledger-row tap text-left">
          <div className="ledger-row-main">
            <span className="ledger-row-label">Search transactions</span>
            <span className="ledger-row-hint">find any line, any account, any date</span>
          </div>
          <span className="ledger-row-chevron">&rsaquo;</span>
        </button>
        {NAV_ITEMS.map((it) => (
          <Link key={it.to} to={it.to} className="ledger-row tap">
            <div className="ledger-row-main">
              <span className="ledger-row-label">{it.label}</span>
              <span className="ledger-row-hint">{it.hint}</span>
            </div>
            <span className="ledger-row-chevron">&rsaquo;</span>
          </Link>
        ))}
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">03</span>Interac e-transfer</span>
        <p className="text-sm text-[color:var(--color-text-muted)] pt-2 pb-3">
          Used on payment links sent from open tabs. Recipients copy these into their bank app.
        </p>
        <div className="flex flex-col gap-3 pb-4">
          <label className="field-label">Interac email</label>
          <input
            className="field"
            type="email"
            value={interacEmail}
            onChange={(e) => setInteracEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <label className="field-label">Default security answer (optional)</label>
          <input
            className="field"
            value={interacAnswer}
            onChange={(e) => setInteracAnswer(e.target.value)}
            placeholder="leave blank if your account is autodeposit"
          />
          <div className="flex gap-2 pt-2">
            <button className="stamp stamp-square flex-1" onClick={saveInterac} disabled={interacSaving}>
              {interacSaving ? 'Saving.' : 'Save'}
            </button>
          </div>
          {interacSavedAt && (
            <p className="text-xs text-[color:var(--color-text-muted)]">Saved at {interacSavedAt}</p>
          )}
        </div>
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">04</span>Paycheque detection</span>
        <p className="text-sm text-[color:var(--color-text-muted)] pt-2 pb-3">
          Anchors pay periods to real deposits. Runs after every CSV import.
        </p>

        <div className="flex flex-col gap-3 pb-4">
          <label className="field-label">Source account</label>
          <select
            className="field"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="">Not set</option>
            {(accounts.data?.accounts ?? [])
              .filter((a) => a.archived === 0 && a.type === 'chequing')
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.institution} · {a.name}
                </option>
              ))}
          </select>

          <label className="field-label">Description pattern (substring, case-insensitive)</label>
          <input
            className="field"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="PAYROLL"
          />

          <label className="field-label">Minimum deposit (cents)</label>
          <input
            className="field"
            inputMode="numeric"
            value={minCents}
            onChange={(e) => setMinCents(e.target.value.replace(/\D/g, ''))}
            placeholder="100000"
          />

          <label className="field-label">Fallback period length (days)</label>
          <input
            className="field"
            inputMode="numeric"
            value={fallbackDays}
            onChange={(e) => setFallbackDays(e.target.value.replace(/\D/g, ''))}
            placeholder="14"
          />

          <div className="flex gap-2 pt-2">
            <button className="stamp stamp-square flex-1" onClick={savePaycheque} disabled={saving}>
              {saving ? 'Saving.' : 'Save'}
            </button>
            <button className="stamp flex-1" onClick={detectNow}>
              Detect now
            </button>
          </div>
          {savedAt && (
            <p className="text-xs text-[color:var(--color-text-muted)]">Last action at {savedAt}</p>
          )}
        </div>
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">05</span>System</span>
        <Link to="/phase" className="ledger-row tap">
          <div className="ledger-row-main">
            <span className="ledger-row-label">Phase journey</span>
            <span className="ledger-row-hint">5 steps, current ringed</span>
          </div>
          <span className="ledger-row-chevron">&rsaquo;</span>
        </Link>
        <Link to="/reconcile" className="ledger-row tap">
          <div className="ledger-row-main">
            <span className="ledger-row-label">Reconciliation</span>
            <span className="ledger-row-hint">walk the week, seal it</span>
          </div>
          <span className="ledger-row-chevron">&rsaquo;</span>
        </Link>
        <Link to="/settings/trial-balance" className="ledger-row tap">
          <div className="ledger-row-main">
            <span className="ledger-row-label">Trial balance</span>
            <span className="ledger-row-hint">debits = credits, close the week</span>
          </div>
          <span className="ledger-row-chevron">&rsaquo;</span>
        </Link>
        <Row k="Current phase" v={s.current_phase ?? '—'} />
        <Row k="Merchant norm version" v={s.merchant_norm_version ?? '—'} />
        <Row k="Reconciliation streak" v={s.reconciliation_streak ?? '0'} />
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">06</span>Notifications</span>
        <p className="text-sm text-[color:var(--color-text-muted)] pt-2 pb-3">
          Sunday 9am reconciliation. Tuesday 9am follow-up if Sunday was skipped.
        </p>
        <div className="pb-4">
          <button className="stamp" onClick={() => scheduleAllNotifications()}>
            Re-schedule notifications
          </button>
        </div>
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">07</span>Cron runs</span>
        <span className="ledger-section-meta">last 5</span>
        <div className="pt-3 pb-1">
          {cronRuns.data?.runs.length ? (
            <ul className="flex flex-col">
              {cronRuns.data.runs.map((r) => (
                <li key={r.id} className="ledger-row">
                  <div className="ledger-row-main">
                    <span className="ledger-row-label" style={{ fontSize: 13 }}>
                      {new Date(r.started_at).toLocaleString('en-CA')}
                    </span>
                    <span className="ledger-row-hint">
                      {r.job}{r.detail ? ` · ${r.detail}` : ''}
                    </span>
                  </div>
                  <span
                    className="ledger-row-value"
                    style={{
                      color:
                        r.status === 'ok'
                          ? 'var(--color-ok)'
                          : 'var(--color-danger)',
                    }}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[color:var(--color-text-muted)]">No runs logged yet.</p>
          )}
        </div>
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">08</span>Audit</span>
        <Link to="/settings/edit-log" className="ledger-row tap">
          <div className="ledger-row-main">
            <span className="ledger-row-label">View edit log</span>
            <span className="ledger-row-hint">every mutation, every actor</span>
          </div>
          <span className="ledger-row-chevron">&rsaquo;</span>
        </Link>
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">09</span>Export</span>
        <div className="pt-3 pb-2">
          <a className="sticker sticker-cool" href={`${api.baseUrl}/api/export`}>
            <span className="sticker-glyph">⤓</span>
            Export CSV
          </a>
        </div>
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">10</span>API token</span>
        <p className="text-sm text-[color:var(--color-text-muted)] pt-2 pb-3">
          Stored in iOS Keychain (or browser secure storage). Paste a fresh token after rotating in Cloudflare.
        </p>
        <div className="flex gap-2 pt-1 pb-2">
          <button className="stamp stamp-purple flex-1" onClick={() => { setNewToken(''); setTokenMsg(null); setTokenSheetOpen(true); }}>
            Rotate token
          </button>
          <button
            className="sticker sticker-warn"
            onClick={async () => {
              await clearToken();
              setTokenMsg('Token cleared. Reload to enter a new one.');
            }}
          >
            <span className="sticker-glyph">⊘</span>
            Clear token
          </button>
        </div>
        {tokenMsg && (
          <p className="text-xs text-[color:var(--color-text-muted)] pb-2">{tokenMsg}</p>
        )}
      </section>

      {searchOpen && <SearchSheet onClose={() => setSearchOpen(false)} />}

      {tokenSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setTokenSheetOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[color:var(--color-bg-card)] rounded-t-2xl p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Rotate API token</h2>
            <label className="field-label">New token</label>
            <input
              className="field"
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="paste here"
            />
            <p className="text-xs text-[color:var(--color-text-muted)]">
              Stored in Keychain. The build-time env value is ignored after this is set.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                className="stamp stamp-square flex-1"
                disabled={tokenSaving || !newToken.trim()}
                onClick={async () => {
                  setTokenSaving(true);
                  try {
                    await setToken(newToken.trim());
                    setTokenMsg('Token saved.');
                    setTokenSheetOpen(false);
                    setNewToken('');
                  } finally {
                    setTokenSaving(false);
                  }
                }}
              >
                {tokenSaving ? 'Saving.' : 'Save'}
              </button>
              <button className="stamp stamp-square flex-1" onClick={() => setTokenSheetOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="ledger-row">
      <span className="ledger-row-label" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{k}</span>
      <span className="ledger-row-value" style={{ color: 'var(--color-text-primary)' }}>{v}</span>
    </div>
  );
}
