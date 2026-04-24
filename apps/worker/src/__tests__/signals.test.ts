import { describe, it, expect } from 'vitest';
import { computeRSI14, computeSignalsForSymbol } from '../lib/signals.js';

describe('signals', () => {
  it('returns nulls until index 14 for RSI', () => {
    const series = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113];
    const rsi = computeRSI14(series);
    expect(rsi.slice(0, 14).every((x) => x === null)).toBe(true);
  });

  it('RSI 100 when all moves are gains', () => {
    const series = Array.from({ length: 30 }, (_, i) => 100 + i);
    const rsi = computeRSI14(series);
    expect(rsi[14]).toBe(100 * 100);
  });

  it('computes SMA50 only after 50 datapoints', () => {
    const prices = Array.from({ length: 60 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      close_cents: 10_000 + i,
    }));
    const signals = computeSignalsForSymbol(prices);
    expect(signals[48]?.sma50).toBeNull();
    expect(signals[49]?.sma50).not.toBeNull();
  });

  it('momentum_30d is bps of return', () => {
    const prices = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      close_cents: 10_000,
    }));
    prices[35]!.close_cents = 11_000;
    const signals = computeSignalsForSymbol(prices);
    // day 35 vs day 5: (11000 - 10000) / 10000 = 0.1 = 1000 bps
    expect(signals[35]?.momentum_30d).toBe(1000);
  });
});
