import { NextResponse } from "next/server";

export async function POST(req) {
  const data = await req.json();
  const symbol = data.symbol;
  console.log("User searched: ", symbol);

  try {
    const environment = process.env.NODE_ENV;
    const url =
      environment === "production"
        ? "https://production-flask-api.com"
        : "http://127.0.0.1:5000";

    const response = await fetch(`${url}/stock-info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ symbol: symbol }),
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
    console.error("Error fetching stock info:", error);
    return NextResponse.error(new Error("Failed to fetch stock info."));
  }
}
