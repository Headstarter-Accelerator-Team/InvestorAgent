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

  try {
    const data = await Promise.all(tickers.map((t) => getNews(t)));
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to fetch news.", error);
    return NextResponse.json({ error: "Failed to fetch news." }, { status: 500 });
  }
}
