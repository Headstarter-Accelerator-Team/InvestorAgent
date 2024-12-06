"use client";

import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";




export default function TopUrls() {
        const topUrls = [
            { url: "https://www.benzinga.com/tech/24/12/42312826/teslas-0-interest-loan-offer-on-model-3-y-to-end-mid-december-customers-who-order-now-can-get-delivery-befor", title: "Tesla's 0% Interest Loan Offer" },
            { url: "https://www.benzinga.com/news/global/24/12/42322754/tesla-boosts-marketing-in-china-highlights-safety-features-during-year-end-sales-push-report", title: "Tesla Boosts Marketing in China" },
            { url: "https://www.benzinga.com/24/12/42311290/trader-danny-moses-says-he-is-no-longer-shorting-tesla", title: "Trader Danny Moses No Longer Shorting Tesla" },
            { url: "https://www.fool.com/investing/2024/12/04/where-will-dogecoin-be-in-1-year/", title: "Where Will Dogecoin Be in 1 Year?" },
            { url: "https://www.benzinga.com/analyst-ratings/analyst-color/24/12/42319796/tesla-analyst-lowers-q4-delivery-estimate-says-2-dynamics-will-determine-ev-stocks-", title: "Tesla Analyst Lowers Q4 Delivery Estimate" },
            { url: "https://www.benzinga.com/24/12/42285783/tesla-bear-craig-irwin-turns-bullish-increases-price-target-from-85-to-380", title: "Tesla Bear Craig Irwin Turns Bullish" },
            { url: "https://www.fool.com/investing/2024/12/03/why-tesla-stock-jumped-38-in-november/", title: "Why Tesla Stock Jumped 38% in November" },
            { url: "https://www.benzinga.com/analyst-ratings/analyst-color/24/12/42297692/credo-technology-analyst-double-upgrades-ai-play-raises-forecast-by-almost-200", title: "Credo Technology Analyst Double-Upgrades AI Play" },
            { url: "https://www.fool.com/investing/2024/12/03/why-chargepoint-wont-turn-a-profit-for-years-to-co/", title: "Why ChargePoint Won't Turn a Profit for Years" },
            { url: "https://www.benzinga.com/news/global/24/12/42284511/tesla-china-sees-robust-demand-in-q4-with-registrations-up-14-2-yoy-so-far-expert-says-ev-giant-on-tr", title: "Tesla China Sees Robust Demand in Q4" }
        ];
    return(

        <Card className="bg-white dark:bg-gray-800 shadow-lg">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <CardTitle className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
                <ExternalLink className="w-5 h-5 mr-2 text-blue-500" />
                Top 10 News
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {topUrls.map((item, index) => (
                            <li key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 ease-in-out">
                                <a 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-start space-x-3 group"
                                >
                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                                        {index + 1}
                                    </div>
                                    <div className="flex-grow">
                                        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-150 ease-in-out">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                            {new URL(item.url).hostname}
                                        </p>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors duration-150 ease-in-out" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}