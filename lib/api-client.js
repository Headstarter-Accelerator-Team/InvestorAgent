// Browser-side fetch wrapper: timeouts, and errors turned into messages a
// user can act on (never "Unexpected token '<'").

function messageForStatus(status) {
  if (status === 504 || status === 408) return "The request took too long. Please try again.";
  if (status === 429) return "Too many requests right now. Please wait a minute and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return `Request failed (${status}).`;
}

export async function requestJSON(url, { method = "GET", body, timeoutMs = 30_000 } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error("This is taking longer than expected. Please try again.");
    }
    throw new Error(
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "You appear to be offline. Check your connection and try again."
        : "Couldn't reach the server. Check your connection and try again."
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body (e.g. a platform error page); handled below.
  }
  if (!response.ok) throw new Error(data?.error ?? messageForStatus(response.status));
  if (data === null) throw new Error("The server sent an unexpected response. Please try again.");
  return data;
}
