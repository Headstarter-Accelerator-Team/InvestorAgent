// Price-history statistics from ~1 year of daily closes. Pure function,
// shared by the app (lib/market.js) and the backtest (scripts/backtest.mjs).

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function priceStats(quotes) {
  const closes = quotes
    .map((q) => num(q.adjclose ?? q.close))
    .filter((v) => v !== null);
  if (closes.length < 20) return {};
  const last = closes.at(-1);
  const back = (days) =>
    closes.length > days ? last / closes[closes.length - 1 - days] - 1 : null;
  const avg = (n) =>
    closes.length >= n
      ? closes.slice(-n).reduce((a, b) => a + b, 0) / n
      : null;

  let peak = closes[0];
  let maxDrawdown = 0;
  for (const c of closes) {
    peak = Math.max(peak, c);
    maxDrawdown = Math.min(maxDrawdown, c / peak - 1);
  }
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);

  // RSI(14), Wilder smoothing.
  let gain = 0;
  let loss = 0;
  let rsi14 = null;
  if (closes.length > 15) {
    for (let i = 1; i <= 14; i++) {
      const d = closes[i] - closes[i - 1];
      gain += Math.max(d, 0) / 14;
      loss += Math.max(-d, 0) / 14;
    }
    for (let i = 15; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      gain = (gain * 13 + Math.max(d, 0)) / 14;
      loss = (loss * 13 + Math.max(-d, 0)) / 14;
    }
    rsi14 = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }

  // MACD(12, 26, 9) histogram as % of price (positive = upward momentum).
  const ema = (values, n) => {
    const k = 2 / (n + 1);
    const out = [values[0]];
    for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
    return out;
  };
  let macdHistPct = null;
  if (closes.length > 35) {
    const e12 = ema(closes, 12);
    const e26 = ema(closes, 26);
    const macd = e12.map((v, i) => v - e26[i]);
    const signal = ema(macd, 9);
    macdHistPct = (macd.at(-1) - signal.at(-1)) / last;
  }

  return {
    rsi14,
    macdHistPct,
    return1m: back(21),
    return3m: back(63),
    return6m: back(126),
    return1y: back(Math.min(252, closes.length - 1)),
    sma50: avg(50),
    sma200: avg(200),
    maxDrawdown1y: maxDrawdown,
    volatility1y: Math.sqrt(variance) * Math.sqrt(252),
  };
}
