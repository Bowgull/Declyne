import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

type AccountType = 'chequing' | 'savings' | 'credit' | 'loan';

interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  archived: number;
}

type Step = 0 | 1 | 2 | 3 | 4;

const STEP_TITLES = [
  'Welcome',
  'Add an account',
  'Paycheque detection',
  'Essentials baseline',
  'You are set',
];

export default function Onboarding() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(0);

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ accounts: Account[] }>('/api/accounts'),
  });

  const finish = useMutation({
    mutationFn: () => api.post('/api/settings/onboarding_completed', { value: '1' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['settings'] });
      nav('/today', { replace: true });
    },
  });

  function next() {
    setStep((s) => Math.min(4, (s + 1) as Step) as Step);
  }
  function back() {
    setStep((s) => Math.max(0, (s - 1) as Step) as Step);
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{STEP_TITLES[step]}</h1>
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Step {step + 1} of {STEP_TITLES.length}
          </p>
        </div>
        <button
          className="btn-outline"
          onClick={() => finish.mutate()}
          disabled={finish.isPending}
        >
          Skip all
        </button>
      </header>

      <div className="flex gap-1">
        {STEP_TITLES.map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{
              background:
                i <= step ? 'var(--color-accent)' : 'var(--color-hairline)',
            }}
          />
        ))}
      </div>

      {step === 0 && <StepWelcome />}
      {step === 1 && <StepAccount accounts={accounts.data?.accounts ?? []} />}
      {step === 2 && <StepPaycheque accounts={accounts.data?.accounts ?? []} />}
      {step === 3 && <StepEssentials />}
      {step === 4 && <StepDone />}

      <div className="mt-2 flex gap-2">
        {step > 0 && (
          <button className="btn-outline flex-1" onClick={back}>
            Back
          </button>
        )}
        {step < 4 ? (
          <button className="stamp stamp-square flex-1" onClick={next}>
            {step === 0 ? 'Begin' : 'Next'}
          </button>
        ) : (
          <button
            className="stamp stamp-square flex-1"
            onClick={() => finish.mutate()}
            disabled={finish.isPending}
          >
            {finish.isPending ? 'Saving.' : 'Finish'}
          </button>
        )}
      </div>
    </div>
  );
}

function StepWelcome() {
  return (
    <section className="card flex flex-col gap-3">
      <p className="text-sm">
        Declyne is a five-phase reset: stabilize, clear debt, build credit, build buffer, grow.
      </p>
      <p className="text-sm text-[color:var(--color-text-muted)]">
        Phase is computed from your real numbers, not how the week felt. Every step here is
        optional. You can fill anything in later from Settings.
      </p>
    </section>
  );
}

function StepAccount({ accounts }: { accounts: Account[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState<AccountType>('chequing');
  const [error, setError] = useState<string | null>(null);

  const live = accounts.filter((a) => a.archived === 0);

  const add = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        institution: institution.trim(),
        type,
        currency: 'CAD',
      };
      if (!body.name || !body.institution) throw new Error('Name and institution required.');
      return api.post<{ id: string }>('/api/accounts', body);
    },
    onSuccess: () => {
      setName('');
      setInstitution('');
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <section className="card flex flex-col gap-3">
      <p className="text-sm text-[color:var(--color-text-muted)]">
        Add the chequing account where your pay lands. You can add more later.
      </p>

      {live.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {live.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-md border border-[color:var(--color-hairline)] px-3 py-2"
            >
              <span>
                {a.institution} · {a.name}
              </span>
              <span className="text-xs text-[color:var(--color-text-muted)]">{a.type}</span>
            </li>
          ))}
        </ul>
      )}

      <label className="flex flex-col gap-1">
        <span className="field-label">Institution</span>
        <input
          className="field"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="TD"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="field-label">Account name</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Chequing ·· 1234"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="field-label">Type</span>
        <select
          className="field"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
        >
          <option value="chequing">Chequing</option>
          <option value="savings">Savings</option>
          <option value="credit">Credit</option>
          <option value="loan">Loan</option>
        </select>
      </label>

      {error && (
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-outline"
        onClick={() => {
          setError(null);
          add.mutate();
        }}
        disabled={add.isPending}
      >
        {add.isPending ? 'Adding.' : 'Add account'}
      </button>
    </section>
  );
}

