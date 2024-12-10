"use client";
import NewsSentiment from "@/components/custom/news-sentiment";
import SearchForm from "@/components/custom/search-form";
import StockInfo from "@/components/custom/stock-info";
import StockResults from "@/components/custom/stock-results";
import TopUrls from "@/components/custom/top-urls";
import { useState } from "react";

export default function Home() {
  const [queryMatches, setQueryMatches] = useState([]);
  const [queryLLMResponse, setQueryLLMResponse] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto py-4 px-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Investor Agent 📈
          </h1>
        </div>
      </header>
      <main className="flex-1 p-8 overflow-auto">
        <div className="container mx-auto py-8 px-4">
          {/* Form Placement */}
          <SearchForm
            queryMatches={queryMatches}
            setQueryMatches={setQueryMatches}
            queryLLMResponse={queryLLMResponse}
            setQueryLLMResponse={setQueryLLMResponse}
          />
          {/* Stock Results Placement */}
          <StockResults
            queryLLMResponse={queryLLMResponse}
            queryMatches={queryMatches}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Top Urls Placement */}
          <NewsSentiment />
          {/* <TopUrls /> */}
          <StockInfo />
        </div>
      </main>
    </div>
  );
}
