// Deterministic merchant normalization pipeline, versioned.
// See MERCHANT_NORM_VERSION in constants.ts.

const PREFIXES = [
  'POS ',
  'VISA DEBIT ',
  'VISA PURCHASE ',
  'INTERAC ',
  'INTERAC PURCHASE ',
  'SQ *',
  'TST* ',
  'PAYPAL *',
  'PAYPAL*',
  'PP*',
];

const PROVINCES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU',
  'ON', 'PE', 'QC', 'SK', 'YT',
]);

const CITIES = new Set([
  'TORONTO', 'MISSISSAUGA', 'BRAMPTON', 'HAMILTON', 'OTTAWA',
  'MONTREAL', 'VANCOUVER', 'CALGARY', 'EDMONTON', 'WINNIPEG',
  'HALIFAX', 'QUEBEC', 'VICTORIA', 'LONDON', 'KITCHENER',
  'MARKHAM', 'VAUGHAN', 'GATINEAU', 'WATERLOO', 'BURLINGTON',
  'OAKVILLE', 'RICHMOND HILL', 'SCARBOROUGH', 'ETOBICOKE',
  'NORTH YORK', 'DOWNSVIEW',
]);

export function normalizeMerchant(raw: string): string {
  // Step 1: uppercase, strip punctuation, collapse whitespace
  let s = raw
    .toUpperCase()
    .replace(/[^A-Z0-9 *]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Step 2: strip known prefixes (iterate, in case of stacked)
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of PREFIXES) {
      if (s.startsWith(p)) {
        s = s.slice(p.length).trim();
        changed = true;
      }
    }
  }

  // Step 3: strip trailing location suffixes
  const tokens = s.split(' ');
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]!;
    if (/^\d{4,}$/.test(last)) {
      tokens.pop();
      continue;
    }
    if (last.length === 2 && PROVINCES.has(last)) {
      tokens.pop();
      continue;
    }
    if (CITIES.has(last)) {
      tokens.pop();
      continue;
    }
    break;
  }

  // Also try two-word city suffix
  if (tokens.length > 2) {
    const two = `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`;
    if (CITIES.has(two)) {
      tokens.pop();
      tokens.pop();
    }
  }

  return tokens.join(' ').trim();
}
