---
name: declyne-investment
description: Deterministic signal math, TFSA/FHSA limits, core-satellite strategy, GPT-4o recommendation prompt.
---

# Declyne Investment Skill

Math is deterministic and lives in the Worker. GPT-4o writes the narrative and ranks ideas within the rules. GPT never does arithmetic. GPT never returns a number that was not computed upstream.

## Strategy

Core-satellite.
- 80% core: broad Canadian-domiciled ETF (VEQT, XEQT, or equivalent).
- 20% satellite: individual equities or sector ETFs, max 5 positions, max 5% per position of total portfolio.

Account priority: **TFSA first**, then FHSA if goal is housing, then non-registered. RRSP only if marginal rate clearly justifies.

TFSA room estimate: ~$102,000 cumulative through 2026 for someone eligible since 2009. Confirm from `tfsa_room` table per year. 2026 limit is TBD at launch; persist as a settings value, do not hardcode.

## Signal Math (deterministic, Worker)

All math on daily close prices from `prices`.

**SMA-N** = mean(close[t-N+1..t])

**RSI-14** (Wilder):
1. For each day compute change = close[t] - close[t-1]
2. gain = max(change, 0), loss = max(-change, 0)
3. Initial avg_gain and avg_loss = mean of first 14
4. Subsequent avg_gain = (prior_avg_gain * 13 + gain) / 14; same for loss
5. RS = avg_gain / avg_loss; RSI = 100 - (100 / (1 + RS))

**Momentum 30d** = (close[t] - close[t-30]) / close[t-30]

**Compound growth (contributions)** FV = PMT * (((1 + r)^n - 1) / r), where r is period rate, n is periods, PMT is per-period contribution. For lump sum use FV = PV * (1 + r)^n.

**Amortization** monthly payment = P * (r (1+r)^n) / ((1+r)^n - 1), r = APR/12.

Store computed signals in `signals` daily. GPT reads from `signals`, not from `prices`.

## GPT-4o System Prompt (locked, 13 rules)

```
You are Declyne's investment coach. You write for one user, Josh.

1. You never do arithmetic. All numbers you cite must come from the input payload.
2. You never recommend a trade that violates Josh's current phase constraints.
3. Core allocation is 80% broad ETF. Do not propose reducing core below 70% unless explicitly asked.
4. Satellite positions max 5, max 5% each of total portfolio.
5. TFSA fills before non-registered unless TFSA room is zero.
6. If TFSA room is zero and a satellite idea would be tax-inefficient in non-registered, say so and defer.
7. Cite SMA-50, SMA-200, RSI-14, and 30d momentum from the payload when recommending a symbol.
8. If RSI-14 > 70, flag overbought and prefer wait. If RSI-14 < 30, flag oversold and note it is a signal, not a buy order.
9. Never recommend leveraged, inverse, or single-country frontier ETFs.
10. Never recommend options, crypto, or individual bonds.
11. Output JSON matching the schema in the payload. No prose outside the schema.
12. If data is stale (older than 2 trading days), return action: "hold" and reason: "stale_data".
13. Tone: dry, direct, short. No hype. No emojis. No em dashes.
```

## Recommendation Payload (to GPT)

```json
{
  "as_of": "2026-04-24",
  "phase": 5,
  "tfsa_room_cents": 1020000000,
  "holdings": [...],
  "signals": {
    "VEQT": {"sma50": ..., "sma200": ..., "rsi14": ..., "momentum_30d": ...}
  },
  "market": {"boc_overnight_bps": 275, "tsx_close": ..., "sp500_close": ...},
  "schema": {
    "action": "buy|sell|hold",
    "symbol": "string",
    "wrapper": "tfsa|fhsa|nonreg",
    "units": "number from payload, not computed",
    "reason": "string, under 200 chars",
    "cited_signals": ["sma50", "rsi14"]
  }
}
```

## Market Data

- Primary: Twelve Data
- Fallback: Financial Modeling Prep, then Yahoo Finance
- Rates: Bank of Canada valet API for overnight and CORRA
- Cache daily close in `prices` and `market_snapshots`. Never hit the client against an external API directly.

## TFSA Limits (persist in `tfsa_room`)

| Year | Limit |
|------|-------|
| 2009-2012 | $5,000 |
| 2013-2014 | $5,500 |
| 2015 | $10,000 |
| 2016-2018 | $5,500 |
| 2019-2022 | $6,000 |
| 2023 | $6,500 |
| 2024-2025 | $7,000 |
| 2026 | persist from settings, confirm with CRA |

Cumulative is computed, not stored. Used-to-date is tracked via contributions.
