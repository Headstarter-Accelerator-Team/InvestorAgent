import SearchForm from "@/components/custom/search-form";
import StockResults from "@/components/custom/stock-results";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header>
        <h1>Investor Agent 📈</h1>
      </header>
      <main>
        <div className="container mx-auto">
          {/* Form Placement */}
          <SearchForm />
          {/* Stock Results Placement */}
          <StockResults />
        </div>
      </main>
    </div>
  );
}
