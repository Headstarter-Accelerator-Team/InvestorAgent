import { NextResponse } from "next/server";
import { jsonError, readJSON } from "@/lib/errors";
import { getFactSheet, resolveTicker } from "@/lib/market";
import { scoreWithModel } from "@/lib/scoring-models";

export async function POST(req) {
  const data = await readJSON(req);
  if (!data) return jsonError("Request body must be JSON.", 400);
  const symbol = String(data.symbol ?? "").trim().slice(0, 100);
  console.log("User searched: ", symbol);
  if (!symbol) return jsonError("Enter a ticker or company name.", 400);

  let ticker;
  try {
    ticker = /^[A-Za-z.\-]{1,6}$/.test(symbol)
      ? symbol.toUpperCase()
      : await resolveTicker(symbol);
  } catch (error) {
    console.error("Ticker search failed:", error);
    return jsonError("Stock search is temporarily unavailable. Please try again in a minute.", 503);
  }
  if (!ticker) return jsonError(`No stock found for "${symbol}".`, 404);

  try {
    const fact = await getFactSheet(ticker);
    return NextResponse.json({
      ...fact,
      score: scoreWithModel(fact, "balanced", data.model),
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
    if (/not found/i.test(error.message)) {
      return jsonError(`No stock found for "${symbol}".`, 404);
    }
    return jsonError("Market data is temporarily unavailable. Please try again in a minute.", 503);
  }
}
