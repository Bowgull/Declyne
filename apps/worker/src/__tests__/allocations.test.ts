import { describe, it, expect } from 'vitest';
import { parseAllocInput, parseAllocPatch } from '../routes/allocations.js';

describe('parseAllocInput', () => {
  it('accepts a valid input', () => {
    const out = parseAllocInput({ category_group: 'essentials', label: 'Rogers', planned_cents: 8500 });
    expect(out).toEqual({ category_group: 'essentials', label: 'Rogers', planned_cents: 8500 });
  });

  it('rejects bad group', () => {
    expect('error' in parseAllocInput({ category_group: 'food', label: 'X', planned_cents: 1 })).toBe(true);
  });

  it('rejects empty label', () => {
    expect('error' in parseAllocInput({ category_group: 'essentials', label: '   ', planned_cents: 1 })).toBe(true);
  });

  it('rejects negative cents', () => {
    expect('error' in parseAllocInput({ category_group: 'essentials', label: 'X', planned_cents: -1 })).toBe(true);
  });

  it('rounds cents', () => {
    const out = parseAllocInput({ category_group: 'savings', label: 'Buf', planned_cents: 100.4 });
    if ('error' in out) throw new Error(out.error);
    expect(out.planned_cents).toBe(100);
  });
});

describe('parseAllocPatch', () => {
  it('returns only specified fields', () => {
    expect(parseAllocPatch({ planned_cents: 1000 })).toEqual({ planned_cents: 1000 });
  });
  it('rejects bad group on patch', () => {
    expect('error' in parseAllocPatch({ category_group: 'food' })).toBe(true);
  });
  it('rejects empty label on patch', () => {
    expect('error' in parseAllocPatch({ label: '   ' })).toBe(true);
  });
});
