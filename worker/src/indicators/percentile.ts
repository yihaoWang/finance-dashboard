export const percentileRank = (value: number, series: number[]): number | null => {
  if (series.length === 0) return null;
  const lessOrEqual = series.filter((s) => s <= value).length;
  return (lessOrEqual / series.length) * 100;
};
