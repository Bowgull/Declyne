import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Today from './pages/Today';
import Budget from './pages/Budget';
import Debts from './pages/Debts';
import Grow from './pages/Grow';
import Settings from './pages/Settings';
import Accounts from './pages/Accounts';
import Review from './pages/Review';
import Routing from './pages/Routing';
import EditLog from './pages/EditLog';
import Merchants from './pages/Merchants';
import Credit from './pages/Credit';
import Goals from './pages/Goals';
import { api } from './lib/api';

export default function App() {
  const phase = useQuery({
    queryKey: ['phase'],
    queryFn: () => api.get<{ phase: number; name: string }>('/api/phase'),
  });

  const currentPhase = phase.data?.phase ?? 1;
  const growUnlocked = currentPhase >= 4;

  return (
    <div className="app-shell grain">
      <div className="relative z-10 mx-auto max-w-xl px-4 pt-4">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/grow" element={<Grow unlocked={growUnlocked} />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/accounts" element={<Accounts />} />
          <Route path="/review" element={<Review />} />
          <Route path="/budget/routing" element={<Routing />} />
          <Route path="/settings/edit-log" element={<EditLog />} />
          <Route path="/settings/merchants" element={<Merchants />} />
          <Route path="/settings/credit" element={<Credit />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </div>

      <nav className="tab-bar" aria-label="Primary">
        <div className="tab-bar-inner">
          <TabLink to="/today" label="Today" />
          <TabLink to="/budget" label="Budget" />
          <TabLink to="/debts" label="Debts" />
          <TabLink to="/grow" label="Grow" muted={!growUnlocked} />
        </div>
      </nav>
    </div>
  );
}

function TabLink({ to, label, muted }: { to: string; label: string; muted?: boolean }) {
  return (
    <NavLink to={to} className="tab-item" style={muted ? { opacity: 0.4 } : {}}>
      {label}
    </NavLink>
  );
}
