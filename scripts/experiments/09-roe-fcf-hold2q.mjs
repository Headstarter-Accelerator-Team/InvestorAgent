// 06 rebalanced every 2 quarters (half the trading).
import base from "./06-roe-fcf-top20.mjs";

export default { ...base, name: "09-roe-fcf-hold2q", description: "06, rebalance every 6 months", rebalanceEvery: 2 };
