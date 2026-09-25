// Same signals as 03, but ranked within each sector (no sector bets).
import base from "./03-quality-value-largecap.mjs";

export default {
  ...base,
  name: "04-quality-value-sector-neutral",
  description: "03 with sector-neutral percentile ranks",
  sectorNeutral: true,
};
