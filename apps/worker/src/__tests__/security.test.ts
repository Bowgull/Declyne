import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '../middleware/security.js';

describe('isAllowedOrigin', () => {
  it('accepts capacitor app origin', () => {
    expect(isAllowedOrigin('capacitor://localhost')).toBe(true);
  });

  it('accepts ionic app origin', () => {
    expect(isAllowedOrigin('ionic://localhost')).toBe(true);
  });

  it('accepts vite dev origins', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5174')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5175')).toBe(true);
  });

  it('accepts no origin (server-to-server, curl)', () => {
    expect(isAllowedOrigin(null)).toBe(true);
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('')).toBe(true);
  });

  it('rejects arbitrary external origins', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(isAllowedOrigin('https://attacker.example')).toBe(false);
  });

  it('rejects almost-matching origins (no substring match)', () => {
    expect(isAllowedOrigin('http://localhost:5174.evil.com')).toBe(false);
    expect(isAllowedOrigin('http://localhost:9999')).toBe(false);
  });

  it('rejects http variants of capacitor origin', () => {
    expect(isAllowedOrigin('http://capacitor.localhost')).toBe(false);
  });
});
