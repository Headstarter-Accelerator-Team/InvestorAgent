import SearchForm from "@/components/custom/search-form";
import StockResults from "@/components/custom/stock-results";
import TopUrls from "@/components/custom/top-urls";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto py-4 px-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Investor Agent 📈
          </h1>
        </div>
      </header>
      <main>
        <div className="container mx-auto py-8 px-4">
          {/* Form Placement */}
          <SearchForm />
          {/* Stock Results Placement */}
          <StockResults />
        </div>
        <div className="container mx-auto py-8 px-4">
          {/* Top Urls Placement */}
          <TopUrls />
        </div>
      </main>
    </div>
  );
}
