// Macro backdrop from FRED (St. Louis Fed). Off unless FRED_API_KEY is set.
import { unstable_cache } from "next/cache";

const observations = async (seriesId, limit) => {
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
    `&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`FRED ${response.status} for ${seriesId}`);
  const data = await response.json();
  // Missing values are reported as ".".
  return (data.observations ?? [])
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: Number(o.value) }));
};

const latest = async (seriesId) => (await observations(seriesId, 10))[0] ?? null;

const getMacro = unstable_cache(
  async () => {
    const [fedFunds, tenYear, twoYear, unemployment, cpi] = await Promise.all([
      latest("DFF"), // effective fed funds rate, daily
      latest("DGS10"),
      latest("DGS2"),
      latest("UNRATE"),
      observations("CPIAUCSL", 13), // monthly index -> year-over-year inflation
    ]);
    const inflation =
      cpi.length >= 13 ? { date: cpi[0].date, value: (cpi[0].value / cpi[12].value - 1) * 100 } : null;
    return { fedFunds, tenYear, twoYear, unemployment, inflation };
  },
  ["fred-macro-v1"],
  { revalidate: 12 * 3600 }
);

// Never throws: the backdrop is context, not core data.
export async function getMacroSafe() {
  if (!process.env.FRED_API_KEY) return null;
  try {
    return await getMacro();
  } catch (error) {
    console.warn("FRED macro failed:", error.message);
    return null;
  }
}

// One line for the analyst prompt and the UI.
export function macroText(m) {
  if (!m) return null;
  const pct = (o) => (o ? `${o.value.toFixed(2)}%` : "n/a");
  const curve =
    m.tenYear && m.twoYear ? ` (10y-2y spread ${(m.tenYear.value - m.twoYear.value).toFixed(2)} pts)` : "";
  return (
    `Fed funds rate ${pct(m.fedFunds)}, 10-year Treasury ${pct(m.tenYear)}, 2-year ${pct(m.twoYear)}${curve}, ` +
    `CPI inflation ${m.inflation ? `${m.inflation.value.toFixed(1)}% y/y` : "n/a"}, unemployment ${pct(m.unemployment)}` +
    ` (FRED, latest as of ${m.tenYear?.date ?? m.fedFunds?.date ?? "n/a"})`
  );
}
