import { NextResponse } from "next/server";

export async function POST(req) {
  const data = await req.json();
  const query = data.query;
  const top_k = data.top_k;
  console.log("User searched: ", query);
  console.log("Top K: ", top_k);
  try {
    const environment = process.env.NODE_ENV;
    const url =
      environment === "production"
        ? "https://production-flask-api.com"
        : "http://127.0.0.1:5000";

    const response = await fetch(`${url}/query-pinecone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: query, top_k: 3 }),
    });

    if (!response.ok) {
      return NextResponse.error(
        new Error(`Response status: ${response.status}`)
      );
    }

    const result = await response.json();

    console.log(result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch: ", error);
    return NextResponse.error(new Error("Failed to fetch matches for query."));
  }
}
