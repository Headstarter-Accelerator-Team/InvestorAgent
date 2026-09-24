// Live market data from Yahoo Finance (free, no key, ~15 min delayed).
import { unstable_cache } from "next/cache";
import YahooFinance from "yahoo-finance2";
import { withTimeout } from "@/lib/errors";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

const SUMMARY_MODULES = [
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "earningsTrend",
  "recommendationTrend",
  "calendarEvents",
  "assetProfile",
];

// One retry for transient connection failures (not timeouts, which already
// used their time budget).
async function retryNetwork(fn) {
  try {
    return await fn();
  } catch (error) {
    const text = `${error.message} ${error.cause?.message ?? ""} ${error.cause?.code ?? ""}`;
    if (error.name === "TimeoutError" || !/fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|Connect Timeout/i.test(text)) {
      throw error;
    }
    console.warn("retrying after network error:", text.trim());
    return fn();
  }
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round = (v, digits = 2) =>
  v === null ? null : Math.round(v * 10 ** digits) / 10 ** digits;

// Price-history stats from ~1 year of daily closes.
function priceStats(quotes) {
  const closes = quotes
    .map((q) => num(q.adjclose ?? q.close))
    .filter((v) => v !== null);
  if (closes.length < 20) return {};
  const last = closes.at(-1);
  const back = (days) =>
    closes.length > days ? last / closes[closes.length - 1 - days] - 1 : null;
  const avg = (n) =>
    closes.length >= n
      ? closes.slice(-n).reduce((a, b) => a + b, 0) / n
      : null;

  let peak = closes[0];
  let maxDrawdown = 0;
  for (const c of closes) {
    peak = Math.max(peak, c);
    maxDrawdown = Math.min(maxDrawdown, c / peak - 1);
  }
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);

  return {
    return1m: back(21),
    return3m: back(63),
    return6m: back(126),
    return1y: back(Math.min(252, closes.length - 1)),
    sma50: avg(50),
    sma200: avg(200),
    maxDrawdown1y: maxDrawdown,
    volatility1y: Math.sqrt(variance) * Math.sqrt(252),
  };
}

async function buildFactSheet(symbol) {
  const [summary, chart] = await Promise.all([
    retryNetwork(() =>
      withTimeout(
        yahooFinance.quoteSummary(symbol, { modules: SUMMARY_MODULES }),
        10_000,
        `Yahoo quoteSummary ${symbol}`
      )
    ),
    // Price history is optional: momentum/risk factors just become n/a.
    withTimeout(
      yahooFinance.chart(symbol, {
        period1: new Date(Date.now() - 370 * 864e5),
        interval: "1d",
      }),
      10_000,
      `Yahoo chart ${symbol}`
    ).catch(() => ({ quotes: [] })),
  ]);

  const p = summary.price ?? {};
  const sd = summary.summaryDetail ?? {};
  const ks = summary.defaultKeyStatistics ?? {};
  const fd = summary.financialData ?? {};
  const profile = summary.assetProfile ?? {};
  const trend = summary.earningsTrend?.trend ?? [];
  const rec = summary.recommendationTrend?.trend?.[0] ?? {};
  const growthFor = (period) =>
    num(trend.find((t) => t.period === period)?.growth);

  const price = num(p.regularMarketPrice);
  const high52 = num(sd.fiftyTwoWeekHigh);
  const low52 = num(sd.fiftyTwoWeekLow);
  const target = num(fd.targetMeanPrice);
  const stats = priceStats(chart.quotes ?? []);

  return {
    ticker: p.symbol ?? symbol,
    name: p.longName ?? p.shortName ?? symbol,
    quoteType: p.quoteType ?? null,
    currency: p.currency ?? "USD",
    asOf: p.regularMarketTime ? new Date(p.regularMarketTime).toISOString() : null,
    sector: profile.sector ?? null,
    industry: profile.industry ?? null,
    summary: profile.longBusinessSummary ?? null,
    city: profile.city ?? null,
    state: profile.state ?? null,
    country: profile.country ?? null,

    price,
    marketCap: num(p.marketCap ?? sd.marketCap),
    high52,
    low52,
    pos52: high52 && low52 && price ? (price - low52) / (high52 - low52) : null,

    trailingPE: num(sd.trailingPE),
    forwardPE: num(sd.forwardPE),
    peg: num(ks.pegRatio),
    priceToSales: num(sd.priceToSalesTrailing12Months),
    priceToBook: num(ks.priceToBook),
    evToEbitda: num(ks.enterpriseToEbitda),

    grossMargin: num(fd.grossMargins),
    operatingMargin: num(fd.operatingMargins),
    profitMargin: num(fd.profitMargins),
    roe: num(fd.returnOnEquity),
    freeCashflow: num(fd.freeCashflow),
    revenue: num(fd.totalRevenue),
    debtToEquity: num(fd.debtToEquity),
    currentRatio: num(fd.currentRatio),

    revenueGrowth: num(fd.revenueGrowth),
    earningsGrowth: num(fd.earningsGrowth),
    epsGrowthThisYear: growthFor("0y"),
    epsGrowthNextYear: growthFor("+1y"),

    dividendYield: num(sd.dividendYield),
    payoutRatio: num(sd.payoutRatio),

    beta: num(sd.beta),
    shortPercentFloat: num(ks.shortPercentOfFloat),
    ...stats,

    analystTarget: target,
    analystUpside: target && price ? target / price - 1 : null,
    analystRating: num(fd.recommendationMean), // 1 = strong buy, 5 = sell
    analystCount: num(fd.numberOfAnalystOpinions),
    analystVotes: {
      strongBuy: rec.strongBuy ?? 0,
      buy: rec.buy ?? 0,
      hold: rec.hold ?? 0,
      sell: rec.sell ?? 0,
      strongSell: rec.strongSell ?? 0,
    },
    nextEarnings:
      summary.calendarEvents?.earnings?.earningsDate?.[0]?.toISOString?.() ??
      null,
  };
}

