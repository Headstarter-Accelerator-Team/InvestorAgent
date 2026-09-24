import { NextResponse } from "next/server";
import { embed, groqChat, queryStocks } from "@/lib/server";

export async function POST(req) {
  const data = await req.json();
  const query = data.query;
  const top_k = data.top_k;
  console.log("User searched: ", query);
  console.log("Top K: ", top_k);
  try {
    const queryEmbedding = await embed(query);
    const contexts = await queryStocks(queryEmbedding, Number(top_k) || 3);

    // Augment the query for LLM
    const contextsStr = contexts
      .slice(0, 5)
      .map((context) =>
        Object.entries(context)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n")
      )
      .join("\n\n-------\n\n");
    const augmentedQuery = `<CONTEXT>\n${contextsStr}\n</CONTEXT>\n\nMY QUESTION:\n${query}`;

    const systemPrompt =
      "You are an expert in financial stock analysis. Use the given context to " +
      "answer the question provided in the format:\n\n" +
      "<Company Name> (<Ticker>): <Answer>";

    const llmAnswer = await groqChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: augmentedQuery },
    ]);

    return NextResponse.json({
      query,
      pinecone_results: contexts,
      llm_response: llmAnswer,
    });
  } catch (error) {
    console.error("Failed to fetch: ", error);
    return NextResponse.json(
      { error: "Failed to fetch matches for query." },
      { status: 500 }
    );
  }
}
