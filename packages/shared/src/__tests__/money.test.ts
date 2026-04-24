import { describe, it, expect } from 'vitest';
import { parseMoneyToCents, formatCents, addCents } from '../money.js';

describe('money', () => {
  it('parses strings with currency symbols', () => {
    expect(parseMoneyToCents('$1,234.56')).toBe(123456);
    expect(parseMoneyToCents('-0.99')).toBe(-99);
  });

  it('formats cents with thousands separators', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(-99)).toBe('-$0.99');
  });

  it('adds cents without floating point drift', () => {
    expect(addCents(33, 33, 33, 1)).toBe(100);
  });
});
