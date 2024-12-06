"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";


const mockStocks = [
    { symbol: 'CRDO', name: 'Credo Technology Group', sector: 'Technology', marketCap: '$2.5B', volume: 1000000, recommendation: 'BUY', reason: "AI play being double-upgraded, forecast increase of almost 200%" },
    { symbol: 'SOFI', name: 'SoFi Technologies', sector: 'Financial Services', marketCap: '$7.5B', volume: 5000000, recommendation: 'BUY', reason: "Flashing bullish momentum" },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', marketCap: '$1.2T', volume: 30000000, recommendation: 'BUY', reason: "Part of 'Magnificent Seven', expected to perform well" },
    { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Automotive', marketCap: '$780B', volume: 100000000, recommendation: 'BUY', reason: "Experiencing a surge, strong sales and innovative technology" },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', marketCap: '$1.5T', volume: 50000000, recommendation: 'BUY', reason: "Part of 'Magnificent Seven', expected to perform well" },
    { symbol: 'GM', name: 'General Motors', sector: 'Automotive', marketCap: '$50B', volume: 15000000, recommendation: 'BUY', reason: "Surge due to offloading stakes in a battery plant" },
    { symbol: 'ETH', name: 'Ethereum', sector: 'Cryptocurrency', marketCap: '$260B', volume: 20000000, recommendation: 'BUY', reason: "Strong performance in the crypto market" },
    { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Automotive', marketCap: '$780B', volume: 100000000, recommendation: 'SELL', reason: "Predicted decline in global sales due to slowdown in Europe and US" },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Technology', marketCap: '$820B', volume: 25000000, recommendation: 'SELL', reason: "Decline due to concerns about content moderation and misinformation" },
    { symbol: 'CRWD', name: 'CrowdStrike Holdings', sector: 'Technology', marketCap: '$40B', volume: 5000000, recommendation: 'NEUTRAL', reason: "Expected to have neutral momentum" },
    { symbol: 'MSTR', name: 'MicroStrategy', sector: 'Technology', marketCap: '$6B', volume: 1000000, recommendation: 'NEUTRAL', reason: "Experiencing some hiccups, but overall neutral momentum" },
    { symbol: 'CHPT', name: 'ChargePoint Holdings', sector: 'Electric Utilities', marketCap: '$2B', volume: 10000000, recommendation: 'NEUTRAL', reason: "Expected to take years to turn a profit" },
]

function StockTable({stocks}) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Market Cap</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Reason</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {stocks.map((stock, index) => (
                    <TableRow key={`${stock.symbol}-${index}`}>
                        <TableCell className="font-medium">{stock.symbol}</TableCell>
                        <TableCell>{stock.name}</TableCell>
                        <TableCell>{stock.sector}</TableCell>
                        <TableCell>{stock.marketCap}</TableCell>
                        <TableCell>{stock.volume.toLocaleString()}</TableCell>
                        <TableCell>{stock.reason}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
 
}

export default function StockResults() {
    const [currentTab, setCurrentTab] = useState('BUY');
    const filteredStocks = mockStocks.filter(stock => stock.recommendation === currentTab);

    return (<div id="stockResults" className="mt-8">
        <Tabs defaultValue="BUY" onValueChange={(value) => setCurrentTab(value)}>
            <TabsList>
                <TabsTrigger value="BUY">Best to Buy</TabsTrigger>
                <TabsTrigger value="SELL">Best to Sell</TabsTrigger>
                <TabsTrigger value="NEUTRAL">Neutral Stocks</TabsTrigger>
            </TabsList>
            <TabsContent value="BUY">
                <StockTable stocks={filteredStocks} />
            </TabsContent>
            <TabsContent value="SELL">
                <StockTable stocks={filteredStocks} />
            </TabsContent>
            <TabsContent value="NEUTRAL">
                <StockTable stocks={filteredStocks} />
            </TabsContent>
      </Tabs>
    </div>);
}