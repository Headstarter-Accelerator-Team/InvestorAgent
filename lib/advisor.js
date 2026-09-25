// The advisor pipeline: question -> intent -> scored candidates -> grounded
// LLM analysis. Numbers are computed in code; the LLM only explains them.
import { unstable_cache } from "next/cache";
import { findCandidates, SECTORS } from "@/lib/candidates";
import { groqJSON, MODELS } from "@/lib/groq";
import { STYLES } from "@/lib/score";
import { fmt } from "@/lib/format";
import { getMacroSafe, macroText } from "@/lib/macro";
import { getDevelopmentsSafe } from "@/lib/research";
import { getFilingsSafe } from "@/lib/sec";
import { DEFAULT_MODEL, SCORING_MODELS, modelGuide, stanceFromScore } from "@/lib/scoring-models";

export const DISCLAIMER =
  "For education and research only, not financial advice. Market data from Yahoo Finance, delayed ~15 minutes. Do your own research and consider your own situation before investing.";

// ---------- conversation ----------

const MAX_TURNS = 3;
const TICKER_RE = /^[A-Z][A-Z.\-]{0,5}$/;

// Validates client-sent history: last few turns, trimmed, tickers checked.
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((t) => t && typeof t.question === "string" && t.question.trim())
    .slice(-MAX_TURNS)
    .map((t) => ({
      question: t.question.trim().slice(0, 300),
      summary: typeof t.summary === "string" ? t.summary.slice(0, 600) : "",
      tickers: Array.isArray(t.tickers)
        ? t.tickers.filter((x) => typeof x === "string" && TICKER_RE.test(x)).slice(0, 5)
        : [],
      style: STYLES.includes(t.intent?.style) ? t.intent.style : null,
      sector: SECTORS.includes(t.intent?.sector) ? t.intent.sector : null,
      theme: typeof t.intent?.theme === "string" ? t.intent.theme.slice(0, 60) : null,
      size: ["small", "mid", "large"].includes(t.intent?.size) ? t.intent.size : null,
    }));
}

// Compact transcript for the prompts (~60-150 tokens per turn).
function conversationText(history) {
  return history
    .map((t, i) => {
      const filters = [
        t.style && `style=${t.style}`,
        t.sector && `sector=${t.sector}`,
        t.theme && `theme=${t.theme}`,
        t.size && `size=${t.size}`,
      ].filter(Boolean).join(", ");
      return [
        `Turn ${i + 1} question: ${t.question}`,
        filters && `Turn ${i + 1} filters: ${filters}`,
        t.tickers.length && `Turn ${i + 1} results (in order): ${t.tickers.join(", ")}`,
        t.summary && `Turn ${i + 1} answer: ${t.summary.slice(0, 300)}`,
      ].filter(Boolean).join("\n");
    })
    .join("\n\n");
}

// ---------- intent ----------

const STYLE_KEYWORDS = [
  ["dividend", /dividend|income|yield|passive/i],
  ["safe", /safe|low[- ]risk|conservative|retire|stable|defensive/i],
  ["speculative", /speculative|high[- ]risk|moonshot|penny|small[- ]cap|aggressive/i],
  ["value", /value|cheap|undervalued|bargain/i],
  ["growth", /growth|growing|fast|innovative/i],
];

const SECTOR_KEYWORDS = [
  ["Technology", /\b(tech|technology|software|semiconductor|chip)s?\b/i],
  ["Healthcare", /\b(health ?care|pharma|biotech|medical|drug)s?\b/i],
  ["Financial Services", /\b(bank|financial|insurance|insurer|fintech)s?\b/i],
  ["Energy", /\b(energy|oil|gas)\b/i],
  ["Utilities", /\butilit(y|ies)\b/i],
  ["Real Estate", /\b(real estate|reits?)\b/i],
  ["Consumer Defensive", /\b(consumer staples|grocery|groceries|beverage)s?\b/i],
  ["Industrials", /\b(industrial|aerospace|defen[cs]e|railroad)s?\b/i],
  ["Communication Services", /\b(telecom|media|social media)s?\b/i],
  ["Basic Materials", /\b(mining|miner|materials|chemical|gold)s?\b/i],
];

// Words that start questions or are common capitalised non-companies.
const NOT_COMPANIES = new Set(
  "i a an the is are am was should would could can will do does did what which who how why when where " +
    "compare vs versus and or best top good buy sell hold stock stocks share shares invest investing " +
    "ai ev us usa etf etfs ipo ceo roi s&p nasdaq dow " +
    "safe safest cheap cheapest low high best good great top new blue undervalued growth value " +
    "dividend dividends income conservative aggressive speculative retirement retiree long short".split(" ")
);

