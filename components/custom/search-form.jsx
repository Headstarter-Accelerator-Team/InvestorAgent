"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SECTOR_OPTIONS, STYLE_OPTIONS } from "@/lib/format";

const EXAMPLES = [
    "Safe dividend stocks for retirement",
    "Should I buy NVIDIA?",
    "Best AI chip stocks for long-term growth",
    "Undervalued healthcare stocks",
    "Compare Apple and Microsoft",
];

export default function SearchForm({ onAsk, isLoading }) {
    const [query, setQuery] = useState('');
    const [style, setStyle] = useState('auto');
    const [sector, setSector] = useState('any');
    const [size, setSize] = useState('any');

    const ask = (question) => {
        if (!question.trim() || isLoading) return;
        onAsk({
            question,
            style: style === 'auto' ? undefined : style,
            sector: sector === 'any' ? undefined : sector,
            size: size === 'any' ? undefined : size,
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        ask(query);
    };

    return (<form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
            <Input
                type="text"
                placeholder="Ask about a stock or what to invest in..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
            </Button>
        </div>
        <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
                <button
                    key={example}
                    type="button"
                    disabled={isLoading}
                    onClick={() => { setQuery(example); ask(example); }}
                    className="text-xs rounded-full border px-3 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                    {example}
                </button>
            ))}
        </div>
        <Accordion type="single" collapsible>
            <AccordionItem value="advanced-search">
                <AccordionTrigger>Advanced Options</AccordionTrigger>
                <AccordionContent>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="style" className="text-sm font-medium">
                            Investing style
                            </label>
                            <Select value={style} onValueChange={setStyle}>
                            <SelectTrigger id="style">
                                <SelectValue placeholder="Detect from question" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">Detect from question</SelectItem>
                                {STYLE_OPTIONS.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="sector" className="text-sm font-medium">
                            Sector
                            </label>
                            <Select value={sector} onValueChange={setSector}>
                            <SelectTrigger id="sector">
                                <SelectValue placeholder="Any sector" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="any">Any sector</SelectItem>
                                {SECTOR_OPTIONS.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="market-cap" className="text-sm font-medium">
                            Market Capitalization
                            </label>
                            <Select value={size} onValueChange={setSize}>
                            <SelectTrigger id="market-cap">
                                <SelectValue placeholder="Any size" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="any">Any size</SelectItem>
                                <SelectItem value="small">Small Cap ($300M - $2B)</SelectItem>
                                <SelectItem value="mid">Mid Cap ($2B - $10B)</SelectItem>
                                <SelectItem value="large">Large Cap (&gt; $10B)</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                     </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </form>);
}
