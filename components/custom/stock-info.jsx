"use client";

import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { Briefcase } from "lucide-react";
import { Building2 } from "lucide-react";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { FactorBars, MetricGrid, ScoreDetails } from "./metrics";



export default function StockInfo() {
    const [symbol, setSymbol] = useState('');
    const [stockInfo, setStockInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);


    const fetchStockInfo = async () => {
        setIsLoading(true)
        setError(null)
        try {
            // Simulating API call with setTimeout
            // setTimeout(() => {
            //     setStockInfo(dummyData)
            //     setIsLoading(false)
            // }, 1000)
            console.log("Symbol: ", symbol);
            const response = await fetch('/api/retrieve-stock-info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({symbol: symbol})
            });  
            
            const result = await response.json();
            if (!response.ok){
                throw new Error(result.error ?? `Response status: ${response.status}`);
            }

            setStockInfo(result);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching stock info:', error)
            setStockInfo(null)
            setError(error.message)
            setIsLoading(false)
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Stock Information
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex space-x-2 mb-4">
                    <Input
                        type="text"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchStockInfo()}
                        placeholder="Ticker or company name"
                        className="flex-grow"
                    />
                    <Button onClick={fetchStockInfo} disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                    </Button>
                </div>
                {stockInfo && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold">{stockInfo.Name}</h2>
                            <span className="text-lg font-semibold bg-blue-100 text-blue-800 py-1 px-2 rounded">
                                {stockInfo.Ticker}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <Briefcase className="w-5 h-5 text-gray-500" />
                                <span className="font-semibold">Industry:</span> {stockInfo.Industry}
                            </div>
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-gray-500" />
                                <span className="font-semibold">Sector:</span> {stockInfo.Sector}
                            </div>
                            <div className="flex items-center gap-2 md:col-span-2">
                                <MapPin className="w-5 h-5 text-gray-500" />
                                <span className="font-semibold">Location:</span> {stockInfo.City}, {stockInfo.State}, {stockInfo.Country}
                            </div>
                        </div>
                        {stockInfo.score && (
                            <div className="space-y-4">
                                <MetricGrid stock={stockInfo} />
                                <div>
                                    <p className="text-sm font-semibold mb-2">
                                        Balanced score: {stockInfo.score.composite ?? "n/a"} / 100
                                    </p>
                                    <FactorBars score={stockInfo.score} />
                                </div>
                                <ScoreDetails score={stockInfo.score} style="balanced" />
                            </div>
                        )}
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Business Summary</h3>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {stockInfo["Business Summary"]}
                            </p>
                        </div>
                    </div>
                )}
                {error && !isLoading && (
                    <p className="text-center text-red-600 dark:text-red-400">{error}</p>
                )}
                {!stockInfo && !isLoading && !error && (
                    <div className="text-center text-gray-500 dark:text-gray-400">
                        <p>
                            No stock information available. Please enter a valid stock symbol and click `Fetch`.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}