"use client";

import { Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { RefreshCw } from "lucide-react";
// import { Alert, AlertCircle, AlertTitle, AlertDescription } from "../ui/alert";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { TrendingUp } from "lucide-react";
import { TrendingDown } from "lucide-react";
import { Minus } from "lucide-react";




export default function NewsSentiment() {

    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null);

    // const fetchNewsSentiment = useCallback(async () => {
    //     setIsLoading(true)
    //     setError(null)
    //     setData(null)
        
    //     try {
    //         const response = await fetch('/api/news-sentiment', {
    //             method: 'GET',
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             }
    //         });

    //         if (!response.ok){
    //             throw new Error(`Response status: ${response.status}`);
    //         }

    //         const result = await response.text(); // Get the response as a string

    //         // Log the response for debugging
    //         console.log("Response:", result);

    //         // Refined regex patterns
    //     const bestToBuyMatch = result.match(/Best to Buy:\n+([\s\S]*?)\n+Best to Sell:/);
    //     const bestToSellMatch = result.match(/Best to Sell:\n+([\s\S]*?)\n+Neutral Stocks:/);
    //     const neutralStocksMatch = result.match(/Neutral Stocks:\n+([\s\S]*?)\n+Top 10 URLs:/);
    //     const topUrlsMatch = result.match(/Top 10 URLs:\n+([\s\S]*)/);

    //     if (!bestToBuyMatch || !bestToSellMatch || !neutralStocksMatch || !topUrlsMatch) {
    //         throw new Error("Failed to parse response");
    //     }

    //     const bestToBuy = bestToBuyMatch[1].trim().split("\n").map((item) => item.trim());
    //     const bestToSell = bestToSellMatch[1].trim().split("\n").map((item) => item.trim());
    //     const neutralStocks = neutralStocksMatch[1].trim().split("\n").map((item) => item.trim());
    //     const topUrls = topUrlsMatch[1].trim().split("\n").map((url) => url.trim());

    //     const transformedData = {
    //         topNews: topUrls.map((url, index) => ({
    //             url: url,
    //             title: `Top News ${index + 1}`,
    //         })),
    //         bestToBuy,
    //         bestToSell,
    //         neutralStocks,
    //     };
    //         setData(transformedData);
    //         setIsLoading(false);
    //     } catch (error){
    //         console.error('Error fetching news sentiment:', error);
    //         setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    //     } finally {
    //         setIsLoading(false)
    //     }
    // }, []);

    const fetchNewsSentiment = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/news-sentiment", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const result = await response.json();
            console.log("Response:", result);
            const parsedData = JSON.parse(result.data);
            const structuredData = {
                "best_to_buy": parsedData.best_to_buy,
                "best_to_sell": parsedData.best_to_sell,
                "neutral_stocks": parsedData.neutral_stocks,
                "top_articles": parsedData.top_articles
            }
            console.log("Structured Data: ", structuredData);

            setData(structuredData);
        } catch (error) {
            console.error("Error fetching news sentiment:", error);
            setError(error.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNewsSentiment();
    }, [fetchNewsSentiment]);

    const renderStockList = (stocks, icon) => (
        <ul className="space-y-2 mt-4">
            {stocks.map((stock, index) => (
                <li key={index} className="flex items-start gap-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
                {icon}
                <div>
                    <span className="font-semibold">{stock.stock} ({stock.ticker})</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{stock.reason}</p>
                </div>
                </li>
            ))}
        </ul>
    )

    const renderSentimentAnalysis = () => {
        if (!data) return null
        console.log(data);
        return (
            <Tabs defaultValue="buy" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="buy">Best to Buy</TabsTrigger>
                    <TabsTrigger value="sell">Best to Sell</TabsTrigger>
                    <TabsTrigger value="neutral">Neutral</TabsTrigger>
                </TabsList>
                <TabsContent value="buy">
                    {renderStockList(data.best_to_buy, <TrendingUp className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />)}
                </TabsContent>
                <TabsContent value="sell">
                    {renderStockList(data.best_to_sell, <TrendingDown className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />)}
                </TabsContent>
                <TabsContent value="neutral">
                    {renderStockList(data.neutral_stocks, <Minus className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />)}
                </TabsContent>
            </Tabs>
        )
    }

    return (
        <Card className="bg-white dark:bg-gray-800 shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Newspaper className="w-5 h-5" />
                    Market Pulse: News Sentiment
                </span>
                <Button variant="outline" size="sm" onClick={fetchNewsSentiment} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? 'Refreshing...' : 'Refresh'}
                </Button>
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
                {isLoading && <p className="text-center text-gray-600 dark:text-gray-400">Analyzing market sentiment...</p>}
                {data && (
                    <div className="space-y-6">
                        {renderSentimentAnalysis()}
                        <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Top 5 Market Movers</h3>
                        <ul className="space-y-2">
                            {data.top_articles.map((url, index) => (
                                <li key={index} className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                        {index + 1}
                                    </Badge>
                                    {/* <span className="text-sm">{new URL(url).hostname}</span> */}
                                    <span className="text-sm">{url.substring(0, 70)}...</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                        </div>
                    </div>
                )}
                {!isLoading && !error && !data && (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Data</AlertTitle>
                        <AlertDescription>No sentiment analysis data is currently available.</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    )

}