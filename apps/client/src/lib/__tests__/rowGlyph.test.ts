import { describe, it, expect } from 'vitest';
import { glyphForCategory } from '../rowGlyph';

describe('glyphForCategory', () => {
  it('returns ? for null/undefined/empty group', () => {
    expect(glyphForCategory(null, -1000)).toBe('?');
    expect(glyphForCategory(undefined, -1000)).toBe('?');
    expect(glyphForCategory('', -1000)).toBe('?');
  });

  it('returns + for income regardless of sign', () => {
    expect(glyphForCategory('income', 425000)).toBe('+');
    expect(glyphForCategory('income', -425000)).toBe('+');
  });

  it('returns ⇄ for transfer in either direction', () => {
    expect(glyphForCategory('transfer', -50000)).toBe('⇄');
    expect(glyphForCategory('transfer', 50000)).toBe('⇄');
  });

  it('returns ▸ for debt in either direction', () => {
    expect(glyphForCategory('debt', -10000)).toBe('▸');
    expect(glyphForCategory('debt', 10000)).toBe('▸');
  });

  it('returns · for negative essentials/lifestyle/savings/indulgence', () => {
    expect(glyphForCategory('essentials', -9500)).toBe('·');
    expect(glyphForCategory('lifestyle', -3200)).toBe('·');
    expect(glyphForCategory('savings', -10000)).toBe('·');
    expect(glyphForCategory('indulgence', -2500)).toBe('·');
  });

  it('returns + for positive non-income groups (refunds)', () => {
    expect(glyphForCategory('essentials', 500)).toBe('+');
    expect(glyphForCategory('lifestyle', 2000)).toBe('+');
    expect(glyphForCategory('indulgence', 1500)).toBe('+');
  });

  it('returns · for zero-amount routine charges', () => {
    expect(glyphForCategory('essentials', 0)).toBe('·');
    expect(glyphForCategory('uncategorized', 0)).toBe('·');
  });

  it('returns · for unknown groups with negative sign', () => {
    expect(glyphForCategory('uncategorized', -1000)).toBe('·');
  });
});
