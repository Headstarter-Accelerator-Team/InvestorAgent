// Latest SEC filings per ticker (EDGAR, free). SEC requires a User-Agent
// with contact details, so this is off unless SEC_USER_AGENT is set.
import { unstable_cache } from "next/cache";

const FORMS = new Set(["10-K", "10-Q", "8-K", "20-F", "6-K", "40-F"]);
const MAX_FILINGS = 4;

// Common 8-K item codes -> what they mean to an investor.
const ITEM_LABELS = {
  "1.01": "material agreement",
  "1.03": "bankruptcy",
  "2.01": "acquisition or sale",
  "2.02": "earnings results",
  "2.05": "restructuring costs",
  "2.06": "impairment",
  "3.01": "delisting notice",
  "4.02": "restatement",
  "5.01": "change in control",
  "5.02": "executive or board change",
  "7.01": "investor disclosure",
  "8.01": "other event",
};

const secFetch = (url) =>
  fetch(url, {
    headers: { "User-Agent": process.env.SEC_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  }).then((r) => {
    if (!r.ok) throw new Error(`SEC ${r.status} for ${url}`);
    return r.json();
  });

// { NVDA: 1045810, ... } (~10k companies), cached for a week.
const getCikMap = unstable_cache(
  async () => {
    const data = await secFetch("https://www.sec.gov/files/company_tickers.json");
    return Object.fromEntries(Object.values(data).map((c) => [c.ticker, c.cik_str]));
  },
  ["sec-cik-map-v1"],
  { revalidate: 7 * 24 * 3600 }
);

const getFilings = unstable_cache(
  async (ticker) => {
    const cik = (await getCikMap())[ticker];
    if (!cik) return []; // foreign or OTC listings often aren't in EDGAR
    const data = await secFetch(
      `https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`
    );
    const r = data.filings?.recent ?? {};
    const filings = [];
    for (let i = 0; i < (r.form?.length ?? 0) && filings.length < MAX_FILINGS; i++) {
      if (!FORMS.has(r.form[i])) continue;
      const items = (r.items?.[i] ?? "")
        .split(",")
        .map((code) => ITEM_LABELS[code.trim()])
        .filter(Boolean);
      filings.push({
        form: r.form[i],
        date: r.filingDate[i],
        about: items.length ? [...new Set(items)].join(", ") : null,
        url: `https://www.sec.gov/Archives/edgar/data/${cik}/${r.accessionNumber[i].replace(/-/g, "")}/${r.primaryDocument[i]}`,
      });
    }
    return filings;
  },
  ["sec-filings-v1"],
  { revalidate: 12 * 3600 }
);

// Never throws: filings are a nice-to-have.
export async function getFilingsSafe(ticker) {
  if (!process.env.SEC_USER_AGENT) return [];
  try {
    return await getFilings(ticker);
  } catch (error) {
    console.warn(`SEC filings failed for ${ticker}:`, error.message);
    return [];
  }
}
