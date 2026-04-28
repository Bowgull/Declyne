import { describe, it, expect } from 'vitest';
import { shouldUnlock, vocabMessage } from '../lib/vocabularyMilestone.js';

describe('shouldUnlock', () => {
  it('returns true when current level is below milestone', () => expect(shouldUnlock(0, 1)).toBe(true));
  it('returns false when current level equals milestone', () => expect(shouldUnlock(1, 1)).toBe(false));
  it('returns false when current level exceeds milestone', () => expect(shouldUnlock(2, 1)).toBe(false));
  it('returns true when skipping multiple levels', () => expect(shouldUnlock(0, 4)).toBe(true));
  it('returns true at one below max', () => expect(shouldUnlock(3, 4)).toBe(true));
});

describe('vocabMessage', () => {
  it('returns a non-empty string for each valid level', () => {
    for (const l of [1, 2, 3, 4]) {
      expect(vocabMessage(l).length).toBeGreaterThan(0);
    }
  });
  it('returns empty string for level 0', () => expect(vocabMessage(0)).toBe(''));
  it('returns empty string for unknown level', () => expect(vocabMessage(99)).toBe(''));
});
