export const ema = (series: number[], period: number): number | null => {
  if (series.length < period) return null;
  const k = 2 / (period + 1);
  let e = series.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < series.length; i++) {
    e = series[i] * k + e * (1 - k);
  }
  return e;
};
