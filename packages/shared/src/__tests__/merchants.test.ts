import { describe, it, expect } from 'vitest';
import { normalizeMerchant } from '../merchants.js';

describe('normalizeMerchant', () => {
  it('strips VISA DEBIT prefix', () => {
    expect(normalizeMerchant('VISA DEBIT LCBO #4421')).toBe('LCBO');
  });

  it('strips SQ * prefix and location suffix', () => {
    expect(normalizeMerchant('SQ *BLUE COFFEE TORONTO ON')).toBe('BLUE COFFEE');
  });

  it('strips trailing 4+ digit numbers', () => {
    expect(normalizeMerchant('TIM HORTONS #4421')).toBe('TIM HORTONS');
  });

  it('strips trailing province code', () => {
    expect(normalizeMerchant('LOBLAWS HAMILTON ON')).toBe('LOBLAWS');
  });

  it('collapses whitespace and uppercases', () => {
    expect(normalizeMerchant('  lcbo   store  ')).toBe('LCBO STORE');
  });

  it('handles stacked prefixes', () => {
    expect(normalizeMerchant('POS VISA DEBIT STARBUCKS')).toBe('STARBUCKS');
  });
});
