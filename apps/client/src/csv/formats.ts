// CSV format detection. Client-side only. The Worker never sees raw CSVs.

import type { CsvFormat } from '@declyne/shared';

export interface FormatDef {
  format: CsvFormat;
  detect: (firstRow: string[], headerRow: string[] | null) => boolean;
  hasHeader: boolean;
  parseRow: (row: string[]) => { posted_at: string; amount_cents: number; description_raw: string } | null;
}

function parseCad(n: string): number {
  const cleaned = n.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return 0;
  return Math.round(Number(cleaned) * 100);
}

function parseDateISO(d: string): string {
  // Accepts MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY (TD varies by user). Default to month/day/year North American.
  const trimmed = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[\/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts as [string, string, string];
    if (c.length === 4) {
      // assume M/D/YYYY
      return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    }
  }
  return trimmed;
}

export const FORMATS: FormatDef[] = [
  // TD Chequing/Savings share format: no header, 5 cols: date, desc, withdraw, deposit, balance
  {
    format: 'td_chequing',
    hasHeader: false,
    detect: (first) => first.length === 5 && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(first[0] ?? ''),
    parseRow: (row) => {
      if (row.length < 5) return null;
      const date = parseDateISO(row[0]!);
      const desc = (row[1] ?? '').trim();
      const withdraw = parseCad(row[2] ?? '');
      const deposit = parseCad(row[3] ?? '');
      const amount_cents = deposit - withdraw;
      return { posted_at: date, amount_cents, description_raw: desc };
    },
  },
  {
    format: 'td_savings',
    hasHeader: false,
    detect: () => false, // same as chequing; assigned by user at import time
    parseRow: (row) => FORMATS[0]!.parseRow(row),
  },
  // TD Visa: no header, 5 cols: date, desc, amount, blank, blank (charges positive, payments negative)
  {
    format: 'td_visa',
    hasHeader: false,
    detect: (first) => first.length >= 3 && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(first[0] ?? '') && first.length <= 5,
    parseRow: (row) => {
      if (row.length < 3) return null;
      const date = parseDateISO(row[0]!);
      const desc = (row[1] ?? '').trim();
      const raw = parseCad(row[2] ?? '');
      // On TD Visa exports a charge is positive; normalize to negative (debt increases from Josh's perspective).
      return { posted_at: date, amount_cents: -raw, description_raw: desc };
    },
  },
  // Capital One: has header row
  {
    format: 'capital_one',
    hasHeader: true,
    detect: (_first, header) =>
      !!header &&
      header.length > 0 &&
      header.map((h) => h.toLowerCase()).some((h) => h === 'transaction date' || h === 'posted date'),
    parseRow: (row) => {
      // Capital One: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit
      if (row.length < 7) return null;
      const date = parseDateISO(row[1] || row[0]!);
      const desc = (row[3] ?? '').trim();
      const debit = parseCad(row[5] ?? '');
      const credit = parseCad(row[6] ?? '');
      const amount_cents = credit - debit;
      return { posted_at: date, amount_cents, description_raw: desc };
    },
  },
];

export function detectFormat(rows: string[][]): CsvFormat | null {
  if (rows.length === 0) return null;
  const first = rows[0]!;
  const maybeHeader = first.every((c) => /[a-zA-Z]/.test(c) && !/\d+\.\d{2}/.test(c)) ? first : null;
  const dataRow = maybeHeader ? rows[1] ?? rows[0]! : first;

  for (const f of FORMATS) {
    if (f.detect(dataRow, maybeHeader)) return f.format;
  }
  return null;
}

export function getFormatDef(format: CsvFormat): FormatDef {
  const f = FORMATS.find((x) => x.format === format);
  if (!f) throw new Error(`Unknown format: ${format}`);
  return f;
}
