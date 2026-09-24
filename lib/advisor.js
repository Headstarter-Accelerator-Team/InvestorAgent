// The advisor pipeline: question -> intent -> scored candidates -> grounded
// LLM analysis. Numbers are computed in code; the LLM only explains them.
import { unstable_cache } from "next/cache";
import { findCandidates, SECTORS } from "@/lib/candidates";
import { groqJSON, MODELS } from "@/lib/groq";
import { STYLES } from "@/lib/score";
import { fmt } from "@/lib/format";

export const DISCLAIMER =
  "For education and research only, not financial advice. Market data from Yahoo Finance, delayed ~15 minutes. Do your own research and consider your own situation before investing.";

// ---------- intent ----------

const STYLE_KEYWORDS = [
  ["dividend", /dividend|income|yield|passive/i],
  ["safe", /safe|low[- ]risk|conservative|retire|stable|defensive/i],
  ["speculative", /speculative|high[- ]risk|moonshot|penny|small[- ]cap|aggressive/i],
  ["value", /value|cheap|undervalued|bargain/i],
  ["growth", /growth|growing|fast|innovative/i],
];

function heuristicIntent(question) {
  const companies = [...question.matchAll(/\$?\b([A-Z]{1,5})\b/g)]
    .map((m) => m[1])
    .filter((t) => !["I", "A", "AI", "EV", "US", "USA", "ETF", "IPO", "CEO", "ROI"].includes(t));
  const style = STYLE_KEYWORDS.find(([, re]) => re.test(question))?.[0] ?? "balanced";
  const size = /small[- ]cap/i.test(question) ? "small" : /mid[- ]cap/i.test(question) ? "mid" : /large[- ]cap|blue[- ]chip/i.test(question) ? "large" : null;
  return { relevant: true, companies, style, sector: null, theme: null, themeTickers: [], size, horizon: null };
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
- horizon: investing horizon if stated or implied, else null.`;

export const parseIntent = unstable_cache(
  async (question) => {
    try {
      const { data } = await groqJSON(
        [
          { role: "system", content: INTENT_PROMPT },
          { role: "user", content: question },
        ],
        // The larger model gives much better theme suggestions.
        { model: MODELS.smart, max_completion_tokens: 700 }
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
    } catch (error) {
      console.error("intent parse failed, using heuristics", error);
      return heuristicIntent(question);
    }
  },
  ["intent-v4"],
  { revalidate: 24 * 3600 }
);

// ---------- fact table ----------

function factBlock({ fact: f, score }) {
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
    `Next earnings: ${f.nextEarnings ? f.nextEarnings.slice(0, 10) : "n/a"}`,
    `Model scores 0-100: composite ${score.composite ?? "n/a"} | ${factors}`,
  ].join("\n");
}

// ---------- analysis ----------

const ANALYST_PROMPT = `You are a careful, plain-spoken equity research analyst advising a self-directed retail investor.
You receive the investor's question, their investing style, and a FACT TABLE of stocks with live data and model scores.

Rules:
- Use ONLY the facts provided. Never mention a ticker that is not in the fact table. Do not invent numbers, news, products or events.
- Every thesis and risk bullet must cite at least one specific number from the fact table.
- Stance per stock: "Buy", "Hold" or "Avoid", with conviction "High", "Medium" or "Low". Keep it consistent with the composite score (roughly: 70+ supports Buy, 50-69 Hold, below 50 Avoid) unless the facts clearly justify otherwise, and say why if you deviate.
- Judge valuation against growth (a high P/E can be fine with high growth, a low P/E can be a value trap with shrinking revenue).
- Never write a bullet about missing ("n/a") data; if missing data matters, mention it once in the summary. Do not predict prices.
- If the question asks about something the data can't answer (e.g. news, macro, a specific date), say so briefly in the summary.
- Be direct and concise.

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
Include every stock from the fact table in picks, best first.`;

const analyze = unstable_cache(
  async (question, style, horizon, table) => {
    const { data, usage } = await groqJSON(
      [
        { role: "system", content: ANALYST_PROMPT },
        {
          role: "user",
          content: `QUESTION: ${question}\nSTYLE: ${style}${horizon ? `\nHORIZON: ${horizon}` : ""}\n\nFACT TABLE:\n\n${table}`,
        },
      ],
      { model: MODELS.smart, max_completion_tokens: 2200 }
    );
    return { data, usage };
  },
  ["analysis-v2"],
  { revalidate: 6 * 3600 }
);

export async function advise({ question, style: styleOverride, sector: sectorOverride, size: sizeOverride }) {
  const parsed = await parseIntent(question);
  const intent = {
    ...parsed,
    style: STYLES.includes(styleOverride) ? styleOverride : parsed.style,
    sector: SECTORS.includes(sectorOverride) ? sectorOverride : parsed.sector,
    size: ["small", "mid", "large"].includes(sizeOverride) ? sizeOverride : parsed.size,
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
  const base = {
    question,
    intent,
    mode: intent.companies.length ? "evaluate" : "discover",
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

  const table = candidates.map(factBlock).join("\n\n");
  let analysis = null;
  try {
    analysis = (await analyze(question, intent.style, intent.horizon, table)).data;
  } catch (error) {
    console.error("analysis failed", error);
    notes.push("AI commentary is temporarily unavailable (rate limit). Showing scores and data only.");
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

  const scoreStance = (c) => (c === null ? null : c >= 70 ? "Buy" : c >= 50 ? "Hold" : "Avoid");
  const picks = candidates.map(({ fact, score }) => {
    const ai = byTicker.get(fact.ticker);
    return {
      ...fact,
      score,
      // If the model skipped a stock, fall back to the score-implied stance.
      stance: ai?.stance ?? scoreStance(score.composite),
      stanceSource: ai?.stance ? "analyst" : "score",
      conviction: ai?.conviction ?? null,
      thesis: Array.isArray(ai?.thesis) ? ai.thesis : [],
      risks: Array.isArray(ai?.risks) ? ai.risks : [],
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
    portfolioNote: analysis?.portfolioNote ?? null,
    picks,
    aiCommentary: Boolean(analysis),
  };
}
