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



export default function StockInfo() {
    const [symbol, setSymbol] = useState('');
    const [stockInfo, setStockInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);


    const fetchStockInfo = async () => {
        setIsLoading(true)
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
            
            if (!response.ok){
                throw new Error(`Response status: ${response.status}`);
            }

            const result = await response.json();

            setStockInfo(result);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching stock info:', error)
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
                        placeholder="Enter stock symbol"
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
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Business Summary</h3>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {stockInfo["Business Summary"]}
                            </p>
                        </div>
                    </div>
                )}
                {!stockInfo && !isLoading && (
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