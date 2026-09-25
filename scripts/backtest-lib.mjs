// Shared data loading and point-in-time fact building for the backtests.
// See scripts/backtest.mjs for what is and isn't modelled.
import fs from "node:fs";
import path from "node:path";
import YahooFinance from "yahoo-finance2";
import { passesFilters } from "../lib/score.js";
import { priceStats } from "../lib/price-stats.js";

const REFRESH = process.argv.includes("--refresh");
export const COST_BPS = 10; // per unit of one-way turnover
const CACHE = path.resolve(".backtest-cache");
const UA = process.env.SEC_USER_AGENT || "InvestorAgent backtest research-script";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
fs.mkdirSync(path.join(CACHE, "prices"), { recursive: true });
fs.mkdirSync(path.join(CACHE, "facts"), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (d) => d.toISOString().slice(0, 10);
const DAY_MS = 864e5;

async function cached(file, fetcher) {
  if (!REFRESH && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const data = await fetcher();
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = await fn(items[i], i);
        } catch (error) {
          out[i] = { error: error.message };
        }
        if (++done % 100 === 0) process.stderr.write(`  ${done}/${items.length}\n`);
      }
    })
  );
  return out;
}

// ---------- data ----------

async function loadPrices(ticker) {
  return cached(path.join(CACHE, "prices", `${ticker}.json`), async () => {
    const chart = await yf.chart(ticker, {
      period1: "2014-06-01",
      interval: "1d",
      events: "div",
    });
    return {
      bars: chart.quotes
        .filter((q) => q.close)
        .map((q) => [day(q.date), q.adjclose ?? q.close, q.close]),
      dividends: (chart.events?.dividends ?? []).map((d) => [day(d.date), d.amount]),
    };
  });
}

const CONCEPTS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "RevenuesNetOfInterestExpense",
  ],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  operatingIncome: ["OperatingIncomeLoss"],
  eps: ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted", "EarningsPerShareBasic"],
  cfo: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  debt: ["LongTermDebt", "LongTermDebtNoncurrent"],
  debtCurrent: ["LongTermDebtCurrent", "DebtCurrent"],
  assetsCurrent: ["AssetsCurrent"],
  liabilitiesCurrent: ["LiabilitiesCurrent"],
  dilutedShares: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
};

let lastSec = 0;
async function secJSON(url) {
  // SEC allows 10 requests/second; stay under it.
  const wait = lastSec + 150 - Date.now();
  if (wait > 0) await sleep(wait);
  lastSec = Date.now();
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`SEC ${response.status}`);
  return response.json();
}

