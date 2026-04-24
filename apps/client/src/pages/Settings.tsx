import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { scheduleAllNotifications } from '../native/notifications';

export default function Settings() {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ settings: Record<string, string> }>('/api/settings'),
  });

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link to="/today" className="btn-outline">Done</Link>
      </header>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">System</h2>
        <Row k="Current phase" v={settings.data?.settings.current_phase ?? '—'} />
        <Row k="Merchant norm version" v={settings.data?.settings.merchant_norm_version ?? '—'} />
        <Row k="Reconciliation streak" v={settings.data?.settings.reconciliation_streak ?? '0'} />
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">Notifications</h2>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Sunday 9am reconciliation. Tuesday 9am follow-up. Day 6 at 10am redeploy reminder before the free provisioning profile expires.
        </p>
        <button className="btn-outline" onClick={() => scheduleAllNotifications()}>
          Re-schedule notifications
        </button>
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
