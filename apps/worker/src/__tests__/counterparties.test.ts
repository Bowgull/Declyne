import { describe, it, expect } from 'vitest';
import { parseCounterpartyInput } from '../routes/counterparties.js';
import { parseSplitInput } from '../routes/splits.js';

describe('parseCounterpartyInput', () => {
  it('accepts a minimal valid input', () => {
    const out = parseCounterpartyInput({ name: 'Marcus Chen' });
    expect(out).toEqual({ name: 'Marcus Chen', default_settlement_method: 'etransfer' });
  });

  it('trims whitespace from name', () => {
    const out = parseCounterpartyInput({ name: '  Priya Shah  ' });
    expect(out).toEqual({ name: 'Priya Shah', default_settlement_method: 'etransfer' });
  });

  it('accepts an explicit settlement method', () => {
    const out = parseCounterpartyInput({ name: 'Diego', default_settlement_method: 'cash' });
    expect(out).toEqual({ name: 'Diego', default_settlement_method: 'cash' });
  });

  it('falls back to etransfer for unknown settlement methods', () => {
    const out = parseCounterpartyInput({ name: 'X', default_settlement_method: 'crypto' });
    expect(out).toEqual({ name: 'X', default_settlement_method: 'etransfer' });
  });

  it('rejects empty name', () => {
    expect(parseCounterpartyInput({ name: '' })).toEqual({ error: 'name required' });
    expect(parseCounterpartyInput({ name: '   ' })).toEqual({ error: 'name required' });
  });

  it('rejects non-object body', () => {
    expect(parseCounterpartyInput(null)).toEqual({ error: 'invalid body' });
    expect(parseCounterpartyInput('marcus')).toEqual({ error: 'invalid body' });
  });

  it('rejects names over 80 chars', () => {
    const long = 'x'.repeat(81);
    expect(parseCounterpartyInput({ name: long })).toEqual({ error: 'name too long' });
  });
});

describe('parseSplitInput', () => {
  const base = {
    direction: 'they_owe' as const,
    amount_cents: 4750,
    reason: 'Lady Marmalade brunch',
  };

  it('accepts counterparty_id', () => {
    const out = parseSplitInput({ ...base, counterparty_id: 'cp_marcus' });
    expect(out).toEqual({
      counterparty_id: 'cp_marcus',
      counterparty_name: undefined,
      direction: 'they_owe',
      amount_cents: 4750,
      reason: 'Lady Marmalade brunch',
    });
  });

  it('accepts counterparty_name for inline create', () => {
    const out = parseSplitInput({ ...base, counterparty_name: 'New Person' });
    expect(out).toEqual({
      counterparty_id: undefined,
      counterparty_name: 'New Person',
      direction: 'they_owe',
      amount_cents: 4750,
      reason: 'Lady Marmalade brunch',
    });
  });

  it('rejects when neither counterparty_id nor name is provided', () => {
    expect(parseSplitInput(base)).toEqual({ error: 'counterparty_id or counterparty_name required' });
  });

  it('rejects invalid direction', () => {
    expect(
      parseSplitInput({ ...base, direction: 'invalid' as unknown as 'they_owe', counterparty_id: 'cp_x' }),
    ).toEqual({ error: 'direction invalid' });
  });

  it('rejects non-positive amounts', () => {
    expect(parseSplitInput({ ...base, counterparty_id: 'cp_x', amount_cents: 0 })).toEqual({ error: 'amount invalid' });
    expect(parseSplitInput({ ...base, counterparty_id: 'cp_x', amount_cents: -100 })).toEqual({ error: 'amount invalid' });
  });

  it('rejects empty reason', () => {
    expect(parseSplitInput({ ...base, counterparty_id: 'cp_x', reason: '' })).toEqual({ error: 'reason required' });
    expect(parseSplitInput({ ...base, counterparty_id: 'cp_x', reason: '   ' })).toEqual({ error: 'reason required' });
  });

  it('rounds fractional cents', () => {
    const out = parseSplitInput({ ...base, counterparty_id: 'cp_x', amount_cents: 47.4 });
    expect((out as { amount_cents: number }).amount_cents).toBe(47);
  });
});
