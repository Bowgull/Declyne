import { describe, it, expect } from 'vitest';
import { dismissAction, unresolveAction } from '../routes/review.js';

describe('dismissAction', () => {
  it('dismisses an open row', () => {
    expect(dismissAction(null)).toBe('dismiss');
  });
  it('no-ops a sealed row', () => {
    expect(dismissAction('2026-04-27T10:00:00Z')).toBe('noop');
  });
});

describe('unresolveAction', () => {
  it('unresolves a sealed row', () => {
    expect(unresolveAction('2026-04-27T10:00:00Z')).toBe('unresolve');
  });
  it('no-ops an already-open row', () => {
    expect(unresolveAction(null)).toBe('noop');
  });
});
