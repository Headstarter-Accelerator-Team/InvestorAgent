// Advisor evaluation: runs fixed questions against /api/advise and checks
// that answers are grounded. Usage:
//   node scripts/eval.mjs [baseUrl]      (default http://localhost:3000)
// Paced for the Groq free tier, so a full run takes ~8 minutes.
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const universe = new Set(
  JSON.parse(fs.readFileSync(new URL("../data/universe.json", import.meta.url))).map((u) => u.t)
);
const PAUSE_MS = Number(process.env.EVAL_PAUSE_MS ?? 25_000);
// Finance acronyms that are also tickers (PEG ratio vs. PEG the company).
const FINANCE_TERMS = new Set(["PEG", "EPS", "ROE", "FCF", "EV", "YOY", "ETF", "IPO", "CEO", "AI", "PE"]);

const CASES = [
  { q: "What are the best stocks to buy right now for a 25 year old with high risk tolerance?" },
  { q: "Should I buy NVIDIA?", mustInclude: ["NVDA"] },
  { q: "safe dividend stocks for retirement", check: (p) => (p.dividendYield ?? 0) > 0 },
  { q: "Is Tesla overvalued?", mustInclude: ["TSLA"] },
  { q: "Compare Apple and Microsoft", mustInclude: ["AAPL", "MSFT"] },
  { q: "Best AI chip stocks for long-term growth" },
  { q: "Undervalued healthcare stocks", check: (p) => p.sector === "Healthcare" },
  { q: "High yield dividend stocks", check: (p) => (p.dividendYield ?? 0) >= 0.015 },
  { q: "cheap bank stocks", check: (p) => p.sector === "Financial Services" },
  { q: "Is Coca-Cola a good long term hold?", mustInclude: ["KO"] },
  { q: "cybersecurity stocks" },
  { q: "low risk stocks for a nervous first-time investor" },
  { q: "speculative small cap stocks with big upside", check: (p) => p.marketCap < 2e9 },
  { q: "What do you think about AMD vs Intel?", mustInclude: ["AMD", "INTC"] },
  { q: "asdfgh qwerty", expectEmpty: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function evaluate(c, res, ms) {
  const fails = [];
  if (res.error) return [`error: ${res.error}`];
  const tickers = res.picks.map((p) => p.ticker);
  if (c.expectEmpty) return res.picks.length ? [`expected no picks, got ${tickers.join(",")}`] : [];
  if (res.picks.length === 0) fails.push("no picks");
  if (!res.aiCommentary) fails.push("no AI commentary");
  const skipped = res.picks.filter((p) => p.stanceSource === "score").map((p) => p.ticker);
  if (skipped.length) fails.push(`no analyst commentary for ${skipped.join(",")}`);
  for (const t of c.mustInclude ?? []) if (!tickers.includes(t)) fails.push(`missing ${t}`);
  for (const p of res.picks) {
    if (p.quoteType !== "EQUITY") fails.push(`${p.ticker} is ${p.quoteType}`);
    if (c.check && !c.check(p)) fails.push(`${p.ticker} fails case check`);
    if (p.stanceSource !== "score" && p.thesis.length === 0) fails.push(`${p.ticker} has no grounded thesis`);
    for (const line of [...p.thesis, ...p.risks]) {
      if (!/\d/.test(line)) fails.push(`${p.ticker} bullet without a number: "${line.slice(0, 60)}"`);
    }
  }
  // Tickers mentioned in the summary must be ones we analysed.
  const mentioned = [...(res.summary ?? "").matchAll(/\b[A-Z]{2,5}\b/g)]
    .map((m) => m[0])
    .filter((t) => universe.has(t) && !tickers.includes(t) && !FINANCE_TERMS.has(t));
  if (mentioned.length) fails.push(`summary mentions unanalysed ${mentioned.join(",")}`);
  if (ms > 45_000) fails.push(`slow: ${Math.round(ms / 1000)}s`);
  return fails;
}

let passed = 0;
for (const [i, c] of CASES.entries()) {
  if (i > 0) await sleep(PAUSE_MS);
  const start = Date.now();
  let res;
  try {
    const r = await fetch(`${BASE}/api/advise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: c.q }),
    });
    res = await r.json();
  } catch (e) {
    res = { error: e.message };
  }
  const ms = Date.now() - start;
  const fails = evaluate(c, res, ms);
  if (fails.length === 0) passed++;
  const picks = (res.picks ?? []).map((p) => `${p.ticker}:${p.stance ?? "-"}`).join(" ");
  console.log(`${fails.length ? "FAIL" : "PASS"} ${String(Math.round(ms / 1000)).padStart(3)}s  ${c.q}`);
  console.log(`      ${res.intent?.style ?? ""} ${picks}`);
  for (const f of fails) console.log(`      - ${f}`);
}
console.log(`\n${passed}/${CASES.length} passed`);
process.exit(passed === CASES.length ? 0 : 1);
