import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import LedgerHeader from '../components/LedgerHeader';

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
    <div className="ledger-page">
      <LedgerHeader
        kicker={`§ PHASE 0${current}`}
        title="Phase journey"
        action={<Link to="/today" className="stamp">Done</Link>}
      />

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">01</span>Current</span>
        <div className="pt-4 pb-4">
          <div className="hero-num-dark-label">Phase 0{current}</div>
          <div className="hero-num-dark gold">{current}. {PHASE_NAMES[current]}</div>
          <p className="text-sm text-[color:var(--color-text-muted)] mt-3">{PHASE_BLURB[current]}</p>
          {phase.data?.entered_at && (
            <p className="text-xs text-[color:var(--color-text-muted)] mt-2 font-mono tracking-wider">
              Since {new Date(phase.data.entered_at).toLocaleDateString('en-CA')} · {phase.data.trigger_rule}
            </p>
          )}
        </div>
      </section>

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">02</span>Path</span>
        <ol className="flex flex-col gap-2 pt-4 pb-2">
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

      <section className="ledger-section">
        <span className="ledger-section-kicker"><span className="num">03</span>Transitions</span>
        {entries.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-muted)] pt-4">No transitions logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-3 pt-4 pb-2">
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
  if (key === 'indulgence_ratio' || key === 'non_mortgage_ratio') {
    return `${(v * 100).toFixed(1)}%`;
  }
  if (key === 'buffer_months') return v.toFixed(2);
  return String(v);
}
