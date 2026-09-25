// 06 plus a trend filter: only stocks trading above their 200-day average.
import base from "./06-roe-fcf-top20.mjs";

export default {
  ...base,
  name: "07-roe-fcf-trend",
  description: "06 + only buy stocks above their 200-day average",
  filter: (f) => f.marketCap >= 10e9 && f.sma200 && f.price > f.sma200,
};
