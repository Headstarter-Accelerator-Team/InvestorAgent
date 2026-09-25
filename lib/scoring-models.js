// Scoring models the app can use. "backtested" (default) is the model that
// held up in the point-in-time backtest (scripts/backtest-*.mjs):
// profitability (ROE) + free-cash-flow yield, as percentiles vs companies
// >= $10B. "classic" is the original style-weighted multi-factor score
// (lib/score.js), which showed no edge in the backtest.
import model from "@/data/backtest-model.json";
import { scoreStock } from "@/lib/score";

export const SCORING_MODELS = ["backtested", "classic"];
export const DEFAULT_MODEL = "backtested";
export const BACKTESTED = model;

// Maps a value onto the 0-100 percentile scale using the 5% cut-points.
function percentile(v, cuts) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (v <= cuts[0]) return 0;
  if (v >= cuts[20]) return 100;
  let i = 0;
  while (i < 19 && v >= cuts[i + 1]) i++;
  const span = cuts[i + 1] - cuts[i];
  return Math.round(5 * i + (span > 0 ? (5 * (v - cuts[i])) / span : 0));
}

// Annual statement figures match the backtest's definitions; Yahoo's
// quick fields are the fallback.
export function roeOf(f) {
  // Like the backtest, ROE is undefined when equity is zero or negative
  // (e.g. heavy buybacks); only fall back to Yahoo when annual data is missing.
  if (f.annualEquity != null) {
    return f.annualEquity > 0 && f.annualNetIncome != null ? f.annualNetIncome / f.annualEquity : null;
  }
  return f.roe ?? null;
}

export function fcfYieldOf(f) {
  if (!f.marketCap) return null;
  if (f.annualFreeCashFlow != null) return f.annualFreeCashFlow / f.marketCap;
  return f.freeCashflow != null ? f.freeCashflow / f.marketCap : null;
}

function scoreBacktested(fact) {
  const roe = roeOf(fact);
  const fcfYield = fcfYieldOf(fact);
  const factors = {
    roe: {
      label: "Profitability (ROE)",
      score: percentile(roe, model.cutpoints.roe),
      weight: model.weights.roe,
      inputs: { roe },
    },
    fcfYield: {
      label: "Cash-flow yield",
      score: percentile(fcfYield, model.cutpoints.fcfYield),
      weight: model.weights.fcfYield,
      inputs: { fcfYield },
    },
  };
  let total = 0;
  let used = 0;
  for (const f of Object.values(factors)) {
    if (f.score === null) continue;
    total += f.score * f.weight;
    used += f.weight;
  }
  return {
    model: "backtested",
    composite: used ? Math.round(total / used) : null,
    coverage: used,
    factors,
    // The model was only validated on companies of at least this size.
    inTestedRange: (fact.marketCap ?? 0) >= model.minMarketCap,
  };
}

export function scoreWithModel(fact, style, modelName = DEFAULT_MODEL) {
  if (modelName === "classic") return { model: "classic", ...scoreStock(fact, style) };
  return scoreBacktested(fact);
}

// The backtested model ranks on ROE + cash-flow yield only, with no notion of
// risk or style. These filters keep results consistent with what the user
// asked for; they narrow the list but are not part of the backtest.
export function styleFitsBacktested(fact, style) {
  switch (style) {
    case "safe":
      return (fact.volatility1y ?? 0) <= 0.3 && (fact.beta ?? 1) <= 1.1;
    case "value": {
      const pe = fact.forwardPE ?? fact.trailingPE;
      return pe !== null && pe !== undefined && pe > 0 && pe <= 20;
    }
    case "growth":
      return (fact.revenueGrowth ?? 0) >= 0.05;
    default:
      return true;
  }
}

// Score-implied stance, used when the AI analyst doesn't give one. For the
// backtested model only the top of the ranking had an edge, so "Buy" needs
// a high score and the middle is "Hold".
export function stanceFromScore(score) {
  const c = score?.composite;
  if (c === null || c === undefined) return null;
  if (score.model === "backtested") return c >= 85 ? "Buy" : c >= 20 ? "Hold" : "Avoid";
  return c >= 70 ? "Buy" : c >= 50 ? "Hold" : "Avoid";
}

// Guidance for the AI analyst about what the score means.
export function modelGuide(modelName) {
  if (modelName === "classic") {
    return "SCORING MODEL: classic multi-factor style score. It showed no predictive edge in backtests; treat it as a descriptive summary. Stance guide: 70+ Buy, 50-69 Hold, below 50 Avoid.";
  }
  return (
    "SCORING MODEL: backtested (ROE 60% + free-cash-flow yield 40%, percentile vs companies >= $10B). " +
    model.evidence +
    " Stance guide: composite 85+ supports Buy; 20-84 Hold (the backtest found no reliable ordering below the top); below 20 Avoid (weak profitability or cash flow). " +
    "Companies under $10B are outside the tested range: say so. Other data (valuation, growth, news, risk) should inform conviction and risks, not override the model without a clear reason."
  );
}
