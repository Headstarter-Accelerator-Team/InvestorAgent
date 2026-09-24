import { NextResponse } from "next/server";
import { getNews } from "@/lib/news";

// GET /api/news-sentiment?tickers=NVDA,KO
export async function GET(req) {
  const tickers = [
    ...new Set(
      (req.nextUrl.searchParams.get("tickers") ?? "")
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z.\-]{1,6}$/.test(t))
    ),
  ].slice(0, 5);
  if (tickers.length === 0) {
    return NextResponse.json({ error: "Pass ?tickers=AAPL,MSFT" }, { status: 400 });
  }

  // One ticker's news failing shouldn't blank the others.
  const settled = await Promise.allSettled(tickers.map((t) => getNews(t)));
  const data = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    console.error(`News failed for ${tickers[i]}:`, r.reason);
    return { ticker: tickers[i], source: null, articles: [], error: "News is temporarily unavailable." };
  });
  return NextResponse.json({ data });
}
