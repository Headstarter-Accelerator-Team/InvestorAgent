import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const environment = process.env.NODE_ENV;
    const url =
      environment === "production"
        ? "https://production-flask-api.com"
        : "http://127.0.0.1:5000";
    const response = await fetch(`${url}/news-sentiment`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.error(
        new Error(`Response status: ${response.status}`)
      );
    }

    const result = await response.json();
    console.log(result);
    return NextResponse.json({ data: result });
  } catch {
    console.error("Failed to fetch news sentiment.");
    return NextResponse.error(new Error("Failed to fetch news sentiment."));
  }
}
