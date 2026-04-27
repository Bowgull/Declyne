// Row-type glyph vocabulary. Six markers tag every money row across the app
// by what kind of movement it is, not what category it hits.
//
//   ↻  recurring  — bills, subscriptions, rent
//   ▸  payment    — toward debt, plan installment, savings sweep
//   +  income     — paycheque, refund, deposit
//   ⇄  transfer   — between your own accounts (incl. CC payment)
//   ·  one-off    — regular spend (groceries, gas, dinner)
//   ?  unknown    — needs a category

export type RowGlyph = '↻' | '▸' | '+' | '⇄' | '·' | '?';

// Map a transaction's category group + signed amount to a glyph. Used for
// reconciliation line items, allocation rows, and any other ledger surface
// that isn't bill-aware. Bill-aware surfaces (Today queue) override with '↻'.
export function glyphForCategory(
  group: string | null | undefined,
  signedCents: number,
): RowGlyph {
  if (!group) return '?';
  if (group === 'income') return '+';
  if (group === 'transfer') return '⇄';
  if (group === 'debt') return '▸';
  // essentials / lifestyle / savings / indulgence / uncategorized-with-group
  // are all routine charges; sign decides direction but glyph stays one-off.
  if (signedCents > 0) return '+';
  return '·';
}
