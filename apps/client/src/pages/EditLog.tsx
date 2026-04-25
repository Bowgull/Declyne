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

const perforation: React.CSSProperties = {
  borderTop: '1px dashed var(--color-hairline)',
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

  const list = entries.data?.entries ?? [];

  return (
    <div className="pb-6">
      <section className="receipt stub-top stub-bottom flex flex-col gap-4">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="mascot-mark" aria-hidden="true" />
            <div>
              <div className="display text-lg tracking-tight">AUDIT TAPE</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                {entries.isLoading ? 'Loading…' : `${list.length} entries`}
              </div>
            </div>
          </div>
          <Link to="/settings" className="text-[color:var(--color-text-muted)] mt-1 text-xs uppercase tracking-[0.18em]">
            Close
          </Link>
        </header>

        <div className="pt-3" style={perforation}>
          <label className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] block mb-1">
            Filter
          </label>
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
        </div>

        {list.length === 0 ? (
          <div className="pt-3 text-center text-xs text-[color:var(--color-text-muted)]" style={perforation}>
            No entries.
          </div>
        ) : (
          <div className="flex flex-col">
            {list.map((e) => (
              <div key={e.id} className="pt-3 mt-3 flex flex-col gap-1" style={perforation}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-medium truncate">
                    {e.entity_type}.{e.field}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] shrink-0">
                    {new Date(e.created_at).toLocaleString('en-CA')}
                  </div>
                </div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] truncate">
                  {e.entity_id} · {e.actor} · {e.reason}
                </div>
                <div className="text-xs num break-all">
                  <span className="text-[color:var(--color-text-muted)]">{e.old_value ?? '-'}</span>
                  {' -> '}
                  <span>{e.new_value ?? '-'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 text-center text-[11px] uppercase tracking-[0.32em] text-[color:var(--color-text-muted)]" style={perforation}>
          ** End of tape **
        </div>
      </section>
    </div>
  );
}
