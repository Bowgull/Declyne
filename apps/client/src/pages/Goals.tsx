import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
};

type GoalType = 'emergency' | 'vacation' | 'rrsp' | 'tfsa' | 'fhsa' | 'car' | 'other';

const GOAL_TYPES: { id: GoalType; label: string }[] = [
  { id: 'emergency', label: 'Emergency Fund' },
  { id: 'vacation', label: 'Vacation' },
  { id: 'rrsp', label: 'Retirement (RRSP)' },
  { id: 'tfsa', label: 'Tax-Free Savings (TFSA)' },
  { id: 'fhsa', label: 'First Home (FHSA)' },
  { id: 'car', label: 'Car' },
  { id: 'other', label: 'Other' },
];

interface Suggestion {
  goal_type: GoalType;
  name: string;
  target_cents: number;
  per_paycheque_cents: number;
  why_target: string;
  why_paycheque: string;
}

type WhatIf = {
  sub: string;
  cut_pct: number;
  monthly_freed_cents: number;
  new_complete_date: string;
  months_saved: number;
};

type Goal = {
  id: string;
  name: string;
  target_cents: number;
  target_date: string;
  linked_account_id: string | null;
  progress_cents: number;
  archived: number;
  goal_type?: GoalType;
  per_paycheque_cents?: number;
  projected_complete_date?: string | null;
  what_if?: WhatIf[];
};

const SUB_LABEL: Record<string, string> = {
  restaurants: 'restaurants',
  delivery: 'delivery',
  alcohol: 'alcohol',
  weed: 'weed',
  streaming: 'streaming',
  treats: 'treats',
  shopping: 'shopping',
  personal_care: 'personal care',
  entertainment: 'entertainment',
  groceries: 'groceries',
  transit: 'transit',
};

function subLabel(s: string): string {
  return SUB_LABEL[s] ?? s.replace(/_/g, ' ');
}

function monthsLabel(n: number): string {
  return n === 1 ? '1 month' : `${n} months`;
}

