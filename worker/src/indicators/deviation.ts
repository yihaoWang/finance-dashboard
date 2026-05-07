export const deviation = (price: number, ma: number | null): number | null => {
  if (ma === null || ma === 0) return null;
  return ((price - ma) / ma) * 100;
};
