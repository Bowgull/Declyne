import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

type Entry = {
  id: string;
  entity_type: string;
  entity_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor: string;
  reason: string;
  created_at: string;
};

export default function EditLog() {
  const [entityType, setEntityType] = useState('');

  const types = useQuery({
    queryKey: ['edit-log-types'],
    queryFn: () => api.get<{ entity_types: string[] }>('/api/edit-log/entity-types'),
  });

  const entries = useQuery({
    queryKey: ['edit-log', entityType],
    queryFn: () => {
      const qs = entityType ? `?entity_type=${encodeURIComponent(entityType)}&limit=100` : '?limit=100';
      return api.get<{ entries: Entry[] }>(`/api/edit-log${qs}`);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Edit log</h1>
        <Link to="/settings" className="text-sm text-[color:var(--color-text-muted)]">
          Back
        </Link>
      </div>

      <section className="card flex flex-col gap-2">
        <label className="field-label">Filter</label>
        <select
          className="field"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">All entities</option>
          {types.data?.entity_types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
          {entries.data ? `${entries.data.entries.length} entries` : 'Loading...'}
        </h2>
        {entries.data && entries.data.entries.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-muted)]">No entries.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {entries.data?.entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 border-b border-[color:var(--color-line)] pb-2 last:border-b-0">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {e.entity_type}.{e.field}
                </span>
                <span className="text-xs text-[color:var(--color-text-muted)]">
                  {new Date(e.created_at).toLocaleString('en-CA')}
                </span>
              </div>
              <div className="text-xs text-[color:var(--color-text-muted)]">
                {e.entity_id} · {e.actor} · {e.reason}
              </div>
              <div className="text-sm num">
                <span className="text-[color:var(--color-text-muted)]">{e.old_value ?? '-'}</span>
                {' -> '}
                <span>{e.new_value ?? '-'}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
