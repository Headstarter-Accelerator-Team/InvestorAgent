import SearchForm from "@/components/custom/search-form";

export default function Home() {
  return (
    <>
      <div id="header">
        <h1>Investor Agent 📈</h1>
      </div>
      <div id="body">
        {/* Form Placement */}

        <SearchForm />
      </div>
    </>
  );
}