// Full fact sheet for one ticker, cached for 6 hours.
export const getFactSheet = unstable_cache(
  async (symbol) => buildFactSheet(symbol.toUpperCase()),
  ["fact-sheet-v1"],
  { revalidate: 6 * 3600 }
);

// Lightweight batch quotes for screening many tickers at once.
export const getQuotes = unstable_cache(
  async (symbols) => {
    const out = [];
    for (let i = 0; i < symbols.length; i += 150) {
      const batch = await retryNetwork(() =>
        withTimeout(
          yahooFinance.quote(symbols.slice(i, i + 150), { return: "array" }),
          15_000,
          "Yahoo quote batch"
        )
      );
      out.push(...batch);
    }
    return out.map((q) => ({
      ticker: q.symbol,
      name: q.longName ?? q.shortName ?? q.symbol,
      quoteType: q.quoteType,
      exchange: q.exchange ?? null,
      price: num(q.regularMarketPrice),
      marketCap: num(q.marketCap),
      trailingPE: num(q.trailingPE),
      forwardPE: num(q.forwardPE),
      priceToBook: num(q.priceToBook),
      dividendYield: num(q.dividendYield) !== null ? q.dividendYield / 100 : null,
      change52w: num(q.fiftyTwoWeekChangePercent) !== null ? q.fiftyTwoWeekChangePercent / 100 : null,
      vs200d: num(q.twoHundredDayAverageChangePercent),
      analystRating: parseFloat(q.averageAnalystRating) || null,
    }));
  },
  ["quotes-v2"],
  { revalidate: 3600 }
);

// Company/ticker search: [{ symbol, name, quoteType }], equities and ETFs only.
export const searchCompanies = unstable_cache(
  async (text) => {
    const result = await retryNetwork(() =>
      withTimeout(
        yahooFinance.search(text, { quotesCount: 5, newsCount: 0 }),
        8_000,
        "Yahoo search"
      )
    );
    return result.quotes
      .filter((q) => q.symbol && ["EQUITY", "ETF"].includes(q.quoteType))
      .map((q) => ({ symbol: q.symbol, name: q.longname ?? q.shortname ?? "", quoteType: q.quoteType }));
  },
  ["search-companies-v1"],
  { revalidate: 7 * 24 * 3600 }
);

// "nvidia" / "Coca Cola" / "nvda" -> "NVDA".
export async function resolveTicker(text) {
  return (await searchCompanies(text))[0]?.symbol ?? null;
}

// Yahoo predefined screeners (see lib/candidates.js for which style uses which).
export const runScreener = unstable_cache(
  async (scrId, count = 25) => {
    const result = await withTimeout(
      yahooFinance.screener({ scrIds: scrId, count }),
      8_000,
      `Yahoo screener ${scrId}`
    );
    return result.quotes
      .filter((q) => q.quoteType === "EQUITY")
      .map((q) => q.symbol);
  },
  ["screener-v1"],
  { revalidate: 6 * 3600 }
);

// Recent headlines for one ticker from Yahoo search (no sentiment).
export const getYahooNews = unstable_cache(
  async (symbol) => {
    const result = await withTimeout(
      yahooFinance.search(symbol, { quotesCount: 0, newsCount: 20 }),
      8_000,
      `Yahoo news ${symbol}`
    );
    // Search results include general market news; keep articles tagged with this ticker.
    return (result.news ?? [])
      .filter((n) => (n.relatedTickers ?? []).includes(symbol))
      .slice(0, 6)
      .map((n) => ({
        title: n.title,
        url: n.link,
        publisher: n.publisher,
        publishedAt: new Date(n.providerPublishTime).toISOString(),
        tickers: n.relatedTickers ?? [],
      }));
  },
  ["yahoo-news-v2"],
  { revalidate: 3 * 3600 }
);

export { round, buildFactSheet };
