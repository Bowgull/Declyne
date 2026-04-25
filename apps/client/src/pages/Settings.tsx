import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { scheduleAllNotifications } from '../native/notifications';

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

  async function detectNow() {
    await api.post('/api/periods/detect', {});
    await qc.invalidateQueries({ queryKey: ['periods'] });
    setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link to="/today" className="btn-outline">Done</Link>
      </header>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Data</h2>
        <Link to="/settings/accounts" className="btn-outline text-center">
          Accounts
        </Link>
        <Link to="/settings/merchants" className="btn-outline text-center">
          Merchants
        </Link>
        <Link to="/settings/credit" className="btn-outline text-center">
          Credit snapshots
        </Link>
        <Link to="/settings/cc-statements" className="btn-outline text-center">
          CC statements
        </Link>
        <Link to="/goals" className="btn-outline text-center">
          Goals
        </Link>
        <Link to="/holdings" className="btn-outline text-center">
          Holdings
        </Link>
        <Link to="/onboarding" className="btn-outline text-center">
          Re-run onboarding
        </Link>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Paycheque detection</h2>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Anchors pay periods to real deposits. Runs after every CSV import.
        </p>

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

        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={savePaycheque} disabled={saving}>
            {saving ? 'Saving.' : 'Save'}
          </button>
          <button className="btn-outline flex-1" onClick={detectNow}>
            Detect now
          </button>
        </div>
        {savedAt && (
          <p className="text-xs text-[color:var(--color-text-muted)]">Last action at {savedAt}</p>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">System</h2>
        <Link to="/phase" className="btn-outline text-center">
          Phase journey
        </Link>
        <Row k="Current phase" v={s.current_phase ?? '—'} />
        <Row k="Merchant norm version" v={s.merchant_norm_version ?? '—'} />
        <Row k="Reconciliation streak" v={s.reconciliation_streak ?? '0'} />
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Notifications</h2>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Sunday 9am reconciliation. Tuesday 9am follow-up if Sunday was skipped.
        </p>
        <button className="btn-outline" onClick={() => scheduleAllNotifications()}>
          Re-schedule notifications
        </button>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Cron runs</h2>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Nightly signals compute at 08:00 UTC. Last 5 shown.
        </p>
        {cronRuns.data?.runs.length ? (
          <ul className="flex flex-col gap-2">
            {cronRuns.data.runs.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
                <div className="flex flex-col">
                  <span className="num">{new Date(r.started_at).toLocaleString('en-CA')}</span>
                  <span className="text-xs text-[color:var(--color-text-muted)]">
                    {r.job}{r.detail ? ` · ${r.detail}` : ''}
                  </span>
                </div>
                <span
                  className={
                    r.status === 'ok'
                      ? 'text-xs text-[color:var(--color-text-muted)]'
                      : 'text-xs text-[color:var(--color-danger,#b00)]'
                  }
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[color:var(--color-text-muted)]">No runs logged yet.</p>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Audit</h2>
        <Link to="/settings/edit-log" className="btn-outline text-center">
          View edit log
        </Link>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Export</h2>
        <a className="btn-outline text-center" href={`${api.baseUrl}/api/export`}>
          Download sectioned CSV
        </a>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[color:var(--color-text-muted)]">{k}</span>
      <span className="num">{v}</span>
    </div>
  );
}
