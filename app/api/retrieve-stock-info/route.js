import { NextResponse } from "next/server";
import { getStockInfo } from "@/lib/server";

export async function POST(req) {
  const data = await req.json();
  const symbol = data.symbol;
  console.log("User searched: ", symbol);

  try {
    const result = await getStockInfo(symbol);

    console.log(result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching stock info:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock info." },
      { status: 500 }
    );
  }
}