type Account = {
  id: string;
  name: string;
  institution: string;
  type: string;
  archived: number;
};

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function Goals() {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const goals = useQuery({
    queryKey: ['goals', showArchived],
    queryFn: () =>
      api.get<{ goals: Goal[] }>(`/api/goals${showArchived ? '?include_archived=1' : ''}`),
  });

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ accounts: Account[] }>('/api/accounts'),
  });

  const rows = goals.data?.goals ?? [];

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-sigil" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">GOALS</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {goals.data ? `${rows.length} on the books` : 'Loading…'}
              </div>
            </div>
          </div>
          <Link to="/grow" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Close
          </Link>
        </header>

        <div className="pt-3 flex gap-2" style={perforation}>
          <button className="stamp stamp-square flex-1" onClick={() => setAdding(true)}>
            Add goal
          </button>
          <button
            className="btn-outline"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
        </div>

        {rows.length === 0 && goals.data ? (
          <div className="pt-3 text-center text-xs text-[color:var(--color-text-muted)]" style={perforation}>
            No goals yet.
          </div>
        ) : (
          <div className="flex flex-col">
            {rows.map((g) => {
              const pct = g.target_cents > 0
                ? Math.min(100, Math.round((g.progress_cents / g.target_cents) * 100))
                : 0;
              const remaining = Math.max(0, g.target_cents - g.progress_cents);
              return (
                <div
                  key={g.id}
                  className="pt-3 mt-3 flex flex-col gap-1.5 cursor-pointer"
                  style={perforation}
                  onClick={() => setEditing(g)}
                  role="button"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm truncate">{g.name}{g.archived ? ' · archived' : ''}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] num shrink-0">
                      {g.target_date}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-xs num text-[color:var(--color-text-muted)]">
                    <span>{formatCents(g.progress_cents)} of {formatCents(g.target_cents)}</span>
                    <span>{formatCents(remaining)} to go · {pct}%</span>
                  </div>
                  {g.projected_complete_date && (
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                      projected complete {g.projected_complete_date}
                      {g.per_paycheque_cents
                        ? ` · ${formatCents(g.per_paycheque_cents)}/paycheque`
                        : ''}
                    </div>
                  )}
                  <div className="h-1 w-full bg-[color:var(--color-line)] rounded">
                    <div
                      className="h-1 bg-[color:var(--color-text)] rounded"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {g.what_if && g.what_if.length > 0 && (
                    <ul
                      className="mt-1 flex flex-col gap-0.5 text-[11px] italic leading-snug"
                      style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {g.what_if.map((w) => (
                        <li key={w.sub}>
                          cut {subLabel(w.sub)} {w.cut_pct}% → finishes {monthsLabel(w.months_saved)} sooner
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-3 text-center text-[11px] uppercase tracking-[0.32em] text-[color:var(--color-text-muted)]" style={perforation}>
          ** End of ledger **
        </div>
      </section>

      {adding && (
        <GoalSheet
          mode="add"
          accounts={accounts.data?.accounts ?? []}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['goals'] });
            setAdding(false);
          }}
        />
      )}
      {editing && (
        <GoalSheet
          mode="edit"
          goal={editing}
          accounts={accounts.data?.accounts ?? []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ['goals'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function GoalSheet({
  mode,
  goal,
  accounts,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  goal?: Goal;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [goalType, setGoalType] = useState<GoalType>(goal?.goal_type ?? 'emergency');
  const [name, setName] = useState(goal?.name ?? '');
  const [targetDollars, setTargetDollars] = useState(
    goal ? (goal.target_cents / 100).toFixed(2) : '',
  );
  const [progressDollars, setProgressDollars] = useState(
    goal ? (goal.progress_cents / 100).toFixed(2) : '0',
  );
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? today());
  const [linkedAccountId, setLinkedAccountId] = useState(goal?.linked_account_id ?? '');
  const [archived, setArchived] = useState(goal?.archived === 1);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [userEditedTarget, setUserEditedTarget] = useState(mode === 'edit');
  const [userEditedName, setUserEditedName] = useState(mode === 'edit');

  useEffect(() => {
    if (goal) {
      setGoalType(goal.goal_type ?? 'other');
      setName(goal.name);
      setTargetDollars((goal.target_cents / 100).toFixed(2));
      setProgressDollars((goal.progress_cents / 100).toFixed(2));
      setTargetDate(goal.target_date);
      setLinkedAccountId(goal.linked_account_id ?? '');
      setArchived(goal.archived === 1);
    }
  }, [goal]);

  // Fetch a suggestion every time goalType changes (add-mode only).
  useEffect(() => {
    if (mode !== 'add') return;
    let cancelled = false;
    api
      .get<{ suggestion: Suggestion }>(`/api/goals/suggest?type=${goalType}`)
      .then((r) => {
        if (cancelled) return;
        setSuggestion(r.suggestion);
        if (!userEditedTarget) {
          setTargetDollars((r.suggestion.target_cents / 100).toFixed(2));
        }
        if (!userEditedName) {
          setName(r.suggestion.name);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [goalType, mode, userEditedTarget, userEditedName]);

  const save = useMutation({
    mutationFn: async () => {
      const target_cents = Math.round(Number(targetDollars) * 100);
      const progress_cents = Math.round(Number(progressDollars) * 100);
      if (mode === 'add') {
        await api.post('/api/goals', {
          name,
          target_cents,
          target_date: targetDate,
          linked_account_id: linkedAccountId || null,
          progress_cents,
          goal_type: goalType,
        });
      } else if (goal) {
        await api.patch(`/api/goals/${goal.id}`, {
          name,
          target_cents,
          target_date: targetDate,
          linked_account_id: linkedAccountId || null,
          progress_cents,
          archived: archived ? 1 : 0,
          goal_type: goalType,
        });
      }
    },
    onSuccess: () => onSaved(),
  });

  const valid =
    name.trim().length > 0 &&
    Number(targetDollars) > 0 &&
    Number(progressDollars) >= 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(targetDate);

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="card w-full max-w-xl mx-auto stub-top flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">{mode === 'add' ? 'Add goal' : 'Edit goal'}</h2>

        <label className="field-label">Type</label>
        <select
          className="field"
          value={goalType}
          onChange={(e) => setGoalType(e.target.value as GoalType)}
        >
          {GOAL_TYPES.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>

        <div className="flex items-baseline justify-between">
          <label className="field-label">Name</label>
        </div>
        <input
          className="field"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setUserEditedName(true);
          }}
          placeholder="Cash buffer"
        />

        <div className="flex items-baseline justify-between">
          <label className="field-label">Target ($)</label>
          {mode === 'add' && suggestion && !userEditedTarget && (
            <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-accent-gold)' }}>
              ✦ suggested
            </span>
          )}
        </div>
        <input
          className="field num"
          inputMode="decimal"
          value={targetDollars}
          onChange={(e) => {
            setTargetDollars(e.target.value);
            setUserEditedTarget(true);
          }}
        />
        {mode === 'add' && suggestion && (
          <p className="text-[11px] italic leading-snug" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            based on {suggestion.why_target}
          </p>
        )}

        <label className="field-label">Progress so far ($)</label>
        <input
          className="field num"
          inputMode="decimal"
          value={progressDollars}
          onChange={(e) => setProgressDollars(e.target.value)}
        />

        {mode === 'add' && suggestion && (
          <p className="text-[11px] italic leading-snug pt-1" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            ~{formatCents(suggestion.per_paycheque_cents)}/paycheque · {suggestion.why_paycheque}
          </p>
        )}

        <label className="field-label">Target date</label>
        <input
          className="field"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />

        <label className="field-label">Linked account (optional)</label>
        <select
          className="field"
          value={linkedAccountId}
          onChange={(e) => setLinkedAccountId(e.target.value)}
        >
          <option value="">None</option>
          {accounts.filter((a) => a.archived === 0).map((a) => (
            <option key={a.id} value={a.id}>
              {a.institution} · {a.name}
            </option>
          ))}
        </select>

        {mode === 'edit' && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Archived
          </label>
        )}

        {save.error && (
          <p className="text-xs text-[color:var(--color-danger,#b00)]">{String(save.error)}</p>
        )}

        <div className="flex gap-2">
          <button className="btn-outline flex-1" onClick={onClose}>Cancel</button>
          <button
            className="stamp stamp-square flex-1"
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid}
          >
            {save.isPending ? 'Saving.' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
