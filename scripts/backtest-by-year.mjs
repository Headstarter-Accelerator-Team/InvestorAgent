// Year-by-year diagnostic: for each calendar year, the rank IC of a few
// signals and the top-20 excess return vs the equal-weight >= $10B universe.
// Usage: node scripts/backtest-by-year.mjs
import fs from "node:fs";
import path from "node:path";
import { FACTORS, STYLE_WEIGHTS } from "../lib/score.js";
import { mean, spearman } from "./backtest-lib.mjs";
import { SIGNALS } from "./backtest-factor-screen.mjs";

const panel = JSON.parse(fs.readFileSync(path.resolve(".backtest-cache/panel-2016.json"), "utf8"));
const pctRank = (vals) => {
  const idx = vals.map((v, i) => [v, i]).filter(([v]) => v !== null && Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  const out = vals.map(() => null);
  idx.forEach(([, i], k) => (out[i] = idx.length > 1 ? k / (idx.length - 1) : 0.5));
  return out;
};
const appBalanced = (f) => {
  let t = 0, u = 0;
  for (const [k, w] of Object.entries(STYLE_WEIGHTS.balanced)) {
    const s = FACTORS[k].score(f);
    if (s !== null && w) { t += s * w; u += w; }
  }
  return u ? t / u : null;
};

const signals = {
  "ROE+FCF (best)": (rows) => {
    const a = pctRank(rows.map((r) => SIGNALS.ROE(r.fact)));
    const b = pctRank(rows.map((r) => SIGNALS["FCF yield"](r.fact)));
    return rows.map((_, i) => (a[i] === null && b[i] === null ? null : ((a[i] ?? 0.5) * 60 + (b[i] ?? 0.5) * 40) / 100));
  },
  "momentum 6m": (rows) => rows.map((r) => SIGNALS["momentum 6m"](r.fact)),
  "app balanced": (rows) => rows.map((r) => appBalanced(r.fact)),
};

const years = {};
for (const q of panel) {
  const y = q.date.slice(0, 4);
  const rows = q.rows.filter((r) => r.fact.marketCap >= 10e9);
  if (rows.length < 50) continue;
  const univ = mean(rows.map((r) => r.ret));
  years[y] ??= {};
  for (const [name, fn] of Object.entries(signals)) {
    const scores = fn(rows);
    const pairs = rows.map((r, i) => [scores[i], r.ret]).filter(([s]) => s !== null);
    const top = [...pairs].sort((a, b) => b[0] - a[0]).slice(0, 20);
    (years[y][name] ??= { ic: [], excess: [] });
    years[y][name].ic.push(spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1])));
    years[y][name].excess.push(mean(top.map((p) => p[1])) - univ);
  }
}
const names = Object.keys(signals);
console.log("year  " + names.map((n) => `${n} IC / top20 excess`.padStart(34)).join(""));
for (const [y, d] of Object.entries(years)) {
  console.log(
    `${y}${y >= "2023" ? "*" : " "} ` +
      names.map((n) => `${mean(d[n].ic).toFixed(3).padStart(8)} / ${((mean(d[n].excess) * 4) * 100).toFixed(1).padStart(6)}%/yr`.padStart(34)).join("")
  );
}
console.log("* = held-out TEST years");
