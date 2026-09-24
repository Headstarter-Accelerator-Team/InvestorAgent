// Semantic company search: Hugging Face embeddings + Pinecone.
import { Pinecone } from "@pinecone-database/pinecone";

const EMBEDDING_URL =
  "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-mpnet-base-v2/pipeline/feature-extraction";

// Same model the Pinecone "stocks" index was built with (768 dims).
export async function embed(text) {
  const response = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });
  if (!response.ok) {
    throw new Error(
      `Hugging Face ${response.status}: ${await response.text()}`
    );
  }
  return response.json();
}

// Namespaces in the "stocks" index: "stocks" (796 companies with full
// descriptions) and "stock-descriptions" (14k, many with one-line text).
export async function queryStocks(vector, topK, namespace = "stocks") {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const results = await pc
    .index("stocks")
    .namespace(namespace)
    .query({ vector, topK, includeMetadata: true });
  return results.matches.map((match) => ({ ...match.metadata, _score: match.score }));
}
