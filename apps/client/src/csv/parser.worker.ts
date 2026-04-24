/// <reference lib="webworker" />
import Papa from 'papaparse';
import { dedupHash, normalizeMerchant, MERCHANT_NORM_VERSION, type CsvFormat } from '@declyne/shared';
import { getFormatDef } from './formats';

export interface WorkerIn {
  file_text: string;
  format: CsvFormat;
  account_id: string;
}

export interface WorkerOut {
  rows: Array<{
    posted_at: string;
    amount_cents: number;
    description_raw: string;
    account_id: string;
    dedup_hash: string;
    merchant_normalized_key: string;
  }>;
  merchant_norm_version: number;
  errors: string[];
}

self.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const { file_text, format, account_id } = ev.data;
  const def = getFormatDef(format);
  const parsed = Papa.parse<string[]>(file_text, { skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    const reply: WorkerOut = { rows: [], merchant_norm_version: MERCHANT_NORM_VERSION, errors: parsed.errors.map((e) => e.message) };
    postMessage(reply);
    return;
  }

  const dataRows = def.hasHeader ? parsed.data.slice(1) : parsed.data;
  const out: WorkerOut['rows'] = [];
  const errors: string[] = [];

  for (const r of dataRows) {
    try {
      const parsedRow = def.parseRow(r);
      if (!parsedRow) continue;
      const key = normalizeMerchant(parsedRow.description_raw);
      const hash = await dedupHash(parsedRow.posted_at, parsedRow.description_raw, parsedRow.amount_cents, account_id);
      out.push({
        posted_at: parsedRow.posted_at,
        amount_cents: parsedRow.amount_cents,
        description_raw: parsedRow.description_raw,
        account_id,
        dedup_hash: hash,
        merchant_normalized_key: key,
      });
    } catch (e) {
      errors.push((e as Error).message);
    }
  }

  const reply: WorkerOut = { rows: out, merchant_norm_version: MERCHANT_NORM_VERSION, errors };
  postMessage(reply);
};
