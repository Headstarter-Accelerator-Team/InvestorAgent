// Server-side replacements for the Flask backend (backend.py), so the app
// deploys to Vercel as a single Next.js project.
import { Pinecone } from "@pinecone-database/pinecone";
import YahooFinance from "yahoo-finance2";

export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const EMBEDDING_URL =
  "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-mpnet-base-v2/pipeline/feature-extraction";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function groqChat(messages, options = {}) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: GROQ_MODEL, messages, ...options }),
    }
  );
  if (!response.ok) {
    throw new Error(`Groq ${response.status}: ${await response.text()}`);
  }
  const result = await response.json();
  return result.choices[0].message.content;
}

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

export async function queryStocks(vector, topK) {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const results = await pc
    .index("stocks")
    .namespace("stocks")
    .query({ vector, topK, includeMetadata: true });
  return results.matches.map((match) => ({ ...match.metadata }));
}

export async function getStockInfo(symbol) {
  const summary = await yahooFinance.quoteSummary(symbol, {
    modules: ["price", "assetProfile"],
  });
  const price = summary.price ?? {};
  const profile = summary.assetProfile ?? {};
  return {
    Ticker: price.symbol ?? "N/A",
    Name: price.longName ?? "N/A",
    "Business Summary": profile.longBusinessSummary ?? "N/A",
    City: profile.city ?? "N/A",
    State: profile.state ?? "N/A",
    Country: profile.country ?? "N/A",
    Industry: profile.industry ?? "N/A",
    Sector: profile.sector ?? "N/A",
  };
}

// Live Alpha Vantage news, formatted like the DataFrame backend.py built.
// Returns null when there is no key or the API refuses (e.g. daily limit).
export async function fetchNewsTable() {
  const key = process.env.ALPHA_VAN_API;
  if (!key) return null;
  const response = await fetch(
    `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=TSLA&limit=100&apikey=${key}`
  );
  const data = await response.json();
  if (!Array.isArray(data.feed)) {
    console.error("Alpha Vantage returned no feed:", data);
    return null;
  }
  const rows = data.feed.flatMap((entry) =>
    (entry.ticker_sentiment ?? []).map((t) => ({
      title: entry.title,
      url: entry.url,
      time_published: entry.time_published,
      overall_sentiment_score: entry.overall_sentiment_score,
      overall_sentiment_label: entry.overall_sentiment_label,
      ticker: t.ticker,
      ticker_relevance_score: Number(t.relevance_score),
      ticker_sentiment_score: t.ticker_sentiment_score,
      ticker_sentiment_label: t.ticker_sentiment_label,
    }))
  );
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.ticker_relevance_score - a.ticker_relevance_score);
  return [Object.keys(rows[0]), ...rows.slice(0, 35).map(Object.values)]
    .map((cells) => cells.join(" | "))
    .join("\n");
}
