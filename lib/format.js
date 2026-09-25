// Number formatting shared by the server (LLM fact table) and the UI.
const missing = (v) => v === null || v === undefined || !Number.isFinite(v);

export const fmt = {
  pct: (v, digits = 1) =>
    missing(v) ? "n/a" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`,
  pctPlain: (v, digits = 1) => (missing(v) ? "n/a" : `${(v * 100).toFixed(digits)}%`),
  x: (v, digits = 1) => (missing(v) ? "n/a" : v.toFixed(digits)),
  money: (v) => (missing(v) ? "n/a" : `$${v.toFixed(2)}`),
  big: (v) => {
    if (missing(v)) return "n/a";
    const abs = Math.abs(v);
    if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    return `$${(v / 1e6).toFixed(0)}M`;
  },
};

export const STYLE_OPTIONS = [
  { value: "balanced", label: "Balanced" },
  { value: "growth", label: "Growth" },
  { value: "value", label: "Value" },
  { value: "dividend", label: "Dividend income" },
  { value: "safe", label: "Safe / low risk" },
  { value: "speculative", label: "Speculative" },
];

export const SECTOR_OPTIONS = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Basic Materials",
  "Communication Services",
];

export const MODEL_OPTIONS = [
  {
    value: "backtested",
    label: "Backtested",
    description:
      "Profitability (ROE) + cash-flow yield vs $10B+ companies. In a 2016-2026 backtest its top picks beat the average large company in 9 of 11 years, by a small margin.",
  },
  {
    value: "classic",
    label: "Classic",
    description:
      "The original multi-factor score (value, quality, growth, momentum, risk, income, analysts) weighted by style. Descriptive only: it showed no edge in the backtest.",
  },
];
