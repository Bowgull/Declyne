import { useState } from 'react';
import { detectFormat } from '../csv/formats';
import type { CsvFormat } from '@declyne/shared';
import type { WorkerIn, WorkerOut } from '../csv/parser.worker';
import { api } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function ImportCsvButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const qc = useQueryClient();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);

    try {
      const text = await file.text();
      const preview = text.split('\n').slice(0, 2).map((l) => l.split(','));
      const detected = detectFormat(preview);
      const format: CsvFormat = detected ?? (window.prompt('Format? td_chequing | td_savings | td_visa | capital_one', 'td_chequing') as CsvFormat);
      const account_id = window.prompt('Account id (e.g. acct_td_chequing)') ?? '';
      if (!account_id) {
        setBusy(false);
        return;
      }

      const worker = new Worker(new URL('../csv/parser.worker.ts', import.meta.url), { type: 'module' });
      const payload: WorkerIn = { file_text: text, format, account_id };
      const result = await new Promise<WorkerOut>((resolve) => {
        worker.onmessage = (ev) => resolve(ev.data as WorkerOut);
        worker.postMessage(payload);
      });
      worker.terminate();

      if (result.errors.length > 0) {
        setMsg(`Parse errors: ${result.errors.length}`);
      }

      const resp = await api.post<{ inserted: number; skipped_dedup: number; new_merchants: number; flagged_for_review: number }>('/api/import/transactions', {
        rows: result.rows,
        merchant_norm_version: result.merchant_norm_version,
      });
      setMsg(`Inserted ${resp.inserted}, skipped ${resp.skipped_dedup}, new merchants ${resp.new_merchants}`);
      qc.invalidateQueries();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <label className="btn-primary cursor-pointer">
      {busy ? 'Parsing…' : 'Import CSV'}
      <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      {msg && <div className="ml-2 text-xs text-[color:var(--color-text-muted)]">{msg}</div>}
    </label>
  );
}
