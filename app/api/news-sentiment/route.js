import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { NEWS_SNAPSHOT, NEWS_SYSTEM_PROMPT } from "@/lib/news-prompt";
import { fetchNewsTable, groqChat } from "@/lib/server";

export const dynamic = "force-dynamic";

// Each call uses ~5.5k Groq tokens (free tier: 8k/min) and Alpha Vantage's
// free tier allows 25 calls/day, so cache the analysis for an hour.
// Errors are thrown, so they are not cached.
const getNewsSentiment = unstable_cache(
  async () => {
    const query = (await fetchNewsTable()) ?? NEWS_SNAPSHOT;
    return groqChat(
      [
        { role: "system", content: NEWS_SYSTEM_PROMPT },
        { role: "user", content: query },
      ],
      { response_format: { type: "json_object" } }
    );
  },
  ["news-sentiment"],
  { revalidate: 3600 }
);

export async function GET(req) {
  try {
    const result = await getNewsSentiment();

    console.log(result);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Failed to fetch news sentiment.", error);
    return NextResponse.json(
      { error: "Failed to fetch news sentiment." },
      { status: 500 }
    );
  }
}
