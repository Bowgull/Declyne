import { describe, it, expect } from 'vitest';
import {
  detectSubCategory,
  isSubCategory,
  isValidForGroup,
  ALL_SUBS,
  ESSENTIALS_SUBS,
  LIFESTYLE_SUBS,
  INDULGENCE_SUBS,
  SUB_CADENCE,
} from '../lib/subCategoryDetect.js';

describe('isSubCategory', () => {
  it('accepts every locked sub-category', () => {
    for (const s of ALL_SUBS) expect(isSubCategory(s)).toBe(true);
  });
  it('rejects unknowns and non-strings', () => {
    expect(isSubCategory('coffee')).toBe(false);
    expect(isSubCategory('')).toBe(false);
    expect(isSubCategory(null)).toBe(false);
    expect(isSubCategory(42)).toBe(false);
    expect(isSubCategory({})).toBe(false);
  });
});

describe('isValidForGroup', () => {
  it('essentials subs only valid for essentials group', () => {
    for (const s of ESSENTIALS_SUBS) {
      expect(isValidForGroup(s, 'essentials')).toBe(true);
      expect(isValidForGroup(s, 'lifestyle')).toBe(false);
      expect(isValidForGroup(s, 'indulgence')).toBe(false);
    }
  });
  it('lifestyle subs only valid for lifestyle group', () => {
    for (const s of LIFESTYLE_SUBS) {
      expect(isValidForGroup(s, 'lifestyle')).toBe(true);
      expect(isValidForGroup(s, 'essentials')).toBe(false);
      expect(isValidForGroup(s, 'indulgence')).toBe(false);
    }
  });
  it('indulgence subs only valid for indulgence group', () => {
    for (const s of INDULGENCE_SUBS) {
      expect(isValidForGroup(s, 'indulgence')).toBe(true);
      expect(isValidForGroup(s, 'essentials')).toBe(false);
      expect(isValidForGroup(s, 'lifestyle')).toBe(false);
    }
  });
});

describe('SUB_CADENCE', () => {
  it('every sub-category has a cadence', () => {
    for (const s of ALL_SUBS) expect(SUB_CADENCE[s]).toBeDefined();
  });
  it('essentials subs are variable cadence', () => {
    for (const s of ESSENTIALS_SUBS) expect(SUB_CADENCE[s]).toBe('variable');
  });
  it('lifestyle subs are discretionary cadence', () => {
    for (const s of LIFESTYLE_SUBS) expect(SUB_CADENCE[s]).toBe('discretionary');
  });
  it('indulgence subs are discretionary cadence', () => {
    for (const s of INDULGENCE_SUBS) expect(SUB_CADENCE[s]).toBe('discretionary');
  });
});

describe('detectSubCategory — indulgence', () => {
  it('streaming brands', () => {
    expect(detectSubCategory('NETFLIX.COM')).toBe('streaming');
    expect(detectSubCategory('Spotify Premium', 'indulgence')).toBe('streaming');
    expect(detectSubCategory('Disney+ subscription')).toBe('streaming');
  });
  it('weed shops', () => {
    expect(detectSubCategory('Tokyo Smoke Queen St')).toBe('weed');
    expect(detectSubCategory('OCS.CA online')).toBe('weed');
  });
  it('bars and LCBO', () => {
    expect(detectSubCategory('LCBO #482')).toBe('bars');
    expect(detectSubCategory('Bar Raval')).toBe('bars');
  });
  it('quick-serve restaurants land in takeout', () => {
    expect(detectSubCategory("McDonald's #1234")).toBe('takeout');
    expect(detectSubCategory('Tim Hortons #4823')).toBe('takeout');
  });
  it('delivery apps land in delivery', () => {
    expect(detectSubCategory('Uber Eats')).toBe('delivery');
    expect(detectSubCategory('SkipTheDishes')).toBe('delivery');
  });
  it('coffee/treats', () => {
    expect(detectSubCategory('Starbucks Bay & College')).toBe('treats');
  });
  it('gaming platforms', () => {
    expect(detectSubCategory('Steam Purchase')).toBe('gaming');
    expect(detectSubCategory('PLAYSTATION NETWORK')).toBe('gaming');
  });
});

describe('detectSubCategory — essentials', () => {
  it('grocery stores are groceries', () => {
    expect(detectSubCategory('Loblaws #1290', 'essentials')).toBe('groceries');
    expect(detectSubCategory('No Frills', 'essentials')).toBe('groceries');
    expect(detectSubCategory('Costco Wholesale', 'essentials')).toBe('groceries');
  });
  it('transit and gas land in transit', () => {
    expect(detectSubCategory('TTC PRESTO', 'essentials')).toBe('transit');
    expect(detectSubCategory('Shell #4821', 'essentials')).toBe('transit');
    expect(detectSubCategory('Esso Bay & College', 'essentials')).toBe('transit');
  });
  it('pharmacy and dental are health', () => {
    expect(detectSubCategory('Shoppers Drug Mart', 'essentials')).toBe('health');
    expect(detectSubCategory('Bayview Dental', 'essentials')).toBe('health');
  });
});

describe('detectSubCategory — lifestyle', () => {
  it('home stores', () => {
    expect(detectSubCategory('IKEA North York', 'lifestyle')).toBe('home');
    expect(detectSubCategory('Canadian Tire', 'lifestyle')).toBe('home');
  });
  it('shopping catch-all', () => {
    expect(detectSubCategory('Amazon.ca', 'lifestyle')).toBe('shopping');
    expect(detectSubCategory('Aritzia Robson', 'lifestyle')).toBe('shopping');
  });
  it('lifestyle no longer matches groceries (groceries moved to essentials)', () => {
    expect(detectSubCategory('Loblaws #1290', 'lifestyle')).toBeNull();
  });
});

describe('detectSubCategory — unknown group falls through indulgence then essentials then lifestyle', () => {
  it('Netflix (indulgence) wins over any other rule set', () => {
    expect(detectSubCategory('Netflix')).toBe('streaming');
  });
  it('Loblaws resolves to essentials groceries when no group hint', () => {
    expect(detectSubCategory('Loblaws')).toBe('groceries');
  });
  it('Amazon resolves to lifestyle shopping when no group hint', () => {
    expect(detectSubCategory('Amazon.ca')).toBe('shopping');
  });
  it('returns null when nothing matches', () => {
    expect(detectSubCategory('Random Acme Corp')).toBeNull();
    expect(detectSubCategory('')).toBeNull();
  });
});

describe('detectSubCategory — group constrains rule set', () => {
  it('essentials group ignores indulgence-only patterns', () => {
    expect(detectSubCategory('Netflix.com', 'essentials')).toBeNull();
  });
  it('lifestyle group ignores indulgence-only patterns', () => {
    expect(detectSubCategory('Netflix.com', 'lifestyle')).toBeNull();
  });
  it('indulgence group ignores essentials-only patterns', () => {
    expect(detectSubCategory('Loblaws Queen', 'indulgence')).toBeNull();
  });
  it('lifestyle group ignores essentials-only patterns', () => {
    expect(detectSubCategory('Shoppers Drug Mart', 'lifestyle')).toBeNull();
  });
});
