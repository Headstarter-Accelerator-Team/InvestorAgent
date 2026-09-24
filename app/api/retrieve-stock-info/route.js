import { NextResponse } from "next/server";
import { getFactSheet, resolveTicker } from "@/lib/market";
import { scoreStock } from "@/lib/score";

export async function POST(req) {
  const data = await req.json();
  const symbol = String(data.symbol ?? "").trim();
  console.log("User searched: ", symbol);
  if (!symbol) {
    return NextResponse.json({ error: "Enter a ticker." }, { status: 400 });
  }

  try {
    const ticker = /^[A-Za-z.\-]{1,6}$/.test(symbol)
      ? symbol.toUpperCase()
      : await resolveTicker(symbol);
    if (!ticker) {
      return NextResponse.json({ error: `No stock found for "${symbol}".` }, { status: 404 });
    }
    const fact = await getFactSheet(ticker);
    return NextResponse.json({
      ...fact,
      score: scoreStock(fact, "balanced"),
      // Fields the original UI reads.
      Ticker: fact.ticker,
      Name: fact.name,
      "Business Summary": fact.summary ?? "N/A",
      City: fact.city ?? "N/A",
      State: fact.state ?? "N/A",
      Country: fact.country ?? "N/A",
      Industry: fact.industry ?? "N/A",
      Sector: fact.sector ?? "N/A",
    });
  } catch (error) {
    console.error("Error fetching stock info:", error);
    const notFound = /not found/i.test(error.message);
    return NextResponse.json(
      { error: notFound ? `No stock found for "${symbol}".` : "Failed to fetch stock info." },
      { status: notFound ? 404 : 500 }
    );
  }
}
