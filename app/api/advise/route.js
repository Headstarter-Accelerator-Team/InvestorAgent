import { NextResponse } from "next/server";
import { advise } from "@/lib/advisor";

export const maxDuration = 60;

export async function POST(req) {
  const { question, style, sector, size } = await req.json();
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  }
  console.log("Advise:", question, style, sector, size);

  try {
    const result = await advise({
      question: question.trim().slice(0, 500),
      style,
      sector,
      size,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Advise failed:", error);
    return NextResponse.json(
      { error: "Couldn't complete the analysis. Please try again." },
      { status: 500 }
    );
  }
}
