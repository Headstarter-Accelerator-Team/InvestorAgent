// Only the two strongest TRAIN signals among large caps: ROE and FCF yield.
import { SIGNALS } from "../backtest-factor-screen.mjs";

export default {
  name: "05-roe-fcf",
  description: "Rank blend ROE 60 + FCF yield 40; mcap >= $10B",
  filter: (f) => f.marketCap >= 10e9,
  rank: true,
  factors: { roe: SIGNALS.ROE, fcfYield: SIGNALS["FCF yield"] },
  weights: { roe: 60, fcfYield: 40 },
  top: 10,
};
