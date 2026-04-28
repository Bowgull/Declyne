import type { MiddlewareHandler } from 'hono';

const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://declyne.vercel.app',
]);

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/declyne-[a-z0-9]+-bowgulls-projects\.vercel\.app$/,
];

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
}

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
  c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  c.header('Cross-Origin-Resource-Policy', 'same-site');
};