// Keyword fallback used when the intent model is unavailable. Capitalised
// words and tickers are treated as possible companies; the ticker search in
// candidates.js confirms or rejects them.
function heuristicIntent(question, history = []) {
  const last = history.at(-1);
  if (last?.tickers.length && /\b(these|those|them|they|it|its|their|the (first|second|third|top|last) (one|pick|stock))\b/i.test(question)) {
    const style = STYLE_KEYWORDS.find(([, re]) => re.test(question))?.[0] ?? last.style ?? "balanced";
    return { relevant: true, companies: last.tickers, style, sector: null, theme: null, themeTickers: [], size: null, horizon: null, fallback: true };
  }
  const companies = [
    ...new Set(
      [...question.matchAll(/\$?\b([A-Z][A-Za-z&.-]{1,20})\b/g)]
        // A capitalised first word is usually just the start of the sentence.
        .filter((m) => m.index > 0 || /^\$?[A-Z]{1,5}$/.test(m[0]))
        .map((m) => m[1])
        .filter((w) => !NOT_COMPANIES.has(w.toLowerCase()))
    ),
  ].slice(0, 5);
  const style = STYLE_KEYWORDS.find(([, re]) => re.test(question))?.[0] ?? "balanced";
  const sector = SECTOR_KEYWORDS.find(([, re]) => re.test(question))?.[0] ?? null;
  const size = /small[- ]cap/i.test(question) ? "small" : /mid[- ]cap/i.test(question) ? "mid" : /large[- ]cap|blue[- ]chip/i.test(question) ? "large" : null;
  return { relevant: true, companies, style, sector, theme: null, themeTickers: [], size, horizon: null, fallback: true };
}

const INTENT_PROMPT = `You classify a stock-investing question. Return ONLY JSON:
{"relevant": boolean, "companies": string[], "style": string, "sector": string|null, "theme": string|null, "themeTickers": string[], "size": "small"|"mid"|"large"|null, "horizon": "short"|"medium"|"long"|null}
- relevant: false if the text is not a question about stocks, companies or investing (gibberish, unrelated topics).
- companies: companies or tickers the user names explicitly (e.g. "Nvidia", "AAPL"). Empty if none.
- style: one of ${STYLES.join(", ")}. Map risk words: retirement/low risk -> safe, income -> dividend, high risk/young/aggressive -> growth or speculative, cheap/undervalued -> value. Default balanced.
- sector: one of ${SECTORS.join(", ")} if the question targets a sector, else null.
- theme: a short search phrase for a specific theme or product area (e.g. "AI chips", "electric vehicles", "cybersecurity", "GLP-1 obesity drugs"), else null. Do not repeat the sector name as a theme.
- themeTickers: if theme is set, up to 8 US-listed tickers of the best-known public companies most exposed to it (leaders first). Empty otherwise.
- size: company size if asked for (small cap, mid cap, large cap / blue chip), else null.
- horizon: investing horizon if stated or implied, else null.

If an EARLIER CONVERSATION is provided, the new question may be a follow-up:
- If it refers to earlier results ("these", "them", "it", "the second one", "which of those is safest", "tell me more about Nvidia"), put the referenced tickers from the conversation in companies: all of the latest results for "these/them/which of these", or the specific ones it points to ("the second one" = the 2nd ticker in the latest results).
- If it changes the search ("what about healthcare instead", "only small caps", "cheaper ones"), keep companies empty and carry over the previous turn's style/sector/theme/themeTickers/size except what the new question changes.
- If it's an unrelated new question, ignore the conversation.
- If the follow-up ranks earlier results by a criterion, set style to match: safest/least risky -> safe, cheapest/best value -> value, fastest growing -> growth, best income/dividend -> dividend.
- A short follow-up like "why?" or "which is safest?" is still relevant.`;

// Cached per question. Throws on failure so outages aren't cached.
const parseIntentWithModel = unstable_cache(
  async (question, model, context) => {
    const { data } = await groqJSON(
      [
        { role: "system", content: INTENT_PROMPT },
        {
          role: "user",
          content: context ? `EARLIER CONVERSATION:\n${context}\n\nNEW QUESTION: ${question}` : question,
        },
      ],
      // Short wait budget: there are fallbacks.
      { model, max_completion_tokens: 700, maxWaitMs: 8_000 }
    );
    return {
      relevant: data.relevant !== false,
      companies: Array.isArray(data.companies) ? data.companies.slice(0, 5) : [],
      style: STYLES.includes(data.style) ? data.style : "balanced",
      sector: SECTORS.includes(data.sector) ? data.sector : null,
      theme: typeof data.theme === "string" && data.theme.trim() ? data.theme.trim() : null,
      // Suggestions only: every ticker still has to pass live data + filters.
      themeTickers: Array.isArray(data.themeTickers)
        ? data.themeTickers.filter((t) => typeof t === "string" && /^[A-Z.]{1,5}$/.test(t)).slice(0, 8)
        : [],
      size: ["small", "mid", "large"].includes(data.size) ? data.size : null,
      horizon: ["short", "medium", "long"].includes(data.horizon) ? data.horizon : null,
    };
  },
  ["intent-v7"],
  { revalidate: 24 * 3600 }
);

