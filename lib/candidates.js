// Turns a parsed question into a short list of scored candidate stocks.
import universe from "@/data/universe.json";
import { getFactSheet, getQuotes, resolveTicker, runScreener } from "@/lib/market";
import { passesFilters, scoreStock } from "@/lib/score";
import { embed, queryStocks } from "@/lib/server";
import { SECTOR_OPTIONS } from "@/lib/format";

export const SECTORS = SECTOR_OPTIONS;

// Yahoo predefined screeners that match each style (used when there's no theme).
const STYLE_SCREENERS = {
  growth: ["growth_technology_stocks", "undervalued_growth_stocks"],
  value: ["undervalued_large_caps", "undervalued_growth_stocks"],
  speculative: ["aggressive_small_caps", "small_cap_gainers"],
  balanced: ["undervalued_growth_stocks"],
  dividend: [],
  safe: [],
};

const SHORTLIST = 18;
// Market-cap bands for an explicit size request.
const SIZE_RANGES = { small: [3e8, 2e9], mid: [2e9, 1e10], large: [1e10, Infinity] };
const FINAL = 5;
// Without a requested sector/theme, cap picks per sector so results
// aren't five versions of the same bet.
const MAX_PER_SECTOR = 2;

const sectorOf = new Map(universe.map((u) => [u.t, u.s]));

function diversify(items, group, limit, maxPer) {
  const counts = new Map();
  const out = [];
  for (const item of items) {
    const key = group(item) ?? item;
    if ((counts.get(key) ?? 0) >= maxPer) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    out.push(item);
    if (out.length === limit) break;
  }
  return out;
}

// Cheap first-pass rank from batch quote data, so only the most promising
// stocks get a full (slower) fact sheet.
function preScore(q, style) {
  const pe = q.forwardPE ?? q.trailingPE;
  const peScore = pe && pe > 0 ? Math.max(0, 40 - pe) / 40 : 0;
  const rating = q.analystRating ? (5 - q.analystRating) / 4 : 0.4;
  const mom = q.change52w ?? 0;
  const yld = Math.min(q.dividendYield ?? 0, 0.09);
  const cap = Math.log10(q.marketCap ?? 1) / 12;
  switch (style) {
    case "growth":
    case "speculative":
      return rating + Math.max(-0.5, Math.min(mom, 1));
    case "value":
      return peScore * 2 + rating;
    case "dividend":
      return yld * 20 + rating * 0.5 + cap * 0.5;
    case "safe":
      return cap * 2 + yld * 5 + rating * 0.5 - Math.abs(mom) * 0.5;
    default:
      return rating + peScore + Math.max(-0.3, Math.min(mom, 0.5)) * 0.5;
  }
}

// Theme leaders suggested by the intent model, plus the closest semantic
// matches from each namespace. Financial ranking happens later.
async function themePool(theme, seeds = []) {
  const vector = await embed(theme);
  const [rich, broad] = await Promise.all([
    queryStocks(vector, 15, "stocks"),
    queryStocks(vector, 10, "stock-descriptions"),
  ]);
  const matches = [...rich, ...broad]
    .map((m) => m.Ticker)
    .filter((t) => t && t !== "N/A");
  return [...seeds, ...matches];
}

async function scoreTickers(tickers, { style, sector, size, allowFunds, applyFilters }) {
  const settled = await Promise.allSettled(tickers.map((t) => getFactSheet(t)));
  const notes = [];
  const scored = [];
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      notes.push(`No market data found for ${tickers[i]}.`);
      return;
    }
    const fact = r.value;
    if (applyFilters) {
      if (!passesFilters(fact, { style, allowFunds, minCap: SIZE_RANGES[size]?.[0] })) return;
      if (sector && fact.sector !== sector) return;
    }
    scored.push({ fact, score: scoreStock(fact, style) });
  });
  scored.sort((a, b) => (b.score.composite ?? 0) - (a.score.composite ?? 0));
  return { scored, notes };
}

