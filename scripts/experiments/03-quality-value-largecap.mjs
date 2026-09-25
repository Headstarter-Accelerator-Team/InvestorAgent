// Large caps only (>= $10B at the time). Signals chosen from the TRAIN screen:
// profitability, cash-flow and earnings yield, plus 1-month reversal.
import { SIGNALS } from "../backtest-factor-screen.mjs";

export default {
  name: "03-quality-value-largecap",
  description: "Rank blend: ROE 35, FCF yield 25, E/P 20, 1m reversal 20; mcap >= $10B",
  filter: (f) => f.marketCap >= 10e9,
  rank: true,
  factors: {
    roe: SIGNALS.ROE,
    fcfYield: SIGNALS["FCF yield"],
    earningsYield: SIGNALS["earnings yield (E/P)"],
    reversal: SIGNALS["reversal 1m (-ret1m)"],
  },
  weights: { roe: 35, fcfYield: 25, earningsYield: 20, reversal: 20 },
  top: 10,
};
