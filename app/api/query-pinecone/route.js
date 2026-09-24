import { NextResponse } from "next/server";
import { advise } from "@/lib/advisor";
import { jsonError, readJSON, ServiceError } from "@/lib/errors";

export const maxDuration = 60;

// Legacy endpoint kept for older clients; the UI uses /api/advise.
export async function POST(req) {
  const body = await readJSON(req);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) return jsonError("Request body must be JSON with a \"query\" string.", 400);

  try {
    const result = await advise({ question: query.slice(0, 500) });
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
    if (error instanceof ServiceError) return jsonError(error.message, error.status);
    return jsonError("Failed to fetch matches for query.", 500);
  }
}
