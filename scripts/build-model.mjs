// Builds data/backtest-model.json: percentile cut-points for the backtested
// scoring model (ROE + FCF yield among companies >= $10B), taken from the
// point-in-time backtest panel. Rerun after re-running the backtest:
//   node scripts/build-model.mjs
import fs from "node:fs";
import path from "node:path";

const panel = JSON.parse(fs.readFileSync(path.resolve(".backtest-cache/panel-2016.json"), "utf8"));
const MIN_CAP = 10e9;
const roe = [];
const fcfYield = [];
for (const q of panel) {
  for (const r of q.rows) {
    const f = r.fact;
    if (f.marketCap < MIN_CAP) continue;
    if (Number.isFinite(f.roe)) roe.push(f.roe);
    if (Number.isFinite(f.freeCashflow) && f.marketCap) fcfYield.push(f.freeCashflow / f.marketCap);
  }
}
// Value at each 5th percentile (0, 5, ..., 100).
const cutpoints = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return Array.from({ length: 21 }, (_, i) => s[Math.min(s.length - 1, Math.round((i / 20) * (s.length - 1)))]);
};
const model = {
  name: "backtested",
  description: "ROE (60%) + free-cash-flow yield (40%), percentiles vs companies >= $10B, 2016-2026",
  minMarketCap: MIN_CAP,
  weights: { roe: 60, fcfYield: 40 },
  cutpoints: { roe: cutpoints(roe), fcfYield: cutpoints(fcfYield) },
  samples: { roe: roe.length, fcfYield: fcfYield.length },
  evidence:
    "Point-in-time backtest 2016-2026 (SEC filings as filed, quarterly rebalance): the top 20 beat an equal-weight basket of $10B+ companies in 9 of 11 years, including all held-out years 2023-2026, by roughly 1-12% a year. The edge is concentrated at the very top of the ranking.",
  builtAt: new Date().toISOString().slice(0, 10),
};
fs.writeFileSync("data/backtest-model.json", JSON.stringify(model, null, 2) + "\n");
console.log("roe cutpoints", model.cutpoints.roe.map((v) => v.toFixed(3)).join(" "));
console.log("fcf cutpoints", model.cutpoints.fcfYield.map((v) => v.toFixed(3)).join(" "));
console.log("samples", model.samples);
