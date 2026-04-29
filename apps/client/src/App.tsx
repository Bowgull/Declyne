import type * as React from 'react';
import { NavLink, Route, Routes, Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Today from './pages/Today';
import Budget from './pages/Budget';
import Debts from './pages/Debts';
import Grow from './pages/Grow';
import Settings from './pages/Settings';
import Accounts from './pages/Accounts';
import Review from './pages/Review';
import EditLog from './pages/EditLog';
import Merchants from './pages/Merchants';
import Credit from './pages/Credit';
import Goals from './pages/Goals';
import Holdings from './pages/Holdings';
import CcStatements from './pages/CcStatements';
import Onboarding from './pages/Onboarding';
import PhaseJourney from './pages/PhaseJourney';
import Reconciliation from './pages/Reconciliation';
import CounterpartyPage from './pages/Counterparty';
import TrialBalance from './pages/TrialBalance';
import Plan from './pages/Plan';
import PL from './pages/PL';
import NetWorthTrend from './pages/NetWorthTrend';
import Forecast from './pages/Forecast';
import Subscriptions from './pages/Subscriptions';
import TaxYear from './pages/TaxYear';
import ButtonsMockup from './pages/ButtonsMockup';
import PaymentLinkMockup from './pages/PaymentLinkMockup';
import DraftChitMockup from './pages/DraftChitMockup';
import PaychequeTankMockup from './pages/PaychequeTankMockup';
import TodayConstellationMockup from './pages/TodayConstellationMockup';
import BooksMockup from './pages/BooksMockup';
import GoalsMockup from './pages/GoalsMockup';
import HabitsStackMockup from './pages/HabitsStackMockup';
import PaychequeColorsMockup from './pages/PaychequeColorsMockup';
import VocabularyToast from './components/VocabularyToast';
import { api } from './lib/api';

export default function App() {
  const location = useLocation();
  const phase = useQuery({
    queryKey: ['phase'],
    queryFn: () => api.get<{ phase: number; name: string }>('/api/phase'),
  });
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ settings: Record<string, string> }>('/api/settings'),
  });

  const currentPhase = phase.data?.phase ?? 1;
  const growUnlocked = currentPhase >= 4;
  const onboardingDone = settings.data?.settings.onboarding_completed === '1';
  const needsOnboarding =
    settings.isSuccess && !onboardingDone && location.pathname !== '/onboarding';

  return (
    <div className="app-shell grain">
      <div className="relative z-10 mx-auto max-w-xl px-4 pt-4">
        <Routes>
          <Route path="/" element={<Navigate to={needsOnboarding ? '/onboarding' : '/today'} replace />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="/today"
            element={needsOnboarding ? <Navigate to="/onboarding" replace /> : <Today />}
          />
          <Route path="/books" element={<Budget />} />
          <Route path="/paycheque" element={<Navigate to="/books" replace />} />
          <Route path="/budget" element={<Navigate to="/books" replace />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/yield" element={<Grow unlocked={growUnlocked} />} />
          <Route path="/grow" element={<Navigate to="/yield" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/accounts" element={<Accounts />} />
          <Route path="/review" element={<Review />} />
          <Route path="/settings/edit-log" element={<EditLog />} />
          <Route path="/settings/merchants" element={<Merchants />} />
          <Route path="/settings/credit" element={<Credit />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/holdings" element={<Holdings />} />
          <Route path="/settings/cc-statements" element={<CcStatements />} />
          <Route path="/phase" element={<PhaseJourney />} />
          <Route path="/reconcile" element={<Reconciliation />} />
          <Route path="/settings/trial-balance" element={<TrialBalance />} />
          <Route path="/paycheque/plan" element={<Plan />} />
          <Route path="/paycheque/pl" element={<PL />} />
          <Route path="/budget/pl" element={<Navigate to="/paycheque/pl" replace />} />
          <Route path="/paycheque/net-worth" element={<NetWorthTrend />} />
          <Route path="/paycheque/forecast" element={<Forecast />} />
          <Route path="/paycheque/subscriptions" element={<Subscriptions />} />
          <Route path="/settings/tax" element={<TaxYear />} />
          <Route path="/budget/forecast" element={<Navigate to="/paycheque/forecast" replace />} />
          <Route path="/budget/net-worth" element={<Navigate to="/paycheque/net-worth" replace />} />
          <Route path="/budget/plan" element={<Navigate to="/paycheque/plan" replace />} />
          <Route path="/paycheque/tabs/:id" element={<CounterpartyPage />} />
          <Route path="/budget/tabs/:id" element={<RedirectTabs />} />
          <Route path="/mockup/buttons" element={<ButtonsMockup />} />
          <Route path="/mockup/payment-link" element={<PaymentLinkMockup />} />
          <Route path="/mockup/draft-chit" element={<DraftChitMockup />} />
          <Route path="/mockup/paycheque-tank" element={<PaychequeTankMockup />} />
          <Route path="/mockup/today-constellation" element={<TodayConstellationMockup />} />
          <Route path="/mockup/books" element={<BooksMockup />} />
          <Route path="/mockup/goals" element={<GoalsMockup />} />
          <Route path="/mockup/habits-stack" element={<HabitsStackMockup />} />
          <Route path="/mockup/paycheque-colors" element={<PaychequeColorsMockup />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </div>

      <VocabularyToast />
      <nav className="tab-bar" aria-label="Primary">
        <div className="tab-bar-inner">
          <TabLink to="/today" label="Today" icon={<TodayIcon />} />
          <TabLink to="/books" label="Books" icon={<BooksIcon />} />
          <TabLink to="/yield" label="Yield" icon={<YieldIcon />} muted={!growUnlocked} />
        </div>
      </nav>
    </div>
  );
}

function TabLink({
  to,
  label,
  icon,
  muted,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <NavLink to={to} className="tab-item" style={muted ? { opacity: 0.4 } : {}}>
      <span className="tab-icon" aria-hidden="true">{icon}</span>
      {label}
    </NavLink>
  );
}

const STROKE: React.SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function TodayIcon() {
  return (
    <svg {...STROKE}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <circle cx="12" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BooksIcon() {
  // Open ledger book: spine center, two facing pages with hairlines.
  return (
    <svg {...STROKE}>
      <path d="M12 6v14" />
      <path d="M3.5 6h6c1.4 0 2.5 1 2.5 2.4V20H5.5C4.4 20 3.5 19.1 3.5 18z" />
      <path d="M20.5 6h-6c-1.4 0-2.5 1-2.5 2.4V20h6.5c1.1 0 2-.9 2-2z" />
      <path d="M6 10h3.6" />
      <path d="M6 13h3.6" />
      <path d="M14.4 10H18" />
      <path d="M14.4 13H18" />
    </svg>
  );
}

function RedirectTabs() {
  const { id } = useParams();
  return <Navigate to={`/paycheque/tabs/${id}`} replace />;
}

function YieldIcon() {
  // Wheat stalk: central stem + paired grain bracts climbing the spike.
  return (
    <svg {...STROKE}>
      <path d="M12 21V6" />
      <path d="M12 9c-2-1-3.5-1-4.5-2.5C8.5 5 10 5 12 6.5" />
      <path d="M12 9c2-1 3.5-1 4.5-2.5C15.5 5 14 5 12 6.5" />
      <path d="M12 13c-2-1-3.5-1-4.5-2.5C8.5 9 10 9 12 10.5" />
      <path d="M12 13c2-1 3.5-1 4.5-2.5C15.5 9 14 9 12 10.5" />
      <path d="M12 17c-2-1-3.5-1-4.5-2.5C8.5 13 10 13 12 14.5" />
      <path d="M12 17c2-1 3.5-1 4.5-2.5C15.5 13 14 13 12 14.5" />
    </svg>
  );
}
