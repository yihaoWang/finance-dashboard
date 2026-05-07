export const sma = (series: number[], window: number): number | null => {
  if (series.length < window || window <= 0) return null;
  const slice = series.slice(-window);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / window;
};
