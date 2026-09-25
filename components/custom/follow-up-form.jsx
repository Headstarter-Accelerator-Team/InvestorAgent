"use client";

import { useState } from "react";
import { Loader2, MessageSquarePlus, RotateCcw } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

const SUGGESTIONS = [
    "Which of these is the safest?",
    "Tell me more about the top pick",
    "Show me cheaper alternatives",
];

export default function FollowUpForm({ onAsk, onReset, isLoading }) {
    const [query, setQuery] = useState('');

    const ask = (question) => {
        if (!question.trim() || isLoading) return;
        onAsk(question.trim());
        setQuery('');
    };

    return (
        <div className="mt-6 space-y-3 border-t pt-6">
            <form
                onSubmit={(e) => { e.preventDefault(); ask(query); }}
                className="flex gap-2"
            >
                <Input
                    type="text"
                    placeholder="Ask a follow-up about these results..."
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
