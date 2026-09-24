"use client";
import NewsSentiment from "@/components/custom/news-sentiment";
import SearchForm from "@/components/custom/search-form";
import StockInfo from "@/components/custom/stock-info";
import StockResults from "@/components/custom/stock-results";
import { useState } from "react";

export default function Home() {
  const [advice, setAdvice] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleResult = (result, errorMessage) => {
    setAdvice(result);
    setError(errorMessage);
  };

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
            onResult={handleResult}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
          {/* Stock Results Placement */}
          <StockResults advice={advice} error={error} isLoading={isLoading} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <NewsSentiment tickers={(advice?.picks ?? []).map((p) => p.ticker)} />
          <StockInfo />
        </div>
      </main>
      <footer className="border-t py-4 px-4 text-center text-xs text-gray-500 dark:text-gray-400">
        For education and research only, not financial advice. Market data from Yahoo Finance,
        delayed ~15 minutes. Do your own research and consider your own situation before investing.
      </footer>
    </div>
  );
}
