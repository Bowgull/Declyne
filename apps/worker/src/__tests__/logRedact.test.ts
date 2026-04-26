import { describe, expect, it } from 'vitest';
import { redactSensitive } from '../lib/logRedact.js';

describe('redactSensitive', () => {
  it('strips dollar amounts', () => {
    expect(redactSensitive('charge $1,200.50 to account')).toBe('charge [amount] to account');
    expect(redactSensitive('amount: 4729.13 CAD')).toBe('amount: [amount]');
  });

  it('strips account numbers (6+ digits)', () => {
    expect(redactSensitive('account 1234567890 failed')).toBe('account [number] failed');
  });

  it('keeps short numbers (e.g. status codes)', () => {
    expect(redactSensitive('error 500 occurred')).toBe('error 500 occurred');
    expect(redactSensitive('rate 12345')).toBe('rate 12345');
  });

  it('strips email addresses', () => {
    expect(redactSensitive('user joshua@example.com hit error')).toBe('user [email] hit error');
  });

  it('strips Bearer tokens', () => {
    expect(redactSensitive('header: Authorization: Bearer abc123_xyz')).toBe(
      'header: Authorization: Bearer [redacted]',
    );
  });

  it('handles object input via JSON.stringify', () => {
    const result = redactSensitive({ msg: 'failed for $100.00 to user@example.com' });
    expect(result).toContain('[amount]');
    expect(result).toContain('[email]');
  });

  it('handles null and undefined safely', () => {
    expect(redactSensitive(null)).toBe('');
    expect(redactSensitive(undefined)).toBe('');
  });

  it('redacts multiple in one string', () => {
    const out = redactSensitive('user@x.com sent $500 to account 9876543');
    expect(out).toBe('[email] sent [amount] to account [number]');
  });
});
