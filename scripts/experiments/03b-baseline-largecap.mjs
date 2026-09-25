// Reference: the app's shipped balanced weights on the same >= $10B universe.
export default {
  name: "03b-baseline-largecap",
  description: "App balanced weights, mcap >= $10B (fair comparison for 03)",
  filter: (f) => f.marketCap >= 10e9,
  weights: { value: 20, quality: 25, growth: 20, momentum: 10, stability: 10, income: 0, analyst: 15 },
  top: 10,
};
