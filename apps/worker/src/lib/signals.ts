// Deterministic signal math. Lives in the Worker. GPT never does arithmetic.
// Inputs are daily close in cents (integers). All outputs integers.

export interface PricePoint {
  date: string;
  close_cents: number;
}

export interface SignalRow {
  date: string;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null; // * 100 for integer storage
  momentum_30d: number | null; // bps
}

function sma(series: number[], window: number, i: number): number | null {
  if (i + 1 < window) return null;
  let sum = 0;
  for (let j = i - window + 1; j <= i; j++) sum += series[j]!;
  return Math.round(sum / window);
}

export function computeRSI14(series: number[]): Array<number | null> {
  const out: Array<number | null> = new Array(series.length).fill(null);
  if (series.length < 15) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= 14; i++) {
    const change = series[i]! - series[i - 1]!;
    if (change >= 0) gainSum += change;
    else lossSum += -change;
  }
  let avgGain = gainSum / 14;
  let avgLoss = lossSum / 14;

  const rsiAt = (ag: number, al: number): number => {
    if (al === 0) return 100;
    const rs = ag / al;
    return 100 - 100 / (1 + rs);
  };

  out[14] = Math.round(rsiAt(avgGain, avgLoss) * 100);

  for (let i = 15; i < series.length; i++) {
    const change = series[i]! - series[i - 1]!;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
    out[i] = Math.round(rsiAt(avgGain, avgLoss) * 100);
  }

  return out;
}

export function computeSignalsForSymbol(prices: PricePoint[]): SignalRow[] {
  const closes = prices.map((p) => p.close_cents);
  const rsi = computeRSI14(closes);

  return prices.map((p, i): SignalRow => {
    const s50 = sma(closes, 50, i);
    const s200 = sma(closes, 200, i);
    const mom =
      i >= 30 && closes[i - 30]! > 0
        ? Math.round(((closes[i]! - closes[i - 30]!) / closes[i - 30]!) * 10_000)
        : null;
    return {
      date: p.date,
      sma50: s50,
      sma200: s200,
      rsi14: rsi[i] ?? null,
      momentum_30d: mom,
    };
  });
}
