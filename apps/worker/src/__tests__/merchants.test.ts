import { describe, it, expect } from 'vitest';
import { parseMerchantPatch } from '../routes/merchants.js';

describe('parseMerchantPatch', () => {
  it('ignores unknown keys and empty strings for display name', () => {
    expect(parseMerchantPatch({ display_name: '   ', foo: 1 })).toEqual({});
  });

  it('trims and caps display name', () => {
    const long = 'x'.repeat(200);
    const out = parseMerchantPatch({ display_name: `  ${long}  ` });
    expect(out.display_name?.length).toBe(120);
  });

  it('treats null, empty string, and missing category differently', () => {
    expect(parseMerchantPatch({ category_default_id: null })).toEqual({ category_default_id: null });
    expect(parseMerchantPatch({ category_default_id: '' })).toEqual({ category_default_id: null });
    expect(parseMerchantPatch({ category_default_id: 'cat_food' })).toEqual({ category_default_id: 'cat_food' });
    expect(parseMerchantPatch({})).toEqual({});
  });

  it('coerces verified to 0/1', () => {
    expect(parseMerchantPatch({ verified: true }).verified).toBe(1);
    expect(parseMerchantPatch({ verified: 1 }).verified).toBe(1);
    expect(parseMerchantPatch({ verified: false }).verified).toBe(0);
    expect(parseMerchantPatch({ verified: 'yes' }).verified).toBe(0);
  });

  it('only includes apply_to_uncategorized when strictly true', () => {
    expect(parseMerchantPatch({ apply_to_uncategorized: true }).apply_to_uncategorized).toBe(true);
    expect(parseMerchantPatch({ apply_to_uncategorized: 'true' }).apply_to_uncategorized).toBeUndefined();
    expect(parseMerchantPatch({}).apply_to_uncategorized).toBeUndefined();
  });

  it('returns empty for non-object input', () => {
    expect(parseMerchantPatch(null)).toEqual({});
    expect(parseMerchantPatch('nope')).toEqual({});
  });
});
