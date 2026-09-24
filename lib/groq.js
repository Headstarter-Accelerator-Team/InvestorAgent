// Groq chat client tuned for the free tier (8k tokens/min per model):
// calls are serialized per instance and 429s are retried after the delay
// Groq asks for, instead of failing the request.

export const MODELS = {
  fast: process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b",
  smart: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
};

// Default budget for waiting out 429s; callers pass less when they have a fallback.
const DEFAULT_MAX_WAIT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 25_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "Please try again in 35.1525s" / retry-after header -> ms
function retryDelayMs(response, body) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header * 1000;
  const match = body.match(/try again in ([\d.]+)(ms|s)/);
  if (match) return Number(match[1]) * (match[2] === "ms" ? 1 : 1000);
  return 5000;
}

export class GroqError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GroqError";
    this.status = status;
  }
}

async function callGroq(messages, { model, maxWaitMs = DEFAULT_MAX_WAIT_MS, ...options }) {
  if (!process.env.GROQ_API_KEY) throw new GroqError("GROQ_API_KEY is not set", 500);
  let waited = 0;
  for (;;) {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, ...options }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    if (response.ok) {
      const result = await response.json();
      console.log(`groq ${model} usage`, result.usage, result.choices[0].finish_reason);
      return {
        content: result.choices[0].message.content,
        usage: result.usage,
      };
    }
    const body = await response.text();
    if (response.status === 429) {
      const delay = retryDelayMs(response, body) + 250;
      if (waited + delay <= maxWaitMs) {
        console.warn(`groq 429, retrying in ${Math.round(delay)}ms`);
        await sleep(delay);
        waited += delay;
        continue;
      }
    }
    throw new GroqError(`Groq ${response.status}: ${body.slice(0, 300)}`, response.status);
  }
}

let queue = Promise.resolve();

// One Groq call at a time per server instance.
export function groqChat(messages, { model = MODELS.smart, ...options } = {}) {
  const run = queue.then(() => callGroq(messages, { model, ...options }));
  queue = run.catch(() => {});
  return run;
}

// JSON-mode call that returns the parsed object. Groq occasionally rejects
// its own output as invalid JSON (json_validate_failed); retry once.
export async function groqJSON(messages, options = {}) {
  const request = () =>
    groqChat(messages, {
      response_format: { type: "json_object" },
      reasoning_effort: "low",
      ...options,
    });
  let result;
  try {
    result = await request();
  } catch (error) {
    if (!/json_validate_failed/.test(error.message)) throw error;
    console.warn("groq json_validate_failed, retrying once");
    result = await request();
  }
  try {
    return { data: JSON.parse(result.content), usage: result.usage };
  } catch {
    throw new GroqError("Groq returned malformed JSON", 502);
  }
}