// The larger model gives much better theme suggestions; the small one has
// its own rate limits, so it's the fallback when the large one is exhausted.
export async function parseIntent(question, history = []) {
  const context = history.length ? conversationText(history) : "";
  for (const model of [MODELS.smart, MODELS.fast]) {
    try {
      return await parseIntentWithModel(question, model, context);
    } catch (error) {
      console.error(`intent parse failed on ${model}`, error.message);
      if (error.status !== 429) break;
    }
  }
  return heuristicIntent(question, history);
}

// ---------- fact table ----------

function factBlock({ fact: f, score, filings = [], developments = [] }) {
  const fcfMargin = f.freeCashflow !== null && f.revenue ? f.freeCashflow / f.revenue : null;
  const factors = Object.values(score.factors)
    .map((x) => `${x.label.toLowerCase()} ${x.score ?? "n/a"}`)
    .join(", ");
  return [
    `${f.ticker} | ${f.name} | ${f.sector ?? "n/a"} / ${f.industry ?? "n/a"} | price ${fmt.money(f.price)} | market cap ${fmt.big(f.marketCap)}`,
    `Valuation: forward P/E ${fmt.x(f.forwardPE)}, trailing P/E ${fmt.x(f.trailingPE)}, PEG ${fmt.x(f.peg, 2)}, EV/EBITDA ${fmt.x(f.evToEbitda)}, P/S ${fmt.x(f.priceToSales)}`,
    `Quality: ROE ${fmt.pctPlain(f.roe)}, operating margin ${fmt.pctPlain(f.operatingMargin)}, net margin ${fmt.pctPlain(f.profitMargin)}, FCF margin ${fmt.pctPlain(fcfMargin)}, debt/equity ${f.debtToEquity === null ? "n/a" : (f.debtToEquity / 100).toFixed(2) + "x"}`,
    `Growth: revenue ${fmt.pct(f.revenueGrowth)} y/y, earnings ${fmt.pct(f.earningsGrowth)} y/y, EPS next year ${fmt.pct(f.epsGrowthNextYear)}`,
    `Momentum: 1m ${fmt.pct(f.return1m)}, 6m ${fmt.pct(f.return6m)}, 1y ${fmt.pct(f.return1y)}, vs 200-day avg ${f.sma200 ? fmt.pct(f.price / f.sma200 - 1) : "n/a"}, 52-week range ${fmt.money(f.low52)}-${fmt.money(f.high52)}`,
    `Risk: beta ${fmt.x(f.beta, 2)}, volatility ${fmt.pctPlain(f.volatility1y, 0)}, 1y max drawdown ${fmt.pct(f.maxDrawdown1y, 0)}, short interest ${fmt.pctPlain(f.shortPercentFloat)} of float`,
    `Income: dividend yield ${fmt.pctPlain(f.dividendYield, 2)}, payout ratio ${fmt.pctPlain(f.payoutRatio, 0)}`,
    `Analysts: ${f.analystCount ?? 0} analysts, mean rating ${fmt.x(f.analystRating, 2)} (1=strong buy, 5=sell), mean target ${fmt.money(f.analystTarget)} (${fmt.pct(f.analystUpside)})`,
    `Technicals: RSI(14) ${fmt.x(f.rsi14, 0)}, MACD histogram ${fmt.pct(f.macdHistPct, 2)} of price`,
    `Next earnings: ${f.nextEarnings ? f.nextEarnings.slice(0, 10) : "n/a"}`,
    f.dataSource && f.dataSource !== "Yahoo Finance" && `Data note: ${f.dataSource}`,
    filings.length &&
      `SEC filings: ${filings.map((x) => `${x.form} ${x.date}${x.about ? ` (${x.about})` : ""}`).join("; ")}`,
    ...developments.map(
      (d, i) =>
        `${f.ticker} news ${i + 1} (${d.publishedAt ? d.publishedAt.slice(0, 16) : "recent"}, ${d.source ?? "web"}): ${d.title}. ${d.snippet.slice(0, 200)}`
    ),
    `${score.model === "backtested" ? "Backtested model" : "Classic model"} scores 0-100: composite ${score.composite ?? "n/a"} | ${factors}` +
      (score.inTestedRange === false ? " (below $10B: outside the tested range)" : ""),
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------- analysis ----------

const ANALYST_PROMPT = `You are a careful, plain-spoken equity research analyst advising a self-directed retail investor.
You receive the investor's question, their investing style, and a FACT TABLE of stocks with live data and model scores.

Rules:
- Use ONLY the facts provided. Never mention a ticker that is not in the fact table. Do not invent numbers, news, products or events.
- Every thesis and risk bullet MUST cite at least one specific number from the fact table. Bullets without a number are discarded, so general points (e.g. "regulatory risk") must be tied to a figure.
- Stance per stock: "Buy", "Hold" or "Avoid", with conviction "High", "Medium" or "Low". Follow the SCORING MODEL stance guide in the message unless the facts clearly justify otherwise, and say why if you deviate.
- Judge valuation against growth (a high P/E can be fine with high growth, a low P/E can be a value trap with shrinking revenue).
- Never write a bullet about missing ("n/a") data; if missing data matters, mention it once in the summary. Do not predict prices.
- "<TICKER> news N" lines are recent web headlines (unverified). Use them for recent developments and cite them as "(<TICKER> news N)"; never add details beyond what they say. If there are none, don't speculate about news.
- If a MACRO BACKDROP is given, factor it in where it matters (e.g. rates for banks, REITs, utilities and high-growth valuations).
- SEC filings show what was recently filed (e.g. an 8-K for an executive change); mention them only when relevant.
- If the question asks about something the data can't answer, say so briefly in the summary.
- Be direct and concise.
- If an EARLIER CONVERSATION is given, answer the new question as a follow-up: refer back to earlier picks where useful (e.g. "compared with the earlier picks...") without repeating earlier answers. Earlier tickers not in the fact table may be mentioned by name only when comparing, never with numbers.

Return ONLY JSON:
{
  "summary": "2-4 sentence direct answer to the question",
  "picks": [
    {
      "ticker": "XXX",
      "stance": "Buy" | "Hold" | "Avoid",
      "conviction": "High" | "Medium" | "Low",
      "thesis": ["2-3 bullets, each citing numbers"],
      "risks": ["2 bullets, each citing numbers"],
      "watch": "one sentence: what would change this view"
    }
  ],
  "portfolioNote": "one or two sentences on position sizing / diversification for this style"
}
Include EVERY ticker listed under TICKERS in picks (exactly one entry each, using the ticker symbol), best first.`;

const analyze = unstable_cache(
  async (question, style, horizon, table, tickers, model, context, macro, guide) => {
    const { data, usage } = await groqJSON(
      [
        { role: "system", content: ANALYST_PROMPT },
        {
          role: "user",
          content: `${context ? `EARLIER CONVERSATION:\n${context}\n\n` : ""}${macro ? `MACRO BACKDROP: ${macro}\n\n` : ""}${guide}\n\nQUESTION: ${question}\nSTYLE: ${style}${horizon ? `\nHORIZON: ${horizon}` : ""}\nTICKERS: ${tickers.join(", ")}\n\nFACT TABLE:\n\n${table}`,
        },
      ],
      {
        model,
        max_completion_tokens: 2600,
        maxWaitMs: 20_000,
        // Medium reasoning follows the "cover every ticker, cite numbers"
        // rules far more reliably than low, for a few hundred extra tokens.
        reasoning_effort: "medium",
      }
    );
    return { data, usage };
  },
  ["analysis-v6"],
  { revalidate: 6 * 3600 }
);

export async function advise({ question, style: styleOverride, sector: sectorOverride, size: sizeOverride, model: modelChoice, history: rawHistory }) {
  const scoringModel = SCORING_MODELS.includes(modelChoice) ? modelChoice : DEFAULT_MODEL;
  const history = sanitizeHistory(rawHistory);
  const context = history.length ? conversationText(history) : "";
  const parsed = await parseIntent(question, history);
  const intent = {
    ...parsed,
    style: STYLES.includes(styleOverride) ? styleOverride : parsed.style,
    sector: SECTORS.includes(sectorOverride) ? sectorOverride : parsed.sector,
    size: ["small", "mid", "large"].includes(sizeOverride) ? sizeOverride : parsed.size,
    model: scoringModel,
  };
  if (!intent.relevant && !styleOverride && !sectorOverride && !sizeOverride) {
    return {
      question,
      intent,
      mode: "none",
      screened: null,
      notes: [],
      disclaimer: DISCLAIMER,
      generatedAt: new Date().toISOString(),
      summary: "I can help with stock and investing questions, like \"Should I buy Apple?\" or \"safe dividend stocks for retirement\". Try rephrasing your question.",
      picks: [],
      aiCommentary: false,
    };
  }

  const { candidates, notes, screened } = await findCandidates(intent);
  if (intent.fallback) {
    notes.unshift("The AI couldn't interpret your question right now, so it was matched by keywords. Results may be less targeted; try again in a minute.");
  }
  const base = {
    question,
    intent,
    mode: intent.companies.length ? "evaluate" : "discover",
    followUp: history.length > 0,
    scoringModel,
    screened: screened ?? null,
    notes,
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
  };
  if (candidates.length === 0) {
    return {
      ...base,
      summary: "I couldn't find stocks with enough market data that match this request. Try naming a company or broadening the sector or style.",
      picks: [],
      aiCommentary: false,
    };
  }

  // Optional context sources; each returns empty when its key isn't set or it fails.
  const [macro, ...extras] = await Promise.all([
    getMacroSafe(),
    ...candidates.map(async (c) => {
      const [filings, developments] = await Promise.all([
        getFilingsSafe(c.fact.ticker),
        getDevelopmentsSafe(c.fact.ticker, c.fact.name),
      ]);
      return { filings, developments };
    }),
  ]);
  candidates.forEach((c, i) => Object.assign(c, extras[i]));
  const backdrop = macroText(macro);

  const table = candidates.map(factBlock).join("\n\n");
  let analysis = null;
  let lastError = null;
  const tickers = candidates.map((c) => c.fact.ticker);
  for (const model of [MODELS.smart, MODELS.fast]) {
    try {
      analysis = (
        await analyze(question, intent.style, intent.horizon, table, tickers, model, context, backdrop, modelGuide(scoringModel))
      ).data;
      break;
    } catch (error) {
      console.error(`analysis failed on ${model}`, error.message);
      lastError = error;
      // Rate limits and malformed JSON are worth trying on the other model.
      if (error.status !== 429 && !/json_validate_failed|malformed JSON/.test(error.message)) break;
    }
  }
  if (!analysis) {
    notes.push(
      lastError?.status === 429
        ? "The free AI quota is used up for now, so this shows scores and data only. Full commentary returns when the quota resets."
        : "AI commentary is temporarily unavailable, so this shows scores and data only."
    );
  }

  // Guardrail: only keep commentary for tickers we actually analysed. The
  // model occasionally writes the company name in the ticker field.
  const normalize = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const toTicker = (value) => {
    const key = normalize(value);
    const match = candidates.find(
      (c) => c.fact.ticker === value.toUpperCase() || normalize(c.fact.name) === key
    );
    return match?.fact.ticker ?? value.toUpperCase();
  };
  const byTicker = new Map(
    (analysis?.picks ?? [])
      .filter((p) => p && typeof p.ticker === "string")
      .map((p) => [toTicker(p.ticker), p])
  );
  const dropped = [...byTicker.keys()].filter(
    (t) => !candidates.some((c) => c.fact.ticker === t)
  );
  if (dropped.length) console.warn("dropped hallucinated tickers", dropped);

  const groundedBullets = (list) =>
    Array.isArray(list) ? list.filter((b) => typeof b === "string" && /\d/.test(b)) : [];
  const picks = candidates.map(({ fact, score, filings, developments }) => {
    const ai = byTicker.get(fact.ticker);
    return {
      ...fact,
      score,
      filings,
      developments,
      // If the model skipped a stock, fall back to the score-implied stance.
      stance: ai?.stance ?? stanceFromScore(score),
      stanceSource: ai?.stance ? "analyst" : "score",
      conviction: ai?.conviction ?? null,
      // Guardrail: keep only bullets grounded in a number from the data.
      thesis: groundedBullets(ai?.thesis),
      risks: groundedBullets(ai?.risks),
      watch: ai?.watch ?? null,
    };
  });
  // Follow the analyst's ordering when available, else composite score.
  const order = [...byTicker.keys()];
  picks.sort((a, b) => {
    const ia = order.indexOf(a.ticker);
    const ib = order.indexOf(b.ticker);
    if (ia !== -1 && ib !== -1) return ia - ib;
    return (b.score.composite ?? 0) - (a.score.composite ?? 0);
  });

  return {
    ...base,
    summary: analysis?.summary ?? null,
    macro: backdrop,
    portfolioNote: analysis?.portfolioNote ?? null,
    picks,
    aiCommentary: Boolean(analysis),
  };
}
