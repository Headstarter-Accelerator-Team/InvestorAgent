// Runs one scoring experiment against the point-in-time panel and reports
// TRAIN (tuning period) and TEST (held out, never used for tuning) results.
//
// Usage: node scripts/backtest-experiment.mjs scripts/experiments/01-baseline.mjs
//
// An experiment module exports default {
//   name, description,
//   factors: { key: (fact) => 0-100 | null },   // defaults to lib/score.js FACTORS
//   weights: { key: number },
//   top: 10, sectorCap: null | number,
// }
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FACTORS } from "../lib/score.js";
import { COST_BPS, loadPanel, mean, spearman, summarize, tStat } from "./backtest-lib.mjs";

const TRAIN_END = "2023-01-01"; // quarters starting before this are TRAIN
const CACHE = path.resolve(".backtest-cache");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/backtest-experiment.mjs <experiment.mjs>");
  process.exit(1);
}
const exp = (await import(pathToFileURL(path.resolve(file)).href)).default;
const factors = {
  ...Object.fromEntries(Object.entries(FACTORS).map(([k, f]) => [k, f.score])),
  ...(exp.factors ?? {}),
};
const weights = exp.weights;
const top = exp.top ?? 10;

// The panel is expensive to build; cache it.
const panelFile = path.join(CACHE, "panel-2016.json");
let panel;
if (fs.existsSync(panelFile)) {
  panel = JSON.parse(fs.readFileSync(panelFile, "utf8"));
} else {
  panel = await loadPanel({ start: "2016-01-01" });
  fs.writeFileSync(panelFile, JSON.stringify(panel));
}

function composite(fact) {
  let total = 0;
  let used = 0;
  for (const [key, w] of Object.entries(weights)) {
    if (!w) continue;
    const s = factors[key]?.(fact);
    if (s === null || s === undefined || !Number.isFinite(s)) continue;
    total += s * w;
    used += Math.abs(w);
  }
  return used ? total / used : null;
}