async function loadFacts(ticker, cik) {
  return cached(path.join(CACHE, "facts", `${ticker}.json`), async () => {
    const data = await secJSON(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, "0")}.json`
    );
    if (!data) return null;
    const gaap = data.facts?.["us-gaap"] ?? {};
    const out = {};
    for (const [key, names] of Object.entries(CONCEPTS)) {
      out[key] = names.flatMap((name) =>
        Object.values(gaap[name]?.units ?? {})
          .flat()
          .map((f) => [f.start ?? null, f.end, f.val, f.filed])
      );
    }
    out.shares = Object.values(data.facts?.dei?.EntityCommonStockSharesOutstanding?.units ?? {})
      .flat()
      .map((f) => [null, f.end, f.val, f.filed]);
    return out;
  });
}

// ---------- point-in-time lookups ----------

const isAnnual = ([start, end]) => {
  if (!start) return false;
  const days = (Date.parse(end) - Date.parse(start)) / DAY_MS;
  return days > 330 && days < 400;
};

// Annual values known on `date`: one per fiscal year end, as first filed.
function annuals(facts, date) {
  const byEnd = new Map();
  for (const f of facts ?? []) {
    if (f[3] > date || !isAnnual(f)) continue;
    const prev = byEnd.get(f[1]);
    if (!prev || f[3] < prev[3]) byEnd.set(f[1], f);
  }
  return [...byEnd.values()].sort((a, b) => (a[1] < b[1] ? -1 : 1));
}

function latestAnnualPair(facts, date) {
  const list = annuals(facts, date);
  const latest = list.at(-1);
  if (!latest) return [null, null];
  const target = Date.parse(latest[1]) - 365 * DAY_MS;
  const prior = list.find((f) => Math.abs(Date.parse(f[1]) - target) < 45 * DAY_MS);
  // Too stale to be "current" (e.g. company stopped filing).
  if (Date.parse(date) - Date.parse(latest[1]) > 550 * DAY_MS) return [null, null];
  return [latest[2], prior?.[2] ?? null];
}

function latestInstant(facts, date) {
  let best = null;
  for (const f of facts ?? []) {
    if (f[3] > date || f[0]) continue;
    if (!best || f[1] > best[1] || (f[1] === best[1] && f[3] < best[3])) best = f;
  }
  if (!best || Date.parse(date) - Date.parse(best[1]) > 550 * DAY_MS) return null;
  return best[2];
}

// Index of the last bar on or before `date` (bars sorted by date).
function barIndex(bars, date) {
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid][0] <= date) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

let spyByDate = null; // built once; SPY adjusted close by date

function beta(bars, spyBars, date) {
  const i = barIndex(bars, date);
  if (i < 252) return null;
  spyByDate ??= new Map(spyBars.map((b) => [b[0], b[1]]));
  const byDate = spyByDate;
  const pairs = [];
  for (let k = i - 251; k <= i; k++) {
    const s0 = byDate.get(bars[k - 1][0]);
    const s1 = byDate.get(bars[k][0]);
    if (s0 && s1) pairs.push([bars[k][1] / bars[k - 1][1] - 1, s1 / s0 - 1]);
  }
  if (pairs.length < 150) return null;
  const mx = pairs.reduce((a, p) => a + p[0], 0) / pairs.length;
  const my = pairs.reduce((a, p) => a + p[1], 0) / pairs.length;
  let cov = 0;
  let vary = 0;
  for (const [x, y] of pairs) {
    cov += (x - mx) * (y - my);
    vary += (y - my) ** 2;
  }
  return vary ? cov / vary : null;
}

const ratio = (a, b) => (a !== null && b !== null && b !== 0 ? a / b : null);
const growth = (now, before) =>
  now !== null && before !== null && before > 0 ? now / before - 1 : null;

// Fact sheet in the same shape as lib/market.js, built only from data known on `date`.
export function factAt(t, date, spyBars) {
  const i = barIndex(t.prices.bars, date);
  if (i < 60) return null;
  // Price must be fresh (stock still trading).
  if (Date.parse(date) - Date.parse(t.prices.bars[i][0]) > 10 * DAY_MS) return null;
  const window = t.prices.bars.slice(Math.max(0, i - 252), i + 1);
  const price = t.prices.bars[i][2];
  const closes = window.map((b) => b[2]);
  const high52 = Math.max(...closes);
  const low52 = Math.min(...closes);
  const f = t.facts;

  const [revenue, revenuePrev] = latestAnnualPair(f.revenue, date);
  const [netIncome, netIncomePrev] = latestAnnualPair(f.netIncome, date);
  const [operatingIncome] = latestAnnualPair(f.operatingIncome, date);
  const [eps] = latestAnnualPair(f.eps, date);
  const [cfo] = latestAnnualPair(f.cfo, date);
  const [capex] = latestAnnualPair(f.capex, date);
  const [dilutedShares] = latestAnnualPair(f.dilutedShares, date);
  const equity = latestInstant(f.equity, date);
  const debt = latestInstant(f.debt, date);
  const debtCurrent = latestInstant(f.debtCurrent, date);
  const shares = latestInstant(f.shares, date) ?? dilutedShares;
  const marketCap = shares ? shares * price : null;

  const yearAgo = day(new Date(Date.parse(date) - 365 * DAY_MS));
  const dividends = t.prices.dividends
    .filter(([d]) => d > yearAgo && d <= date)
    .reduce((a, [, amt]) => a + amt, 0);
  const trailingPE = eps && eps > 0 ? price / eps : eps !== null ? -1 : null;
  const earningsGrowth = growth(netIncome, netIncomePrev);
  const stats = priceStats(window.map((b) => ({ adjclose: b[1] })));

  return {
    ticker: t.ticker,
    sector: t.sector,
    quoteType: "EQUITY",
    price,
    marketCap,
    high52,
    low52,
    pos52: high52 > low52 ? (price - low52) / (high52 - low52) : null,
    trailingPE,
    forwardPE: null,
    peg: trailingPE > 0 && earningsGrowth > 0 ? trailingPE / (earningsGrowth * 100) : null,
    priceToSales: ratio(marketCap, revenue),
    priceToBook: ratio(marketCap, equity),
    evToEbitda: null,
    grossMargin: null,
    operatingMargin: ratio(operatingIncome, revenue),
    profitMargin: ratio(netIncome, revenue),
    roe: equity && equity > 0 ? ratio(netIncome, equity) : null,
    freeCashflow: cfo !== null ? cfo - (capex ?? 0) : null,
    revenue,
    debtToEquity: equity && equity > 0 && debt !== null ? ((debt + (debtCurrent ?? 0)) / equity) * 100 : null,
    currentRatio: ratio(latestInstant(f.assetsCurrent, date), latestInstant(f.liabilitiesCurrent, date)),
    revenueGrowth: growth(revenue, revenuePrev),
    earningsGrowth,
    epsGrowthNextYear: null,
    dividendYield: price ? dividends / price : null,
    payoutRatio: eps && eps > 0 && dividends ? dividends / eps : dividends ? null : 0,
    beta: beta(t.prices.bars, spyBars, date),
    shortPercentFloat: null,
    analystTarget: null,
    analystUpside: null,
    analystRating: null,
    analystCount: null,
    ...stats,
  };
}

export function priceOn(t, date) {
  const i = barIndex(t.prices.bars, date);
  return i === -1 ? null : t.prices.bars[i][1]; // adjusted close = total return
}

// ---------- stats ----------

export const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const sd = (xs) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

export function summarize(returns) {
  let equity = 1;
  let peak = 1;
  let maxDD = 0;
  for (const r of returns) {
    equity *= 1 + r;
    peak = Math.max(peak, equity);
    maxDD = Math.min(maxDD, equity / peak - 1);
  }
  const years = returns.length / 4;
  return {
    cagr: equity ** (1 / years) - 1,
    vol: sd(returns) * 2,
    sharpe: (mean(returns) * 4) / (sd(returns) * 2),
    maxDD,
    total: equity - 1,
  };
}

function ranks(values) {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(values.length);
  order.forEach(([, i], k) => (r[i] = k));
  return r;
}

export function spearman(xs, ys) {
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

export const tStat = (xs) => mean(xs) / (sd(xs) / Math.sqrt(xs.length));


// ---------- panel ----------

// Loads prices + SEC facts (cached) and returns, for each quarter from
// `start`, every stock's point-in-time fact sheet and next-quarter return.
export async function loadPanel({ start = "2016-01-01" } = {}) {
  const START = start;
  const universe = JSON.parse(fs.readFileSync("data/universe.json", "utf8")).filter(
    (u) => /^[A-Z]{1,5}$/.test(u.t)
  );
  console.error(`Universe: ${universe.length} tickers. Loading data (cached after first run)...`);

  const cikMap = await cached(path.join(CACHE, "cik-map.json"), async () => {
    const data = await secJSON("https://www.sec.gov/files/company_tickers.json");
    return Object.fromEntries(Object.values(data).map((c) => [c.ticker, c.cik_str]));
  });

  const spy = await loadPrices("SPY");
  console.error("Prices...");
  const prices = await pool(universe, 6, (u) => loadPrices(u.t));
  console.error("SEC financials...");
  const facts = await pool(universe, 4, (u) => (cikMap[u.t] ? loadFacts(u.t, cikMap[u.t]) : null));

  const stocks = universe
    .map((u, i) => ({ ticker: u.t, sector: u.s, prices: prices[i], facts: facts[i] }))
    .filter((s) => s.prices?.bars?.length && s.facts && !s.facts.error);
  console.error(`Usable: ${stocks.length} stocks with prices and SEC financials.`);

  // Quarterly rebalance dates: first SPY trading day of each quarter.
  const dates = [];
  for (let y = Number(START.slice(0, 4)); ; y++) {
    let stop = false;
    for (const m of ["01", "04", "07", "10"]) {
      const target = `${y}-${m}-01`;
      if (target < START) continue;
      const bar = spy.bars.find((b) => b[0] >= target);
      if (!bar) {
        stop = true;
        break;
      }
      dates.push(bar[0]);
    }
    if (stop) break;
  }

  const quarters = [];
  for (let q = 0; q < dates.length - 1; q++) {
    const date = dates[q];
    const nextDate = dates[q + 1];
    const rows = [];
    for (const s of stocks) {
      const fact = factAt(s, date, spy.bars);
      if (!fact || !passesFilters(fact, { style: "balanced" })) continue;
      const p0 = priceOn(s, date);
      const p1 = priceOn(s, nextDate);
      if (!p0 || !p1) continue;
      rows.push({ ticker: s.ticker, sector: s.sector, fact, ret: p1 / p0 - 1 });
    }
    const spyRet = priceOn({ prices: spy }, nextDate) / priceOn({ prices: spy }, date) - 1;
    quarters.push({ date, nextDate, rows, spyRet });
  }
  return quarters;
}
