// Deterministic, explainable stock scoring. Every factor is 0-100 (higher is
// better for the investor) and carries the inputs that produced it, so the UI
// and the LLM can show *why* a stock ranks where it does.

// Linear map of v from [bad, good] to [0, 100], clamped. Works either direction.
function scale(v, bad, good) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const t = (v - bad) / (good - bad);
  return Math.max(0, Math.min(100, t * 100));
}

function combine(parts) {
  const scores = parts.filter((s) => s !== null);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

const log10 = (v) => (v && v > 0 ? Math.log10(v) : null);

// Negative or missing multiples mean "no earnings to value" -> score low, not skipped.
const multiple = (v, good, bad) =>
  v === null ? null : v <= 0 ? 5 : scale(v, bad, good);

export const FACTORS = {
  value: {
    label: "Value",
    inputs: ["forwardPE", "trailingPE", "peg", "evToEbitda", "priceToSales"],
    score: (f) =>
      combine([
        multiple(f.forwardPE ?? f.trailingPE, 10, 40),
        f.peg === null ? null : multiple(f.peg, 0.8, 3),
        multiple(f.evToEbitda, 8, 30),
        f.priceToSales === null ? null : scale(f.priceToSales, 15, 1),
      ]),
  },
  quality: {
    label: "Quality",
    inputs: ["roe", "operatingMargin", "profitMargin", "freeCashflow", "debtToEquity", "currentRatio"],
    score: (f) =>
      combine([
        scale(f.roe, 0, 0.25),
        scale(f.operatingMargin, 0, 0.3),
        scale(f.profitMargin, 0, 0.2),
        f.freeCashflow !== null && f.revenue
          ? scale(f.freeCashflow / f.revenue, 0, 0.2)
          : null,
        // Yahoo reports debt/equity as a percentage (50 = 0.5x).
        scale(f.debtToEquity, 200, 30),
        scale(f.currentRatio, 0.8, 2),
      ]),
  },
  growth: {
    label: "Growth",
    inputs: ["revenueGrowth", "earningsGrowth", "epsGrowthNextYear"],
    score: (f) => {
      // EPS growth off a loss-making base is meaningless; use revenue only.
      const profitable = f.trailingPE !== null && f.trailingPE > 0;
      return combine([
        scale(f.revenueGrowth, 0, 0.25),
        profitable ? scale(f.earningsGrowth, -0.1, 0.3) : null,
        profitable ? scale(f.epsGrowthNextYear, 0, 0.25) : null,
      ]);
    },
  },
  momentum: {
    label: "Momentum",
    inputs: ["return6m", "return1y", "sma200", "pos52"],
    score: (f) =>
      combine([
        scale(f.return6m, -0.2, 0.3),
        scale(f.return1y, -0.25, 0.4),
        f.sma200 && f.price ? scale(f.price / f.sma200 - 1, -0.15, 0.15) : null,
        scale(f.pos52, 0.1, 0.9),
      ]),
  },
  stability: {
    label: "Stability",
    inputs: ["beta", "volatility1y", "maxDrawdown1y", "marketCap", "shortPercentFloat"],
    // Price risk (beta, volatility, drawdown) counts double.
    score: (f) => {
      const beta = scale(f.beta, 2, 0.6);
      const vol = scale(f.volatility1y, 0.6, 0.15);
      const drawdown = scale(f.maxDrawdown1y, -0.5, -0.1);
      return combine([
        beta, beta, vol, vol, drawdown, drawdown,
        scale(log10(f.marketCap), 9, 11.3),
        scale(f.shortPercentFloat, 0.15, 0.01),
      ]);
    },
  },
  income: {
    label: "Income",
    inputs: ["dividendYield", "payoutRatio"],
    score: (f) => {
      const y = f.dividendYield ?? 0;
      if (y <= 0) return 0;
      // Very high yields are often a sign the market expects a cut.
      const yieldScore = y > 0.09 ? 40 : scale(y, 0, 0.05);
      // Paying out more than earnings is a cut risk. REIT payout is measured
      // against earnings, not cash flow, so it's naturally >100%: skip it.
      const payout = f.sector === "Real Estate" ? null : f.payoutRatio;
      const sustainability =
        payout === null ? 1 : payout > 1 ? 0.5 : payout > 0.8 ? 0.8 : 1;
      return Math.round(yieldScore * sustainability);
    },
  },
  analyst: {
    label: "Analysts",
    inputs: ["analystRating", "analystUpside", "analystCount"],
    score: (f) => {
      const s = combine([
        scale(f.analystRating, 3.5, 1.5),
        scale(f.analystUpside, -0.1, 0.3),
      ]);
      if (s === null) return null;
      // Few analysts -> pull toward neutral.
      const confidence = Math.min(1, (f.analystCount ?? 0) / 8);
      return Math.round(50 + (s - 50) * confidence);
    },
  },
};

// Weights per investing style (each row sums to 100).
export const STYLE_WEIGHTS = {
  balanced: { value: 20, quality: 25, growth: 20, momentum: 10, stability: 10, income: 0, analyst: 15 },
  growth: { value: 5, quality: 15, growth: 40, momentum: 20, stability: 5, income: 0, analyst: 15 },
  value: { value: 40, quality: 25, growth: 5, momentum: 5, stability: 10, income: 5, analyst: 10 },
  dividend: { value: 15, quality: 20, growth: 5, momentum: 5, stability: 20, income: 35, analyst: 0 },
  safe: { value: 10, quality: 25, growth: 5, momentum: 0, stability: 50, income: 10, analyst: 0 },
  speculative: { value: 0, quality: 5, growth: 35, momentum: 35, stability: 0, income: 0, analyst: 25 },
};

export const STYLES = Object.keys(STYLE_WEIGHTS);

export function scoreStock(fact, style = "balanced") {
  const weights = STYLE_WEIGHTS[style] ?? STYLE_WEIGHTS.balanced;
  const factors = {};
  let total = 0;
  let weightUsed = 0;
  for (const [key, def] of Object.entries(FACTORS)) {
    const score = def.score(fact);
    factors[key] = {
      label: def.label,
      score,
      weight: weights[key],
      inputs: Object.fromEntries(def.inputs.map((k) => [k, fact[k] ?? null])),
    };
    if (score !== null && weights[key] > 0) {
      total += score * weights[key];
      weightUsed += weights[key];
    }
  }
  return {
    composite: weightUsed ? Math.round(total / weightUsed) : null,
    // Share of the style's weight backed by real data.
    coverage: Math.round(weightUsed),
    factors,
  };
}

// Hard filters applied before scoring.
export function passesFilters(fact, { style, allowFunds = false, minCap: minOverride } = {}) {
  if (!fact.price || !fact.marketCap) return false;
  if (!allowFunds && fact.quoteType !== "EQUITY") return false;
  const minCap = minOverride ?? (style === "speculative" ? 3e8 : 2e9);
  if (fact.marketCap < minCap) return false;
  if (style === "dividend" && (fact.dividendYield ?? 0) < 0.015) return false;
  return true;
}
