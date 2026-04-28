import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCents } from '@declyne/shared';
import LedgerHeader from '../components/LedgerHeader';

interface TaxYearResp {
  year: string;
  income_ytd_cents: number;
  contributions: Record<string, number>;
  annual_limits: Record<string, number | null>;
  note: string;
}

const WRAPPER_LABELS: Record<string, string> = {
  tfsa: 'TFSA',
  fhsa: 'FHSA',
  rrsp: 'RRSP',
  nonreg: 'Non-reg',
};

const WRAPPER_HINTS: Record<string, string> = {
  tfsa: 'Tax-free savings account',
  fhsa: 'First home savings account',
  rrsp: 'Retirement savings plan',
  nonreg: 'Non-registered',
};

const CURRENT_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function TaxYear() {
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const q = useQuery({
    queryKey: ['tax-year', year],
    queryFn: () => api.get<TaxYearResp>(`/api/settings/tax-year?year=${year}`),
  });

  const data = q.data;

  return (
    <div className="ledger-page pb-20">
      <LedgerHeader
        kicker="Settings"
        title={`Tax Year ${year}`}
        subtitle={data?.note}
        action={
          <Link to="/settings" className="stamp stamp-square text-[10px]">
            Back
          </Link>
        }
      />

      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>01</span> Year
        </span>
        <div className="flex gap-2 pt-3 flex-wrap">
          {AVAILABLE_YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setYear(String(y))}
              className={`stamp stamp-square text-[10px] ${year === String(y) ? 'stamp-gold' : ''}`}
            >
              {y}
            </button>
          ))}
        </div>
      </section>

      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>02</span> Income
        </span>
        <div className="ledger-row">
          <div className="ledger-row-main">
            <span className="ledger-row-label">Salary YTD</span>
            <span className="ledger-row-hint">GL · Income:Salary · Jan 1 – today</span>
          </div>
          <span className="ledger-row-value num" style={{ color: 'var(--color-accent-purple)' }}>
            {data ? `+${formatCents(data.income_ytd_cents)}` : '—'}
          </span>
        </div>
      </section>

      <section className="ledger-section pt-4">
        <span className="ledger-section-kicker">
          <span className="num" style={{ color: 'var(--color-accent-gold)' }}>03</span> Registered accounts
        </span>
        {['tfsa', 'fhsa', 'rrsp'].map((wrapper) => {
          const invested = data?.contributions[wrapper] ?? 0;
          const limit = data?.annual_limits[wrapper] ?? null;
          const remaining = limit !== null ? limit - invested : null;
          return (
            <div key={wrapper} className="ledger-row">
              <div className="ledger-row-main">
                <span className="ledger-row-label">{WRAPPER_LABELS[wrapper]}</span>
                <span className="ledger-row-hint">
                  {WRAPPER_HINTS[wrapper]}
                  {limit !== null
                    ? ` · ${formatCents(limit)} limit · ${remaining !== null && remaining >= 0 ? formatCents(remaining) + ' room' : 'over limit'}`
                    : wrapper === 'rrsp'
                    ? ' · room requires prior-year T4'
                    : ''}
                </span>
              </div>
              <span
                className="ledger-row-value num text-sm"
                style={{ color: invested > 0 ? 'var(--cat-savings)' : 'var(--color-text-muted)' }}
              >
                {invested > 0 ? formatCents(invested) : '—'}
              </span>
            </div>
          );
        })}
      </section>

      {(data?.contributions.nonreg ?? 0) > 0 && (
        <section className="ledger-section pt-4">
          <span className="ledger-section-kicker">
            <span className="num" style={{ color: 'var(--color-accent-gold)' }}>04</span> Non-registered
          </span>
          <div className="ledger-row">
            <div className="ledger-row-main">
              <span className="ledger-row-label">Non-reg</span>
              <span className="ledger-row-hint">No contribution limit</span>
            </div>
            <span className="ledger-row-value num text-sm">
              {formatCents(data!.contributions['nonreg'] ?? 0)}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
