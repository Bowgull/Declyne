// All money is integer cents. Never float.

export type Cents = number;

export function parseMoneyToCents(input: string | number): Cents {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error('Non-finite amount');
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') {
    throw new Error(`Cannot parse money: ${input}`);
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new Error(`Non-finite parsed amount: ${input}`);
  return Math.round(n * 100);
}

export function formatCents(c: Cents, opts: { signed?: boolean } = {}): string {
  const sign = c < 0 ? '-' : opts.signed && c > 0 ? '+' : '';
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100).toLocaleString('en-CA');
  const frac = (abs % 100).toString().padStart(2, '0');
  return `${sign}$${whole}.${frac}`;
}

export function addCents(...xs: Cents[]): Cents {
  return xs.reduce((a, b) => a + b, 0);
}

export function subCents(a: Cents, b: Cents): Cents {
  return a - b;
}

export function bpsToRate(bps: number): number {
  return bps / 10_000;
}

export function rateToBps(rate: number): number {
  return Math.round(rate * 10_000);
}
