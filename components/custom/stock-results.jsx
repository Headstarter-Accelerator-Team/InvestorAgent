"use client";

import { AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { FactorBars, MetricGrid, ScoreDetails } from "./metrics";

const STANCE_STYLES = {
    Buy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    Hold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    Avoid: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function PickCard({ pick, style }) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold bg-blue-100 text-blue-800 py-0.5 px-2 rounded">
                                {pick.ticker}
                            </span>
                            <h3 className="text-lg font-bold">{pick.name}</h3>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {pick.sector} · {pick.industry}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {pick.stance && (
                            <span className={`text-sm font-semibold py-1 px-2 rounded ${STANCE_STYLES[pick.stance] ?? ""}`}>
                                {pick.stance}
                                {pick.stanceSource === "score"
                                    ? " · from score"
                                    : pick.conviction ? ` · ${pick.conviction} conviction` : ""}
                            </span>
                        )}
                        <div className="text-center">
                            <div className="text-2xl font-bold">{pick.score?.composite ?? "n/a"}</div>
                            <div className="text-xs text-gray-500">
                                {pick.score?.model === "classic" ? "classic score" : "backtested score"}
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MetricGrid stock={pick} />
                    {pick.score && <FactorBars score={pick.score} />}
                </div>
                {pick.thesis?.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-sm mb-1">Why</h4>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {pick.thesis.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                    </div>
                )}
                {pick.risks?.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-sm mb-1">Risks</h4>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {pick.risks.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                )}
                {pick.watch && (
                    <p className="text-sm">
                        <span className="font-semibold">What would change this view: </span>{pick.watch}
                    </p>
                )}
                {pick.developments?.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-sm mb-1">Recent developments</h4>
                        <ol className="list-decimal pl-5 text-sm space-y-1">
                            {pick.developments.map((d) => (
                                <li key={d.url}>
                                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                                        {d.title}
                                    </a>
                                    <span className="text-xs text-gray-500">
                                        {" "}· {d.source}{d.publishedAt ? ` · ${new Date(d.publishedAt).toLocaleDateString()}` : ""}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
                {pick.filings?.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-sm mb-1">Latest SEC filings</h4>
                        <ul className="flex flex-wrap gap-2 text-xs">
                            {pick.filings.map((f) => (
                                <li key={f.url}>
                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-block rounded border px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                                        <span className="font-semibold">{f.form}</span> {f.date}{f.about ? ` · ${f.about}` : ""}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {pick.nextEarnings && (
                    <p className="text-xs text-gray-500">Next earnings: {pick.nextEarnings.slice(0, 10)}</p>
                )}
                {pick.score?.inTestedRange === false && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                        Below $10B market cap: outside the range the backtested model was tested on.
                    </p>
                )}
                {pick.dataSource && pick.dataSource !== "Yahoo Finance" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Data: {pick.dataSource}</p>
                )}
                {pick.score && <ScoreDetails score={pick.score} style={style} />}
            </CardContent>
        </Card>
    );
}

export default function StockResults({ advice, error, isLoading, onRetry }) {
    if (isLoading) {
        return (
            <p className="mt-6 text-center text-gray-600 dark:text-gray-400">
                Screening stocks, pulling live data and analysing...
            </p>
        );
    }
    if (error) {
        return (
            <Alert variant="destructive" className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                    <span>{error}</span>
                    {onRetry && (
                        <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
                    )}
                </AlertDescription>
            </Alert>
        );
    }
    if (!advice) return null;

    const picks = advice.picks ?? [];
    const notes = advice.notes ?? [];
    const asOf = picks.find((p) => p.asOf)?.asOf;
    return (
        <div className="mt-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    AI Insights
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {advice.summary && <p className="text-sm">{advice.summary}</p>}
                    {advice.macro && (
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                            <span className="font-semibold">Market backdrop: </span>{advice.macro}
                        </p>
                    )}
                    {advice.portfolioNote && (
                        <p className="text-sm text-gray-700 dark:text-gray-300">{advice.portfolioNote}</p>
                    )}
                    <p className="text-xs text-gray-500">
                        {advice.scoringModel ? `Scoring: ${advice.scoringModel === "classic" ? "Classic" : "Backtested"} model · ` : ""}
                        {advice.intent?.style ? `Style: ${advice.intent.style}` : ""}
                        {advice.intent?.sector ? ` · Sector: ${advice.intent.sector}` : ""}
                        {advice.intent?.theme ? ` · Theme: ${advice.intent.theme}` : ""}
                        {advice.screened ? ` · Screened ${advice.screened} stocks` : ""}
                        {asOf ? ` · Prices as of ${new Date(asOf).toLocaleString()}` : ""}
                    </p>
                    {notes.map((note) => (
                        <Alert key={note}>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{note}</AlertDescription>
                        </Alert>
                    ))}
                </CardContent>
            </Card>
            {picks.map((pick) => (
                <PickCard key={pick.ticker} pick={pick} style={advice.intent?.style} />
            ))}
        </div>
    );
}
