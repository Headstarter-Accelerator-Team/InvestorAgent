// Recent news per ticker. Alpha Vantage (with sentiment) when ALPHA_VAN_API
// is set; Yahoo headlines otherwise or when Alpha Vantage's free tier
// (25 calls/day) is exhausted.
import { unstable_cache } from "next/cache";
import { getYahooNews } from "@/lib/market";

const parseAvTime = (t) =>
  new Date(
    `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:${t.slice(13, 15)}Z`
  ).toISOString();

// The free tier rejects bursts (max 1 request/second), so calls are queued
// and spaced out. Cache hits never reach the queue.
const AV_SPACING_MS = 1500;
let avQueue = Promise.resolve();
let lastAvCall = 0;

function throttled(fn) {
  const run = avQueue.then(async () => {
    const wait = lastAvCall + AV_SPACING_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAvCall = Date.now();
    return fn();
  });
  avQueue = run.catch(() => {});
  return run;
}

// Cached 12h per ticker so the daily quota covers ~12 distinct tickers a day.
const getAlphaVantageNews = unstable_cache(
  async (ticker) => {
    const request = () =>
      throttled(() =>
        fetch(
          `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(ticker)}&limit=20&sort=LATEST&apikey=${process.env.ALPHA_VAN_API}`,
          { signal: AbortSignal.timeout(8_000) }
        ).then((r) => r.json())
      );
    let data = await request();
    // Burst rejection ("1 request per second"): one more try through the queue.
    if (!Array.isArray(data.feed) && /per second/i.test(data.Information ?? "")) {
      data = await request();
    }
    // Rate-limit and error responses have no feed; throwing keeps them out of the cache.
    if (!Array.isArray(data.feed)) {
      throw new Error(data.Information || data.Note || "Alpha Vantage returned no feed");
    }
    return data.feed.slice(0, 6).map((item) => {
      const t = item.ticker_sentiment?.find((s) => s.ticker === ticker);
      return {
        title: item.title,
        url: item.url,
        publisher: item.source,
        publishedAt: parseAvTime(item.time_published),
        sentiment: t
          ? { label: t.ticker_sentiment_label, score: Number(t.ticker_sentiment_score) }
          : null,
      };
    });
  },
  ["av-news-v1"],
  { revalidate: 12 * 3600 }
);

export async function getNews(ticker) {
  if (process.env.ALPHA_VAN_API) {
    try {
      return { ticker, source: "Alpha Vantage", articles: await getAlphaVantageNews(ticker) };
    } catch (error) {
      console.warn(`Alpha Vantage news failed for ${ticker}:`, error.message);
    }
  }
  // Let Yahoo failures propagate so the route can say news is unavailable
  // (rather than implying there is no news).
  return { ticker, source: "Yahoo Finance", articles: await getYahooNews(ticker) };
}
