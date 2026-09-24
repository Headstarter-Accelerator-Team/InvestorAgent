// Shared error helpers for API routes and upstream calls.
import { NextResponse } from "next/server";

export class TimeoutError extends Error {
  constructor(label, ms) {
    super(`${label} timed out after ${ms / 1000}s`);
    this.name = "TimeoutError";
  }
}

// Rejects if the promise doesn't settle in time. Used for SDK calls that
// don't accept an AbortSignal (Yahoo Finance, Pinecone).
export function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// An error whose message is safe to show the user, with the HTTP status to use.
export class ServiceError extends Error {
  constructor(message, status = 503, cause) {
    super(message, { cause });
    this.name = "ServiceError";
    this.status = status;
  }
}

export const jsonError = (message, status) =>
  NextResponse.json({ error: message }, { status });

// Parses a JSON request body; returns null (instead of throwing) if it's
// missing or malformed so routes can answer 400.
export async function readJSON(req) {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}
