import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

type PhaseLogEntry = {
  id: string;
  phase: number;
  entered_at: string;
  trigger_rule: string;
  metrics_json: string | null;
};

const PHASE_NAMES: Record<number, string> = {
  1: 'Stabilize',
  2: 'Clear Debt',
  3: 'Build Credit',
  4: 'Build Buffer',
  5: 'Grow',
};

const PHASE_BLURB: Record<number, string> = {
  1: 'Cover essentials. Stop bleeding.',
  2: 'Pay down high-APR debt.',
  3: 'Utilization under 30, on-time, repeat.',
  4: 'Three months of essentials in cash.',
  5: 'Buffer set. Time to plant.',
};

export default function PhaseJourney() {
  const log = useQuery({
    queryKey: ['phase-log'],
    queryFn: () => api.get<{ entries: PhaseLogEntry[] }>('/api/phase/log'),
  });
  const phase = useQuery({
    queryKey: ['phase'],
    queryFn: () => api.get<{ phase: number; name: string; entered_at: string | null; trigger_rule: string }>('/api/phase'),
  });

  const current = phase.data?.phase ?? 1;
  const entries = log.data?.entries ?? [];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Phase journey</h1>
        <Link to="/today" className="btn-outline">Done</Link>
      </header>

      <section className="card flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Current</div>
        <div className="text-3xl font-semibold">
          {current}. {PHASE_NAMES[current]}
        </div>
        <p className="text-sm text-[color:var(--color-text-muted)]">{PHASE_BLURB[current]}</p>
        {phase.data?.entered_at && (
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Since {new Date(phase.data.entered_at).toLocaleDateString('en-CA')} · {phase.data.trigger_rule}
          </p>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Path</div>
        <ol className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((p) => {
            const reached = current >= p;
            const isCurrent = current === p;
            return (
              <li
                key={p}
                className="flex items-center gap-3"
                style={{ opacity: reached ? 1 : 0.4 }}
              >
                <span
                  className="num inline-flex h-7 w-7 items-center justify-center rounded-full"
                  style={{
                    background: isCurrent ? 'var(--color-accent, #c9a86a)' : 'transparent',
                    border: '1px solid var(--color-text-muted)',
                    color: isCurrent ? 'var(--color-bg, #0d0a10)' : 'inherit',
                  }}
                >
                  {p}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{PHASE_NAMES[p]}</span>
                  <span className="text-xs text-[color:var(--color-text-muted)]">{PHASE_BLURB[p]}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Transitions</div>
        {entries.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-muted)]">No transitions logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((e) => {
              const metrics = parseMetrics(e.metrics_json);
              return (
                <li key={e.id} className="flex flex-col gap-1 border-t border-[color:var(--color-text-muted)]/20 pt-3 first:border-0 first:pt-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">
                      Phase {e.phase}. {PHASE_NAMES[e.phase] ?? '—'}
                    </span>
                    <span className="num text-xs text-[color:var(--color-text-muted)]">
                      {new Date(e.entered_at).toLocaleDateString('en-CA')}
                    </span>
                  </div>
                  <span className="text-xs text-[color:var(--color-text-muted)]">{e.trigger_rule}</span>
                  {metrics.length > 0 && (
                    <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                      {metrics.map(([k, v]) => (
                        <li key={k} className="flex items-baseline justify-between text-xs">
                          <span className="text-[color:var(--color-text-muted)]">{k}</span>
                          <span className="num">{v}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function parseMetrics(raw: string | null): Array<[string, string]> {
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, number | null>;
    return Object.entries(obj).map(([k, v]) => [k, formatMetric(k, v)]);
  } catch {
    return [];
  }
}

function formatMetric(key: string, v: number | null): string {
  if (v === null || v === undefined) return '—';
  if (key === 'vice_ratio' || key === 'non_mortgage_ratio') {
    return `${(v * 100).toFixed(1)}%`;
  }
  if (key === 'buffer_months') return v.toFixed(2);
  return String(v);
}
