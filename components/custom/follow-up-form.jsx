"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquarePlus, RotateCcw } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

const SUGGESTIONS = [
    "Why did these come out on top?",
    "What are the biggest risks here?",
    "Explain the scores in simple terms",
    "Which of these is the safest?",
    "Show me cheaper alternatives",
];

// `draft` pre-fills the box (e.g. from "Ask AI about NVDA"); it's applied
// once and the box is focused so the user can finish the question.
export default function FollowUpForm({ onAsk, onReset, isLoading, draft, onDraftUsed }) {
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (!draft) return;
        setQuery(draft);
        inputRef.current?.focus();
        inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        onDraftUsed?.();
    }, [draft, onDraftUsed]);

    const ask = (question) => {
        if (!question.trim() || isLoading) return;
        onAsk(question.trim());
        setQuery('');
    };

    return (
        <div className="mt-6 space-y-3 border-t pt-6">
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Keep the conversation going: ask why, dig into a stock, or ask for different picks.
            </p>
            <form
                onSubmit={(e) => { e.preventDefault(); ask(query); }}
                className="flex gap-2"
            >
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Ask the AI a follow-up about these stocks..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Follow-up question"
                />
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />}
                    <span className="ml-2">Follow up</span>
                </Button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
                {SUGGESTIONS.map((s) => (
                    <button
                        key={s}
                        type="button"
                        disabled={isLoading}
                        onClick={() => ask(s)}
                        className="text-xs rounded-full border px-3 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        {s}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={onReset}
                    disabled={isLoading}
                    className="ml-auto text-xs flex items-center gap-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                >
                    <RotateCcw className="w-3 h-3" /> New conversation
                </button>
            </div>
        </div>
    );
}
