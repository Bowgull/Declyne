import { describe, it, expect } from 'vitest';
import { stripRoleSuffix } from '../routes/today.js';

describe('stripRoleSuffix', () => {
  it('strips trailing priority', () => {
    expect(stripRoleSuffix('Capital One priority')).toBe('Capital One');
  });

  it('strips trailing avalanche', () => {
    expect(stripRoleSuffix('TD Visa avalanche')).toBe('TD Visa');
  });

  it('strips trailing min', () => {
    expect(stripRoleSuffix('Bowgull (Mexico) min')).toBe('Bowgull (Mexico)');
  });

  it('leaves names without role unchanged', () => {
    expect(stripRoleSuffix('Capital One')).toBe('Capital One');
  });

  it('does not strip role names embedded in the middle', () => {
    expect(stripRoleSuffix('Avalanche Credit Co')).toBe('Avalanche Credit Co');
  });

  it('strips case-insensitively', () => {
    expect(stripRoleSuffix('Visa MIN')).toBe('Visa');
  });
});
