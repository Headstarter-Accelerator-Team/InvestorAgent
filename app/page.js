import SearchForm from "@/components/custom/search-form";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header>
        <h1>Investor Agent 📈</h1>
      </header>
      <main>
        {/* Form Placement */}
        <SearchForm />
      </main>
    </div>
  );
}
