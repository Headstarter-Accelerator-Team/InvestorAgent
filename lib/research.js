// Recent company developments from Tavily web search. Off unless
// TAVILY_API_KEY is set. Free tier is 1,000 searches/month, so results are
// cached per ticker for 12 hours and only fetched for the final picks.
import { unstable_cache } from "next/cache";

const MAX_RESULTS = 3;

const search = unstable_cache(
  async (ticker, name) => {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${name} (${ticker}) stock news`,
        topic: "news",
        days: 30,
        max_results: MAX_RESULTS,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Tavily ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    const data = await response.json();
    return (data.results ?? []).slice(0, MAX_RESULTS).map((r) => ({
      title: r.title,
      url: r.url,
      source: (() => {
        try {
          return new URL(r.url).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      })(),
      publishedAt: r.published_date ?? null,
      snippet: (r.content ?? "").replace(/\s+/g, " ").slice(0, 280),
    }));
  },
  ["tavily-developments-v1"],
  { revalidate: 12 * 3600 }
);

// Never throws: developments are context, not core data.
export async function getDevelopmentsSafe(ticker, name) {
  if (!process.env.TAVILY_API_KEY) return [];
  try {
    return await search(ticker, name);
  } catch (error) {
    console.warn(`Tavily search failed for ${ticker}:`, error.message);
    return [];
  }
}
