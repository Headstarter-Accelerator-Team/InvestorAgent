// 06 plus low leverage as a third signal.
import { SIGNALS } from "../backtest-factor-screen.mjs";
import base from "./06-roe-fcf-top20.mjs";

export default {
  ...base,
  name: "08-roe-fcf-leverage",
  description: "06 + low debt/equity (ROE 50, FCF yield 35, low leverage 15)",
  factors: { ...base.factors, lowLeverage: SIGNALS["low leverage (-D/E)"] },
  weights: { roe: 50, fcfYield: 35, lowLeverage: 15 },
};
