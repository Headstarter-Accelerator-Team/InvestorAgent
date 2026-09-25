// Screens candidate signals on the TRAIN period only (quarters before
// TRAIN_END): rank IC of each raw signal vs next-quarter return. Used to
// choose experiments without looking at the held-out TEST period.
//
// Usage: node scripts/backtest-factor-screen.mjs
import fs from "node:fs";
import path from "node:path";
import { mean, spearman, tStat } from "./backtest-lib.mjs";

const TRAIN_END = "2023-01-01";
// Point-in-time size floor: the universe is today's survivors, so small
// companies in early years are biased winners. --min-cap 10e9 limits that.
const minCapArg = process.argv.indexOf("--min-cap");
const MIN_CAP = minCapArg === -1 ? 0 : Number(process.argv[minCapArg + 1]);
const panel = JSON.parse(fs.readFileSync(path.resolve(".backtest-cache/panel-2016.json"), "utf8"));

const pos = (v) => (v !== null && v !== undefined && Number.isFinite(v) ? v : null);
// Each signal: higher value = expected better return.
export const SIGNALS = {
  "momentum 12-1": (f) =>
    pos(f.return1y) !== null && pos(f.return1m) !== null ? (1 + f.return1y) / (1 + f.return1m) - 1 : null,
  "momentum 6m": (f) => pos(f.return6m),
  "reversal 1m (-ret1m)": (f) => (pos(f.return1m) !== null ? -f.return1m : null),
  "52w-high proximity": (f) => pos(f.pos52),
  "above 200-day": (f) => (f.sma200 && f.price ? f.price / f.sma200 - 1 : null),
  "earnings yield (E/P)": (f) => (f.trailingPE > 0 ? 1 / f.trailingPE : f.trailingPE === -1 ? -0.1 : null),
  "FCF yield": (f) => (f.freeCashflow !== null && f.marketCap ? f.freeCashflow / f.marketCap : null),
  "sales yield (S/P)": (f) => (f.priceToSales ? 1 / f.priceToSales : null),
  "book yield (B/P)": (f) => (f.priceToBook > 0 ? 1 / f.priceToBook : null),
  ROE: (f) => pos(f.roe),
  "net margin": (f) => pos(f.profitMargin),
  "operating margin": (f) => pos(f.operatingMargin),
  "revenue growth": (f) => pos(f.revenueGrowth),
  "earnings growth": (f) => pos(f.earningsGrowth),
  "low volatility (-vol)": (f) => (pos(f.volatility1y) !== null ? -f.volatility1y : null),
  "low beta (-beta)": (f) => (pos(f.beta) !== null ? -f.beta : null),
  "small size (-log cap)": (f) => (f.marketCap ? -Math.log(f.marketCap) : null),
  "dividend yield": (f) => pos(f.dividendYield),
  "low leverage (-D/E)": (f) => (pos(f.debtToEquity) !== null ? -f.debtToEquity : null),
  RSI14: (f) => pos(f.rsi14),
  "MACD hist": (f) => pos(f.macdHistPct),
};

if (process.argv[1]?.endsWith("backtest-factor-screen.mjs")) {
  const out = [];
  for (const [name, fn] of Object.entries(SIGNALS)) {
    const ics = [];
    let coverage = 0;
    let quarters = 0;
    for (const q of panel) {
      if (q.date >= TRAIN_END) continue;
      quarters++;
      const rows = q.rows.filter((r) => r.fact.marketCap >= MIN_CAP);
      const pairs = rows.map((r) => [fn(r.fact), r.ret]).filter(([v]) => v !== null);
      coverage += pairs.length / rows.length;
      if (pairs.length < 50) continue;
      ics.push(spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1])));
    }
    out.push({ name, ic: mean(ics), t: tStat(ics), hit: ics.filter((x) => x > 0).length / ics.length, coverage: coverage / quarters });
  }
  out.sort((a, b) => b.ic - a.ic);
  console.log(`TRAIN only (2016-2022), market cap >= $${MIN_CAP / 1e9}B at the time — rank IC vs next-quarter return`);
  console.log("signal".padEnd(26) + "IC".padStart(8) + "t".padStart(7) + "  IC>0 qtrs".padStart(12) + "coverage".padStart(10));
  for (const r of out) {
    console.log(
      r.name.padEnd(26) + r.ic.toFixed(3).padStart(8) + r.t.toFixed(2).padStart(7) +
        `${(r.hit * 100).toFixed(0)}%`.padStart(12) + `${(r.coverage * 100).toFixed(0)}%`.padStart(10)
    );
  }
}
