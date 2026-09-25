// 06 with ROE treated as unreliable above 100% (tiny or buyback-shrunk equity).
import { SIGNALS } from "../backtest-factor-screen.mjs";
import base from "./06-roe-fcf-top20.mjs";

export default {
  ...base,
  name: "10-roe-capped",
  description: "06 with ROE > 100% treated as missing",
  factors: { ...base.factors, roe: (f) => { const r = SIGNALS.ROE(f); return r !== null && r > 1 ? null : r; } },
};