// Named companies ("Should I buy Nvidia?", "AAPL vs MSFT").
async function namedCandidates(intent) {
  const resolved = await Promise.all(
    intent.companies.slice(0, FINAL).map(async (c) => {
      const upper = c.trim().toUpperCase();
      if (/^[A-Z.]{1,6}$/.test(upper) && universe.some((u) => u.t === upper)) {
        return upper;
      }
      return (await resolveTicker(c).catch(() => null)) ?? (/^[A-Z.]{1,6}$/.test(upper) ? upper : null);
    })
  );
  const tickers = [...new Set(resolved.filter(Boolean))];
  const { scored, notes } = await scoreTickers(tickers, {
    style: intent.style,
    applyFilters: false,
  });
  const missing = intent.companies.filter((_, i) => !resolved[i]);
  if (missing.length) notes.push(`Couldn't find a ticker for: ${missing.join(", ")}.`);
  return { candidates: scored, notes };
}

// Open-ended discovery ("safe dividend stocks", "best AI stocks").
async function discoverCandidates(intent) {
  const { style, sector, theme, size } = intent;
  const pool = new Set();
  const notes = [];

  if (theme) {
    (await themePool(theme, intent.themeTickers).catch((e) => {
      console.error("theme search failed", e);
      notes.push("Thematic search is unavailable right now; screened the full universe instead.");
      return [];
    })).forEach((t) => pool.add(t));
  }
  if (pool.size === 0) {
    universe
      .filter((u) => !sector || u.s === sector)
      .forEach((u) => pool.add(u.t));
    for (const id of STYLE_SCREENERS[style] ?? []) {
      (await runScreener(id).catch(() => [])).forEach((t) => pool.add(t));
    }
  }

  if (size === "small") {
    (await runScreener("aggressive_small_caps").catch(() => [])).forEach((t) => pool.add(t));
    (await runScreener("small_cap_gainers").catch(() => [])).forEach((t) => pool.add(t));
  }
  const [minCap, maxCap] = SIZE_RANGES[size] ?? [style === "speculative" ? 3e8 : 2e9, Infinity];
  // Skip extra share classes (BRK-B, PBR-A): one line per company.
  const quotes = (await getQuotes([...pool].filter((t) => !t.includes("-")))).filter(
    (q) =>
      q.quoteType === "EQUITY" &&
      q.exchange !== "PNK" && // OTC / pink-sheet listings
      q.price &&
      (q.marketCap ?? 0) >= minCap &&
      (q.marketCap ?? 0) < maxCap &&
      (style !== "dividend" || (q.dividendYield ?? 0) >= 0.015)
  );
  const focused = Boolean(sector || theme || size === "small");
  // Theme leaders always make the shortlist, whatever their pre-score.
  const seeds = new Set(theme ? intent.themeTickers ?? [] : []);
  const ranked = quotes
    .sort((a, b) => preScore(b, style) - preScore(a, style))
    .map((q) => q.ticker);
  const shortlist = focused
    ? [...ranked.filter((t) => seeds.has(t)), ...ranked.filter((t) => !seeds.has(t))].slice(0, SHORTLIST)
    : diversify(ranked, (t) => sectorOf.get(t), SHORTLIST, 4);

  // Missing data for screener-picked tickers isn't worth surfacing.
  const { scored } = await scoreTickers(shortlist, {
    style,
    sector,
    size,
    applyFilters: true,
  });
  // For a theme, its leading companies come first (still sorted by score),
  // so "EV stocks" shows EV makers even when they score poorly.
  const themed = [
    ...scored.filter((c) => seeds.has(c.fact.ticker)),
    ...scored.filter((c) => !seeds.has(c.fact.ticker)),
  ];
  const candidates = focused
    ? themed.slice(0, FINAL).sort((a, b) => (b.score.composite ?? 0) - (a.score.composite ?? 0))
    : diversify(scored, (c) => c.fact.sector, FINAL, MAX_PER_SECTOR);
  return { candidates, screened: quotes.length, notes };
}

export async function findCandidates(intent) {
  if (intent.companies?.length) return namedCandidates(intent);
  return discoverCandidates(intent);
}
