"use client";

import { MODEL_OPTIONS } from "@/lib/format";

// Switch between the backtested and classic scoring models.
export default function ModelToggle({ model, onChange, disabled }) {
    const current = MODEL_OPTIONS.find((m) => m.value === model) ?? MODEL_OPTIONS[0];
    return (
        <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">Scoring model</span>
                <div role="radiogroup" aria-label="Scoring model" className="inline-flex rounded-md border p-0.5">
                    {MODEL_OPTIONS.map((m) => (
                        <button
                            key={m.value}
                            type="button"
                            role="radio"
                            aria-checked={model === m.value}
                            disabled={disabled}
                            onClick={() => onChange(m.value)}
                            className={`px-3 py-1 text-sm rounded ${
                                model === m.value
                                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                            }`}
                        >
                            {m.label}
                            {m.value === "backtested" && <span className="ml-1 text-xs opacity-70">(default)</span>}
                        </button>
                    ))}
                </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{current.description}</p>
        </div>
    );
}
