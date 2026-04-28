import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { detectFormat } from '../csv/formats';
import type { CsvFormat } from '@declyne/shared';
import type { WorkerIn, WorkerOut } from '../csv/parser.worker';
import { api } from '../lib/api';
import type { Account } from '../pages/Accounts';
import { showVocabularyToast } from '../lib/vocabularyToast';

const FORMATS: CsvFormat[] = ['td_chequing', 'td_savings', 'td_visa', 'capital_one'];

export default function ImportCsvButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<{ text: string; detected: CsvFormat | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const accounts = useQuery({
    queryKey: ['accounts', false],
    queryFn: () => api.get<{ accounts: Account[] }>('/api/accounts'),
  });
  const active = (accounts.data?.accounts ?? []).filter((a) => a.archived === 0);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg(null);
    file.text().then((text) => {
      const preview = text.split('\n').slice(0, 2).map((l) => l.split(','));
      setPending({ text, detected: detectFormat(preview) });
    });
  }

  async function runImport(accountId: string, format: CsvFormat) {
    if (!pending) return;
    setBusy(true);
    setMsg(null);
    try {
      const worker = new Worker(new URL('../csv/parser.worker.ts', import.meta.url), { type: 'module' });
      const payload: WorkerIn = { file_text: pending.text, format, account_id: accountId };
      const result = await new Promise<WorkerOut>((resolve) => {
        worker.onmessage = (ev) => resolve(ev.data as WorkerOut);
        worker.postMessage(payload);
      });
      worker.terminate();

      const resp = await api.post<{
        inserted: number;
        skipped_dedup: number;
        new_merchants: number;
        flagged_for_review: number;
        vocabulary_unlock?: { level: number; message: string };
      }>('/api/import/transactions', {
        rows: result.rows,
        merchant_norm_version: result.merchant_norm_version,
      });
      if (resp.vocabulary_unlock) showVocabularyToast(resp.vocabulary_unlock.message);
      const parts = [
        `${resp.inserted} inserted`,
        `${resp.skipped_dedup} dupes`,
        `${resp.new_merchants} new merchants`,
      ];
      if (result.errors.length) parts.push(`${result.errors.length} parse errors`);
      setMsg(parts.join(' · '));
      qc.invalidateQueries();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  return (
    <>
      <label className="stamp stamp-square cursor-pointer inline-flex items-center justify-center">
        {busy ? 'Parsing…' : 'Import CSV'}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFile}
          disabled={busy}
        />
      </label>
      {msg && <div className="mt-2 text-xs text-[color:var(--color-text-muted)]">{msg}</div>}

      {pending && (
        <ImportPickerSheet
          accounts={active}
          detected={pending.detected}
          onCancel={() => setPending(null)}
          onConfirm={runImport}
        />
      )}
    </>
  );
}

function ImportPickerSheet({
  accounts,
  detected,
  onCancel,
  onConfirm,
}: {
  accounts: Account[];
  detected: CsvFormat | null;
  onCancel: () => void;
  onConfirm: (accountId: string, format: CsvFormat) => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [format, setFormat] = useState<CsvFormat>(detected ?? 'td_chequing');

  const empty = accounts.length === 0;

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Pick account for import"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xl rounded-t-[16px] border border-[color:var(--color-hairline)] bg-[color:var(--color-bg-card)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import CSV</h2>
          <button className="text-[color:var(--color-text-muted)]" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>

        {empty ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[color:var(--color-text-muted)]">
              No accounts yet. Add one before importing.
            </p>
            <Link to="/settings/accounts" className="stamp stamp-square text-center" onClick={onCancel}>
              Add account
            </Link>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (accountId) onConfirm(accountId, format);
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="field-label">Account</span>
              <select
                className="field"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.institution} — {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="field-label">
                Format {detected ? '(auto-detected)' : '(manual)'}
              </span>
              <select
                className="field"
                value={format}
                onChange={(e) => setFormat(e.target.value as CsvFormat)}
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-outline flex-1" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="stamp stamp-square flex-1">
                Import
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
