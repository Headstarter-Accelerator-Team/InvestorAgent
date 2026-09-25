## InvestorAgent

An agent which search stocks for you based on a question and gives relevant article and recommendations on stock prices

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Scoring models

The app has a toggle between two scoring models (remembered per browser):

- **Backtested (default):** profitability (ROE, 60%) + free-cash-flow yield (40%), as percentiles against companies worth $10B+ (`data/backtest-model.json`, built by `scripts/build-model.mjs`). In a point-in-time backtest (2016-2026, SEC filings as filed, quarterly rebalance) its top 20 beat an equal-weight basket of $10B+ companies in 9 of 11 years, including every held-out year 2023-2026, by roughly 1-12% a year. The edge is modest and concentrated at the top of the ranking. Style filters (safe, value, growth) narrow its list but are not part of the backtest.
- **Classic:** the original style-weighted multi-factor score (`lib/score.js`). It showed no predictive edge in the same backtest and is kept as a descriptive view.

Backtest tooling lives in `scripts/backtest*.mjs` and `scripts/experiments/`.

## Environment variables

Set these in `.env.local` for local development and in the Vercel project for deployments.

| Variable | Required | Used for |
|---|---|---|
| `GROQ_API_KEY` | Yes | AI intent parsing and analysis (Groq) |
| `PINECONE_API_KEY` | Yes | Thematic company search (Pinecone `stocks` index) |
| `HF_TOKEN` | Yes | Embeddings for thematic search (Hugging Face) |
| `ALPHA_VAN_API` | No | Per-ticker news with sentiment (Alpha Vantage); falls back to Yahoo headlines |
| `TAVILY_API_KEY` | No | Recent company developments from web search, cited in the analysis |
| `FRED_API_KEY` | No | Macro backdrop: rates, inflation, unemployment (FRED) |
| `SEC_USER_AGENT` | No | Latest SEC filings per stock (EDGAR needs a contact User-Agent, e.g. `Investor Agent you@example.com`) |
| `TWELVE_DATA_API_KEY` | No | Backup price data when Yahoo Finance is unavailable |
| `GROQ_MODEL`, `GROQ_FAST_MODEL` | No | Override the Groq models (defaults `openai/gpt-oss-120b`, `openai/gpt-oss-20b`) |

Optional features switch on automatically when their variable is set.

`node scripts/eval.mjs http://localhost:3000` runs the 15-question grounding check.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
