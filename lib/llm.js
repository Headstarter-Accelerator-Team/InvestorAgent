// Free-tier LLM chain. Every provider here is used on its free tier only
// (no paid models, no credits): when one hits its rate or daily limit, the
// request moves to the next and the limited provider is skipped until its
// cooldown ends. Providers without a key are ignored.
//
//   GROQ_API_KEY        Groq free tier (gpt-oss-120b / gpt-oss-20b)
//   CEREBRAS_API_KEY    Cerebras free tier (gpt-oss-120b)          optional
//   GEMINI_API_KEY      Google AI Studio free tier (Gemini Flash)  optional
//   OPENROUTER_API_KEY  OpenRouter ":free" models only             optional

const PROVIDERS = [
  {
    id: "groq-120b",
    label: "Groq · gpt-oss-120b",
    base: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    reasoning: true,
  },
  {
    id: "cerebras",
    label: "Cerebras · gpt-oss-120b",
    base: "https://api.cerebras.ai/v1",
    keyEnv: "CEREBRAS_API_KEY",
    model: "gpt-oss-120b",
    reasoning: true,
  },
  {
    id: "gemini-flash",
    label: "Gemini Flash",
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    model: "gemini-flash-latest",
    reasoning: true,
    // Gemini's "thinking" tokens count against max_tokens: keep it low and
    // add headroom so JSON answers aren't cut off.
    maxEffort: "low",
    extraTokens: 4096,
  },
  {
    id: "groq-20b",
    label: "Groq · gpt-oss-20b",
    base: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    model: process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b",
    reasoning: true,
  },
  {
    id: "gemini-flash-lite",
    label: "Gemini Flash-Lite",
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    model: "gemini-flash-lite-latest",
    reasoning: false,
    extraTokens: 2048,
  },
  {
    id: "openrouter-free",
    label: "OpenRouter · gpt-oss-120b (free)",
    base: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    model: "openai/gpt-oss-120b:free", // ":free" variants never use credits
    reasoning: true,
  },
];

const REQUEST_TIMEOUT_MS = 25_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class LLMError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "LLMError";
    this.status = status;
  }
}

// provider id -> timestamp until which it's skipped
const cooldownUntil = new Map();
// key env var -> timestamp; a rejected key parks every provider using it
const badKeyUntil = new Map();

function retryAfterMs(response, body) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header * 1000;
  const m = body.match(/try again in (?:(\d+)m)?([\d.]+)(ms|s)/);
  if (m) return (Number(m[1] ?? 0) * 60 + Number(m[2]) / (m[3] === "ms" ? 1000 : 1)) * 1000;
  // Daily quotas without a hint: back off for a while.
  return /per day|daily|quota/i.test(body) ? 30 * 60_000 : 60_000;
}

async function callProvider(p, messages, { json, maxTokens, effort }) {
  const body = {
    model: p.model,
    messages,
    max_tokens: maxTokens + (p.extraTokens ?? 0),
    ...(json ? { response_format: { type: "json_object" } } : {}),
    ...(p.reasoning && effort ? { reasoning_effort: p.maxEffort ?? effort } : {}),
  };
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${p.base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env[p.keyEnv]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    if (response.ok) {
      const data = JSON.parse(text);
      const content = data.choices?.[0]?.message?.content;
      console.log(`llm ${p.id} usage`, data.usage, data.choices?.[0]?.finish_reason);
      if (!content) throw new LLMError(`${p.id} returned an empty answer`, 502);
      return content;
    }
    if (response.status === 429) {
      const wait = retryAfterMs(response, text);
      // A short per-minute wait is worth it once; anything longer, move on.
      if (wait <= 3_000 && attempt === 0) {
        await sleep(wait + 250);
        continue;
      }
      cooldownUntil.set(p.id, Date.now() + wait);
      throw new LLMError(`${p.id} rate-limited for ${Math.round(wait / 1000)}s`, 429);
    }
    if (response.status === 402) {
      // "Payment required": never fall into paid usage; park this provider.
      cooldownUntil.set(p.id, Date.now() + 6 * 3600_000);
      throw new LLMError(`${p.id} requires credits; skipped`, 402);
    }
    if (response.status === 401 || response.status === 403) {
      badKeyUntil.set(p.keyEnv, Date.now() + 3600_000);
    }
    throw new LLMError(`${p.id} ${response.status}: ${text.slice(0, 200)}`, response.status);
  }
}

export function availableProviders() {
  return PROVIDERS.filter((p) => process.env[p.keyEnv]);
}

// Runs the request down the free-provider chain. Returns { content, provider }.
export async function llmChat(messages, { json = false, maxTokens = 2000, effort = "low", tier = "smart" } = {}) {
  let providers = availableProviders();
  if (providers.length === 0) throw new LLMError("No LLM provider key is configured", 500);
  // Light tasks (intent parsing) start with the small, fast models.
  if (tier === "fast") {
    const order = ["groq-20b", "gemini-flash-lite", "gemini-flash", "cerebras", "groq-120b", "openrouter-free"];
    providers = [...providers].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }
  const errors = [];
  for (const p of providers) {
    if ((cooldownUntil.get(p.id) ?? 0) > Date.now() || (badKeyUntil.get(p.keyEnv) ?? 0) > Date.now()) {
      errors.push(`${p.id} cooling down`);
      continue;
    }
    try {
      const content = await callProvider(p, messages, { json, maxTokens, effort });
      if (json) JSON.parse(content); // malformed JSON -> try the next provider
      return { content, provider: p.label };
    } catch (error) {
      console.warn(`llm ${p.id} failed: ${error.message}`);
      errors.push(error.message);
    }
  }
  const allLimited = errors.every((e) => /rate-limited|cooling down|requires credits/.test(e));
  throw new LLMError(`All free LLM providers failed: ${errors.join("; ")}`, allLimited ? 429 : 502);
}

export async function llmJSON(messages, options = {}) {
  const { content, provider } = await llmChat(messages, { ...options, json: true });
  return { data: JSON.parse(content), provider };
}
