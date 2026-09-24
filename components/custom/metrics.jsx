import { fmt } from "@/lib/format";

const tone = (v) =>
    v === null || v === undefined ? "" : v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

export function MetricGrid({ stock }) {
    const metrics = [
        ["Price", fmt.money(stock.price)],
        ["Market cap", fmt.big(stock.marketCap)],
        ["Forward P/E", fmt.x(stock.forwardPE)],
        ["Revenue growth", fmt.pct(stock.revenueGrowth), tone(stock.revenueGrowth)],
        ["Net margin", fmt.pctPlain(stock.profitMargin)],
        ["Dividend yield", fmt.pctPlain(stock.dividendYield, 2)],
        ["1y return", fmt.pct(stock.return1y), tone(stock.return1y)],
        ["Beta", fmt.x(stock.beta, 2)],
        ["Analyst target", `${fmt.money(stock.analystTarget)} (${fmt.pct(stock.analystUpside, 0)})`],
    ];
    return (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
            {metrics.map(([label, value, className]) => (
                <div key={label}>
                    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className={`font-semibold ${className ?? ""}`}>{value}</dd>
                </div>
            ))}
        </dl>
    );
}

const barColor = (s) => (s >= 70 ? "bg-green-500" : s >= 50 ? "bg-yellow-500" : "bg-red-500");

export function FactorBars({ score }) {
    return (
        <div className="space-y-1.5">
            {Object.entries(score.factors)
                .filter(([, f]) => f.weight > 0)
                .map(([key, f]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-gray-600 dark:text-gray-300">{f.label}</span>
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded">
                            {f.score !== null && (
                                <div className={`h-2 rounded ${barColor(f.score)}`} style={{ width: `${f.score}%` }} />
                            )}
                        </div>
                        <span className="w-8 text-right font-medium">{f.score ?? "n/a"}</span>
                    </div>
                ))}
        </div>
    );
}

const INPUT_LABELS = {
    forwardPE: ["Forward P/E", fmt.x],
    trailingPE: ["Trailing P/E", fmt.x],
    peg: ["PEG", (v) => fmt.x(v, 2)],
    evToEbitda: ["EV/EBITDA", fmt.x],
    priceToSales: ["P/S", fmt.x],
    roe: ["ROE", fmt.pctPlain],
    operatingMargin: ["Operating margin", fmt.pctPlain],
    profitMargin: ["Net margin", fmt.pctPlain],
    freeCashflow: ["Free cash flow", fmt.big],
    debtToEquity: ["Debt/equity", (v) => (v === null ? "n/a" : `${(v / 100).toFixed(2)}x`)],
    currentRatio: ["Current ratio", (v) => fmt.x(v, 2)],
    revenueGrowth: ["Revenue growth", fmt.pct],
    earningsGrowth: ["Earnings growth", fmt.pct],
    epsGrowthNextYear: ["EPS growth next yr", fmt.pct],
    return6m: ["6m return", fmt.pct],
    return1y: ["1y return", fmt.pct],
    sma200: ["200-day avg", fmt.money],
    pos52: ["Position in 52w range", (v) => fmt.pctPlain(v, 0)],
    beta: ["Beta", (v) => fmt.x(v, 2)],
    volatility1y: ["Volatility", (v) => fmt.pctPlain(v, 0)],
    maxDrawdown1y: ["1y max drawdown", (v) => fmt.pct(v, 0)],
    marketCap: ["Market cap", fmt.big],
    shortPercentFloat: ["Short interest", fmt.pctPlain],
    dividendYield: ["Dividend yield", (v) => fmt.pctPlain(v, 2)],
    payoutRatio: ["Payout ratio", (v) => fmt.pctPlain(v, 0)],
    analystRating: ["Analyst rating (1-5)", (v) => fmt.x(v, 2)],
    analystUpside: ["Target upside", fmt.pct],
    analystCount: ["Analysts", (v) => (v === null ? "n/a" : String(v))],
};

export function ScoreDetails({ score, style }) {
    return (
        <details className="text-xs text-gray-600 dark:text-gray-300">
            <summary className="cursor-pointer font-medium">How this was scored</summary>
            <p className="mt-2">
                Each factor is 0-100 from the inputs below. The composite weights them for the{" "}
                <span className="font-semibold">{style}</span> style.
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.values(score.factors).map((f) => (
                    <div key={f.label}>
                        <p className="font-semibold">
                            {f.label}: {f.score ?? "n/a"} (weight {f.weight}%)
                        </p>
                        <ul>
                            {Object.entries(f.inputs).map(([k, v]) => {
                                const [label, format] = INPUT_LABELS[k] ?? [k, String];
                                return (
                                    <li key={k}>
                                        {label}: {format(v)}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </details>
    );
}
