"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Search } from "lucide-react";
import { Info } from "lucide-react";



function StockTable({stocks}) {
    return (
        <Card className="col-span-1 md:col-span-2">
            {/* <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Quick Stock Query
                </CardTitle>
            </CardHeader> */}
            <CardContent>
                <div className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <Info className="w-5 h-5" />
                            AI Insights
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">{results.llm_response}</p>
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
    )
 
}

export default function StockResults({queryLLMResponse, queryMatches}) {
    // const [currentTab, setCurrentTab] = useState('BUY');
    // const filteredStocks = mockStocks.filter(stock => stock.recommendation === currentTab);

    return (
        <Card className="col-span-1 md:col-span-2">
            { (queryLLMResponse && queryMatches) &&(
                <div className="mt-6 space-y-6">
                    <CardContent>
                        <div className="mt-6 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <Info className="w-5 h-5" />
                                    AI Insights
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm">{queryLLMResponse}</p>
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">Top Matches</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="table" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="table">Table View</TabsTrigger>
                                    <TabsTrigger value="details">Detailed View</TabsTrigger>
                                </TabsList>
                                <TabsContent value="table">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Ticker</TableHead>
                                                    <TableHead>Industry</TableHead>
                                                    <TableHead>Sector</TableHead>
                                                    <TableHead>Location</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {queryMatches.map((match, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium">{match.Name}</TableCell>
                                                        <TableCell>{match.Ticker}</TableCell>
                                                        <TableCell>{match.Industry}</TableCell>
                                                        <TableCell>{match.Sector}</TableCell>
                                                        <TableCell>{`${match.City}, ${match.State}, ${match.Country}`}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>
                                <TabsContent value="details">
                                    <div className="space-y-4">
                                        {queryMatches.map((match, index) => (
                                            <Card key={index}>
                                                <CardHeader>
                                                    <CardTitle>{match.Name} ({match.Ticker})</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-sm mb-2"><strong>Industry:</strong> {match.Industry}</p>
                                                    <p className="text-sm mb-2"><strong>Sector:</strong> {match.Sector}</p>
                                                    <p className="text-sm mb-2"><strong>Location:</strong> {match.City}, {match.State}, {match.Country}</p>
                                                    <p className="text-sm"><strong>Summary:</strong> {match["Business Summary"]}</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            )}
        </Card>
    )
}