function StepPaycheque({ accounts }: { accounts: Account[] }) {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ settings: Record<string, string> }>('/api/settings'),
  });
  const s = settings.data?.settings ?? {};

  const [sourceId, setSourceId] = useState('');
  const [pattern, setPattern] = useState('');
  const [minCents, setMinCents] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setSourceId(s.paycheque_source_account_id ?? '');
    setPattern(s.paycheque_pattern ?? '');
    setMinCents(s.paycheque_min_cents ?? '');
  }, [s.paycheque_source_account_id, s.paycheque_pattern, s.paycheque_min_cents]);

  const save = useMutation({
    mutationFn: async () => {
      await Promise.all([
        api.post('/api/settings/paycheque_source_account_id', { value: sourceId }),
        api.post('/api/settings/paycheque_pattern', { value: pattern }),
        api.post('/api/settings/paycheque_min_cents', { value: minCents }),
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSavedAt(new Date().toLocaleTimeString());
    },
  });

  const chequing = accounts.filter((a) => a.archived === 0 && a.type === 'chequing');

  return (
    <section className="card flex flex-col gap-3">
      <p className="text-sm text-[color:var(--color-text-muted)]">
        Pay periods anchor on real deposits. Tell Declyne which account and what the deposit
        looks like.
      </p>

      <label className="field-label">Source account</label>
      <select className="field" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
        <option value="">Not set</option>
        {chequing.map((a) => (
          <option key={a.id} value={a.id}>
            {a.institution} · {a.name}
          </option>
        ))}
      </select>

      <label className="field-label">Description pattern</label>
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

      <button className="btn-outline" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? 'Saving.' : 'Save'}
      </button>
      {savedAt && (
        <p className="text-xs text-[color:var(--color-text-muted)]">Saved at {savedAt}</p>
      )}
    </section>
  );
}

function StepEssentials() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ settings: Record<string, string> }>('/api/settings'),
  });
  const s = settings.data?.settings ?? {};

  const [dollars, setDollars] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const cents = s.essentials_monthly_cents;
    setDollars(cents ? String(Math.round(Number(cents) / 100)) : '');
  }, [s.essentials_monthly_cents]);

  const save = useMutation({
    mutationFn: async () => {
      const cents = String(Math.round(Number(dollars) * 100));
      await api.post('/api/settings/essentials_monthly_cents', { value: cents });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSavedAt(new Date().toLocaleTimeString());
    },
  });

  return (
    <section className="card flex flex-col gap-3">
      <p className="text-sm text-[color:var(--color-text-muted)]">
        Rough monthly essentials: rent, utilities, groceries, transit, insurance. Skip and
        Declyne will derive it from your imports.
      </p>

      <label className="field-label">Essentials per month (CAD)</label>
      <input
        className="field"
        inputMode="numeric"
        value={dollars}
        onChange={(e) => setDollars(e.target.value.replace(/\D/g, ''))}
        placeholder="3000"
      />

      <button
        className="btn-outline"
        onClick={() => save.mutate()}
        disabled={save.isPending || !dollars}
      >
        {save.isPending ? 'Saving.' : 'Save'}
      </button>
      {savedAt && (
        <p className="text-xs text-[color:var(--color-text-muted)]">Saved at {savedAt}</p>
      )}
    </section>
  );
}

function StepDone() {
  return (
    <section className="card flex flex-col gap-3">
      <p className="text-sm">
        That is enough to start. Import a CSV from Settings, and Declyne will detect periods,
        compute behaviour signals, and place you in a phase.
      </p>
      <p className="text-sm text-[color:var(--color-text-muted)]">
        Sunday 9am reconciliation. Tuesday 9am follow-up if Sunday slipped. No other pings.
      </p>
    </section>
  );
}
