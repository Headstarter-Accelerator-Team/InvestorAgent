"use client";

import { Newspaper, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { requestJSON } from "@/lib/api-client";

const SENTIMENT_STYLES = {
    Bullish: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Somewhat-Bullish": "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    Neutral: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    "Somewhat-Bearish": "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    Bearish: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function NewsSentiment({ tickers }) {

    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null);
    const key = tickers.join(",");

    const fetchNews = useCallback(async () => {
        if (!key) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await requestJSON(`/api/news-sentiment?tickers=${encodeURIComponent(key)}`, { timeoutMs: 20_000 });
            setData(result.data);
        } catch (error) {
            console.error("Error fetching news:", error);
            setError(error.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }, [key]);

    useEffect(() => {
        setData(null);
        fetchNews();
    }, [fetchNews]);

    return (
        <Card className="bg-white dark:bg-gray-800 shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Newspaper className="w-5 h-5" />
                    Latest News
                </span>
                {key && (
                    <Button variant="outline" size="sm" onClick={fetchNews} disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Refreshing...' : 'Refresh'}
                    </Button>
                )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {!key && (
                    <p className="text-center text-gray-500 dark:text-gray-400">
                        Ask a question to see the latest news for the stocks it recommends.
                    </p>
                )}
                {isLoading && <p className="text-center text-gray-600 dark:text-gray-400">Loading news...</p>}
                {data && !isLoading && (
                    <Tabs defaultValue={data[0]?.ticker} className="w-full">
                        <TabsList className="flex w-full">
                            {data.map((d) => (
                                <TabsTrigger key={d.ticker} value={d.ticker} className="flex-1">{d.ticker}</TabsTrigger>
                            ))}
                        </TabsList>
                        {data.map((d) => (
                            <TabsContent key={d.ticker} value={d.ticker}>
                                {d.error && (
                                    <p className="text-sm text-red-600 dark:text-red-400 mt-4">{d.error}</p>
                                )}
                                {!d.error && d.articles.length === 0 && (
                                    <p className="text-sm text-gray-500 mt-4">No recent news found.</p>
                                )}
                                <ul className="space-y-2 mt-4">
                                    {d.articles.map((a) => (
                                        <li key={a.url} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
                                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
                                                {a.title}
                                            </a>
                                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span>{a.publisher}</span>
                                                <span>{new Date(a.publishedAt).toLocaleDateString()}</span>
                                                {a.sentiment && (
                                                    <span className={`rounded px-1.5 py-0.5 ${SENTIMENT_STYLES[a.sentiment.label] ?? ""}`}>
                                                        {a.sentiment.label}
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                {d.source && <p className="text-xs text-gray-400 mt-2">Source: {d.source}</p>}
                            </TabsContent>
                        ))}
                    </Tabs>
                )}
            </CardContent>
        </Card>
    )

}
