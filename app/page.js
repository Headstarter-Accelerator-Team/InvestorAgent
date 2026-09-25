"use client";
import FollowUpForm from "@/components/custom/follow-up-form";
import NewsSentiment from "@/components/custom/news-sentiment";
import SearchForm from "@/components/custom/search-form";
import StockInfo from "@/components/custom/stock-info";
import StockResults from "@/components/custom/stock-results";
import { requestJSON } from "@/lib/api-client";
import { useEffect, useRef, useState } from "react";

// The conversation lives for the browser session (survives a refresh,
// cleared when the tab closes or on "New conversation").
const STORAGE_KEY = "investor-agent-thread-v1";
const MAX_STORED_TURNS = 10;
const HISTORY_TURNS = 3;

function loadThread() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((t) => t?.request?.question) : [];
  } catch {
    return [];
  }
}

function saveThread(turns) {
  try {
    // Don't persist in-flight turns; they can't resume after a reload.
    const done = turns.filter((t) => !t.isLoading).slice(-MAX_STORED_TURNS);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(done));
  } catch {
    // Storage full or blocked: the conversation still works in memory.
  }
}

// What the server needs from earlier turns to understand a follow-up.
const toHistory = (turns) =>
  turns
    .filter((t) => t.advice)
    .slice(-HISTORY_TURNS)
    .map((t) => ({
      question: t.request.question,
      summary: t.advice.summary ?? "",
      tickers: (t.advice.picks ?? []).map((p) => p.ticker),
      intent: t.advice.intent,
    }));

export default function Home() {
  const [turns, setTurns] = useState([]);
  const [restored, setRestored] = useState(false);
  const lastTurnRef = useRef(null);
  const isLoading = turns.some((t) => t.isLoading);

  useEffect(() => {
    setTurns(loadThread());
    setRestored(true);
  }, []);

  useEffect(() => {
    if (restored) saveThread(turns);
  }, [turns, restored]);

  const updateTurn = (id, patch) =>
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  // Runs a turn. `previous` = the turns it follows up on ([] for a new conversation).
  const run = async (id, request, previous) => {
    console.log("User asked: ", request.question);
    try {
      const advice = await requestJSON("/api/advise", {
        method: "POST",
        body: { ...request, history: toHistory(previous) },
        // Server allows 60s; leave headroom for the network.
        timeoutMs: 70_000,
      });
      updateTurn(id, { advice, error: null, isLoading: false });
    } catch (err) {
      console.error("Failed to fetch advice:", err);
      updateTurn(id, { advice: null, error: err.message, isLoading: false });
    }
    lastTurnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startTurn = (request, previous) => {
    const turn = { id: crypto.randomUUID(), request, advice: null, error: null, isLoading: true };
    setTurns([...previous, turn]);
    run(turn.id, request, previous);
  };

  // Top search box starts a new conversation.
  const askNew = (request) => startTurn(request, []);

  // Follow-ups keep the thread and inherit the style/sector/size overrides.
  const askFollowUp = (question) => {
    const last = turns.at(-1);
    const { style, sector, size } = last?.request ?? {};
    startTurn({ question, style, sector, size }, turns);
  };

  const retry = (turn) => {
    updateTurn(turn.id, { isLoading: true, error: null });
    run(turn.id, turn.request, turns.slice(0, turns.indexOf(turn)));
  };

  const latestAdvice = [...turns].reverse().find((t) => t.advice)?.advice;
  const lastTurn = turns.at(-1);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto py-4 px-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Investor Agent 📈
          </h1>
        </div>
      </header>
      <main className="flex-1 p-8 overflow-auto">
        <div className="container mx-auto py-8 px-4">
          {/* Form Placement */}
          <SearchForm onAsk={askNew} isLoading={isLoading} />
          {/* Conversation */}
          {turns.map((turn, i) => (
            <section
              key={turn.id}
              ref={i === turns.length - 1 ? lastTurnRef : undefined}
              className="mt-8 scroll-mt-4"
            >
              <p className="text-sm">
                <span className="font-semibold text-gray-500 dark:text-gray-400">
                  {i === 0 ? "You asked" : "Follow-up"}:{" "}
                </span>
                {turn.request.question}
              </p>
              <StockResults
                advice={turn.advice}
                error={turn.error}
                isLoading={turn.isLoading}
                onRetry={() => retry(turn)}
              />
            </section>
          ))}
          {lastTurn && !lastTurn.isLoading && lastTurn.advice && (
            <FollowUpForm
              onAsk={askFollowUp}
              onReset={() => setTurns([])}
              isLoading={isLoading}
            />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <NewsSentiment tickers={(latestAdvice?.picks ?? []).map((p) => p.ticker)} />
          <StockInfo />
        </div>
      </main>
      <footer className="border-t py-4 px-4 text-center text-xs text-gray-500 dark:text-gray-400">
        For education and research only, not financial advice. Market data from Yahoo Finance,
        delayed ~15 minutes. Do your own research and consider your own situation before investing.
      </footer>
    </div>
  );
}
