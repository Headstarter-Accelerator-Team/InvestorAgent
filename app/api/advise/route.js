import { NextResponse } from "next/server";
import { advise } from "@/lib/advisor";
import { jsonError, readJSON, ServiceError } from "@/lib/errors";

export const maxDuration = 60;

export async function POST(req) {
  const body = await readJSON(req);
  if (!body) return jsonError("Request body must be JSON.", 400);
  const { question, style, sector, size } = body;
  if (typeof question !== "string" || !question.trim()) {
    return jsonError("Ask a question.", 400);
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
    if (error instanceof ServiceError) return jsonError(error.message, error.status);
    return jsonError("Couldn't complete the analysis. Please try again.", 500);
  }
}
