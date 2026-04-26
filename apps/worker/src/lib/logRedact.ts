const DOLLAR_PREFIX_PATTERN = /\$\d{1,3}(?:,\d{3})*(?:\.\d+)?/g;
const DOLLAR_UNIT_PATTERN = /\b\d+(?:\.\d+)?\s+(?:cents|CAD|USD)\b/gi;
const ACCOUNT_NUMBER_PATTERN = /\b\d{6,}\b/g;
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;
const AUTH_HEADER_PATTERN = /Bearer\s+[\w.-]+/gi;

export function redactSensitive(input: unknown): string {
  if (input == null) return '';
  const raw = typeof input === 'string' ? input : safeStringify(input);
  return raw
    .replace(AUTH_HEADER_PATTERN, 'Bearer [redacted]')
    .replace(EMAIL_PATTERN, '[email]')
    .replace(DOLLAR_PREFIX_PATTERN, '[amount]')
    .replace(DOLLAR_UNIT_PATTERN, '[amount]')
    .replace(ACCOUNT_NUMBER_PATTERN, '[number]');
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
