import { describe, it, expect } from 'vitest';
import {
  detectSubCategory,
  isSubCategory,
  isValidForGroup,
  ALL_SUBS,
  LIFESTYLE_SUBS,
  INDULGENCE_SUBS,
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
  it('lifestyle subs only valid for lifestyle group', () => {
    for (const s of LIFESTYLE_SUBS) {
      expect(isValidForGroup(s, 'lifestyle')).toBe(true);
      expect(isValidForGroup(s, 'indulgence')).toBe(false);
    }
  });
  it('indulgence subs only valid for indulgence group', () => {
    for (const s of INDULGENCE_SUBS) {
      expect(isValidForGroup(s, 'indulgence')).toBe(true);
      expect(isValidForGroup(s, 'lifestyle')).toBe(false);
    }
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
  it('fast food chains', () => {
    expect(detectSubCategory("McDonald's #1234")).toBe('fast_food');
    expect(detectSubCategory('Tim Hortons #4823')).toBe('fast_food');
  });
  it('takeout services', () => {
    expect(detectSubCategory('Uber Eats')).toBe('takeout');
    expect(detectSubCategory('SkipTheDishes')).toBe('takeout');
  });
  it('coffee/treats', () => {
    expect(detectSubCategory('Starbucks Bay & College')).toBe('treats');
  });
  it('gaming platforms', () => {
    expect(detectSubCategory('Steam Purchase')).toBe('gaming');
    expect(detectSubCategory('PLAYSTATION NETWORK')).toBe('gaming');
  });
});

describe('detectSubCategory — lifestyle', () => {
  it('grocery is food', () => {
    expect(detectSubCategory('Loblaws #1290', 'lifestyle')).toBe('food');
    expect(detectSubCategory('No Frills', 'lifestyle')).toBe('food');
  });
  it('transit and gas', () => {
    expect(detectSubCategory('TTC PRESTO', 'lifestyle')).toBe('transit');
    expect(detectSubCategory('Shell #4821', 'lifestyle')).toBe('transit');
  });
  it('home stores', () => {
    expect(detectSubCategory('IKEA North York', 'lifestyle')).toBe('home');
    expect(detectSubCategory('Canadian Tire', 'lifestyle')).toBe('home');
  });
  it('shopping catch-all', () => {
    expect(detectSubCategory('Amazon.ca', 'lifestyle')).toBe('shopping');
    expect(detectSubCategory('Aritzia Robson', 'lifestyle')).toBe('shopping');
  });
  it('health', () => {
    expect(detectSubCategory('Shoppers Drug Mart', 'lifestyle')).toBe('health');
  });
});

describe('detectSubCategory — unknown group falls through indulgence first', () => {
  it('Netflix matches even with no group hint', () => {
    expect(detectSubCategory('Netflix')).toBe('streaming');
  });
  it('Loblaws still resolves to lifestyle food when no group hint', () => {
    expect(detectSubCategory('Loblaws')).toBe('food');
  });
  it('returns null when nothing matches', () => {
    expect(detectSubCategory('Random Acme Corp')).toBeNull();
    expect(detectSubCategory('')).toBeNull();
  });
});

describe('detectSubCategory — group constrains rule set', () => {
  it('lifestyle group ignores indulgence-only patterns', () => {
    // Netflix is a streaming brand — never a lifestyle sub-category
    expect(detectSubCategory('Netflix.com', 'lifestyle')).toBeNull();
  });
  it('indulgence group ignores lifestyle-only patterns', () => {
    // IKEA is home (lifestyle) — never an indulgence sub-category
    expect(detectSubCategory('IKEA Etobicoke', 'indulgence')).toBeNull();
  });
});
