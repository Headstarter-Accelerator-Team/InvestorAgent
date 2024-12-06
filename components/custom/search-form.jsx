"use client";

import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";



export default function SearchForm() {
    const [query, setQuery] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("User searched: ", query);
    }

    return (<form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
            <Input 
                type="text"
                placeholder="Enter your research query..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <Button type="submit">Search</Button>
        </div>
        <Accordion type="single" collapsible>
            <AccordionItem value="advanced-search">
                <AccordionTrigger>Advanced Search Options</AccordionTrigger>
                <AccordionContent>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="market-cap" className="text-sm font-medium">
                            Market Capitalization
                            </label>
                            <Select>
                            <SelectTrigger id="market-cap">
                                <SelectValue placeholder="Select range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="small">Small Cap (&lt; $2B)</SelectItem>
                                <SelectItem value="mid">Mid Cap ($2B - $10B)</SelectItem>
                                <SelectItem value="large">Large Cap (&gt; $10B)</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="volume" className="text-sm font-medium">
                            Volume
                            </label>
                            <Select>
                            <SelectTrigger id="volume">
                                <SelectValue placeholder="Select range" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Low (&lt; 100K)</SelectItem>
                                <SelectItem value="medium">Medium (100K - 1M)</SelectItem>
                                <SelectItem value="high">High (&gt; 1M)</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="sector" className="text-sm font-medium">
                            Sector
                            </label>
                            <Select>
                            <SelectTrigger id="sector">
                                <SelectValue placeholder="Select sector" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="technology">Technology</SelectItem>
                                <SelectItem value="healthcare">Healthcare</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="energy">Energy</SelectItem>
                                <SelectItem value="consumer">Consumer Goods</SelectItem>
                            </SelectContent>
                            </Select>
                        </div>
                     </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </form>);
}