const results = { train: [], test: [] };
let prevPicks = new Set();
// rank: true -> each factor becomes a 0-100 percentile within the quarter,
// so raw signals on different scales can be combined.
// sectorNeutral: true -> percentiles are computed within each sector.
function rankComposite(rows) {
  const ranked = rows.map(() => ({ total: 0, used: 0 }));
  const groups = new Map();
  rows.forEach((r, i) => {
    const key = exp.sectorNeutral ? r.sector : "all";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  for (const [key, w] of Object.entries(weights)) {
    if (!w) continue;
    for (const members of groups.values()) {
      const vals = members
        .map((i) => [factors[key]?.(rows[i].fact), i])
        .filter(([v]) => v !== null && v !== undefined && Number.isFinite(v));
      if (vals.length < 3) continue;
      vals.sort((a, b) => a[0] - b[0]);
      vals.forEach(([, i], k) => {
        ranked[i].total += (k / (vals.length - 1)) * 100 * w;
        ranked[i].used += Math.abs(w);
      });
    }
  }
  return ranked.map((x) => (x.used ? x.total / x.used : null));
}

let held = null; // picks carried between rebalances (rebalanceEvery > 1)
const rebalanceEvery = exp.rebalanceEvery ?? 1;
for (const [qi, q] of panel.entries()) {
  const eligible = q.rows.filter((r) => !exp.filter || exp.filter(r.fact));
  const scores = exp.rank ? rankComposite(eligible) : eligible.map((r) => composite(r.fact));
  const rows = eligible
    .map((r, i) => ({ ...r, score: scores[i] }))
    .filter((r) => r.score !== null);
  if (rows.length < 50) continue;

  const ranked = [...rows].sort((a, b) => b.score - a.score);
  let picks = [];
  const perSector = new Map();
  for (const r of ranked) {
    if (exp.sectorCap) {
      const n = perSector.get(r.sector) ?? 0;
      if (n >= exp.sectorCap) continue;
      perSector.set(r.sector, n + 1);
    }
    picks.push(r);
    if (picks.length === top) break;
  }
  // Between rebalances keep the previous holdings (those still trading).
  if (held && qi % rebalanceEvery !== 0) {
    const byTicker = new Map(q.rows.map((r) => [r.ticker, r]));
    const kept = [...held].map((t) => byTicker.get(t)).filter(Boolean);
    if (kept.length) picks = kept;
  }
  held = new Set(picks.map((p) => p.ticker));
  const turnover = picks.filter((p) => !prevPicks.has(p.ticker)).length / picks.length;
  prevPicks = new Set(picks.map((p) => p.ticker));
  const ret = mean(picks.map((p) => p.ret)) - turnover * (COST_BPS / 1e4) * 2;
  // Benchmark = equal weight of the same eligible universe.
  const universe = mean(eligible.map((r) => r.ret));

  const asc = [...rows].sort((a, b) => a.score - b.score);
  const fifth = Math.floor(asc.length / 5);
  const q1 = mean(asc.slice(0, fifth).map((r) => r.ret));
  const q5 = mean(asc.slice(-fifth).map((r) => r.ret));

  (q.date < TRAIN_END ? results.train : results.test).push({
    ret,
    universe,
    spy: q.spyRet,
    ic: spearman(rows.map((r) => r.score), rows.map((r) => r.ret)),
    spread: q5 - q1,
    hit: mean(picks.map((p) => (p.ret > universe ? 1 : 0))),
  });
}

function metrics(qs) {
  const excess = qs.map((x) => x.ret - x.universe);
  const s = summarize(qs.map((x) => x.ret));
  const u = summarize(qs.map((x) => x.universe));
  return {
    quarters: qs.length,
    cagr: s.cagr,
    universeCagr: u.cagr,
    spyCagr: summarize(qs.map((x) => x.spy)).cagr,
    excessPerYear: mean(excess) * 4,
    beatRate: excess.filter((x) => x > 0).length / excess.length,
    t: tStat(excess),
    ic: mean(qs.map((x) => x.ic)),
    icT: tStat(qs.map((x) => x.ic)),
    spreadPerYear: mean(qs.map((x) => x.spread)) * 4,
    pickHitRate: mean(qs.map((x) => x.hit)),
    maxDD: s.maxDD,
  };
}

const train = metrics(results.train);
const test = metrics(results.test);
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const row = (label, m) =>
  `${label.padEnd(6)} ${String(m.quarters).padStart(3)}q  CAGR ${pct(m.cagr).padStart(6)} (univ ${pct(m.universeCagr)}, SPY ${pct(m.spyCagr)})  ` +
  `excess ${pct(m.excessPerYear).padStart(6)}/yr  beat ${pct(m.beatRate).padStart(6)}  t ${m.t.toFixed(2).padStart(5)}  ` +
  `IC ${m.ic.toFixed(3)} (t ${m.icT.toFixed(2)})  Q5-Q1 ${pct(m.spreadPerYear)}/yr  pick hit ${pct(m.pickHitRate)}  maxDD ${pct(m.maxDD)}`;

console.log(`\n${exp.name}: ${exp.description ?? ""}`);
console.log(row("TRAIN", train));
console.log(row("TEST", test));
const targets = {
  beatRate: test.beatRate > 0.6,
  ic: test.ic > 0.05,
  spread: test.spreadPerYear > 0,
};
console.log(
  `Held-out targets: beat >60% ${targets.beatRate ? "✓" : "✗"} | IC >0.05 ${targets.ic ? "✓" : "✗"} | Q5>Q1 ${targets.spread ? "✓" : "✗"}`
);
fs.appendFileSync(
  path.join(CACHE, "experiments.jsonl"),
  JSON.stringify({ at: new Date().toISOString(), name: exp.name, weights, top, sectorCap: exp.sectorCap ?? null, train, test }) + "\n"
);
