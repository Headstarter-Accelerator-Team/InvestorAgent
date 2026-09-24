import { NextResponse } from "next/server";
import { advise } from "@/lib/advisor";

export const maxDuration = 60;

// Legacy endpoint kept for older clients; the UI uses /api/advise.
export async function POST(req) {
  const { query } = await req.json();
  try {
    const result = await advise({ question: String(query ?? "").slice(0, 500) });
    return NextResponse.json({
      query,
      pinecone_results: result.picks.map((p) => ({
        Ticker: p.ticker,
        Name: p.name,
        Sector: p.sector,
        Industry: p.industry,
        "Business Summary": p.summary,
      })),
      llm_response: result.summary ?? "",
    });
  } catch (error) {
    console.error("Failed to fetch: ", error);
    return NextResponse.json(
      { error: "Failed to fetch matches for query." },
      { status: 500 }
    );
  }
}
